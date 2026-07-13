-- STORY 12: persistent availability, familiarity, and playing-time consequences.

CREATE TABLE IF NOT EXISTS `player_condition` (
  `player_id` INTEGER PRIMARY KEY NOT NULL,
  `fatigue_load` INTEGER NOT NULL DEFAULT 0,
  `injury_kind` TEXT,
  `injury_matches_remaining` INTEGER NOT NULL DEFAULT 0,
  `updated_season` INTEGER NOT NULL DEFAULT 0,
  `updated_match_week` INTEGER NOT NULL DEFAULT 0,
  `updated_at` TEXT NOT NULL,
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `player_discipline` (
  `player_id` INTEGER NOT NULL,
  `competition_key` TEXT NOT NULL,
  `season` INTEGER NOT NULL,
  `yellow_cards` INTEGER NOT NULL DEFAULT 0,
  `suspension_matches_remaining` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`player_id`, `competition_key`, `season`),
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `player_condition_injury_idx`
  ON `player_condition`(`injury_matches_remaining`);
CREATE INDEX IF NOT EXISTS `player_discipline_suspension_idx`
  ON `player_discipline`(`competition_key`, `season`, `suspension_matches_remaining`);

CREATE TABLE IF NOT EXISTS `tactical_familiarity` (
  `club_id` INTEGER PRIMARY KEY NOT NULL,
  `tactic_signature` TEXT NOT NULL,
  `familiarity_load` INTEGER NOT NULL DEFAULT 100,
  `updated_at` TEXT NOT NULL,
  FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `playing_time_promise_state` (
  `player_id` INTEGER PRIMARY KEY NOT NULL,
  `club_id` INTEGER NOT NULL,
  `season` INTEGER NOT NULL,
  `eligible_non_start_streak` INTEGER NOT NULL DEFAULT 0,
  `last_processed_match_week` INTEGER NOT NULL DEFAULT 0,
  `updated_at` TEXT NOT NULL,
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `player_relationship_events` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `player_id` INTEGER NOT NULL,
  `club_id` INTEGER NOT NULL,
  `season` INTEGER NOT NULL,
  `match_week` INTEGER NOT NULL,
  `event_type` TEXT NOT NULL,
  `mood` TEXT NOT NULL,
  `summary` TEXT NOT NULL,
  `created_at` TEXT NOT NULL,
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE CASCADE,
  UNIQUE (`player_id`, `club_id`, `season`, `match_week`, `event_type`)
);

CREATE INDEX IF NOT EXISTS `playing_time_promise_club_idx`
  ON `playing_time_promise_state`(`club_id`, `season`);
CREATE INDEX IF NOT EXISTS `player_relationship_events_player_idx`
  ON `player_relationship_events`(`player_id`, `season`, `match_week`);
