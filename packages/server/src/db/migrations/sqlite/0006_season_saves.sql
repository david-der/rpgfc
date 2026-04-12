-- Story 07: Full Season, Save Slots & Transfer Windows — SQLite.

-- ── save_state ────────────────────────────────────────────────────────────
-- Singleton row (id=1) tracking the current season + next match week.
-- The server auto-creates this on first boot.
CREATE TABLE IF NOT EXISTS `save_state` (
  `id` INTEGER PRIMARY KEY NOT NULL DEFAULT 1,
  `save_name` TEXT NOT NULL DEFAULT 'Default',
  `season` INTEGER NOT NULL DEFAULT 0,
  `next_match_week` INTEGER NOT NULL DEFAULT 1,
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);

-- ── matches.season ────────────────────────────────────────────────────────
-- Which season a fixture belongs to. Story 06 fixtures are all Season 0.
ALTER TABLE `matches` ADD COLUMN `season` INTEGER NOT NULL DEFAULT 0;
