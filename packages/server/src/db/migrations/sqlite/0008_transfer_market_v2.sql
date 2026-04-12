-- Story 08: Transfer Market v2 — SQLite.
-- Time-based bid resolution + competing bids + finance tracking.

-- ── bid timing columns ────────────────────────────────────────────────────
-- submitted_match_week: the match week the bid was placed. Used to
-- schedule seller evaluation (1 week later) and deadline (4 weeks).
-- deadline_match_week: bid expires if unresolved by this week.
ALTER TABLE `bids` ADD COLUMN `submitted_match_week` INTEGER;
ALTER TABLE `bids` ADD COLUMN `deadline_match_week` INTEGER;
