// Story 06 AC-08, AC-09 — advanceMatchday end-to-end against a seeded
// in-memory DB. Asserts the transactional invariants and the half-
// season terminal state.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedClubIdentityIfMissing } from "../application/clubs/seed-identity.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { seedTacticsIfEmpty } from "../application/tactics/seed.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";
import { seedFixturesIfEmpty } from "../application/season/seed.js";
import { advanceMatchday } from "../application/season/advance.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

describe("advanceMatchday — Story 06", () => {
  let db: DbClient;

  beforeAll(async () => {
    db = createDbClient("sqlite::memory:");
    await runMigrations(db);
    await seedContentIfMissing(db);
    await seedWorldIfEmpty(db, {
      seed: 42,
      clubCount: 10,
      playersPerClub: 14,
      referenceDate: REFERENCE_DATE,
    });
    await seedClubIdentityIfMissing(db);
    await seedTacticsIfEmpty(db);
    await seedSquadIfEmpty(db);
    await seedFixturesIfEmpty(db);
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-08: advanceMatchday plays five fixtures, writes 22 performances per match", async () => {
    if (db.dialect !== "sqlite") return;

    const before = db.sqlite
      .prepare<
        [],
        { n: number }
      >(`SELECT COUNT(*) AS n FROM matches WHERE state = 'Played'`)
      .get();
    expect(before?.n).toBe(0);

    const result = await advanceMatchday(db, { now: REFERENCE_DATE });
    expect(result.matchday).toBe(1);
    expect(result.played).toBe(5);

    // Every fixture in matchday 1 is now Played.
    const played = db.sqlite
      .prepare<
        [],
        { n: number }
      >(`SELECT COUNT(*) AS n FROM matches WHERE state = 'Played' AND matchday = 1`)
      .get();
    expect(played?.n).toBe(5);

    // Per-player rows: 22 per match × 5 matches = 110.
    const perfRows = db.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM player_match_performance`)
      .get();
    expect(perfRows?.n).toBe(110);
  });

  it("AC-08: a second call advances to matchday 2", async () => {
    const result = await advanceMatchday(db, { now: REFERENCE_DATE });
    expect(result.matchday).toBe(2);
    expect(result.played).toBe(5);
  });

  it("AC-09: advancing to the end of the half-season returns remaining=0", async () => {
    // We've already played 2 matchdays (10 fixtures). 7 to go.
    let last: { matchday: number | null; played: number; remaining: number } = {
      matchday: 2,
      played: 5,
      remaining: 35,
    };
    while (last.remaining > 0) {
      last = await advanceMatchday(db, { now: REFERENCE_DATE });
    }
    expect(last.matchday).toBe(9);
    expect(last.remaining).toBe(0);

    // One more call: terminal state, no work done.
    const terminal = await advanceMatchday(db, { now: REFERENCE_DATE });
    expect(terminal.matchday).toBeNull();
    expect(terminal.played).toBe(0);
    expect(terminal.remaining).toBe(0);
  });

  it("at the end of the half-season every fixture is Played", () => {
    if (db.dialect !== "sqlite") return;
    const row = db.sqlite
      .prepare<
        [],
        { n: number }
      >(`SELECT COUNT(*) AS n FROM matches WHERE state = 'Scheduled'`)
      .get();
    expect(row?.n).toBe(0);
  });
});
