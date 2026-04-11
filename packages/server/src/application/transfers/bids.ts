// Bid state machine + persistence — Story 04.
//
// One bid per negotiation. The state progression is:
//
//   Draft → Submitted → SellerReviewing
//                         ├─ SellerRejected        (terminal)
//                         ├─ SellerCountered       ← buyer can re-propose
//                         └─ SellerAccepted → PlayerReviewing
//                                               ├─ PlayerRejected (terminal)
//                                               └─ PlayerAccepted → Signed
//                                                                    (terminal)
//
// Each state change is accompanied by a new bid_proposals row when the
// terms move (buyer submissions and seller counters both write rows;
// seller acceptance / rejection and player decisions do not).
//
// Story 04 does NOT wire any transfer-window gating. Every listed player
// is always available. Story 07 introduces windows around this state
// machine.

import type { BidRef, BidState, LoanTerms, PlayingTimeRole, RejectionReason } from "@rpgfc/shared";
import { stanceFor } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";
import {
  REJECTION_PROSE,
  evaluatePlayerProposal,
  evaluateSellerProposal,
  type PlayerEvalInput,
} from "./evaluators.js";

// ── types ─────────────────────────────────────────────────────────────────

export interface SubmitBidInput {
  playerId: number;
  fromClubId: number; // the user's buying club
  feeCents: number;
  wageCents: number;
  signingBonusCents: number;
  rolePromise: PlayingTimeRole;
  loanOffer?: LoanTerms | null;
  now?: Date;
}

// ── DB row shapes ─────────────────────────────────────────────────────────

interface BidRow {
  id: number;
  player_id: number;
  from_club_id: number;
  to_club_id: number;
  state: string;
  current_proposal_id: number | null;
  stance: string;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface BidProposalRow {
  id: number;
  bid_id: number;
  author_kind: string;
  fee_cents: number;
  wage_cents: number;
  signing_bonus_cents: number;
  role_promise: string;
  loan_details_json: string | null;
  created_at: string;
}

interface ListingRow {
  player_id: number;
  asking_price_cents: number;
  reason: string;
}

interface PlayerRow {
  id: number;
  club_id: number | null;
  nationality: string;
}

interface ClubBudgetRow {
  club_id: number;
  nationality: string;
  cash_reserve_cents: number;
  wage_budget_cents_per_week: number;
}

// ── loaders ───────────────────────────────────────────────────────────────

async function loadBid(client: DbClient, id: number): Promise<BidRow | null> {
  if (client.dialect === "sqlite") {
    return (
      client.sqlite
        .prepare<[number], BidRow>(
          `SELECT id, player_id, from_club_id, to_club_id, state,
                  current_proposal_id, stance, rejection_reason,
                  created_at, updated_at
           FROM bids WHERE id = ?`,
        )
        .get(id) ?? null
    );
  }
  const res = await client.pool.query<BidRow>(
    `SELECT id, player_id, from_club_id, to_club_id, state,
            current_proposal_id, stance, rejection_reason,
            created_at, updated_at
     FROM bids WHERE id = $1`,
    [id],
  );
  return res.rows[0] ?? null;
}

async function loadProposal(client: DbClient, id: number): Promise<BidProposalRow | null> {
  if (client.dialect === "sqlite") {
    return (
      client.sqlite
        .prepare<[number], BidProposalRow>(
          `SELECT id, bid_id, author_kind, fee_cents, wage_cents,
                  signing_bonus_cents, role_promise, loan_details_json, created_at
           FROM bid_proposals WHERE id = ?`,
        )
        .get(id) ?? null
    );
  }
  const res = await client.pool.query<BidProposalRow>(
    `SELECT id, bid_id, author_kind, fee_cents, wage_cents,
            signing_bonus_cents, role_promise, loan_details_json, created_at
     FROM bid_proposals WHERE id = $1`,
    [id],
  );
  return res.rows[0] ?? null;
}

async function loadListing(client: DbClient, playerId: number): Promise<ListingRow | null> {
  if (client.dialect === "sqlite") {
    return (
      client.sqlite
        .prepare<
          [number],
          ListingRow
        >(`SELECT player_id, asking_price_cents, reason FROM listing WHERE player_id = ?`)
        .get(playerId) ?? null
    );
  }
  const res = await client.pool.query<ListingRow>(
    `SELECT player_id, asking_price_cents, reason FROM listing WHERE player_id = $1`,
    [playerId],
  );
  return res.rows[0] ?? null;
}

async function loadPlayer(client: DbClient, id: number): Promise<PlayerRow | null> {
  if (client.dialect === "sqlite") {
    return (
      client.sqlite
        .prepare<[number], PlayerRow>(`SELECT id, club_id, nationality FROM players WHERE id = ?`)
        .get(id) ?? null
    );
  }
  const res = await client.pool.query<PlayerRow>(
    `SELECT id, club_id, nationality FROM players WHERE id = $1`,
    [id],
  );
  return res.rows[0] ?? null;
}

async function loadClubBudget(client: DbClient, clubId: number): Promise<ClubBudgetRow | null> {
  if (client.dialect === "sqlite") {
    return (
      client.sqlite
        .prepare<[number], ClubBudgetRow>(
          `SELECT c.id AS club_id, c.nationality,
                  ie.cash_reserve_cents, ie.wage_budget_cents_per_week
           FROM clubs c
           LEFT JOIN club_identity_ext ie ON ie.club_id = c.id
           WHERE c.id = ?`,
        )
        .get(clubId) ?? null
    );
  }
  const res = await client.pool.query<ClubBudgetRow>(
    `SELECT c.id AS club_id, c.nationality,
            ie.cash_reserve_cents, ie.wage_budget_cents_per_week
     FROM clubs c
     LEFT JOIN club_identity_ext ie ON ie.club_id = c.id
     WHERE c.id = $1`,
    [clubId],
  );
  return res.rows[0] ?? null;
}

async function loadCurrentWageOut(client: DbClient, clubId: number): Promise<number> {
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<
        [number],
        { total: number | null }
      >(`SELECT SUM(weekly_wage_cents) AS total FROM contracts WHERE club_id = ?`)
      .get(clubId);
    return Number(row?.total ?? 0);
  }
  const res = await client.pool.query<{ total: string | null }>(
    `SELECT SUM(weekly_wage_cents)::text AS total FROM contracts WHERE club_id = $1`,
    [clubId],
  );
  return Number(res.rows[0]?.total ?? 0);
}

interface PreferencesRow {
  wage_floor_cents: number;
  min_playing_time: string;
  preferred_regions_json: string;
  forbidden_club_ids_json: string;
}

async function loadPreferences(client: DbClient, playerId: number): Promise<PreferencesRow | null> {
  if (client.dialect === "sqlite") {
    return (
      client.sqlite
        .prepare<[number], PreferencesRow>(
          `SELECT wage_floor_cents, min_playing_time,
                  preferred_regions_json, forbidden_club_ids_json
           FROM player_preferences WHERE player_id = ?`,
        )
        .get(playerId) ?? null
    );
  }
  const res = await client.pool.query<PreferencesRow>(
    `SELECT wage_floor_cents, min_playing_time,
            preferred_regions_json, forbidden_club_ids_json
     FROM player_preferences WHERE player_id = $1`,
    [playerId],
  );
  return res.rows[0] ?? null;
}

// ── row → ref conversion ──────────────────────────────────────────────────

function rowToBidRef(bid: BidRow, proposal: BidProposalRow): BidRef {
  return {
    id: bid.id,
    playerId: bid.player_id,
    fromClubId: bid.from_club_id,
    toClubId: bid.to_club_id,
    state: bid.state as BidState,
    currentProposal: {
      id: proposal.id,
      bidId: proposal.bid_id,
      authorKind: proposal.author_kind as "buyer" | "seller",
      feeCents: proposal.fee_cents,
      wageCents: proposal.wage_cents,
      signingBonusCents: proposal.signing_bonus_cents,
      rolePromise: proposal.role_promise as PlayingTimeRole,
      loanOffer: proposal.loan_details_json
        ? (JSON.parse(proposal.loan_details_json) as LoanTerms)
        : null,
      createdAt: proposal.created_at,
    },
    stance: bid.stance as BidRef["stance"],
    rejectionReasonCode: (bid.rejection_reason as RejectionReason | null) ?? null,
    createdAt: bid.created_at,
    updatedAt: bid.updated_at,
  };
}

// ── helpers ────────────────────────────────────────────────────────────────

async function insertBid(
  client: DbClient,
  row: {
    playerId: number;
    fromClubId: number;
    toClubId: number;
    state: BidState;
    stance: BidRef["stance"];
    now: string;
  },
): Promise<number> {
  if (client.dialect === "sqlite") {
    const result = client.sqlite
      .prepare(
        `INSERT INTO bids
           (player_id, from_club_id, to_club_id, state, stance,
            rejection_reason, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      )
      .run(row.playerId, row.fromClubId, row.toClubId, row.state, row.stance, row.now, row.now);
    return Number(result.lastInsertRowid);
  }
  const res = await client.pool.query<{ id: number }>(
    `INSERT INTO bids
       (player_id, from_club_id, to_club_id, state, stance,
        rejection_reason, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NULL, $6, $7)
     RETURNING id`,
    [row.playerId, row.fromClubId, row.toClubId, row.state, row.stance, row.now, row.now],
  );
  return res.rows[0]!.id;
}

async function insertProposal(
  client: DbClient,
  row: {
    bidId: number;
    authorKind: "buyer" | "seller";
    feeCents: number;
    wageCents: number;
    signingBonusCents: number;
    rolePromise: PlayingTimeRole;
    loanOffer: LoanTerms | null;
    now: string;
  },
): Promise<number> {
  const loanJson = row.loanOffer ? JSON.stringify(row.loanOffer) : null;
  if (client.dialect === "sqlite") {
    const result = client.sqlite
      .prepare(
        `INSERT INTO bid_proposals
           (bid_id, author_kind, fee_cents, wage_cents, signing_bonus_cents,
            role_promise, loan_details_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.bidId,
        row.authorKind,
        row.feeCents,
        row.wageCents,
        row.signingBonusCents,
        row.rolePromise,
        loanJson,
        row.now,
      );
    return Number(result.lastInsertRowid);
  }
  const res = await client.pool.query<{ id: number }>(
    `INSERT INTO bid_proposals
       (bid_id, author_kind, fee_cents, wage_cents, signing_bonus_cents,
        role_promise, loan_details_json, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      row.bidId,
      row.authorKind,
      row.feeCents,
      row.wageCents,
      row.signingBonusCents,
      row.rolePromise,
      loanJson,
      row.now,
    ],
  );
  return res.rows[0]!.id;
}

async function updateBid(
  client: DbClient,
  id: number,
  patch: {
    state?: BidState;
    current_proposal_id?: number;
    stance?: BidRef["stance"];
    rejection_reason?: RejectionReason | null;
    updated_at: string;
  },
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.state !== undefined) {
    sets.push("state = ?");
    values.push(patch.state);
  }
  if (patch.current_proposal_id !== undefined) {
    sets.push("current_proposal_id = ?");
    values.push(patch.current_proposal_id);
  }
  if (patch.stance !== undefined) {
    sets.push("stance = ?");
    values.push(patch.stance);
  }
  if (patch.rejection_reason !== undefined) {
    sets.push("rejection_reason = ?");
    values.push(patch.rejection_reason);
  }
  sets.push("updated_at = ?");
  values.push(patch.updated_at);
  values.push(id);

  if (client.dialect === "sqlite") {
    const sql = `UPDATE bids SET ${sets.join(", ")} WHERE id = ?`;
    client.sqlite.prepare(sql).run(...(values as unknown[] as never[]));
    return;
  }
  // Postgres: convert ? placeholders to $n
  let paramIndex = 0;
  const sql = `UPDATE bids SET ${sets
    .map((s) => s.replace("?", () => `$${++paramIndex}`))
    .join(", ")} WHERE id = $${++paramIndex}`;
  await client.pool.query(sql, values);
}

// ── submit ────────────────────────────────────────────────────────────────

export async function submitBid(client: DbClient, input: SubmitBidInput): Promise<BidRef> {
  const now = (input.now ?? new Date()).toISOString();

  const listing = await loadListing(client, input.playerId);
  if (!listing) throw new Error("Player is not listed for transfer");
  const player = await loadPlayer(client, input.playerId);
  if (!player || player.club_id === null) {
    throw new Error("Player has no current club");
  }

  const buyerBudget = await loadClubBudget(client, input.fromClubId);
  if (!buyerBudget) throw new Error("Buying club not found");
  const buyerCurrentWage = await loadCurrentWageOut(client, input.fromClubId);

  const sellerResult = evaluateSellerProposal({
    feeCents: input.feeCents,
    wageCents: input.wageCents,
    askingCents: listing.asking_price_cents,
    buyerCashReserveCents: buyerBudget.cash_reserve_cents,
    buyerWageBudgetCentsPerWeek: buyerBudget.wage_budget_cents_per_week,
    buyerCurrentWageOutCents: buyerCurrentWage,
  });

  const stance = stanceFor(input.feeCents, listing.asking_price_cents);

  // Every submit starts with a SellerReviewing state so the evaluator's
  // result can be baked into the same row update in one transaction.
  const bidId = await insertBid(client, {
    playerId: input.playerId,
    fromClubId: input.fromClubId,
    toClubId: player.club_id,
    state: "SellerReviewing",
    stance,
    now,
  });
  const proposalId = await insertProposal(client, {
    bidId,
    authorKind: "buyer",
    feeCents: input.feeCents,
    wageCents: input.wageCents,
    signingBonusCents: input.signingBonusCents,
    rolePromise: input.rolePromise,
    loanOffer: input.loanOffer ?? null,
    now,
  });
  await updateBid(client, bidId, {
    current_proposal_id: proposalId,
    updated_at: now,
  });

  // Apply the seller decision immediately.
  if (sellerResult.kind === "reject") {
    await updateBid(client, bidId, {
      state: "SellerRejected",
      rejection_reason: sellerResult.reason,
      updated_at: now,
    });
  } else if (sellerResult.kind === "counter") {
    // Write the seller's counter-proposal row and point the bid at it.
    const counterProposalId = await insertProposal(client, {
      bidId,
      authorKind: "seller",
      feeCents: sellerResult.counterFeeCents,
      wageCents: input.wageCents,
      signingBonusCents: input.signingBonusCents,
      rolePromise: input.rolePromise,
      loanOffer: input.loanOffer ?? null,
      now,
    });
    await updateBid(client, bidId, {
      state: "SellerCountered",
      current_proposal_id: counterProposalId,
      stance: stanceFor(sellerResult.counterFeeCents, listing.asking_price_cents),
      updated_at: now,
    });
  } else {
    // Seller accepted — run the player evaluator next.
    await updateBid(client, bidId, {
      state: "SellerAccepted",
      updated_at: now,
    });

    const playerResult = await evaluateAgainstPlayer(client, {
      playerId: input.playerId,
      toClubId: input.fromClubId,
      toClubNationality: buyerBudget.nationality,
      wageCents: input.wageCents,
      rolePromise: input.rolePromise,
    });

    if (playerResult.kind === "accept") {
      await signBid(client, bidId, now);
    } else {
      await updateBid(client, bidId, {
        state: "PlayerRejected",
        rejection_reason: playerResult.reason,
        updated_at: now,
      });
    }
  }

  return (await getBidById(client, bidId))!;
}

// ── player evaluator bridge (loads preferences + player row) ──────────────

async function evaluateAgainstPlayer(
  client: DbClient,
  input: {
    playerId: number;
    toClubId: number;
    toClubNationality: string;
    wageCents: number;
    rolePromise: PlayingTimeRole;
  },
) {
  const prefs = await loadPreferences(client, input.playerId);
  if (!prefs) {
    // No preferences row → treat as "happy enough" for Story 04.
    return { kind: "accept" as const };
  }
  const playerEvalInput: PlayerEvalInput = {
    wageCents: input.wageCents,
    rolePromise: input.rolePromise,
    toClubId: input.toClubId,
    toClubNationality: input.toClubNationality,
    preferences: {
      wageFloorCents: prefs.wage_floor_cents,
      minPlayingTime: prefs.min_playing_time as PlayingTimeRole,
      preferredRegions: JSON.parse(prefs.preferred_regions_json) as string[],
      forbiddenClubIds: JSON.parse(prefs.forbidden_club_ids_json) as number[],
    },
  };
  return evaluatePlayerProposal(playerEvalInput);
}

// ── sign: create contract + move player + delete listing ─────────────────

async function signBid(client: DbClient, bidId: number, now: string): Promise<void> {
  const bid = await loadBid(client, bidId);
  if (!bid || bid.current_proposal_id === null) return;
  const proposal = await loadProposal(client, bid.current_proposal_id);
  if (!proposal) return;

  const isLoan = proposal.loan_details_json !== null && proposal.loan_details_json !== "";

  // Upsert the contract. Story 04 treats contracts as one-per-player
  // (unique index on player_id) — update-or-insert.
  if (client.dialect === "sqlite") {
    // Delete existing contract first to avoid the unique-index collision.
    client.sqlite.prepare(`DELETE FROM contracts WHERE player_id = ?`).run(bid.player_id);
    client.sqlite
      .prepare(
        `INSERT INTO contracts
           (player_id, club_id, weekly_wage_cents, signing_bonus_cents,
            seasons_remaining, role_promise, release_clause_cents,
            is_loan, loan_details_json, signed_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      )
      .run(
        bid.player_id,
        // Loans keep ownership with the seller; permanents move it.
        isLoan ? bid.to_club_id : bid.from_club_id,
        proposal.wage_cents,
        proposal.signing_bonus_cents,
        3, // default 3-season length for Story 04; Story 05 makes it a prop
        proposal.role_promise,
        isLoan ? 1 : 0,
        proposal.loan_details_json,
        now,
      );

    // Move the player if it's a permanent transfer.
    if (!isLoan) {
      client.sqlite
        .prepare(`UPDATE players SET club_id = ? WHERE id = ?`)
        .run(bid.from_club_id, bid.player_id);
      // And remove the listing — the player is no longer on the market.
      client.sqlite.prepare(`DELETE FROM listing WHERE player_id = ?`).run(bid.player_id);
    }
  } else {
    await client.pool.query(`DELETE FROM contracts WHERE player_id = $1`, [bid.player_id]);
    await client.pool.query(
      `INSERT INTO contracts
         (player_id, club_id, weekly_wage_cents, signing_bonus_cents,
          seasons_remaining, role_promise, release_clause_cents,
          is_loan, loan_details_json, signed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9)`,
      [
        bid.player_id,
        isLoan ? bid.to_club_id : bid.from_club_id,
        proposal.wage_cents,
        proposal.signing_bonus_cents,
        3,
        proposal.role_promise,
        isLoan ? 1 : 0,
        proposal.loan_details_json,
        now,
      ],
    );
    if (!isLoan) {
      await client.pool.query(`UPDATE players SET club_id = $1 WHERE id = $2`, [
        bid.from_club_id,
        bid.player_id,
      ]);
      await client.pool.query(`DELETE FROM listing WHERE player_id = $1`, [bid.player_id]);
    }
  }

  await updateBid(client, bidId, {
    state: "Signed",
    updated_at: now,
  });
}

// ── query helpers (rendering layer uses these) ────────────────────────────

export async function getBidById(client: DbClient, id: number): Promise<BidRef | null> {
  const bid = await loadBid(client, id);
  if (!bid || bid.current_proposal_id === null) return null;
  const proposal = await loadProposal(client, bid.current_proposal_id);
  if (!proposal) return null;
  return rowToBidRef(bid, proposal);
}

export async function listBidsForClub(client: DbClient, fromClubId: number): Promise<BidRef[]> {
  let bids: BidRow[];
  if (client.dialect === "sqlite") {
    bids = client.sqlite
      .prepare<[number], BidRow>(
        `SELECT id, player_id, from_club_id, to_club_id, state,
                current_proposal_id, stance, rejection_reason,
                created_at, updated_at
         FROM bids WHERE from_club_id = ?
         ORDER BY updated_at DESC`,
      )
      .all(fromClubId);
  } else {
    const res = await client.pool.query<BidRow>(
      `SELECT id, player_id, from_club_id, to_club_id, state,
              current_proposal_id, stance, rejection_reason,
              created_at, updated_at
       FROM bids WHERE from_club_id = $1
       ORDER BY updated_at DESC`,
      [fromClubId],
    );
    bids = res.rows;
  }
  const out: BidRef[] = [];
  for (const bid of bids) {
    if (bid.current_proposal_id === null) continue;
    const proposal = await loadProposal(client, bid.current_proposal_id);
    if (!proposal) continue;
    out.push(rowToBidRef(bid, proposal));
  }
  return out;
}

export async function forceAcceptBid(
  client: DbClient,
  bidId: number,
  now: Date = new Date(),
): Promise<BidRef | null> {
  const nowIso = now.toISOString();
  await updateBid(client, bidId, { state: "SellerAccepted", updated_at: nowIso });
  await signBid(client, bidId, nowIso);
  return getBidById(client, bidId);
}

// Re-export prose so the rendering layer can label rejection reasons.
export { REJECTION_PROSE };
