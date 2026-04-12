-- Story 06: Match Engine, Fixtures & Form — Postgres.
-- Portability rules (TDD v2 §5.2): no JSONB, no ARRAY, no ENUM, ISO-8601 strings.

CREATE TABLE IF NOT EXISTS "matches" (
  "id" SERIAL PRIMARY KEY,
  "matchday" INTEGER NOT NULL,
  "home_club_id" INTEGER NOT NULL REFERENCES "clubs"("id"),
  "away_club_id" INTEGER NOT NULL REFERENCES "clubs"("id"),
  "state" TEXT NOT NULL DEFAULT 'Scheduled',
  "home_goals" INTEGER,
  "away_goals" INTEGER,
  "seed" INTEGER NOT NULL,
  "played_at" TEXT
);

CREATE INDEX IF NOT EXISTS "matches_matchday_idx" ON "matches"("matchday");
CREATE INDEX IF NOT EXISTS "matches_state_idx" ON "matches"("state");
CREATE INDEX IF NOT EXISTS "matches_home_club_idx" ON "matches"("home_club_id");
CREATE INDEX IF NOT EXISTS "matches_away_club_idx" ON "matches"("away_club_id");

CREATE TABLE IF NOT EXISTS "player_match_performance" (
  "id" SERIAL PRIMARY KEY,
  "match_id" INTEGER NOT NULL REFERENCES "matches"("id"),
  "player_id" INTEGER NOT NULL REFERENCES "players"("id"),
  "club_id" INTEGER NOT NULL REFERENCES "clubs"("id"),
  "goals" INTEGER NOT NULL DEFAULT 0,
  "assists" INTEGER NOT NULL DEFAULT 0,
  "tier" TEXT NOT NULL,
  "event_description" TEXT,
  UNIQUE("match_id", "player_id")
);

CREATE INDEX IF NOT EXISTS "pmp_match_idx" ON "player_match_performance"("match_id");
CREATE INDEX IF NOT EXISTS "pmp_player_idx" ON "player_match_performance"("player_id");
