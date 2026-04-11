-- Story 05: Tactics, Squad & Promise Mood — Postgres.
-- Portability rules (TDD v2 §5.2): no JSONB, no ARRAY, no ENUM, ISO-8601 strings.

CREATE TABLE IF NOT EXISTS "tactics" (
  "id" SERIAL PRIMARY KEY,
  "club_id" INTEGER NOT NULL REFERENCES "clubs"("id"),
  "name" TEXT NOT NULL DEFAULT 'Default',
  "formation" TEXT NOT NULL,
  "playing_style" TEXT NOT NULL,
  "instructions_json" TEXT NOT NULL,
  "assignments_json" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  UNIQUE("club_id", "name")
);

CREATE TABLE IF NOT EXISTS "squad_entries" (
  "id" SERIAL PRIMARY KEY,
  "club_id" INTEGER NOT NULL REFERENCES "clubs"("id"),
  "player_id" INTEGER NOT NULL UNIQUE REFERENCES "players"("id"),
  "role" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "squad_entries_club_idx" ON "squad_entries"("club_id");
