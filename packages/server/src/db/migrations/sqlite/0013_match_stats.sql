-- Rich per-player match stats — Opta-style.
-- xG and passing accuracy are stored as integers (×100) to stay
-- portable across SQLite + Postgres without a numeric type dance.
-- Display layer divides by 100 for the user.
ALTER TABLE `player_match_performance` ADD COLUMN `minutes_played` INTEGER NOT NULL DEFAULT 90;
ALTER TABLE `player_match_performance` ADD COLUMN `shots` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `shots_on_target` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `xg_x100` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `key_passes` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `passes_attempted` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `passes_completed` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `tackles_attempted` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `tackles_won` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `interceptions` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `clearances` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `aerials_won` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `aerials_contested` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `dribbles_completed` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `fouls_committed` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `fouls_drawn` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `saves` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `yellow_cards` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `player_match_performance` ADD COLUMN `red_cards` INTEGER NOT NULL DEFAULT 0;
