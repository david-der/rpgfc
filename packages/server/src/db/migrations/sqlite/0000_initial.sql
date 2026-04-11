-- Story 00 walking skeleton — SQLite initial migration.
-- Portability rules (TDD v2 §5.2): no JSONB, no ARRAY, no ENUM, ISO-8601 strings.
CREATE TABLE IF NOT EXISTS `_meta` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `key` TEXT NOT NULL UNIQUE,
  `value` TEXT NOT NULL,
  `created_at` TEXT NOT NULL
);
