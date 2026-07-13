// Story 12 — availability is visible as qualitative squad information.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedClubIdentityIfMissing } from "../application/clubs/seed-identity.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";
import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { renderSquadForClub } from "../rendering/squad-response.js";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("Story 12 — rendered squad availability", () => {
  let db: DbClient;

  beforeAll(async () => {
    db = createDbClient("sqlite::memory:");
    await runMigrations(db);
    await seedContentIfMissing(db);
    await seedWorldIfEmpty(db, {
      seed: 42,
      clubCount: 10,
      playersPerClub: 20,
      referenceDate: NOW,
    });
    await seedClubIdentityIfMissing(db);
    await seedSquadIfEmpty(db);
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-12-02: injuries and workload render as words, not internal counters", async () => {
    if (db.dialect !== "sqlite") return;
    db.sqlite
      .prepare(
        `INSERT INTO player_condition
           (player_id, fatigue_load, injury_kind, injury_matches_remaining,
            updated_season, updated_match_week, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(1, 82, "match_injury", 2, 0, 1, NOW.toISOString());

    const squad = await renderSquadForClub(db, 1);
    const player = squad?.entries.find((entry) => entry.playerId === 1);
    expect(player?.availability).toEqual({
      state: "Injured",
      condition: "Spent",
      explanation: "Unavailable through injury.",
    });
    expect(JSON.stringify(player)).not.toContain("fatigue_load");
    expect(JSON.stringify(player)).not.toContain("injury_matches_remaining");
  });
});
