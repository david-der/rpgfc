ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "wages_by_season_json" TEXT NOT NULL DEFAULT '[]';
