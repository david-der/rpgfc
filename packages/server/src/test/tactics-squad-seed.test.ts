// AC-03, AC-04: Story 05 seed invariants.
//
// Every seeded club gets exactly one tactics row (Default). Every
// contracted player gets exactly one squad_entries row.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { seedTacticsIfEmpty } from "../application/tactics/seed.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

describe("Story 05 seed — tactics + squad_entries", () => {
  let db: DbClient;

  beforeAll(async () => {
    db = createDbClient("sqlite::memory:");
    await runMigrations(db);
    await seedContentIfMissing(db);
    await seedWorldIfEmpty(db, {
      seed: 42,
      clubCount: 6,
      playersPerClub: 12,
      referenceDate: REFERENCE_DATE,
    });
    await seedTacticsIfEmpty(db);
    await seedSquadIfEmpty(db);
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-03: every club has exactly one Default tactics row", () => {
    if (db.dialect !== "sqlite") return;
    const clubs = db.sqlite.prepare<[], { id: number }>(`SELECT id FROM clubs`).all();
    expect(clubs.length).toBeGreaterThan(0);
    for (const club of clubs) {
      const rows = db.sqlite
        .prepare<[number], { n: number }>(`SELECT COUNT(*) AS n FROM tactics WHERE club_id = ?`)
        .get(club.id);
      expect(rows?.n ?? 0).toBe(1);
    }
  });

  it("AC-03: default formation is 4-3-3 and assignments are empty", () => {
    if (db.dialect !== "sqlite") return;
    const row = db.sqlite
      .prepare<
        [],
        { formation: string; assignments_json: string }
      >(`SELECT formation, assignments_json FROM tactics LIMIT 1`)
      .get();
    expect(row?.formation).toBe("4-3-3");
    expect(row?.assignments_json).toBe("{}");
  });

  it("AC-04: every contracted player has exactly one squad_entries row", () => {
    if (db.dialect !== "sqlite") return;
    const players = db.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM players WHERE club_id IS NOT NULL`)
      .get();
    const entries = db.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM squad_entries`)
      .get();
    expect(entries?.n).toBe(players?.n);
  });

  it("seedTacticsIfEmpty is idempotent", async () => {
    const second = await seedTacticsIfEmpty(db);
    expect(second.skipped).toBe(true);
  });

  it("seedSquadIfEmpty is idempotent", async () => {
    const second = await seedSquadIfEmpty(db);
    expect(second.skipped).toBe(true);
  });
});
