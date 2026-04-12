ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "preferred_positions_json" TEXT NOT NULL DEFAULT '[]';
