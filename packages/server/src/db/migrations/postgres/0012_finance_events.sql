CREATE TABLE IF NOT EXISTS "finance_events" (
  "id" SERIAL PRIMARY KEY,
  "club_id" INTEGER NOT NULL REFERENCES "clubs"("id"),
  "season" INTEGER NOT NULL,
  "match_week" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "note" TEXT,
  "recorded_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "finance_events_club_idx" ON "finance_events"("club_id");
CREATE INDEX IF NOT EXISTS "finance_events_week_idx" ON "finance_events"("season", "match_week");
