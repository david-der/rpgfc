// Story 06 AC-06, AC-07 — round-robin schedule + fixtures seed.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { seedFixturesIfEmpty } from "../application/season/seed.js";
import { generateRoundRobin } from "../application/season/schedule.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

describe("round-robin schedule — Story 06", () => {
  it("generateRoundRobin: every club plays every other club exactly once for n=10", () => {
    const clubs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const schedule = generateRoundRobin(clubs);
    expect(schedule).toHaveLength(9); // n - 1

    const seen = new Set<string>();
    for (const md of schedule) {
      expect(md.fixtures).toHaveLength(5); // n / 2
      // No team plays twice in a single matchday.
      const teamsThisMatchday = new Set<number>();
      for (const fx of md.fixtures) {
        teamsThisMatchday.add(fx.homeClubId);
        teamsThisMatchday.add(fx.awayClubId);
        // Track unique unordered pair.
        const key =
          fx.homeClubId < fx.awayClubId
            ? `${fx.homeClubId}-${fx.awayClubId}`
            : `${fx.awayClubId}-${fx.homeClubId}`;
        expect(seen.has(key), `pair ${key} appears twice`).toBe(false);
        seen.add(key);
      }
      expect(teamsThisMatchday.size).toBe(10);
    }
    // Total unique pairs = n * (n-1) / 2 = 45.
    expect(seen.size).toBe(45);
  });

  it("AC-07: every club plays the same number of fixtures (n - 1)", () => {
    const clubs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const schedule = generateRoundRobin(clubs);
    const counts = new Map<number, number>();
    for (const md of schedule) {
      for (const fx of md.fixtures) {
        counts.set(fx.homeClubId, (counts.get(fx.homeClubId) ?? 0) + 1);
        counts.set(fx.awayClubId, (counts.get(fx.awayClubId) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(10);
    for (const [, n] of counts) expect(n).toBe(9);
  });

  it("generateRoundRobin handles odd club counts via a bye", () => {
    const clubs = [1, 2, 3, 4, 5];
    const schedule = generateRoundRobin(clubs);
    expect(schedule).toHaveLength(5); // n matchdays for odd n
    // No fixture references the sentinel -1.
    for (const md of schedule) {
      for (const fx of md.fixtures) {
        expect(fx.homeClubId).not.toBe(-1);
        expect(fx.awayClubId).not.toBe(-1);
      }
    }
  });
});

describe("fixtures seed — Story 06", () => {
  let db: DbClient;

  beforeAll(async () => {
    db = createDbClient("sqlite::memory:");
    await runMigrations(db);
    await seedContentIfMissing(db);
    await seedWorldIfEmpty(db, {
      seed: 42,
      clubCount: 10,
      playersPerClub: 12,
      referenceDate: REFERENCE_DATE,
    });
    await seedFixturesIfEmpty(db);
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-06: writes n*(n-1) = 90 matches for 10 clubs (full season)", () => {
    if (db.dialect !== "sqlite") return;
    const row = db.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM matches`)
      .get();
    // Full season: each club plays every other twice (home + away).
    // 10 clubs → 10 * 9 = 90 total fixtures.
    expect(row?.n).toBe(90);
  });

  it("every match starts in the Scheduled state", () => {
    if (db.dialect !== "sqlite") return;
    const row = db.sqlite
      .prepare<
        [],
        { n: number }
      >(`SELECT COUNT(*) AS n FROM matches WHERE state != 'Scheduled'`)
      .get();
    expect(row?.n).toBe(0);
  });

  it("seedFixturesIfEmpty is idempotent", async () => {
    const second = await seedFixturesIfEmpty(db);
    expect(second.skipped).toBe(true);
  });
});
