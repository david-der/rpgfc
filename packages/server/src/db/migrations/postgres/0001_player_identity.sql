-- Story 01: Player Identity — Postgres.
-- Portability rules (TDD v2 §5.2): no JSONB, no ARRAY, no ENUM, ISO-8601 strings.

CREATE TABLE IF NOT EXISTS "runs" (
  "id" SERIAL PRIMARY KEY,
  "seed" INTEGER NOT NULL,
  "started_at" TEXT NOT NULL,
  "ended_at" TEXT
);

CREATE TABLE IF NOT EXISTS "archetypes" (
  "id" TEXT PRIMARY KEY,
  "display_name" TEXT NOT NULL,
  "primary_role" TEXT NOT NULL,
  "position_label" TEXT NOT NULL,
  "gift_dist_json" TEXT NOT NULL,
  "trait_dist_json" TEXT NOT NULL,
  "starting_badge_keys_json" TEXT NOT NULL,
  "inborn_badge_chances_json" TEXT NOT NULL,
  "preferred_foot_weights_json" TEXT NOT NULL,
  "age_range_json" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "badges" (
  "id" SERIAL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "category" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "tiers_json" TEXT,
  "award_trigger" TEXT NOT NULL,
  "conditions_json" TEXT NOT NULL,
  "effects_json" TEXT NOT NULL,
  "prose_hooks_json" TEXT NOT NULL,
  "decay_rules_json" TEXT NOT NULL,
  "created_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "clubs" (
  "id" SERIAL PRIMARY KEY,
  "run_id" INTEGER NOT NULL REFERENCES "runs"("id"),
  "name" TEXT NOT NULL,
  "nationality" TEXT NOT NULL,
  "founded_year" INTEGER NOT NULL,
  "created_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "players" (
  "id" SERIAL PRIMARY KEY,
  "run_id" INTEGER NOT NULL REFERENCES "runs"("id"),
  "club_id" INTEGER REFERENCES "clubs"("id"),
  "name" TEXT NOT NULL,
  "dob" TEXT NOT NULL,
  "nationality" TEXT NOT NULL,
  "preferred_foot" TEXT NOT NULL,
  "archetype_id" TEXT NOT NULL REFERENCES "archetypes"("id"),
  "hidden_attrs_json" TEXT NOT NULL,
  "mental_traits_json" TEXT NOT NULL,
  "experience_years" INTEGER NOT NULL,
  "narrative_seed_json" TEXT NOT NULL,
  "created_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "players_run_idx" ON "players"("run_id");
CREATE INDEX IF NOT EXISTS "players_club_idx" ON "players"("club_id");

CREATE TABLE IF NOT EXISTS "player_badges" (
  "id" SERIAL PRIMARY KEY,
  "player_id" INTEGER NOT NULL REFERENCES "players"("id"),
  "badge_key" TEXT NOT NULL REFERENCES "badges"("key"),
  "tier" INTEGER,
  "awarded_at" TEXT NOT NULL,
  "awarded_reason" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "player_badges_player_idx" ON "player_badges"("player_id");

CREATE TABLE IF NOT EXISTS "thesaurus" (
  "id" SERIAL PRIMARY KEY,
  "attribute" TEXT NOT NULL,
  "precision" TEXT NOT NULL,
  "tier_index" INTEGER NOT NULL,
  "word" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "thesaurus_lookup_idx" ON "thesaurus"("attribute", "precision", "tier_index");
