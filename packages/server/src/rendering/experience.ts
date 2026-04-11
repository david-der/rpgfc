import type { ExperienceTier } from "@rpgfc/shared";

// PRD §4.4 — experience tier bucketing. A pure function of career years.
// The exact breakpoints are tunable; these are Story 01's starting values.
export function bucketExperience(years: number): ExperienceTier {
  if (years < 2) return "Rookie";
  if (years < 5) return "Developing";
  if (years < 9) return "Established";
  if (years < 14) return "Veteran";
  return "Elder";
}
