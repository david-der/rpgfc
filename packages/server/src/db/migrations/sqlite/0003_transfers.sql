-- Story 04: Transfer Market & Contracts — SQLite.
-- Portability rules (TDD v2 §5.2): no JSONB, no ARRAY, no ENUM, ISO-8601 strings.

-- ── club_identity_ext: add cash + wage budget cents columns ─────────────
-- These drive the seller evaluator's affordability check and the manager's
-- own cash reserve for the user's club. The tiered strings stay as human
-- labels; these cents columns are the arithmetic source of truth, never
-- rendered on the wire.
ALTER TABLE `club_identity_ext` ADD COLUMN `cash_reserve_cents` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `club_identity_ext` ADD COLUMN `wage_budget_cents_per_week` INTEGER NOT NULL DEFAULT 0;

-- ── contracts ─────────────────────────────────────────────────────────────
-- One active contract per player. When a player moves clubs, the single
-- row is updated in place (Story 04 scope); contract history lands with
-- Story 08. The unique index on player_id enforces the one-contract rule.
CREATE TABLE IF NOT EXISTS `contracts` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `player_id` INTEGER NOT NULL UNIQUE,
  `club_id` INTEGER NOT NULL,
  `weekly_wage_cents` INTEGER NOT NULL,
  `signing_bonus_cents` INTEGER NOT NULL,
  `seasons_remaining` INTEGER NOT NULL,
  `role_promise` TEXT NOT NULL,
  `release_clause_cents` INTEGER,
  `is_loan` INTEGER NOT NULL DEFAULT 0,
  `loan_details_json` TEXT,
  `signed_at` TEXT NOT NULL,
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`),
  FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`)
);

-- ── bids ──────────────────────────────────────────────────────────────────
-- Each row represents one bid negotiation between two clubs for a player.
-- `current_proposal_id` points at the latest row in `bid_proposals`.
CREATE TABLE IF NOT EXISTS `bids` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `player_id` INTEGER NOT NULL,
  `from_club_id` INTEGER NOT NULL,
  `to_club_id` INTEGER NOT NULL,
  `state` TEXT NOT NULL,
  `current_proposal_id` INTEGER,
  `stance` TEXT NOT NULL,
  `rejection_reason` TEXT,
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL,
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`),
  FOREIGN KEY (`from_club_id`) REFERENCES `clubs`(`id`),
  FOREIGN KEY (`to_club_id`) REFERENCES `clubs`(`id`)
);

CREATE INDEX IF NOT EXISTS `bids_player_idx` ON `bids`(`player_id`);
CREATE INDEX IF NOT EXISTS `bids_from_club_idx` ON `bids`(`from_club_id`);
CREATE INDEX IF NOT EXISTS `bids_state_idx` ON `bids`(`state`);

-- ── bid_proposals ─────────────────────────────────────────────────────────
-- Append-only history of every proposal that changed terms during a bid.
CREATE TABLE IF NOT EXISTS `bid_proposals` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `bid_id` INTEGER NOT NULL,
  `author_kind` TEXT NOT NULL,
  `fee_cents` INTEGER NOT NULL,
  `wage_cents` INTEGER NOT NULL,
  `signing_bonus_cents` INTEGER NOT NULL,
  `role_promise` TEXT NOT NULL,
  `loan_details_json` TEXT,
  `created_at` TEXT NOT NULL,
  FOREIGN KEY (`bid_id`) REFERENCES `bids`(`id`)
);

CREATE INDEX IF NOT EXISTS `bid_proposals_bid_idx` ON `bid_proposals`(`bid_id`);

-- ── listing ───────────────────────────────────────────────────────────────
-- Which players are on the market. Seeded per club at world gen and
-- removed when a transfer is signed.
CREATE TABLE IF NOT EXISTS `listing` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `player_id` INTEGER NOT NULL UNIQUE,
  `asking_price_cents` INTEGER NOT NULL,
  `reason` TEXT NOT NULL,
  `listed_at` TEXT NOT NULL,
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`)
);

-- ── player_preferences ────────────────────────────────────────────────────
-- Every generated player gets exactly one preferences row. Values are
-- deterministic per seed (see seed-preferences.ts).
CREATE TABLE IF NOT EXISTS `player_preferences` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `player_id` INTEGER NOT NULL UNIQUE,
  `wage_floor_cents` INTEGER NOT NULL,
  `min_playing_time` TEXT NOT NULL,
  `preferred_regions_json` TEXT NOT NULL,
  `forbidden_club_ids_json` TEXT NOT NULL,
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`)
);
