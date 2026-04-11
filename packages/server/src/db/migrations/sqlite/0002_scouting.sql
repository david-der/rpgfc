-- Story 03: Scouting + Clubs Grow Up — SQLite.
-- Portability rules (TDD v2 §5.2): no JSONB, no ARRAY, no ENUM, ISO-8601 strings.

-- ── scouts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `scouts` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `run_id` INTEGER NOT NULL,
  `name` TEXT NOT NULL,
  `region` TEXT NOT NULL,
  `voice_id` TEXT NOT NULL,
  `trust_tier` TEXT NOT NULL,
  `hired_at` TEXT NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`)
);

CREATE INDEX IF NOT EXISTS `scouts_run_idx` ON `scouts`(`run_id`);

-- ── scout assignments ──────────────────────────────────────────────────────
-- Exactly one active assignment per scout is enforced in the application
-- layer (no SQL-level partial index; SQLite's partial indexes would work
-- but we keep the dialect-agnostic shape).
CREATE TABLE IF NOT EXISTS `scout_assignments` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `scout_id` INTEGER NOT NULL,
  `kind` TEXT NOT NULL,
  `target_region` TEXT,
  `target_player_id` INTEGER,
  `started_at` TEXT NOT NULL,
  `ended_at` TEXT,
  FOREIGN KEY (`scout_id`) REFERENCES `scouts`(`id`),
  FOREIGN KEY (`target_player_id`) REFERENCES `players`(`id`)
);

CREATE INDEX IF NOT EXISTS `scout_assignments_scout_idx`
  ON `scout_assignments`(`scout_id`);
CREATE INDEX IF NOT EXISTS `scout_assignments_active_idx`
  ON `scout_assignments`(`scout_id`, `ended_at`);

-- ── scout reports ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `scout_reports` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `scout_id` INTEGER NOT NULL,
  `assignment_id` INTEGER NOT NULL,
  `player_id` INTEGER NOT NULL,
  `prose_body` TEXT NOT NULL,
  `created_at` TEXT NOT NULL,
  FOREIGN KEY (`scout_id`) REFERENCES `scouts`(`id`),
  FOREIGN KEY (`assignment_id`) REFERENCES `scout_assignments`(`id`),
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`)
);

CREATE INDEX IF NOT EXISTS `scout_reports_player_idx`
  ON `scout_reports`(`player_id`);
CREATE INDEX IF NOT EXISTS `scout_reports_scout_idx`
  ON `scout_reports`(`scout_id`);

-- ── knowledge graph ────────────────────────────────────────────────────────
-- The canonical store replacing the synthetic viewerScoutLevel.
-- Each row is one observation by one scout of one fact about one subject.
CREATE TABLE IF NOT EXISTS `knowledge_nodes` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `run_id` INTEGER NOT NULL,
  `subject_kind` TEXT NOT NULL,
  `subject_id` INTEGER NOT NULL,
  `fact_type` TEXT NOT NULL,
  `fact_key` TEXT NOT NULL,
  `fact_value_tier` TEXT NOT NULL,
  `certainty` TEXT NOT NULL,
  `observed_at` TEXT NOT NULL,
  `source_scout_id` INTEGER,
  FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`),
  FOREIGN KEY (`source_scout_id`) REFERENCES `scouts`(`id`)
);

CREATE INDEX IF NOT EXISTS `knowledge_nodes_subject_idx`
  ON `knowledge_nodes`(`subject_kind`, `subject_id`);
CREATE INDEX IF NOT EXISTS `knowledge_nodes_lookup_idx`
  ON `knowledge_nodes`(`subject_kind`, `subject_id`, `fact_type`, `fact_key`);

-- ── club identity extension ────────────────────────────────────────────────
-- Story 01 ships clubs as (id, run_id, name, nationality, founded_year).
-- Story 03 adds real colors + reputation + wage budget tier on a side table
-- so we can enrich without rewriting the Story 01 players FK graph.
CREATE TABLE IF NOT EXISTS `club_identity_ext` (
  `club_id` INTEGER PRIMARY KEY NOT NULL,
  `primary_color` TEXT NOT NULL,
  `secondary_color` TEXT NOT NULL,
  `stripe_color` TEXT NOT NULL,
  `primary_ink` TEXT NOT NULL,
  `secondary_ink` TEXT NOT NULL,
  `reputation_tier` TEXT NOT NULL,
  `wage_budget_tier` TEXT NOT NULL,
  FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`)
);
