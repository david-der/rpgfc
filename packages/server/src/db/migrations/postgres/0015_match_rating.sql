-- Position-aware "media consensus" per-match rating. See the SQLite
-- companion for the design note.

ALTER TABLE "player_match_performance" ADD COLUMN IF NOT EXISTS "rating_x10" INTEGER NOT NULL DEFAULT 65;

UPDATE "player_match_performance"
SET "rating_x10" = GREATEST(40, LEAST(100,
  CASE WHEN minutes_played < 15 THEN 60
  ELSE
    65
    + CASE WHEN saves > 0 THEN saves * 3 ELSE goals * 12 + assists * 7 + shots + dribbles_completed + tackles_won * 2 END
    + ((match_id * 31 + player_id) % 7) - 3
  END
))
WHERE "rating_x10" = 65;
