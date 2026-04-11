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

// ────────────────────────────────────────────────────────────────────────────
//  BadgeRef — what the UI sees. Never an underlying numeric tier index.
// ────────────────────────────────────────────────────────────────────────────

export interface BadgeRef {
  /** Stable string key from the badge library (e.g. "clutch_finisher"). */
  key: string;
  /** Display name, already tier-adjusted. */
  name: string;
  category: BadgeCategory;
  /** Tier index (1-based), or null for untiered badges. */
  tier: number | null;
  /** Short prose description for the tooltip. */
  prose: string;
  /** How confidently the current viewer knows about this badge. */
  certainty: CertaintyTier;
}

// ────────────────────────────────────────────────────────────────────────────
//  BadgeDefinition — the content-side schema. Declarative per PRD §5.3.2.
//  Ships in @rpgfc/shared so tests, the server's rendering layer, and the web
//  package's tooltip copy all read from a single source of truth.
// ────────────────────────────────────────────────────────────────────────────

export type BadgeAwardTrigger =
  | "match_end"
  | "season_end"
  | "career_milestone"
  | "transfer"
  | "generation"
  | "training_milestone";

export type BadgeDecayKind =
  | "none"             // permanent history (most Achievement badges)
  | "soft"             // tier can regress after a bad window
  | "event_triggered"; // specific in-game events can strip the badge

export interface BadgeTier {
  tier: number; // 1-based
  displayName: string;
  prose: string;
}

export type BadgeEffect =
  | {
      type: "contextual_boost";
      target: string;        // which hidden attribute/trait
      context: string;       // e.g. "knockout_after_65min"
      magnitude: number;
    }
  | {
      type: "behavior_modifier";
      modifier: string;
      magnitude: number;
    }
  | {
      type: "event_trigger";
      event: string;
    }
  | {
      type: "role_unlock";
      role: string;
    }
  | {
      type: "team_effect";
      effect: string;
      radius: "adjacent" | "squad";
    }
  | {
      type: "growth_modifier";
      target: string;
      magnitude: number;
    };

export interface BadgeDefinition {
  key: string;
  category: BadgeCategory;
  /** If non-null, the badge is tiered; tier 1 is the first level. */
  tiers: BadgeTier[] | null;
  /** Display name when untiered; for tiered badges, tier.displayName wins. */
  displayName: string;
  awardTrigger: BadgeAwardTrigger;
  /** Declarative DSL; interpreted by the Badge Engine in later stories. */
  conditions: Record<string, unknown>;
  effects: BadgeEffect[];
  proseHooks: string[];
  decayRules: { kind: BadgeDecayKind };
}
