-- Cancel any pre-existing self-bids (from_club_id == to_club_id).
-- These were created before the self-bid guard landed. Mark them
-- Cancelled so they don't appear in My Bids / Offers tabs.
UPDATE `bids` SET state = 'Cancelled'
WHERE from_club_id = to_club_id
  AND state NOT IN ('Signed', 'Cancelled', 'Expired');
