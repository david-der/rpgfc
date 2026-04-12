-- Story 07: Full Season, Save Slots & Transfer Windows — Postgres.

CREATE TABLE IF NOT EXISTS "save_state" (
  "id" INTEGER PRIMARY KEY DEFAULT 1,
  "save_name" TEXT NOT NULL DEFAULT 'Default',
  "season" INTEGER NOT NULL DEFAULT 0,
  "next_match_week" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "season" INTEGER NOT NULL DEFAULT 0;
