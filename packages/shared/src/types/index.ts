// Public type barrel. Everything exported here is safe for the web package.
// HiddenPlayer is *not* re-exported from this file — it lives in ./player.js
// and is importable only via @rpgfc/shared/types/hidden (the side-door).
export type { CertaintyTier } from "./certainty.js";
export { CERTAINTY_TIERS } from "./certainty.js";

export type {
  BadgeCategory,
  BadgeRef,
  BadgeDefinition,
  BadgeTier,
  BadgeEffect,
  BadgeAwardTrigger,
  BadgeDecayKind,
} from "./badge.js";
export { BADGE_CATEGORIES } from "./badge.js";

export type {
  NaturalGiftKey,
  NaturalGifts,
  MentalTraitKey,
  MentalTraits,
  PreferredFoot,
} from "./attributes.js";
export { NATURAL_GIFT_KEYS, MENTAL_TRAIT_KEYS, PREFERRED_FEET } from "./attributes.js";

export type { ExperienceTier } from "./experience.js";
export { EXPERIENCE_TIERS } from "./experience.js";

export type { Archetype, AttributeDistribution, GiftDistribution, TraitDistribution } from "./archetype.js";

export type { Thesaurus, ThesaurusEntry, ThesaurusKey, ThesaurusPrecision } from "./thesaurus.js";

export type { RenderedPlayer, RenderedClubRef, NarrativeSeed } from "./player.js";
export { asRenderedPlayer } from "./player.js";
