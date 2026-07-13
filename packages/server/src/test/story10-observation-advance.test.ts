// Story 10 AC-10-05 — scouting is part of the authoritative weekly loop.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedContentIfMissing } from "../application/content-seed.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { startAssignment } from "../application/scouting/assignments.js";
import { seedScoutsIfMissing } from "../application/scouting/seed-scouts.js";
import { advanceMatchday } from "../application/season/advance.js";
import { seedFixturesIfEmpty } from "../application/season/seed.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";
import { seedTacticsIfEmpty } from "../application/tactics/seed.js";
import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("Story 10 — weekly scouting progression", () => {
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
    await seedScoutsIfMissing(db, 1);
    await seedTacticsIfEmpty(db);
    await seedSquadIfEmpty(db);
    await seedFixturesIfEmpty(db);
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-10-05: advancing a matchweek progresses an active Player Focus assignment", async () => {
    if (db.dialect !== "sqlite") return;
    const scout = db.sqlite
      .prepare<[], { id: number }>(`SELECT id FROM scouts ORDER BY id LIMIT 1`)
      .get();
    expect(scout).toBeDefined();
    await startAssignment(db, {
      scoutId: scout!.id,
      kind: "player",
      targetPlayerId: 21,
      now: NOW,
    });

    await advanceMatchday(db, { now: NOW, skipAiBids: true });

    const observations = db.sqlite
      .prepare<
        [number],
        { count: number }
      >(`SELECT COUNT(*) AS count FROM knowledge_nodes WHERE subject_id = ?`)
      .get(21);
    const reports = db.sqlite
      .prepare<
        [number],
        { count: number }
      >(`SELECT COUNT(*) AS count FROM scout_reports WHERE player_id = ?`)
      .get(21);
    expect(observations?.count).toBeGreaterThan(0);
    expect(reports?.count).toBeGreaterThan(0);
  });
});
