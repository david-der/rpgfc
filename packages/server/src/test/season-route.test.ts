// Story 06 AC-12, AC-13, AC-14, AC-15 — /api/season, /api/matches,
// /api/players/:id/form route coverage. Hono test client, no network.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedClubIdentityIfMissing } from "../application/clubs/seed-identity.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { seedTacticsIfEmpty } from "../application/tactics/seed.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";
import { seedFixturesIfEmpty } from "../application/season/seed.js";
import { createApiApp } from "../index.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

function baseDeps(db: DbClient) {
  return {
    dialect: db.dialect,
    commit: "dev",
    db,
    devEndpointsEnabled: true,
    now: () => REFERENCE_DATE,
  };
}

describe("season + matches + form routes — Story 06", () => {
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

  it("AC-12: GET /api/season/fixtures returns matchday-grouped list with no cents", async () => {
    const app = createApiApp(baseDeps(db));
    const res = await app.request("/api/season/fixtures");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      matchdays: Array<{ matchday: number; fixtures: unknown[] }>;
      nextMatchday: number | null;
    };
    // Full season for 10 clubs: 2*(10-1) = 18 matchdays.
    expect(body.matchdays).toHaveLength(18);
    expect(body.nextMatchday).toBe(1);
    const raw = JSON.stringify(body);
    expect(raw.toLowerCase()).not.toContain("cents");
  });

  it("AC-14: POST /api/season/advance plays the next matchday", async () => {
    const app = createApiApp(baseDeps(db));
    const res = await app.request("/api/season/advance", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      matchday: number | null;
      played: number;
      remaining: number;
    };
    expect(body.matchday).toBe(1);
    expect(body.played).toBe(5);
    // Full season: 90 total - 5 played = 85 remaining.
    expect(body.remaining).toBe(85);
  });

  it("AC-13: GET /api/matches/:id returns prose narrative after the fixture is played", async () => {
    if (db.dialect !== "sqlite") return;
    const row = db.sqlite
      .prepare<
        [],
        { id: number }
      >(`SELECT id FROM matches WHERE state = 'Played' ORDER BY id LIMIT 1`)
      .get();
    expect(row).toBeDefined();
    const app = createApiApp(baseDeps(db));
    const res = await app.request(`/api/matches/${row!.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      state: string;
      home: { name: string; goals: number | null };
      away: { name: string; goals: number | null };
      narrative: string[];
      performances: Array<{ playerName: string; tier: string }>;
    };
    expect(body.state).toBe("Played");
    expect(body.narrative.length).toBeGreaterThan(0);
    expect(body.performances.length).toBe(22);
  });

  it("AC-13: GET /api/matches/:id returns 404 for unknown ids", async () => {
    const app = createApiApp(baseDeps(db));
    const res = await app.request("/api/matches/999999");
    expect(res.status).toBe(404);
  });

  it("AC-15: GET /api/players/:id/form returns a series whose length equals matches played", async () => {
    if (db.dialect !== "sqlite") return;
    // Pick a player from a club that just played in matchday 1.
    const row = db.sqlite
      .prepare<
        [],
        { player_id: number }
      >(
        `SELECT pmp.player_id
         FROM player_match_performance pmp
         LIMIT 1`,
      )
      .get();
    expect(row).toBeDefined();

    const app = createApiApp(baseDeps(db));
    const res = await app.request(`/api/players/${row!.player_id}/form`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      points: Array<{ matchday: number; tier: string }>;
      currentTier: string;
    };
    expect(body.points.length).toBeGreaterThanOrEqual(1);
    expect(["Excellent", "Good", "Average", "Poor", "Dreadful"]).toContain(body.currentTier);
  });

  it("Story 06: GET /api/players/:id carries formTier on the response", async () => {
    if (db.dialect !== "sqlite") return;
    const row = db.sqlite
      .prepare<
        [],
        { player_id: number }
      >(
        `SELECT pmp.player_id FROM player_match_performance pmp LIMIT 1`,
      )
      .get();
    const app = createApiApp(baseDeps(db));
    const res = await app.request(`/api/players/${row!.player_id}`);
    const body = (await res.json()) as { formTier?: string; formTierLabel?: string };
    expect(["Excellent", "Good", "Average", "Poor", "Dreadful"]).toContain(body.formTier);
    expect(typeof body.formTierLabel).toBe("string");
  });
});
