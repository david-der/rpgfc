-- Story 06: Match Engine, Fixtures & Form — SQLite.
-- Portability rules (TDD v2 §5.2): no JSONB, no ARRAY, no ENUM, ISO-8601 strings.

-- ── matches ───────────────────────────────────────────────────────────────
-- One row per fixture in the half-season. Created with state='Scheduled'
-- by the seed; advanceMatchday updates state='Played' and writes the
-- goal totals + played_at timestamp in a single transaction.
CREATE TABLE IF NOT EXISTS `matches` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `matchday` INTEGER NOT NULL,
  `home_club_id` INTEGER NOT NULL,
  `away_club_id` INTEGER NOT NULL,
  `state` TEXT NOT NULL DEFAULT 'Scheduled',
  `home_goals` INTEGER,
  `away_goals` INTEGER,
  `seed` INTEGER NOT NULL,
  `played_at` TEXT,
  FOREIGN KEY (`home_club_id`) REFERENCES `clubs`(`id`),
  FOREIGN KEY (`away_club_id`) REFERENCES `clubs`(`id`)
);

CREATE INDEX IF NOT EXISTS `matches_matchday_idx` ON `matches`(`matchday`);
CREATE INDEX IF NOT EXISTS `matches_state_idx` ON `matches`(`state`);
CREATE INDEX IF NOT EXISTS `matches_home_club_idx` ON `matches`(`home_club_id`);
CREATE INDEX IF NOT EXISTS `matches_away_club_idx` ON `matches`(`away_club_id`);

-- ── player_match_performance ──────────────────────────────────────────────
-- Eleven rows per match, per side — one per starter. The unique
-- (match_id, player_id) constraint enforces "one player, one row per
-- match" so re-running advanceMatchday on a Played match would fail
-- loudly (it shouldn't anyway — advance only picks Scheduled matchdays).
CREATE TABLE IF NOT EXISTS `player_match_performance` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `match_id` INTEGER NOT NULL,
  `player_id` INTEGER NOT NULL,
  `club_id` INTEGER NOT NULL,
  `goals` INTEGER NOT NULL DEFAULT 0,
  `assists` INTEGER NOT NULL DEFAULT 0,
  `tier` TEXT NOT NULL,
  `event_description` TEXT,
  UNIQUE(`match_id`, `player_id`),
  FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`),
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`),
  FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`)
);

CREATE INDEX IF NOT EXISTS `pmp_match_idx` ON `player_match_performance`(`match_id`);
CREATE INDEX IF NOT EXISTS `pmp_player_idx` ON `player_match_performance`(`player_id`);
