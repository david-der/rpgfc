// Seller + player bid evaluators — Story 04.
//
// Pure functions. Given a proposal shape, the seller's asking price, and
// the buying/selling club's budget, decide what happens next.
//
// Seller evaluation rules (PRD §8.2 style):
//   - If the proposal fee is ≥90% of asking → accept.
//   - If the proposal fee is ≥75% of asking AND the buyer can afford the
//     wage bill → counter at the midpoint.
//   - Otherwise → reject. Reason code depends on whether the buyer could
//     afford it (SELLER_FEE_TOO_LOW) or couldn't (SELLER_BUDGET_STRAIN).
//
// Player evaluation rules (PRD §8.3):
//   - Wage ≥ wage floor.
//   - Playing time role ≥ minimum.
//   - Buyer club id not in forbidden set.
//   - Buyer club nationality matches preferred regions (empty = any).
//   All four pass → accept; else reject with the failing reason code.

import type { PlayingTimeRole, RejectionReason } from "@rpgfc/shared";
import { PLAYING_TIME_ROLES } from "@rpgfc/shared";

// ── seller ─────────────────────────────────────────────────────────────────

export interface SellerEvalInput {
  feeCents: number;
  wageCents: number;
  askingCents: number;
  buyerCashReserveCents: number;
  buyerWageBudgetCentsPerWeek: number;
  buyerCurrentWageOutCents: number;
  /** The player isn't listed — seller demands significantly above
   *  implied market value to consider letting them go. */
  isUnlisted?: boolean;
  /** Seller's current roster size. Sellers refuse to sell when this
   *  would drop the roster below the minimum. */
  sellerRosterSize?: number;
  /** Minimum roster size the seller is willing to maintain. */
  sellerRosterFloor?: number;
}

export type SellerEvalResult =
  | { kind: "accept" }
  | { kind: "counter"; counterFeeCents: number }
  | { kind: "reject"; reason: RejectionReason };

export function evaluateSellerProposal(input: SellerEvalInput): SellerEvalResult {
  // Roster-floor gate: a club below its minimum squad size won't sell
  // anyone regardless of fee. Blocks cascading depletion.
  if (
    input.sellerRosterFloor !== undefined &&
    input.sellerRosterSize !== undefined &&
    input.sellerRosterSize <= input.sellerRosterFloor
  ) {
    return { kind: "reject", reason: "SELLER_FEE_TOO_LOW" };
  }

  const ratio = input.feeCents / input.askingCents;
  const buyerCanAffordFee = input.buyerCashReserveCents >= input.feeCents;

  // Unlisted inquiries: the seller isn't looking to move the player,
  // so they only entertain offers significantly above implied market
  // value. Threshold is 1.5× — the "pay a fat premium" path.
  if (input.isUnlisted) {
    if (!buyerCanAffordFee) return { kind: "reject", reason: "SELLER_BUDGET_STRAIN" };
    if (ratio >= 1.5) return { kind: "accept" };
    if (ratio >= 1.25) {
      const counterFeeCents = Math.round(input.askingCents * 1.6);
      return { kind: "counter", counterFeeCents };
    }
    return { kind: "reject", reason: "SELLER_FEE_TOO_LOW" };
  }

  // Listed path.
  if (ratio >= 1.10) return { kind: "accept" };
  if (!buyerCanAffordFee) return { kind: "reject", reason: "SELLER_BUDGET_STRAIN" };
  if (ratio >= 0.9) return { kind: "accept" };
  if (ratio >= 0.75) {
    const counterFeeCents = Math.round((input.feeCents + input.askingCents) / 2);
    return { kind: "counter", counterFeeCents };
  }
  return { kind: "reject", reason: "SELLER_FEE_TOO_LOW" };
}

// ── player ─────────────────────────────────────────────────────────────────

export interface PlayerEvalInput {
  wageCents: number;
  rolePromise: PlayingTimeRole;
  toClubId: number;
  toClubNationality: string;
  preferences: {
    wageFloorCents: number;
    minPlayingTime: PlayingTimeRole;
    preferredRegions: string[];
    forbiddenClubIds: number[];
  };
}

export type PlayerEvalResult = { kind: "accept" } | { kind: "reject"; reason: RejectionReason };

// PLAYING_TIME_ROLES is ordered strongest → weakest (Star first).
// A role promise "counts" if its index is ≤ the minimum's index.
function roleIndex(role: PlayingTimeRole): number {
  return PLAYING_TIME_ROLES.indexOf(role);
}

export function evaluatePlayerProposal(input: PlayerEvalInput): PlayerEvalResult {
  const p = input.preferences;

  if (input.wageCents < p.wageFloorCents) {
    return { kind: "reject", reason: "PLAYER_WAGE_FLOOR" };
  }

  if (roleIndex(input.rolePromise) > roleIndex(p.minPlayingTime)) {
    return { kind: "reject", reason: "PLAYER_PLAYING_TIME" };
  }

  if (p.forbiddenClubIds.includes(input.toClubId)) {
    return { kind: "reject", reason: "PLAYER_FORBIDDEN_CLUB" };
  }

  if (p.preferredRegions.length > 0 && !p.preferredRegions.includes(input.toClubNationality)) {
    return { kind: "reject", reason: "PLAYER_REGION_MISMATCH" };
  }

  return { kind: "accept" };
}

// ── human-readable reason labels (prose for the wire) ─────────────────────

export const REJECTION_PROSE: Record<RejectionReason, string> = {
  SELLER_FEE_TOO_LOW: "The selling club laughed the offer out of the room.",
  SELLER_BUDGET_STRAIN:
    "The selling club will not consider a move they cannot replace financially.",
  PLAYER_WAGE_FLOOR: "He expects a proper reward for a player at his level.",
  PLAYER_PLAYING_TIME: "He wants more game time than this club can realistically offer.",
  PLAYER_FORBIDDEN_CLUB: "He would not play for this club under any terms.",
  PLAYER_REGION_MISMATCH: "He is not willing to move to that part of the world.",
};
