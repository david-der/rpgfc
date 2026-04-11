// Story 01 AC-11, AC-12, AC-13 — /api/players route coverage.
//
// Uses Hono's test client against a real in-memory SQLite DB with a seeded
// world. No network.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { seedContentIfMissing } from "../application/content-seed.js";
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

describe("/api/players — Story 01 AC-11/12/13", () => {
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
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-11: GET /api/players/:id returns a RenderedPlayer shape", async () => {
    const app = createApiApp(baseDeps(db));
    const res = await app.request("/api/players/1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(1);
    expect(typeof body.name).toBe("string");
    expect(typeof body.age).toBe("number");
    expect(body.prose).toBeDefined();
    expect((body.prose as Record<string, unknown>).identity).toBeDefined();
    expect(Array.isArray(body.badges)).toBe(true);
    expect(["Certain", "Confident", "Likely", "Speculation", "Unknown"]).toContain(
      body.certainty,
    );
    // AC-02 / rendering-boundary safety: no hidden vector in the response.
    expect(body.hiddenAttrs).toBeUndefined();
    expect(body.mentalTraits).toBeUndefined();
  });

  it("returns 404 for a non-existent player", async () => {
    const app = createApiApp(baseDeps(db));
    const res = await app.request("/api/players/999999");
    expect(res.status).toBe(404);
  });

  it("AC-12: GET /api/players paginates exhaustively through all seeded players", async () => {
    const app = createApiApp(baseDeps(db));
    const seen = new Set<number>();
    let cursor: number | null = null;
    let pages = 0;
    for (;;) {
      const qs = new URLSearchParams({ limit: "25" });
      if (cursor !== null) qs.set("cursor", String(cursor));
      const res = await app.request(`/api/players?${qs.toString()}`);
      expect(res.status).toBe(200);
      const page = (await res.json()) as {
        items: Array<{ id: number }>;
        nextCursor: number | null;
      };
      for (const item of page.items) seen.add(item.id);
      pages++;
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
      if (pages > 20) throw new Error("runaway pagination");
    }
    // 10 clubs × 20 players = 200 seeded players.
    expect(seen.size).toBe(200);
  });

  it("AC-13: POST /api/players/generate is mounted when dev endpoints are enabled", async () => {
    const app = createApiApp(baseDeps(db, true));
    // World is already seeded — the endpoint should idempotently skip.
    const res = await app.request("/api/players/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seed: 42, clubCount: 2, playersPerClub: 2 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { skipped: boolean };
    expect(body.skipped).toBe(true);
  });

  it("AC-13: POST /api/players/generate returns 404 when dev endpoints are disabled", async () => {
    const app = createApiApp(baseDeps(db, false));
    const res = await app.request("/api/players/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seed: 42 }),
    });
    // Hono returns 404 for unmounted routes.
    expect(res.status).toBe(404);
  });
});
