-- Story 05: Tactics, Squad & Promise Mood — SQLite.
-- Portability rules (TDD v2 §5.2): no JSONB, no ARRAY, no ENUM, ISO-8601 strings.

-- ── tactics ───────────────────────────────────────────────────────────────
-- Exactly one row per (club, name) pair. Story 05 ships only the "Default"
-- name; future stories can grow the set (A/B tactics) without migrating.
-- `instructions_json` is a JSON array of TeamInstruction values.
-- `assignments_json` is a JSON object mapping PitchSlot → playerId.
CREATE TABLE IF NOT EXISTS `tactics` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `club_id` INTEGER NOT NULL,
  `name` TEXT NOT NULL DEFAULT 'Default',
  `formation` TEXT NOT NULL,
  `playing_style` TEXT NOT NULL,
  `instructions_json` TEXT NOT NULL,
  `assignments_json` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL,
  UNIQUE(`club_id`, `name`),
  FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`)
);

-- ── squad_entries ─────────────────────────────────────────────────────────
-- One row per contracted player. The unique player_id index enforces the
-- "every player is in exactly one club's squad" invariant.
CREATE TABLE IF NOT EXISTS `squad_entries` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `club_id` INTEGER NOT NULL,
  `player_id` INTEGER NOT NULL UNIQUE,
  `role` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL,
  FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`),
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`)
);

CREATE INDEX IF NOT EXISTS `squad_entries_club_idx` ON `squad_entries`(`club_id`);
