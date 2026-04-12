-- Preferred positions — 1-3 position labels per player.
-- Stored as a JSON array of strings (e.g. '["ST","LW","CAM"]').
ALTER TABLE `players` ADD COLUMN `preferred_positions_json` TEXT NOT NULL DEFAULT '[]';
