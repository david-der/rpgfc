UPDATE "bids" SET state = 'Cancelled'
WHERE from_club_id = to_club_id
  AND state NOT IN ('Signed', 'Cancelled', 'Expired');
