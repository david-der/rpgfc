// Experience tier — PRD §4.1, TDD §6.1.
// Qualitative bucket derived from career years. Never displayed as a number.
export type ExperienceTier = "Rookie" | "Developing" | "Established" | "Veteran" | "Elder";

export const EXPERIENCE_TIERS: readonly ExperienceTier[] = [
  "Rookie",
  "Developing",
  "Established",
  "Veteran",
  "Elder",
] as const;
