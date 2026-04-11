-- Story 03: Scouting + Clubs Grow Up — Postgres.
-- Portability rules (TDD v2 §5.2): no JSONB, no ARRAY, no ENUM, ISO-8601 strings.

CREATE TABLE IF NOT EXISTS "scouts" (
  "id" SERIAL PRIMARY KEY,
  "run_id" INTEGER NOT NULL REFERENCES "runs"("id"),
  "name" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "voice_id" TEXT NOT NULL,
  "trust_tier" TEXT NOT NULL,
  "hired_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "scouts_run_idx" ON "scouts"("run_id");

CREATE TABLE IF NOT EXISTS "scout_assignments" (
  "id" SERIAL PRIMARY KEY,
  "scout_id" INTEGER NOT NULL REFERENCES "scouts"("id"),
  "kind" TEXT NOT NULL,
  "target_region" TEXT,
  "target_player_id" INTEGER REFERENCES "players"("id"),
  "started_at" TEXT NOT NULL,
  "ended_at" TEXT
);

CREATE INDEX IF NOT EXISTS "scout_assignments_scout_idx"
  ON "scout_assignments"("scout_id");
CREATE INDEX IF NOT EXISTS "scout_assignments_active_idx"
  ON "scout_assignments"("scout_id", "ended_at");

CREATE TABLE IF NOT EXISTS "scout_reports" (
  "id" SERIAL PRIMARY KEY,
  "scout_id" INTEGER NOT NULL REFERENCES "scouts"("id"),
  "assignment_id" INTEGER NOT NULL REFERENCES "scout_assignments"("id"),
  "player_id" INTEGER NOT NULL REFERENCES "players"("id"),
  "prose_body" TEXT NOT NULL,
  "created_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "scout_reports_player_idx"
  ON "scout_reports"("player_id");
CREATE INDEX IF NOT EXISTS "scout_reports_scout_idx"
  ON "scout_reports"("scout_id");

CREATE TABLE IF NOT EXISTS "knowledge_nodes" (
  "id" SERIAL PRIMARY KEY,
  "run_id" INTEGER NOT NULL REFERENCES "runs"("id"),
  "subject_kind" TEXT NOT NULL,
  "subject_id" INTEGER NOT NULL,
  "fact_type" TEXT NOT NULL,
  "fact_key" TEXT NOT NULL,
  "fact_value_tier" TEXT NOT NULL,
  "certainty" TEXT NOT NULL,
  "observed_at" TEXT NOT NULL,
  "source_scout_id" INTEGER REFERENCES "scouts"("id")
);

CREATE INDEX IF NOT EXISTS "knowledge_nodes_subject_idx"
  ON "knowledge_nodes"("subject_kind", "subject_id");
CREATE INDEX IF NOT EXISTS "knowledge_nodes_lookup_idx"
  ON "knowledge_nodes"("subject_kind", "subject_id", "fact_type", "fact_key");

CREATE TABLE IF NOT EXISTS "club_identity_ext" (
  "club_id" INTEGER PRIMARY KEY REFERENCES "clubs"("id"),
  "primary_color" TEXT NOT NULL,
  "secondary_color" TEXT NOT NULL,
  "stripe_color" TEXT NOT NULL,
  "primary_ink" TEXT NOT NULL,
  "secondary_ink" TEXT NOT NULL,
  "reputation_tier" TEXT NOT NULL,
  "wage_budget_tier" TEXT NOT NULL
);
