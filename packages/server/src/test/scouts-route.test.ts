// Story 03 — /api/scouts + /api/players/:id/reports + /api/world/observation-tick
// route coverage. Hono test client only — no network.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedClubIdentityIfMissing } from "../application/clubs/seed-identity.js";
import { seedScoutsIfMissing } from "../application/scouting/seed-scouts.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { startAssignment } from "../application/scouting/assignments.js";
import { runObservationTick } from "../application/scouting/observations.js";
import { createApiApp } from "../index.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

function baseDeps(db: DbClient, devEndpointsEnabled = true) {
  return {
    dialect: db.dialect,
    commit: "dev",
    db,
    devEndpointsEnabled,
    now: () => REFERENCE_DATE,
  };
}

describe("scout routes — Story 03 AC-11/12/13", () => {
  let db: DbClient;

  beforeAll(async () => {
    db = createDbClient("sqlite::memory:");
    await runMigrations(db);
    await seedContentIfMissing(db);
    await seedWorldIfEmpty(db, {
      seed: 42,
      clubCount: 10,
      playersPerClub: 20,
      referenceDate: REFERENCE_DATE,
    });
    await seedClubIdentityIfMissing(db);
    await seedScoutsIfMissing(db, 1);
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-11: GET /api/scouts returns 4 seeded scouts", async () => {
    const app = createApiApp(baseDeps(db));
    const res = await app.request("/api/scouts");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<Record<string, unknown>> };
    expect(body.items.length).toBe(4);
    for (const item of body.items) {
      expect(typeof item.name).toBe("string");
      expect(typeof item.region).toBe("string");
      expect(item.voice).toBeDefined();
      expect(typeof (item.voice as { id: string }).id).toBe("string");
      expect(typeof item.trust).toBe("string");
    }
  });

  it("GET /api/scouts/:id returns scout + assignment + reports", async () => {
    const app = createApiApp(baseDeps(db));
    const res = await app.request("/api/scouts/1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      scout: { id: number; name: string };
      activeAssignment: unknown;
      recentReports: unknown[];
    };
    expect(body.scout.id).toBe(1);
    expect(typeof body.scout.name).toBe("string");
    expect(Array.isArray(body.recentReports)).toBe(true);
  });

  it("AC-12: GET /api/players/:id/reports returns recent prose reports", async () => {
    // Seed a Player Focus assignment + tick so we have at least two reports.
    await startAssignment(db, {
      scoutId: 1, // Henri
      kind: "player",
      targetPlayerId: 1,
      now: new Date("2026-06-02T00:00:00Z"),
    });
    await runObservationTick(db, {
      runId: 1,
      tickIndex: 50,
      now: new Date("2026-06-03T00:00:00Z"),
    });
    await runObservationTick(db, {
      runId: 1,
      tickIndex: 51,
      now: new Date("2026-06-04T00:00:00Z"),
    });

    const app = createApiApp(baseDeps(db));
    const res = await app.request("/api/players/1/reports");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ scoutName: string; prose: string; createdAt: string }>;
    };
    expect(body.items.length).toBeGreaterThanOrEqual(2);
    for (const report of body.items) {
      expect(typeof report.scoutName).toBe("string");
      expect(typeof report.prose).toBe("string");
      // Reports themselves are prose; they MAY contain digits in
      // editorial copy, but every prose body must be non-empty.
      expect(report.prose.length).toBeGreaterThan(0);
    }
  });

  it("AC-13: POST /api/world/observation-tick is dev-only", async () => {
    const app = createApiApp(baseDeps(db, false));
    const res = await app.request("/api/world/observation-tick", {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  it("POST /api/world/observation-tick advances when dev-enabled", async () => {
    const app = createApiApp(baseDeps(db, true));
    const res = await app.request("/api/world/observation-tick", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      observationsWritten: number;
      reportsWritten: number;
    };
    expect(body.observationsWritten).toBeGreaterThanOrEqual(0);
    expect(body.reportsWritten).toBeGreaterThanOrEqual(0);
  });

  it("POST /api/scouts/:id/assignments updates the active assignment", async () => {
    const app = createApiApp(baseDeps(db));
    const res = await app.request("/api/scouts/2/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "region", targetRegion: "Iberia" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kind: string; targetRegion: string };
    expect(body.kind).toBe("region");
    expect(body.targetRegion).toBe("Iberia");
  });
});
