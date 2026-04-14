-- Replace calendar DOB with a simple integer age.
-- See the SQLite companion for the design note.

ALTER TABLE players ADD COLUMN age INTEGER NOT NULL DEFAULT 25;

UPDATE players
SET age = EXTRACT(YEAR FROM DATE '2026-06-01')::int
        - EXTRACT(YEAR FROM dob::date)::int
        - CASE WHEN to_char(dob::date, 'MM-DD') > '06-01' THEN 1 ELSE 0 END
WHERE dob IS NOT NULL;
