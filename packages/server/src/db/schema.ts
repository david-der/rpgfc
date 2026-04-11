// Dual-dialect schema (TDD v2 §5.1).
//
// Portability discipline (TDD v2 §5.2):
//   - No JSONB. JSON → TEXT.
//   - No ARRAY. Join tables instead.
//   - No native ENUM. Text + Zod enum on writes.
//   - Timestamps → ISO-8601 strings, parsed to Date at the app boundary.
//   - Auto-increment → SQLite integer PK autoIncrement / Postgres serial.
//
// Every schema change MUST produce migrations for both dialects in the same
// PR. CI's test-postgres job blocks drift.

import { sqliteTable, integer as sqInt, text as sqText } from "drizzle-orm/sqlite-core";
import { pgTable, serial as pgSerial, integer as pgInt, text as pgText } from "drizzle-orm/pg-core";

// ────────────────────────────────────────────────────────────────────────────
//  _meta — Story 00 walking skeleton table. Used by health checks and the
//  initial-seed sentinel so we know whether generation has already happened.
// ────────────────────────────────────────────────────────────────────────────

export const metaSqlite = sqliteTable("_meta", {
  id: sqInt("id").primaryKey({ autoIncrement: true }),
  key: sqText("key").notNull().unique(),
  value: sqText("value").notNull(),
  createdAt: sqText("created_at").notNull(),
});

export const metaPg = pgTable("_meta", {
  id: pgSerial("id").primaryKey(),
  key: pgText("key").notNull().unique(),
  value: pgText("value").notNull(),
  createdAt: pgText("created_at").notNull(),
});

// ────────────────────────────────────────────────────────────────────────────
//  runs — one per rogue-lite career. Story 01 hardcodes a single run_id=1.
// ────────────────────────────────────────────────────────────────────────────

export const runsSqlite = sqliteTable("runs", {
  id: sqInt("id").primaryKey({ autoIncrement: true }),
  seed: sqInt("seed").notNull(),
  startedAt: sqText("started_at").notNull(),
  endedAt: sqText("ended_at"),
});

export const runsPg = pgTable("runs", {
  id: pgSerial("id").primaryKey(),
  seed: pgInt("seed").notNull(),
  startedAt: pgText("started_at").notNull(),
  endedAt: pgText("ended_at"),
});

// ────────────────────────────────────────────────────────────────────────────
//  archetypes — seed content, keyed by stable string ID from @rpgfc/shared.
// ────────────────────────────────────────────────────────────────────────────

export const archetypesSqlite = sqliteTable("archetypes", {
  id: sqText("id").primaryKey(),
  displayName: sqText("display_name").notNull(),
  primaryRole: sqText("primary_role").notNull(),
  positionLabel: sqText("position_label").notNull(),
  giftDistJson: sqText("gift_dist_json").notNull(),
  traitDistJson: sqText("trait_dist_json").notNull(),
  startingBadgeKeysJson: sqText("starting_badge_keys_json").notNull(),
  inbornBadgeChancesJson: sqText("inborn_badge_chances_json").notNull(),
  preferredFootWeightsJson: sqText("preferred_foot_weights_json").notNull(),
  ageRangeJson: sqText("age_range_json").notNull(),
});

export const archetypesPg = pgTable("archetypes", {
  id: pgText("id").primaryKey(),
  displayName: pgText("display_name").notNull(),
  primaryRole: pgText("primary_role").notNull(),
  positionLabel: pgText("position_label").notNull(),
  giftDistJson: pgText("gift_dist_json").notNull(),
  traitDistJson: pgText("trait_dist_json").notNull(),
  startingBadgeKeysJson: pgText("starting_badge_keys_json").notNull(),
  inbornBadgeChancesJson: pgText("inborn_badge_chances_json").notNull(),
  preferredFootWeightsJson: pgText("preferred_foot_weights_json").notNull(),
  ageRangeJson: pgText("age_range_json").notNull(),
});

// ────────────────────────────────────────────────────────────────────────────
//  badges — the definition library. Tiered data + effects live in the JSON
//  blob (interpreted by the Badge Engine in later stories).
// ────────────────────────────────────────────────────────────────────────────

export const badgesSqlite = sqliteTable("badges", {
  id: sqInt("id").primaryKey({ autoIncrement: true }),
  key: sqText("key").notNull().unique(),
  category: sqText("category").notNull(),
  displayName: sqText("display_name").notNull(),
  tiersJson: sqText("tiers_json"),
  awardTrigger: sqText("award_trigger").notNull(),
  conditionsJson: sqText("conditions_json").notNull(),
  effectsJson: sqText("effects_json").notNull(),
  proseHooksJson: sqText("prose_hooks_json").notNull(),
  decayRulesJson: sqText("decay_rules_json").notNull(),
  createdAt: sqText("created_at").notNull(),
});

export const badgesPg = pgTable("badges", {
  id: pgSerial("id").primaryKey(),
  key: pgText("key").notNull().unique(),
  category: pgText("category").notNull(),
  displayName: pgText("display_name").notNull(),
  tiersJson: pgText("tiers_json"),
  awardTrigger: pgText("award_trigger").notNull(),
  conditionsJson: pgText("conditions_json").notNull(),
  effectsJson: pgText("effects_json").notNull(),
  proseHooksJson: pgText("prose_hooks_json").notNull(),
  decayRulesJson: pgText("decay_rules_json").notNull(),
  createdAt: pgText("created_at").notNull(),
});

// ────────────────────────────────────────────────────────────────────────────
//  clubs — minimal in Story 01. Name, nationality, founded year, run scope.
// ────────────────────────────────────────────────────────────────────────────

export const clubsSqlite = sqliteTable("clubs", {
  id: sqInt("id").primaryKey({ autoIncrement: true }),
  runId: sqInt("run_id").notNull(),
  name: sqText("name").notNull(),
  nationality: sqText("nationality").notNull(),
  foundedYear: sqInt("founded_year").notNull(),
  createdAt: sqText("created_at").notNull(),
});

export const clubsPg = pgTable("clubs", {
  id: pgSerial("id").primaryKey(),
  runId: pgInt("run_id").notNull(),
  name: pgText("name").notNull(),
  nationality: pgText("nationality").notNull(),
  foundedYear: pgInt("founded_year").notNull(),
  createdAt: pgText("created_at").notNull(),
});

// ────────────────────────────────────────────────────────────────────────────
//  players — the core entity. Hidden vectors stored as JSON TEXT, parsed in
//  the rendering layer.
// ────────────────────────────────────────────────────────────────────────────

export const playersSqlite = sqliteTable("players", {
  id: sqInt("id").primaryKey({ autoIncrement: true }),
  runId: sqInt("run_id").notNull(),
  clubId: sqInt("club_id"),
  name: sqText("name").notNull(),
  dob: sqText("dob").notNull(),
  nationality: sqText("nationality").notNull(),
  preferredFoot: sqText("preferred_foot").notNull(),
  archetypeId: sqText("archetype_id").notNull(),
  hiddenAttrsJson: sqText("hidden_attrs_json").notNull(),
  mentalTraitsJson: sqText("mental_traits_json").notNull(),
  experienceYears: sqInt("experience_years").notNull(),
  narrativeSeedJson: sqText("narrative_seed_json").notNull(),
  createdAt: sqText("created_at").notNull(),
});

export const playersPg = pgTable("players", {
  id: pgSerial("id").primaryKey(),
  runId: pgInt("run_id").notNull(),
  clubId: pgInt("club_id"),
  name: pgText("name").notNull(),
  dob: pgText("dob").notNull(),
  nationality: pgText("nationality").notNull(),
  preferredFoot: pgText("preferred_foot").notNull(),
  archetypeId: pgText("archetype_id").notNull(),
  hiddenAttrsJson: pgText("hidden_attrs_json").notNull(),
  mentalTraitsJson: pgText("mental_traits_json").notNull(),
  experienceYears: pgInt("experience_years").notNull(),
  narrativeSeedJson: pgText("narrative_seed_json").notNull(),
  createdAt: pgText("created_at").notNull(),
});

// ────────────────────────────────────────────────────────────────────────────
//  player_badges — tiered link table. Tier is nullable (untiered badges).
// ────────────────────────────────────────────────────────────────────────────

export const playerBadgesSqlite = sqliteTable("player_badges", {
  id: sqInt("id").primaryKey({ autoIncrement: true }),
  playerId: sqInt("player_id").notNull(),
  badgeKey: sqText("badge_key").notNull(),
  tier: sqInt("tier"),
  awardedAt: sqText("awarded_at").notNull(),
  awardedReason: sqText("awarded_reason").notNull(),
});

export const playerBadgesPg = pgTable("player_badges", {
  id: pgSerial("id").primaryKey(),
  playerId: pgInt("player_id").notNull(),
  badgeKey: pgText("badge_key").notNull(),
  tier: pgInt("tier"),
  awardedAt: pgText("awarded_at").notNull(),
  awardedReason: pgText("awarded_reason").notNull(),
});

// ────────────────────────────────────────────────────────────────────────────
//  thesaurus — qualitative tier words. Seeded from constants.
// ────────────────────────────────────────────────────────────────────────────

export const thesaurusSqlite = sqliteTable("thesaurus", {
  id: sqInt("id").primaryKey({ autoIncrement: true }),
  attribute: sqText("attribute").notNull(),
  precision: sqText("precision").notNull(), // "fine" | "coarse"
  tierIndex: sqInt("tier_index").notNull(),
  word: sqText("word").notNull(),
});

export const thesaurusPg = pgTable("thesaurus", {
  id: pgSerial("id").primaryKey(),
  attribute: pgText("attribute").notNull(),
  precision: pgText("precision").notNull(),
  tierIndex: pgInt("tier_index").notNull(),
  word: pgText("word").notNull(),
});

// ────────────────────────────────────────────────────────────────────────────
//  Grouped schema objects — imported by the Drizzle client factory.
// ────────────────────────────────────────────────────────────────────────────

export const sqliteSchema = {
  meta: metaSqlite,
  runs: runsSqlite,
  archetypes: archetypesSqlite,
  badges: badgesSqlite,
  clubs: clubsSqlite,
  players: playersSqlite,
  playerBadges: playerBadgesSqlite,
  thesaurus: thesaurusSqlite,
};

export const pgSchema = {
  meta: metaPg,
  runs: runsPg,
  archetypes: archetypesPg,
  badges: badgesPg,
  clubs: clubsPg,
  players: playersPg,
  playerBadges: playerBadgesPg,
  thesaurus: thesaurusPg,
};
