// Currency thesaurus — Story 04.
//
// The no-numbers doctrine extends to money: cents stay on the server,
// the wire carries qualitative tier words. This module is the single
// source of truth for the tier vocabulary; the rendering layer's
// `renderContract` / `renderBid` map cents → tier before values cross
// the wire, and the BidComposer UI picks a tier word rather than
// typing a cents value.
//
// Two thresholds ramps: one for transfer fees, one for weekly wages.
// Each ramp has the same 5 tier words (Minimal / Modest / Notable /
// Significant / Elite) so the UI vocabulary stays consistent.

export const CURRENCY_TIERS = ["Minimal", "Modest", "Notable", "Significant", "Elite"] as const;
export type CurrencyTier = (typeof CURRENCY_TIERS)[number];

// Fee thresholds in cents. A fee at-or-below the threshold resolves to
// that tier; the top tier catches everything above the fourth.
//   Minimal    ≤ $500,000
//   Modest     ≤ $2,000,000
//   Notable    ≤ $10,000,000
//   Significant ≤ $30,000,000
//   Elite      otherwise
export const FEE_TIER_THRESHOLDS_CENTS: Readonly<Record<CurrencyTier, number>> = {
  Minimal: 50_000_000,
  Modest: 200_000_000,
  Notable: 1_000_000_000,
  Significant: 3_000_000_000,
  Elite: Number.POSITIVE_INFINITY,
};

// Wage thresholds in cents per week.
//   Minimal     ≤ $5,000/week
//   Modest      ≤ $15,000/week
//   Notable     ≤ $50,000/week
//   Significant ≤ $150,000/week
//   Elite       otherwise
export const WAGE_TIER_THRESHOLDS_CENTS: Readonly<Record<CurrencyTier, number>> = {
  Minimal: 500_000,
  Modest: 1_500_000,
  Notable: 5_000_000,
  Significant: 15_000_000,
  Elite: Number.POSITIVE_INFINITY,
};

// Midpoint values used when the user picks a tier in the composer and
// we need to turn that choice back into concrete cents for evaluation.
export const FEE_TIER_MIDPOINT_CENTS: Readonly<Record<CurrencyTier, number>> = {
  Minimal: 25_000_000,
  Modest: 100_000_000,
  Notable: 500_000_000,
  Significant: 2_000_000_000,
  Elite: 6_000_000_000,
};

export const WAGE_TIER_MIDPOINT_CENTS: Readonly<Record<CurrencyTier, number>> = {
  Minimal: 300_000,
  Modest: 1_000_000,
  Notable: 3_000_000,
  Significant: 10_000_000,
  Elite: 30_000_000,
};

export function feeTierFor(cents: number): CurrencyTier {
  if (cents <= FEE_TIER_THRESHOLDS_CENTS.Minimal) return "Minimal";
  if (cents <= FEE_TIER_THRESHOLDS_CENTS.Modest) return "Modest";
  if (cents <= FEE_TIER_THRESHOLDS_CENTS.Notable) return "Notable";
  if (cents <= FEE_TIER_THRESHOLDS_CENTS.Significant) return "Significant";
  return "Elite";
}

export function wageTierFor(cents: number): CurrencyTier {
  if (cents <= WAGE_TIER_THRESHOLDS_CENTS.Minimal) return "Minimal";
  if (cents <= WAGE_TIER_THRESHOLDS_CENTS.Modest) return "Modest";
  if (cents <= WAGE_TIER_THRESHOLDS_CENTS.Notable) return "Notable";
  if (cents <= WAGE_TIER_THRESHOLDS_CENTS.Significant) return "Significant";
  return "Elite";
}

// BidStance — how the current proposal compares to the seller's asking.
// Pure qualitative signal; the UI uses it to decorate BidHistory rows.
export type BidStance = "BelowAsking" | "AtAsking" | "AboveAsking";

export function stanceFor(feeCents: number, askingCents: number): BidStance {
  const tolerance = 0.05;
  if (feeCents < askingCents * (1 - tolerance)) return "BelowAsking";
  if (feeCents > askingCents * (1 + tolerance)) return "AboveAsking";
  return "AtAsking";
}
