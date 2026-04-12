// Market value — Story 08.
//
// A pure function that computes a player's current market value from
// observable attributes. Called at render time, never stored. The
// value moves as the player plays — form, age, and contract situation
// all shift it.
//
// The output is a cents value (for internal arithmetic) and a
// CurrencyTier (for display). The tier mapping reuses the existing
// feeTierFor from @rpgfc/shared.

import type { CurrencyTier, FormTier } from "@rpgfc/shared";
import { feeTierFor } from "@rpgfc/shared";

export interface MarketValueInput {
  positionLabel: string;
  age: number;
  formTier: FormTier | null;
  badgeCount: number;
  contractSeasonsRemaining: number | null;
}

export interface MarketValueResult {
  cents: number;
  tier: CurrencyTier;
}

// Base value by position family. Attackers are most expensive.
const POSITION_BASE_CENTS: Record<string, number> = {
  ST: 800_000_000,
  LW: 700_000_000,
  RW: 700_000_000,
  CAM: 600_000_000,
  AM: 600_000_000,
  CM: 500_000_000,
  CDM: 450_000_000,
  DM: 450_000_000,
  LM: 400_000_000,
  RM: 400_000_000,
  FB: 350_000_000,
  LB: 350_000_000,
  RB: 350_000_000,
  LWB: 350_000_000,
  RWB: 350_000_000,
  CB: 400_000_000,
  GK: 250_000_000,
};

const DEFAULT_BASE = 400_000_000;

// Age curve: peaks 23-28, declines sharply after 30.
function ageFactor(age: number): number {
  if (age <= 18) return 0.5;
  if (age <= 20) return 0.7;
  if (age <= 22) return 0.9;
  if (age <= 28) return 1.0;
  if (age <= 30) return 0.85;
  if (age <= 32) return 0.6;
  if (age <= 34) return 0.35;
  return 0.2;
}

// Form impact: recent performance shifts value.
const FORM_FACTOR: Record<FormTier, number> = {
  Excellent: 1.3,
  Good: 1.1,
  Average: 1.0,
  Poor: 0.85,
  Dreadful: 0.7,
};

// Contract situation: expiring contracts lower value.
function contractFactor(seasonsRemaining: number | null): number {
  if (seasonsRemaining === null) return 0.6; // no contract = free agent price
  if (seasonsRemaining <= 1) return 0.7;
  if (seasonsRemaining <= 2) return 0.9;
  return 1.0;
}

// Badge bonus: each badge adds value, soft-capped.
function badgeFactor(count: number): number {
  return Math.min(1.0 + count * 0.06, 1.6);
}

export function computeMarketValue(input: MarketValueInput): MarketValueResult {
  const base = POSITION_BASE_CENTS[input.positionLabel] ?? DEFAULT_BASE;
  const age = ageFactor(input.age);
  const form = input.formTier ? FORM_FACTOR[input.formTier] : 1.0;
  const contract = contractFactor(input.contractSeasonsRemaining);
  const badges = badgeFactor(input.badgeCount);

  const raw = base * age * form * contract * badges;
  const cents = Math.round(raw / 10_000_000) * 10_000_000; // round to 10M
  const tier = feeTierFor(cents);

  return { cents, tier };
}
