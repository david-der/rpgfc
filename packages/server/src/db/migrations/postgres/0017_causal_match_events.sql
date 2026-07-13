-- STORY 12: causal evidence, match snapshots, and substitution participation.

CREATE TABLE IF NOT EXISTS "match_side_snapshots" (
  "id" SERIAL PRIMARY KEY,
  "match_id" INTEGER NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
  "club_id" INTEGER NOT NULL REFERENCES "clubs"("id"),
  "formation" TEXT NOT NULL,
  "playing_style" TEXT NOT NULL,
  "instructions_json" TEXT NOT NULL,
  "starter_ids_json" TEXT NOT NULL,
  "bench_ids_json" TEXT NOT NULL,
  "pressure_context" TEXT NOT NULL,
  "engine_version" TEXT NOT NULL,
  UNIQUE("match_id", "club_id")
);

CREATE TABLE IF NOT EXISTS "match_events" (
  "id" SERIAL PRIMARY KEY,
  "match_id" INTEGER NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
  "sequence" INTEGER NOT NULL,
  "minute" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "club_id" INTEGER REFERENCES "clubs"("id"),
  "primary_player_id" INTEGER REFERENCES "players"("id"),
  "secondary_player_id" INTEGER REFERENCES "players"("id"),
  "outcome" TEXT,
  "evidence_json" TEXT NOT NULL,
  UNIQUE("match_id", "sequence")
);

CREATE INDEX IF NOT EXISTS "match_events_match_idx" ON "match_events"("match_id", "sequence");
CREATE INDEX IF NOT EXISTS "match_events_player_idx" ON "match_events"("primary_player_id");

ALTER TABLE "player_match_performance" ADD COLUMN "started" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "player_match_performance" ADD COLUMN "entered_minute" INTEGER;
ALTER TABLE "player_match_performance" ADD COLUMN "left_minute" INTEGER;
ALTER TABLE "player_match_performance" ADD COLUMN "position_slot" TEXT;
