// Transfer valuations — Story 04.
//
// Pure, deterministic function from (archetype, experience, badges, name)
// to cents. Story 06's sim will extend this with form + reputation once
// matches exist; Story 04 ships a formula that produces a reasonable
// spread without touching any dynamic state.
//
// Formula:
//   base = BASE_BY_ROLE[primaryRole]
//   value = base
//         * experienceMultiplier(years)
//         * badgeMultiplier(badgeCount)
//         * nameNoise(name)          // ±15% deterministic jitter
//
// Rounded to the nearest $10,000 so the numbers look clean in the ledger
// even though they're never displayed to the user as numbers.

import { ARCHETYPE_BY_ID } from "@rpgfc/shared";

// Cents. Story 04 uses a 100x spread between the cheapest and the
// priciest positional archetype base value.
const BASE_CENTS_BY_ROLE: Record<string, number> = {
  Goalkeeper: 400_000_000,
  "Center-Back": 600_000_000,
  Fullback: 500_000_000,
  "Defensive Midfielder": 700_000_000,
  "Central Midfielder": 800_000_000,
  "Attacking Midfielder": 1_200_000_000,
  Winger: 1_400_000_000,
  Striker: 1_600_000_000,
};

const DEFAULT_BASE_CENTS = 800_000_000;

function experienceMultiplier(years: number): number {
  // Peak years 4..9 (Developing / Established). Tails fall off both sides.
  if (years <= 0) return 0.45;
  if (years <= 2) return 0.65;
  if (years <= 4) return 0.9;
  if (years <= 9) return 1.1; // peak
  if (years <= 13) return 0.95;
  if (years <= 17) return 0.7;
  return 0.35;
}

function badgeMultiplier(badgeCount: number): number {
  // Soft cap at 2.0× so a badge-farm player can't single-handedly blow
  // up the valuation.
  const bumped = 1 + Math.min(badgeCount, 12) * 0.08;
  return Math.min(bumped, 2.0);
}

// Deterministic hash-based ±15% noise so two players with the same
// archetype + experience + badge count don't carry identical values.
function nameNoise(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const normalized = (Math.abs(h) % 1000) / 1000; // [0, 1)
  return 0.85 + normalized * 0.3; // [0.85, 1.15)
}

function roundToCleanCents(cents: number): number {
  // Round to the nearest $10,000 so the ledger reads clean.
  const step = 1_000_000;
  return Math.round(cents / step) * step;
}

export interface ValuationInput {
  archetypeId: string;
  experienceYears: number;
  badgeKeys: string[];
  name: string;
}

export function estimateValueCents(input: ValuationInput): number {
  const archetype = ARCHETYPE_BY_ID[input.archetypeId];
  const role = archetype?.primaryRole ?? "Central Midfielder";
  const base = BASE_CENTS_BY_ROLE[role] ?? DEFAULT_BASE_CENTS;

  const value =
    base *
    experienceMultiplier(input.experienceYears) *
    badgeMultiplier(input.badgeKeys.length) *
    nameNoise(input.name);

  return roundToCleanCents(Math.max(1_000_000, value));
}
