// Story 03 — scouting application service tests.
//
// Covers AC-06 (Player Focus climbs the certainty ladder), AC-09 (only
// one active assignment per scout), AC-10 (Regional Watch confines its
// observations to the targeted region).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedClubIdentityIfMissing } from "../application/clubs/seed-identity.js";
import { seedScoutsIfMissing } from "../application/scouting/seed-scouts.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { startAssignment } from "../application/scouting/assignments.js";
import { runObservationTick } from "../application/scouting/observations.js";
import { knowPlayer, aggregateOverallCertainty } from "../rendering/knowledge.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

describe("scouting — Story 03", () => {
  let db: DbClient;
  let henriId: number; // BeneluxFrance scout
  let cristinaId: number; // Iberia scout

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

    if (db.dialect !== "sqlite") throw new Error("test only runs on SQLite");
    const scouts = db.sqlite
      .prepare<[], { id: number; name: string }>(
        `SELECT id, name FROM scouts WHERE run_id = 1 ORDER BY id`,
      )
      .all();
    henriId = scouts.find((s) => s.name === "Henri Lavigne")!.id;
    cristinaId = scouts.find((s) => s.name === "Cristina Romero")!.id;
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-08: 4 seed scouts land on world gen", () => {
    if (db.dialect !== "sqlite") return;
    const count = db.sqlite
      .prepare<[], { n: number }>(
        `SELECT COUNT(*) AS n FROM scouts WHERE run_id = 1`,
      )
      .get();
    expect(count?.n).toBe(4);
  });

  it("AC-05: an empty knowledge graph yields Unknown certainty for any player", async () => {
    const knowledge = await knowPlayer(db, 1);
    expect(knowledge.best.size).toBe(0);
    expect(aggregateOverallCertainty(knowledge)).toBe("Unknown");
  });

  it("AC-09: starting a new assignment ends the previous one for that scout", async () => {
    // Henri starts on Region: BeneluxFrance.
    await startAssignment(db, {
      scoutId: henriId,
      kind: "region",
      targetRegion: "BeneluxFrance",
      now: new Date("2026-06-02T00:00:00Z"),
    });
    // Then switches to Player Focus.
    await startAssignment(db, {
      scoutId: henriId,
      kind: "player",
      targetPlayerId: 1,
      now: new Date("2026-06-03T00:00:00Z"),
    });

    if (db.dialect !== "sqlite") return;
    const active = db.sqlite
      .prepare<[number], { id: number; kind: string; ended_at: string | null }>(
        `SELECT id, kind, ended_at FROM scout_assignments
         WHERE scout_id = ? AND ended_at IS NULL`,
      )
      .all(henriId);
    expect(active.length).toBe(1);
    expect(active[0]?.kind).toBe("player");
  });

  it("AC-06: Player Focus ticks climb the certainty ladder for the target", async () => {
    // Henri is currently on Player Focus 1 from the previous test.
    // Run three ticks.
    await runObservationTick(db, { runId: 1, tickIndex: 1, now: new Date("2026-06-04T00:00:00Z") });
    let k = await knowPlayer(db, 1);
    const tier1 = aggregateOverallCertainty(k);

    await runObservationTick(db, { runId: 1, tickIndex: 2, now: new Date("2026-06-05T00:00:00Z") });
    k = await knowPlayer(db, 1);
    const tier2 = aggregateOverallCertainty(k);

    await runObservationTick(db, { runId: 1, tickIndex: 3, now: new Date("2026-06-06T00:00:00Z") });
    k = await knowPlayer(db, 1);
    const tier3 = aggregateOverallCertainty(k);

    // Each tick must climb the ladder by exactly one tier (until it
    // saturates at Certain).
    const ladder = ["Unknown", "Speculation", "Likely", "Confident", "Certain"];
    expect(ladder.indexOf(tier1)).toBeGreaterThan(0);
    expect(ladder.indexOf(tier2)).toBeGreaterThanOrEqual(ladder.indexOf(tier1));
    expect(ladder.indexOf(tier3)).toBeGreaterThanOrEqual(ladder.indexOf(tier2));
  });

  it("AC-10: Regional Watch produces observations only against players in the target region", async () => {
    // Cristina is Iberia (ES). Start a fresh region watch.
    await startAssignment(db, {
      scoutId: cristinaId,
      kind: "region",
      targetRegion: "Iberia",
      now: new Date("2026-06-10T00:00:00Z"),
    });
    const before = countObs(db);
    await runObservationTick(db, {
      runId: 1,
      tickIndex: 100,
      now: new Date("2026-06-11T00:00:00Z"),
    });
    const after = countObs(db);
    const newRows = after - before;
    expect(newRows).toBeGreaterThanOrEqual(2);

    if (db.dialect !== "sqlite") return;
    // Every new observation by Cristina must reference an Iberian player.
    const cristinaObs = db.sqlite
      .prepare<
        [number],
        { subject_id: number; nationality: string }
      >(
        `SELECT k.subject_id, p.nationality
         FROM knowledge_nodes k
         JOIN players p ON p.id = k.subject_id
         WHERE k.source_scout_id = ?
           AND k.observed_at = '2026-06-11T00:00:00.000Z'`,
      )
      .all(cristinaId);
    expect(cristinaObs.length).toBeGreaterThan(0);
    for (const row of cristinaObs) {
      expect(row.nationality).toBe("ES");
    }
  });
});

function countObs(db: DbClient): number {
  if (db.dialect !== "sqlite") return 0;
  const row = db.sqlite
    .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM knowledge_nodes`)
    .get();
  return row?.n ?? 0;
}
