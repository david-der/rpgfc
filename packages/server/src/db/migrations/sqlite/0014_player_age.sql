-- Replace calendar DOB with a simple integer age.
-- Age is the only time representation the UI exposes (no calendar, no
-- birthday — same philosophy as "Match Week N"). Season rollover bumps
-- every age by 1.

ALTER TABLE `players` ADD COLUMN `age` INTEGER NOT NULL DEFAULT 25;

-- Backfill from existing DOB. SQLite stores dob as ISO-8601 TEXT
-- (yyyy-mm-dd); we compute age against the harness reference date
-- 2026-06-01. Any pre-existing save that gets migrated forward will
-- get a reasonable age without recomputing per-player jitter.
UPDATE `players`
SET `age` = CAST(strftime('%Y', '2026-06-01') AS INTEGER)
          - CAST(strftime('%Y', dob) AS INTEGER)
          - CASE WHEN strftime('%m-%d', dob) > '06-01' THEN 1 ELSE 0 END
WHERE `dob` IS NOT NULL;
