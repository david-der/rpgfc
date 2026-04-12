// Contract + bid shapes — Story 04.
//
// The server-internal types carry cents; the wire types (RenderedContract,
// RenderedBid) carry only CurrencyTier words. The rendering layer is
// the single place where the conversion happens. Routes and the web
// package never see raw cents.

import type { BidStance, CurrencyTier } from "./currency.js";

// ── playing-time role ──────────────────────────────────────────────────────

export const PLAYING_TIME_ROLES = [
  "Star Player",
  "Important Player",
  "Rotation",
  "Backup",
  "Youth/Development",
] as const;
export type PlayingTimeRole = (typeof PLAYING_TIME_ROLES)[number];

// ── server-internal contract + loan ───────────────────────────────────────

export interface LoanTerms {
  /** Fraction of the loan wage the buying club pays (0..1). */
  wageCoveragePct: number;
  /** Minimum matches started or the loan triggers a penalty. */
  playingTimeGuarantee: number;
  /** Whether a permanent move at the end of the loan is obligatory. */
  obligationToBuy: boolean;
  /** Loan end date — ISO-8601. */
  endsAt: string;
}

export interface Contract {
  id: number;
  playerId: number;
  clubId: number;
  /** Current season's weekly wage in cents. Shifts to the next
   *  entry in wagesBySeasonCents on season rollover. */
  weeklyWageCents: number;
  /** Per-season wage schedule. wagesBySeasonCents[i] is the weekly
   *  wage in season i of the contract (0-indexed). Length matches
   *  the original contract length. */
  wagesBySeasonCents: number[];
  signingBonusCents: number;
  seasonsRemaining: number;
  rolePromise: PlayingTimeRole;
  releaseClauseCents: number | null;
  isLoan: boolean;
  loanDetails: LoanTerms | null;
  signedAt: string;
}

// ── server-internal bid + proposal ────────────────────────────────────────

export const BID_STATES = [
  "Draft",
  "Submitted",
  "SellerReviewing",
  "SellerRejected",
  "SellerCountered",
  "SellerAccepted",
  "PlayerReviewing",
  "PlayerRejected",
  "PlayerAccepted",
  "Signed",
  "Expired",
  "Cancelled",
] as const;
export type BidState = (typeof BID_STATES)[number];

export interface BidProposal {
  id: number;
  bidId: number;
  authorKind: "buyer" | "seller";
  feeCents: number;
  wageCents: number;
  signingBonusCents: number;
  rolePromise: PlayingTimeRole;
  loanOffer: LoanTerms | null;
  createdAt: string;
}

export interface BidRef {
  id: number;
  playerId: number;
  fromClubId: number;
  toClubId: number;
  state: BidState;
  currentProposal: BidProposal;
  stance: BidStance;
  rejectionReasonCode: RejectionReason | null;
  createdAt: string;
  updatedAt: string;
}

// Why a bid was rejected. Maps to a prose template for the UI.
export type RejectionReason =
  | "SELLER_FEE_TOO_LOW"
  | "SELLER_BUDGET_STRAIN"
  | "PLAYER_WAGE_FLOOR"
  | "PLAYER_PLAYING_TIME"
  | "PLAYER_FORBIDDEN_CLUB"
  | "PLAYER_REGION_MISMATCH";

// ── wire shapes (no cents) ────────────────────────────────────────────────

export interface RenderedContract {
  id: number;
  playerId: number;
  club: { id: number; name: string };
  wageTier: CurrencyTier;
  /** Per-season wage tier breakdown, starting from the CURRENT season
   *  forward. Length equals seasonsRemaining. Each entry is a tier
   *  word for the opposition; the user's own club gets real cents
   *  from the /club/finances endpoint. */
  wageTiersBySeason: CurrencyTier[];
  signingBonusTier: CurrencyTier;
  seasonsRemaining: number;
  rolePromise: PlayingTimeRole;
  hasReleaseClause: boolean;
  releaseClauseTier: CurrencyTier | null;
  isLoan: boolean;
  loanWageCoverageLabel: string | null;
  loanEndsAt: string | null;
  signedAt: string;
}

export interface RenderedBidProposal {
  id: number;
  authorKind: "buyer" | "seller";
  feeTier: CurrencyTier;
  wageTier: CurrencyTier;
  signingBonusTier: CurrencyTier;
  rolePromise: PlayingTimeRole;
  isLoan: boolean;
  createdAt: string;
}

export interface RenderedBid {
  id: number;
  playerId: number;
  fromClubId: number;
  toClubId: number;
  state: BidState;
  stance: BidStance;
  rejectionReason: RejectionReason | null;
  /** Qualitative label for the rejection reason, already prose. */
  rejectionReasonLabel: string | null;
  currentProposal: RenderedBidProposal;
  createdAt: string;
  updatedAt: string;
}

export interface RenderedListing {
  playerId: number;
  playerName: string;
  positionLabel: string;
  nationality: string;
  age: number;
  club: { id: number; name: string };
  askingTier: CurrencyTier;
  reason: "rebuild" | "wage_trim" | "squad_overhaul";
  /** Most recent bid state for this player by the current user's club,
   *  if any. Drives the ListingCard status badge on /transfers. */
  currentBidState: BidState | null;
}
