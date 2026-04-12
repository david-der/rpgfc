// Bid ticker — Story 08.
//
// Called inside advanceMatchday. Walks every active (non-terminal) bid
// and advances the state machine based on the current match week:
//
// - Submitted bids that are 1+ weeks old → seller evaluates
// - SellerAccepted bids → player evaluates
// - Bids past their deadline_match_week → expire
// - On any Signed bid → cancel all other bids on the same player

import type { PlayingTimeRole } from "@rpgfc/shared";
import { stanceFor } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";
import {
  evaluatePlayerProposal,
  evaluateSellerProposal,
} from "./evaluators.js";

const BID_DEADLINE_WEEKS = 4;

export interface BidTickResult {
  evaluated: number;
  expired: number;
  signed: number;
}

interface ActiveBidRow {
  id: number;
  player_id: number;
  from_club_id: number;
  to_club_id: number;
  state: string;
  submitted_match_week: number | null;
  deadline_match_week: number | null;
  fee_cents: number;
  wage_cents: number;
  signing_bonus_cents: number;
  role_promise: string;
  asking_price_cents: number | null;
}

async function loadActiveBids(client: DbClient): Promise<ActiveBidRow[]> {
  const sql = `
    SELECT b.id, b.player_id, b.from_club_id, b.to_club_id, b.state,
           b.submitted_match_week, b.deadline_match_week,
           bp.fee_cents, bp.wage_cents, bp.signing_bonus_cents, bp.role_promise,
           l.asking_price_cents
    FROM bids b
    LEFT JOIN bid_proposals bp ON bp.id = b.current_proposal_id
    LEFT JOIN listing l ON l.player_id = b.player_id
    WHERE b.state IN ('Submitted', 'SellerReviewing', 'SellerAccepted', 'PlayerReviewing')
    ORDER BY b.id`;
  if (client.dialect === "sqlite") {
    return client.sqlite.prepare<[], ActiveBidRow>(sql).all();
  }
  const res = await client.pool.query<ActiveBidRow>(sql);
  return res.rows;
}

function updateState(
  client: DbClient,
  bidId: number,
  state: string,
  rejectionReason: string | null,
  stance: string | null,
): void {
  if (client.dialect !== "sqlite") return;
  const now = new Date().toISOString();
  client.sqlite
    .prepare(
      `UPDATE bids SET state = ?,
       rejection_reason = COALESCE(?, rejection_reason),
       stance = COALESCE(?, stance),
       updated_at = ? WHERE id = ?`,
    )
    .run(state, rejectionReason, stance, now, bidId);
}

async function signFromTick(client: DbClient, bid: ActiveBidRow): Promise<void> {
  if (client.dialect !== "sqlite") return;
  const now = new Date().toISOString();
  // Create contract.
  client.sqlite
    .prepare(
      `INSERT INTO contracts
         (player_id, club_id, weekly_wage_cents, signing_bonus_cents,
          seasons_remaining, role_promise, release_clause_cents, is_loan,
          loan_details_json, signed_at)
       VALUES (?, ?, ?, ?, 3, ?, NULL, 0, NULL, ?)`,
    )
    .run(bid.player_id, bid.from_club_id, bid.wage_cents, bid.signing_bonus_cents, bid.role_promise, now);
  // Move player.
  client.sqlite.prepare(`UPDATE players SET club_id = ? WHERE id = ?`).run(bid.from_club_id, bid.player_id);
  // Remove listing.
  client.sqlite.prepare(`DELETE FROM listing WHERE player_id = ?`).run(bid.player_id);
  // Update squad.
  client.sqlite
    .prepare(
      `INSERT INTO squad_entries (club_id, player_id, role, updated_at)
       VALUES (?, ?, 'Rotation', ?)
       ON CONFLICT(player_id) DO UPDATE SET club_id = ?, role = 'Rotation', updated_at = ?`,
    )
    .run(bid.from_club_id, bid.player_id, now, bid.from_club_id, now);
  // Transfer cash.
  client.sqlite
    .prepare(`UPDATE club_identity_ext SET cash_reserve_cents = cash_reserve_cents - ? WHERE club_id = ?`)
    .run(bid.fee_cents, bid.from_club_id);
  client.sqlite
    .prepare(`UPDATE club_identity_ext SET cash_reserve_cents = cash_reserve_cents + ? WHERE club_id = ?`)
    .run(bid.fee_cents, bid.to_club_id);
  // Cancel competing bids.
  client.sqlite
    .prepare(
      `UPDATE bids SET state = 'Cancelled', updated_at = ?
       WHERE player_id = ? AND id != ?
       AND state NOT IN ('Signed', 'SellerRejected', 'PlayerRejected', 'Expired', 'Cancelled')`,
    )
    .run(now, bid.player_id, bid.id);
}

export async function tickBids(
  client: DbClient,
  currentMatchWeek: number,
): Promise<BidTickResult> {
  const bids = await loadActiveBids(client);
  let evaluated = 0;
  let expired = 0;
  let signed = 0;

  for (const bid of bids) {
    const deadline = bid.deadline_match_week ?? (bid.submitted_match_week ?? 0) + BID_DEADLINE_WEEKS;

    // Expire past-deadline bids.
    if (currentMatchWeek > deadline) {
      updateState(client, bid.id, "Expired", null, null);
      expired++;
      continue;
    }

    const submittedWeek = bid.submitted_match_week ?? 0;

    // Seller evaluates after 1 week.
    if (
      (bid.state === "Submitted" || bid.state === "SellerReviewing") &&
      currentMatchWeek >= submittedWeek + 1
    ) {
      const askingCents = bid.asking_price_cents ?? bid.fee_cents;

      // Load buyer budget for affordability check.
      let buyerCash = 0;
      let buyerWageBudget = 0;
      let buyerCurrentWage = 0;
      if (client.dialect === "sqlite") {
        const budget = client.sqlite
          .prepare<[number], { cash_reserve_cents: number; wage_budget_cents_per_week: number }>(
            `SELECT cash_reserve_cents, wage_budget_cents_per_week
             FROM club_identity_ext WHERE club_id = ?`,
          )
          .get(bid.from_club_id);
        buyerCash = budget?.cash_reserve_cents ?? 0;
        buyerWageBudget = budget?.wage_budget_cents_per_week ?? 0;
        const wageRow = client.sqlite
          .prepare<[number], { total: number | null }>(
            `SELECT SUM(weekly_wage_cents) AS total FROM contracts WHERE club_id = ?`,
          )
          .get(bid.from_club_id);
        buyerCurrentWage = Number(wageRow?.total ?? 0);
      }

      const sellerResult = evaluateSellerProposal({
        feeCents: bid.fee_cents,
        wageCents: bid.wage_cents,
        askingCents,
        buyerCashReserveCents: buyerCash,
        buyerWageBudgetCentsPerWeek: buyerWageBudget,
        buyerCurrentWageOutCents: buyerCurrentWage,
      });

      const stance = stanceFor(bid.fee_cents, askingCents);

      if (sellerResult.kind === "reject") {
        updateState(client, bid.id, "SellerRejected", sellerResult.reason, stance);
      } else if (sellerResult.kind === "counter") {
        updateState(client, bid.id, "SellerCountered", null, stance);
      } else {
        updateState(client, bid.id, "SellerAccepted", null, stance);
      }
      evaluated++;
      continue;
    }

    // Player evaluates after seller accepts.
    if (bid.state === "SellerAccepted" || bid.state === "PlayerReviewing") {
      let prefs: { wageFloorCents: number; minPlayingTime: string; preferredRegions: string[]; forbiddenClubIds: number[] } | null = null;
      let buyerNationality = "";

      if (client.dialect === "sqlite") {
        const prefRow = client.sqlite
          .prepare<[number], { wage_floor_cents: number; min_playing_time: string; preferred_regions_json: string; forbidden_club_ids_json: string }>(
            `SELECT wage_floor_cents, min_playing_time, preferred_regions_json, forbidden_club_ids_json
             FROM player_preferences WHERE player_id = ?`,
          )
          .get(bid.player_id);
        if (prefRow) {
          prefs = {
            wageFloorCents: prefRow.wage_floor_cents,
            minPlayingTime: prefRow.min_playing_time,
            preferredRegions: JSON.parse(prefRow.preferred_regions_json),
            forbiddenClubIds: JSON.parse(prefRow.forbidden_club_ids_json),
          };
        }
        const clubRow = client.sqlite
          .prepare<[number], { nationality: string }>(`SELECT nationality FROM clubs WHERE id = ?`)
          .get(bid.from_club_id);
        buyerNationality = clubRow?.nationality ?? "";
      }

      if (prefs) {
        const playerResult = evaluatePlayerProposal({
          wageCents: bid.wage_cents,
          rolePromise: bid.role_promise as PlayingTimeRole,
          toClubId: bid.from_club_id,
          toClubNationality: buyerNationality,
          preferences: {
            wageFloorCents: prefs.wageFloorCents,
            minPlayingTime: prefs.minPlayingTime as PlayingTimeRole,
            preferredRegions: prefs.preferredRegions,
            forbiddenClubIds: prefs.forbiddenClubIds,
          },
        });
        if (playerResult.kind === "accept") {
          updateState(client, bid.id, "Signed", null, null);
          await signFromTick(client, bid);
          signed++;
        } else {
          updateState(client, bid.id, "PlayerRejected", playerResult.reason, null);
        }
      } else {
        // No preferences = auto-accept.
        updateState(client, bid.id, "Signed", null, null);
        await signFromTick(client, bid);
        signed++;
      }
      evaluated++;
    }
  }

  return { evaluated, expired, signed };
}
