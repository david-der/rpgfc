// Certainty tiers describe how well a viewer (manager, scout) knows a given fact.
// Every piece of information crossing the rendering boundary carries one of these tags.
// See PRD §7.1, TDD §6.1, Style Guide §2.6.
export type CertaintyTier = "Certain" | "Confident" | "Likely" | "Speculation" | "Unknown";

export const CERTAINTY_TIERS: readonly CertaintyTier[] = [
  "Certain",
  "Confident",
  "Likely",
  "Speculation",
  "Unknown",
] as const;
