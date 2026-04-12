-- Watchlist — players the user is tracking.
CREATE TABLE IF NOT EXISTS `watchlist` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `club_id` INTEGER NOT NULL,
  `player_id` INTEGER NOT NULL,
  `added_at` TEXT NOT NULL,
  UNIQUE(`club_id`, `player_id`),
  FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`),
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`)
);
