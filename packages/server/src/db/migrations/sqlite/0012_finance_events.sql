-- Finance events — ledger of every cash movement per club.
-- Kinds: revenue_tv, revenue_matchday, revenue_sponsor,
--        expense_wages, transfer_in, transfer_out, signing_bonus.
CREATE TABLE IF NOT EXISTS `finance_events` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `club_id` INTEGER NOT NULL,
  `season` INTEGER NOT NULL,
  `match_week` INTEGER NOT NULL,
  `kind` TEXT NOT NULL,
  `amount_cents` INTEGER NOT NULL,
  `note` TEXT,
  `recorded_at` TEXT NOT NULL,
  FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`)
);
CREATE INDEX IF NOT EXISTS `finance_events_club_idx` ON `finance_events`(`club_id`);
CREATE INDEX IF NOT EXISTS `finance_events_week_idx` ON `finance_events`(`season`, `match_week`);
