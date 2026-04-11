-- Story 04: Transfer Market & Contracts — Postgres.
-- Portability rules (TDD v2 §5.2): no JSONB, no ARRAY, no ENUM, ISO-8601 strings.

-- IF NOT EXISTS on ADD COLUMN — Postgres 16 supports this natively.
ALTER TABLE "club_identity_ext" ADD COLUMN IF NOT EXISTS "cash_reserve_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "club_identity_ext" ADD COLUMN IF NOT EXISTS "wage_budget_cents_per_week" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "contracts" (
  "id" SERIAL PRIMARY KEY,
  "player_id" INTEGER NOT NULL UNIQUE REFERENCES "players"("id"),
  "club_id" INTEGER NOT NULL REFERENCES "clubs"("id"),
  "weekly_wage_cents" INTEGER NOT NULL,
  "signing_bonus_cents" INTEGER NOT NULL,
  "seasons_remaining" INTEGER NOT NULL,
  "role_promise" TEXT NOT NULL,
  "release_clause_cents" INTEGER,
  "is_loan" INTEGER NOT NULL DEFAULT 0,
  "loan_details_json" TEXT,
  "signed_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "bids" (
  "id" SERIAL PRIMARY KEY,
  "player_id" INTEGER NOT NULL REFERENCES "players"("id"),
  "from_club_id" INTEGER NOT NULL REFERENCES "clubs"("id"),
  "to_club_id" INTEGER NOT NULL REFERENCES "clubs"("id"),
  "state" TEXT NOT NULL,
  "current_proposal_id" INTEGER,
  "stance" TEXT NOT NULL,
  "rejection_reason" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "bids_player_idx" ON "bids"("player_id");
CREATE INDEX IF NOT EXISTS "bids_from_club_idx" ON "bids"("from_club_id");
CREATE INDEX IF NOT EXISTS "bids_state_idx" ON "bids"("state");

CREATE TABLE IF NOT EXISTS "bid_proposals" (
  "id" SERIAL PRIMARY KEY,
  "bid_id" INTEGER NOT NULL REFERENCES "bids"("id"),
  "author_kind" TEXT NOT NULL,
  "fee_cents" INTEGER NOT NULL,
  "wage_cents" INTEGER NOT NULL,
  "signing_bonus_cents" INTEGER NOT NULL,
  "role_promise" TEXT NOT NULL,
  "loan_details_json" TEXT,
  "created_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "bid_proposals_bid_idx" ON "bid_proposals"("bid_id");

CREATE TABLE IF NOT EXISTS "listing" (
  "id" SERIAL PRIMARY KEY,
  "player_id" INTEGER NOT NULL UNIQUE REFERENCES "players"("id"),
  "asking_price_cents" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "listed_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "player_preferences" (
  "id" SERIAL PRIMARY KEY,
  "player_id" INTEGER NOT NULL UNIQUE REFERENCES "players"("id"),
  "wage_floor_cents" INTEGER NOT NULL,
  "min_playing_time" TEXT NOT NULL,
  "preferred_regions_json" TEXT NOT NULL,
  "forbidden_club_ids_json" TEXT NOT NULL
);
