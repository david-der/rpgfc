// Transfers rendering orchestration — Story 04.
//
// Route files import from this module (and only this module). The
// `no-hidden-in-routes` ESLint rule blocks routes from importing the
// application/transfers/** modules directly.
//
// The rendering layer is the single place where cents become tier
// words. `RenderedContract` / `RenderedBid` / `RenderedListing` all
// strip raw cents before the values cross the wire.

import type {
  BidState,
  Contract,
  CurrencyTier,
  LoanTerms,
  RenderedBid,
  RenderedBidProposal,
  RenderedContract,
  RenderedListing,
  PlayingTimeRole,
} from "@rpgfc/shared";
import { feeTierFor, wageTierFor } from "@rpgfc/shared";

import {
  forceAcceptBid,
  getBidById,
  listBidsForClub,
  submitBid,
  REJECTION_PROSE,
  type SubmitBidInput,
} from "../application/transfers/bids.js";
import type { DbClient } from "../db/client.js";

import { loadFullClubMap } from "./club.js";

// ── contract renderer ─────────────────────────────────────────────────────

function renderContract(
  contract: Contract,
  clubs: Map<number, { id: number; name: string }>,
): RenderedContract {
  const club = clubs.get(contract.clubId) ?? {
    id: contract.clubId,
    name: "Unknown",
  };
  const hasRelease = contract.releaseClauseCents !== null;
  return {
    id: contract.id,
    playerId: contract.playerId,
    club: { id: club.id, name: club.name },
    wageTier: wageTierFor(contract.weeklyWageCents),
    signingBonusTier: feeTierFor(contract.signingBonusCents),
    seasonsRemaining: contract.seasonsRemaining,
    rolePromise: contract.rolePromise,
    hasReleaseClause: hasRelease,
    releaseClauseTier: hasRelease ? feeTierFor(contract.releaseClauseCents ?? 0) : null,
    isLoan: contract.isLoan,
    loanWageCoverageLabel: contract.loanDetails
      ? `${Math.round((contract.loanDetails.wageCoveragePct ?? 0) * 100)}% covered`
      : null,
    loanEndsAt: contract.loanDetails?.endsAt ?? null,
    signedAt: contract.signedAt,
  };
}

function renderProposal(p: {
  id: number;
  authorKind: "buyer" | "seller";
  feeCents: number;
  wageCents: number;
  signingBonusCents: number;
  rolePromise: PlayingTimeRole;
  loanOffer: LoanTerms | null;
  createdAt: string;
}): RenderedBidProposal {
  return {
    id: p.id,
    authorKind: p.authorKind,
    feeTier: feeTierFor(p.feeCents),
    wageTier: wageTierFor(p.wageCents),
    signingBonusTier: feeTierFor(p.signingBonusCents),
    rolePromise: p.rolePromise,
    isLoan: p.loanOffer !== null,
    createdAt: p.createdAt,
  };
}

// Server-internal BidRef carries raw cents inside currentProposal; we
// translate in place here.
function renderBid(bid: {
  id: number;
  playerId: number;
  fromClubId: number;
  toClubId: number;
  state: BidState;
  stance: RenderedBid["stance"];
  rejectionReasonCode: RenderedBid["rejectionReason"];
  currentProposal: {
    id: number;
    authorKind: "buyer" | "seller";
    feeCents: number;
    wageCents: number;
    signingBonusCents: number;
    rolePromise: PlayingTimeRole;
    loanOffer: LoanTerms | null;
    createdAt: string;
  };
  createdAt: string;
  updatedAt: string;
}): RenderedBid {
  return {
    id: bid.id,
    playerId: bid.playerId,
    fromClubId: bid.fromClubId,
    toClubId: bid.toClubId,
    state: bid.state,
    stance: bid.stance,
    rejectionReason: bid.rejectionReasonCode,
    rejectionReasonLabel: bid.rejectionReasonCode ? REJECTION_PROSE[bid.rejectionReasonCode] : null,
    currentProposal: renderProposal(bid.currentProposal),
    createdAt: bid.createdAt,
    updatedAt: bid.updatedAt,
  };
}

// ── listings orchestrator ────────────────────────────────────────────────

interface ListingRow {
  player_id: number;
  asking_price_cents: number;
  reason: string;
  player_name: string;
  nationality: string;
  archetype_id: string;
  experience_years: number;
  dob: string;
  club_id: number;
}

async function loadListingRows(db: DbClient): Promise<ListingRow[]> {
  if (db.dialect === "sqlite") {
    return db.sqlite
      .prepare<[], ListingRow>(
        `SELECT l.player_id, l.asking_price_cents, l.reason,
                p.name AS player_name, p.nationality, p.archetype_id,
                p.experience_years, p.dob, p.club_id
         FROM listing l
         JOIN players p ON p.id = l.player_id`,
      )
      .all();
  }
  const res = await db.pool.query<ListingRow>(
    `SELECT l.player_id, l.asking_price_cents, l.reason,
            p.name AS player_name, p.nationality, p.archetype_id,
            p.experience_years, p.dob, p.club_id
     FROM listing l
     JOIN players p ON p.id = l.player_id`,
  );
  return res.rows;
}

function ageFromDob(dob: string, now: Date): number {
  const birth = new Date(dob + "T00:00:00Z");
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

async function loadLatestBidStateByPlayer(
  db: DbClient,
  fromClubId: number,
): Promise<Map<number, BidState>> {
  const out = new Map<number, BidState>();
  if (db.dialect === "sqlite") {
    const rows = db.sqlite
      .prepare<[number], { player_id: number; state: string }>(
        `SELECT player_id, state FROM bids
         WHERE from_club_id = ?
         ORDER BY updated_at DESC`,
      )
      .all(fromClubId);
    for (const row of rows) {
      if (!out.has(row.player_id)) {
        out.set(row.player_id, row.state as BidState);
      }
    }
    return out;
  }
  const res = await db.pool.query<{ player_id: number; state: string }>(
    `SELECT player_id, state FROM bids
     WHERE from_club_id = $1
     ORDER BY updated_at DESC`,
    [fromClubId],
  );
  for (const row of res.rows) {
    if (!out.has(row.player_id)) {
      out.set(row.player_id, row.state as BidState);
    }
  }
  return out;
}

export interface TransfersPage {
  listings: RenderedListing[];
  pending: RenderedBid[];
}

export interface TransfersDeps {
  now: () => Date;
  /** The user's buying club id. Story 04 hardcodes it to 1 until Story
   *  09 adds real user auth. */
  userClubId: number;
}

export async function renderTransfersPage(
  db: DbClient,
  deps: TransfersDeps,
): Promise<TransfersPage> {
  const clubs = await loadFullClubMap(db);
  const listingRows = await loadListingRows(db);
  const latestStateByPlayer = await loadLatestBidStateByPlayer(db, deps.userClubId);
  const now = deps.now();

  const listings: RenderedListing[] = listingRows.map((row) => {
    const clubRef = clubs.get(row.club_id);
    const club = clubRef
      ? { id: clubRef.id, name: clubRef.name }
      : { id: row.club_id, name: "Unknown" };
    const archetype = row.archetype_id;
    return {
      playerId: row.player_id,
      playerName: row.player_name,
      positionLabel: positionLabelFromArchetype(archetype),
      nationality: row.nationality,
      age: ageFromDob(row.dob, now),
      club,
      askingTier: feeTierFor(row.asking_price_cents),
      reason: row.reason as RenderedListing["reason"],
      currentBidState: latestStateByPlayer.get(row.player_id) ?? null,
    };
  });

  // Sort: listings with an in-flight bid first, then by ascending player id
  // so the page order is stable across reloads.
  listings.sort((a, b) => {
    const aActive = a.currentBidState ? 0 : 1;
    const bActive = b.currentBidState ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return a.playerId - b.playerId;
  });

  // Pending bids for the user's club — everything non-terminal.
  const bids = await listBidsForClub(db, deps.userClubId);
  const pendingStates: BidState[] = [
    "Draft",
    "Submitted",
    "SellerReviewing",
    "SellerCountered",
    "SellerAccepted",
    "PlayerReviewing",
  ];
  const pending = bids.filter((b) => pendingStates.includes(b.state)).map((b) => renderBid(b));

  return { listings, pending };
}

function positionLabelFromArchetype(archetypeId: string): string {
  // We keep a small lookup here so the rendering layer doesn't need to
  // reach into @rpgfc/shared's archetype library just for this; the
  // full library is still the authoritative source, this is a display
  // fallback.
  switch (archetypeId) {
    case "pressing_forward":
    case "target_man":
    case "classic_nine":
      return "ST";
    case "creative_ten":
      return "AM";
    case "destroyer":
    case "box_to_box":
      return "CM";
    case "inverted_winger_arch":
      return "LW";
    case "flying_fullback":
      return "FB";
    case "ball_playing_cb":
    case "stopper_cb":
      return "CB";
    case "sweeper_keeper":
    case "shot_stopper":
      return "GK";
    default:
      return "??";
  }
}

// ── bid endpoints ─────────────────────────────────────────────────────────

export interface RenderedBidDetail {
  bid: RenderedBid;
  askingTier: CurrencyTier;
}

export async function submitBidRendered(db: DbClient, input: SubmitBidInput): Promise<RenderedBid> {
  const bid = await submitBid(db, input);
  return renderBid(bid);
}

export async function forceAcceptBidRendered(
  db: DbClient,
  bidId: number,
): Promise<RenderedBid | null> {
  const bid = await forceAcceptBid(db, bidId);
  return bid ? renderBid(bid) : null;
}

export async function getBidRendered(db: DbClient, bidId: number): Promise<RenderedBid | null> {
  const bid = await getBidById(db, bidId);
  return bid ? renderBid(bid) : null;
}

// ── contract endpoint ─────────────────────────────────────────────────────

interface ContractRow {
  id: number;
  player_id: number;
  club_id: number;
  weekly_wage_cents: number;
  signing_bonus_cents: number;
  seasons_remaining: number;
  role_promise: string;
  release_clause_cents: number | null;
  is_loan: number;
  loan_details_json: string | null;
  signed_at: string;
}

async function loadContractForPlayer(db: DbClient, playerId: number): Promise<Contract | null> {
  const row = await (async () => {
    if (db.dialect === "sqlite") {
      return (
        db.sqlite
          .prepare<[number], ContractRow>(
            `SELECT id, player_id, club_id, weekly_wage_cents, signing_bonus_cents,
                    seasons_remaining, role_promise, release_clause_cents,
                    is_loan, loan_details_json, signed_at
             FROM contracts WHERE player_id = ?`,
          )
          .get(playerId) ?? null
      );
    }
    const res = await db.pool.query<ContractRow>(
      `SELECT id, player_id, club_id, weekly_wage_cents, signing_bonus_cents,
              seasons_remaining, role_promise, release_clause_cents,
              is_loan, loan_details_json, signed_at
       FROM contracts WHERE player_id = $1`,
      [playerId],
    );
    return res.rows[0] ?? null;
  })();

  if (!row) return null;
  return {
    id: row.id,
    playerId: row.player_id,
    clubId: row.club_id,
    weeklyWageCents: row.weekly_wage_cents,
    signingBonusCents: row.signing_bonus_cents,
    seasonsRemaining: row.seasons_remaining,
    rolePromise: row.role_promise as PlayingTimeRole,
    releaseClauseCents: row.release_clause_cents,
    isLoan: row.is_loan === 1,
    loanDetails: row.loan_details_json ? (JSON.parse(row.loan_details_json) as LoanTerms) : null,
    signedAt: row.signed_at,
  };
}

export async function getContractForPlayer(
  db: DbClient,
  playerId: number,
): Promise<RenderedContract | null> {
  const contract = await loadContractForPlayer(db, playerId);
  if (!contract) return null;
  const clubs = await loadFullClubMap(db);
  const clubShells = new Map<number, { id: number; name: string }>();
  for (const [id, ref] of clubs) clubShells.set(id, { id, name: ref.name });
  return renderContract(contract, clubShells);
}
