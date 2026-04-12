-- Contract wage schedule — per-season breakdown.
-- JSON array of weekly_wage_cents, one entry per season of the contract.
-- e.g. [5000000, 5500000, 6000000] = 3-year deal with 10%/yr raises.
-- The existing weekly_wage_cents column stays as the CURRENT season
-- wage for backwards compat; on season rollover, it's updated to
-- index (totalSeasons - seasonsRemaining) of this array.
ALTER TABLE `contracts` ADD COLUMN `wages_by_season_json` TEXT NOT NULL DEFAULT '[]';
