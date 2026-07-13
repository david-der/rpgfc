// Story 12 — tactical familiarity grows through use and resets on change.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedContentIfMissing } from "../application/content-seed.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { advanceMatchday } from "../application/season/advance.js";
import { seedFixturesIfEmpty } from "../application/season/seed.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";
import { seedTacticsIfEmpty } from "../application/tactics/seed.js";
import { upsertTactics } from "../application/tactics/repository.js";
import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { renderTacticsForClub } from "../rendering/tactics-response.js";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("Story 12 — tactical familiarity", () => {
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
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-12-05: a material tactic change resets familiarity and match use rebuilds it", async () => {
    expect((await renderTacticsForClub(db, 1)).familiarity).toBe("Familiar");

    await upsertTactics(db, {
      clubId: 1,
      formation: "4-2-3-1",
      playingStyle: "Counter-Attack",
      instructions: ["HighTempo"],
      now: NOW,
    });
    expect((await renderTacticsForClub(db, 1)).familiarity).toBe("Learning");

    await advanceMatchday(db, { now: NOW, skipAiBids: true });
    expect((await renderTacticsForClub(db, 1)).familiarity).toBe("Settling");
  });
});
