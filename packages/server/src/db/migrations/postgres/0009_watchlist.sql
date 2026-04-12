CREATE TABLE IF NOT EXISTS "watchlist" (
  "id" SERIAL PRIMARY KEY,
  "club_id" INTEGER NOT NULL REFERENCES "clubs"("id"),
  "player_id" INTEGER NOT NULL REFERENCES "players"("id"),
  "added_at" TEXT NOT NULL,
  UNIQUE("club_id", "player_id")
);
