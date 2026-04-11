import type { CertaintyTier } from "./certainty.js";

// Badge taxonomy mirrors PRD §5.1 exactly.
export type BadgeCategory =
  | "NaturalGift"
  | "MentalTrait"
  | "PositionalMastery"
  | "EarnedSkill"
  | "Achievement"
  | "Relationship";

export const BADGE_CATEGORIES: readonly BadgeCategory[] = [
  "NaturalGift",
  "MentalTrait",
  "PositionalMastery",
  "EarnedSkill",
  "Achievement",
  "Relationship",
] as const;

// BadgeRef is what the UI sees — never the underlying numeric tier index.
// The full BadgeDefinition + tier resolution lands in Story 01.
export interface BadgeRef {
  id: number;
  name: string;
  category: BadgeCategory;
  certainty: CertaintyTier;
}
