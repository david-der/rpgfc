-- Story 08: Transfer Market v2 — Postgres.

ALTER TABLE "bids" ADD COLUMN IF NOT EXISTS "submitted_match_week" INTEGER;
ALTER TABLE "bids" ADD COLUMN IF NOT EXISTS "deadline_match_week" INTEGER;
