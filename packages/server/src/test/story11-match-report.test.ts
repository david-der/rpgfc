// Story 11 — persisted causal evidence drives a four-paragraph report.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedContentIfMissing } from "../application/content-seed.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { advanceMatchday } from "../application/season/advance.js";
import { seedFixturesIfEmpty } from "../application/season/seed.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";
import { seedTacticsIfEmpty } from "../application/tactics/seed.js";
import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { renderMatchById } from "../rendering/match-response.js";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("Story 11 — causal match report", () => {
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
    await seedTacticsIfEmpty(db);
    await seedSquadIfEmpty(db);
    await seedFixturesIfEmpty(db);
    await advanceMatchday(db, { now: NOW, skipAiBids: true });
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-11-06: report has at least four paragraphs and names a persisted tactical cause", async () => {
    if (db.dialect !== "sqlite") return;
    const played = db.sqlite
      .prepare<
        [],
        { id: number }
      >(`SELECT id FROM matches WHERE state = 'Played' ORDER BY id LIMIT 1`)
      .get();
    expect(played).toBeDefined();
    const match = await renderMatchById(db, played!.id);
    expect(match?.narrative.length).toBeGreaterThanOrEqual(4);
    expect(match?.narrative.join(" ")).toMatch(
      /press|build-up|transition|compact|tempo|possession/i,
    );
    const timeline = (match as unknown as { events: Array<{ kind: string }> }).events;
    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline.filter((event) => event.kind === "Goal")).toHaveLength(
      (match?.home.goals ?? 0) + (match?.away.goals ?? 0),
    );
  });
});
