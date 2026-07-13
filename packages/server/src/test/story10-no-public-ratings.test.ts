// Story 10 — No-Ratings Doctrine.
// Numeric performance calculations may remain server-private, but no rating
// field may cross an API or rendered-season boundary.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedClubIdentityIfMissing } from "../application/clubs/seed-identity.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { seedContractsIfEmpty } from "../application/players/seed-contracts.js";
import { advanceMatchday } from "../application/season/advance.js";
import { seedFixturesIfEmpty } from "../application/season/seed.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";
import { seedTacticsIfEmpty } from "../application/tactics/seed.js";
import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { createApiApp } from "../index.js";
import { computeBestXI } from "../rendering/best-xi.js";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("Story 10 — numeric ratings stay private", () => {
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
    await seedTacticsIfEmpty(db);
    await seedSquadIfEmpty(db);
    await seedContractsIfEmpty(db);
    await seedFixturesIfEmpty(db);
    for (let week = 0; week < 10; week += 1) {
      await advanceMatchday(db, { now: NOW, skipAiBids: true });
    }
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-10-08: recent-match and squad responses expose tiers, never rating fields", async () => {
    const app = createApiApp({
      dialect: db.dialect,
      commit: "test",
      db,
      devEndpointsEnabled: true,
      now: () => NOW,
      userClubId: 1,
    });

    const recent = await app.request("/api/players/1/recent-matches");
    const squad = await app.request("/api/squad");
    expect(recent.status).toBe(200);
    expect(squad.status).toBe(200);

    const wire = JSON.stringify([await recent.json(), await squad.json()]);
    expect(wire).not.toMatch(/ratingX10|rating_x10|last5Ratings|avg_rating/i);
    expect(wire).toMatch(/tier|recentForm/i);
  });

  it("AC-10-08: Best XI contains evidence and no public rating scalar", async () => {
    const best = await computeBestXI(db, 0);
    const wire = JSON.stringify(best);
    expect(wire).not.toMatch(/rating/i);
    expect(wire).toMatch(/evidence/i);
    const entries = [best.gk, ...best.def, ...best.mid, ...best.fwd].filter(
      (entry) => entry !== null,
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.evidence.length).toBeGreaterThan(0);
      expect(entry.evidence.length).toBeLessThanOrEqual(2);
      expect(entry.evidence.join(" ")).not.toMatch(/\d/);
    }
  });
});
