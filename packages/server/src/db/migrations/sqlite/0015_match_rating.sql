-- Position-aware "media consensus" per-match rating.
-- Stored as INTEGER × 10 (6.0–10.0 → 60–100) to stay portable across
-- SQLite + Postgres with no decimal type dance. UI divides by 10.
-- The formula is duplicated in the sim at insert time; this backfill
-- gives pre-existing rows a reasonable value using a coarse role guess
-- based on counting stats already on the row.

ALTER TABLE `player_match_performance` ADD COLUMN `rating_x10` INTEGER NOT NULL DEFAULT 65;

-- Backfill: apply a simplified version of the live formula using only
-- columns present on the row. No archetype lookup — we approximate
-- "is keeper" by saves > 0 and lean on the delta tables from §2. The
-- ±3 noise is deterministic-per-row via (match_id * 31 + player_id) % 7.
UPDATE `player_match_performance`
SET `rating_x10` = MAX(40, MIN(100,
  CASE WHEN minutes_played < 15 THEN 60
  ELSE
    65
    + CASE WHEN saves > 0 THEN saves * 3 ELSE goals * 12 + assists * 7 + shots + dribbles_completed + tackles_won * 2 END
    + ((match_id * 31 + player_id) % 7) - 3
  END
))
WHERE `rating_x10` = 65;
