// Hidden attribute and mental-trait keys. The raw numeric values that these
// names index live on HiddenPlayer.hiddenAttrs / HiddenPlayer.mentalTraits.
// They are NEVER exposed to the web package — only the server's rendering
// layer reads them, and it translates them into badges, tier words, and prose.
//
// The ESLint rule `no-numbers-in-player-facing` also scans JSX for member
// expressions on these names (player.pace, player.composure, ...) and flags
// them. Add any new key in BOTH places (this file and the ESLint rule's
// NUMERIC_ATTRIBUTE_NAMES set).

export const NATURAL_GIFT_KEYS = [
  "pace",
  "finishing",
  "composure",
  "aerial",
  "tackling",
  "passing",
  "vision",
  "stamina",
  "strength",
  "reflexes",
] as const;

export type NaturalGiftKey = (typeof NATURAL_GIFT_KEYS)[number];

export type NaturalGifts = Record<NaturalGiftKey, number>;

// Mental traits are personality/behavioral tendencies (PRD §4.5).
// Note: "composure" lives under NaturalGifts only — the hidden vector models
// cognitive stability as raw material. If we need a parallel trait-layer
// concept later, name it differently (e.g. "poise") rather than reusing the
// string; the Thesaurus Record type cannot hold the same key in both lists.
export const MENTAL_TRAIT_KEYS = [
  "ambition",
  "leadership",
  "temperament",
  "workEthic",
  "sociability",
  "riskTolerance",
  "professionalism",
] as const;

export type MentalTraitKey = (typeof MENTAL_TRAIT_KEYS)[number];

export type MentalTraits = Record<MentalTraitKey, number>;

export type PreferredFoot = "Left" | "Right" | "Both";

export const PREFERRED_FEET: readonly PreferredFoot[] = [
  "Left",
  "Right",
  "Both",
] as const;
