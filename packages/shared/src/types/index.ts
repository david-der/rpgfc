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

export type {
  Archetype,
  AttributeDistribution,
  GiftDistribution,
  TraitDistribution,
} from "./archetype.js";

export type { Thesaurus, ThesaurusEntry, ThesaurusKey, ThesaurusPrecision } from "./thesaurus.js";

export type {
  RenderedPlayer,
  RenderedClubRef,
  NarrativeSeed,
  WirePlayer,
  ReputationTier,
  ClubColors,
} from "./player.js";
export { REPUTATION_TIERS, asRenderedPlayer } from "./player.js";

export type {
  ScoutRegion,
  ScoutVoice,
  ScoutVoiceId,
  ScoutTrustTier,
  ScoutRef,
  ScoutReportRef,
  AssignmentRef,
  AssignmentKind,
} from "./scout.js";
export { SCOUT_REGIONS, SCOUT_VOICE_IDS, SCOUT_TRUST_TIERS } from "./scout.js";

export type { FactType, SubjectKind, KnowledgeNodeRef } from "./knowledge.js";
export { FACT_TYPES } from "./knowledge.js";

export type { BidStance, CurrencyTier } from "./currency.js";
export {
  CURRENCY_TIERS,
  FEE_TIER_MIDPOINT_CENTS,
  FEE_TIER_THRESHOLDS_CENTS,
  WAGE_TIER_MIDPOINT_CENTS,
  WAGE_TIER_THRESHOLDS_CENTS,
  feeTierFor,
  stanceFor,
  wageTierFor,
} from "./currency.js";

export type {
  BidProposal,
  BidRef,
  BidState,
  Contract,
  LoanTerms,
  PlayingTimeRole,
  RejectionReason,
  RenderedBid,
  RenderedBidProposal,
  RenderedContract,
  RenderedListing,
} from "./contract.js";
export { BID_STATES, PLAYING_TIME_ROLES } from "./contract.js";

export type {
  Formation,
  PitchSlot,
  PlayingStyle,
  RenderedSlotAssignment,
  RenderedTactics,
  Tactics,
  TeamInstruction,
} from "./tactics.js";
export {
  FORMATIONS,
  FORMATION_SLOTS,
  PITCH_SLOTS,
  PITCH_SLOT_LABELS,
  PITCH_SLOT_POSITION_FAMILIES,
  PLAYING_STYLES,
  TEAM_INSTRUCTIONS,
  TEAM_INSTRUCTION_LABELS,
} from "./tactics.js";

export type {
  Harmony,
  PromiseMood,
  RenderedSquad,
  RenderedSquadEntry,
  SquadEntry,
  SquadRole,
} from "./squad.js";
export {
  HARMONY_LABELS,
  HARMONY_TIERS,
  PROMISE_MOODS,
  SQUAD_ROLES,
  SQUAD_ROLE_LABELS,
} from "./squad.js";

export type {
  FormSeries,
  FormSeriesPoint,
  FormTier,
  MatchState,
  RenderedFixture,
  RenderedFixturesPage,
  RenderedMatch,
  RenderedMatchClub,
  RenderedMatchPerformance,
} from "./form.js";
export { FORM_TIERS, FORM_TIER_LABELS, MATCH_STATES } from "./form.js";
