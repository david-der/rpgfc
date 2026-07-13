// Story 10 AC-01/02/03 — qualitative mental evidence crosses the knowledge
// boundary without exposing or re-reading the hidden trait at render time.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedClubIdentityIfMissing } from "../application/clubs/seed-identity.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { startAssignment } from "../application/scouting/assignments.js";
import { runObservationTick } from "../application/scouting/observations.js";
import { seedScoutsIfMissing } from "../application/scouting/seed-scouts.js";
import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { createApiApp } from "../index.js";

const NOW = new Date("2026-06-01T00:00:00Z");

function appDeps(db: DbClient) {
  return {
    dialect: db.dialect,
    commit: "test",
    db,
    devEndpointsEnabled: true,
    now: () => NOW,
    userClubId: 1,
  };
}

describe("Story 10 — mental-trait knowledge projection", () => {
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
    await seedScoutsIfMissing(db, 1);
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("progressively renders observed professionalism while keeping hidden truth private", async () => {
    if (db.dialect !== "sqlite") return;

    const api = createApiApp(appDeps(db));
    const unknownResponse = await api.request("/api/players/21");
    const unknown = (await unknownResponse.json()) as {
      prose: { identity: string };
      mentalTraits?: unknown;
    };
    expect(unknown.prose.identity).not.toContain("professional habits");
    expect(unknown.mentalTraits).toBeUndefined();

    const hiddenRow = db.sqlite
      .prepare<
        [number],
        { mental_traits_json: string }
      >(`SELECT mental_traits_json FROM players WHERE id = ?`)
      .get(21);
    expect(hiddenRow).toBeDefined();
    const hiddenTraits = JSON.parse(hiddenRow!.mental_traits_json) as Record<string, number>;
    hiddenTraits.professionalism = 100;
    db.sqlite
      .prepare(`UPDATE players SET mental_traits_json = ? WHERE id = ?`)
      .run(JSON.stringify(hiddenTraits), 21);

    const scout = db.sqlite
      .prepare<[], { id: number }>(`SELECT id FROM scouts ORDER BY id LIMIT 1`)
      .get();
    expect(scout).toBeDefined();
    await startAssignment(db, {
      scoutId: scout!.id,
      kind: "player",
      targetPlayerId: 21,
      now: NOW,
    });

    await runObservationTick(db, {
      runId: 1,
      tickIndex: 1,
      now: new Date("2026-06-02T00:00:00Z"),
    });
    const firstObservation = db.sqlite
      .prepare<[number], { fact_value_tier: string; certainty: string }>(
        `SELECT fact_value_tier, certainty
         FROM knowledge_nodes
         WHERE subject_id = ?
           AND fact_type = 'mental_trait_tier'
           AND fact_key = 'professionalism'
         ORDER BY id DESC LIMIT 1`,
      )
      .get(21);
    expect(firstObservation).toEqual({ fact_value_tier: "meticulous", certainty: "Speculation" });

    const firstResponse = await api.request("/api/players/21");
    const first = (await firstResponse.json()) as {
      prose: { identity: string };
      mentalTraits?: unknown;
    };
    expect(first.prose.identity).toContain(
      "Scouts tentatively describe his professional habits as meticulous.",
    );
    expect(first.mentalTraits).toBeUndefined();

    await runObservationTick(db, {
      runId: 1,
      tickIndex: 2,
      now: new Date("2026-06-03T00:00:00Z"),
    });
    const secondResponse = await api.request("/api/players/21");
    const second = (await secondResponse.json()) as { prose: { identity: string } };
    expect(second.prose.identity).toContain(
      "Scouts increasingly describe his professional habits as meticulous.",
    );

    hiddenTraits.professionalism = 0;
    db.sqlite
      .prepare(`UPDATE players SET mental_traits_json = ? WHERE id = ?`)
      .run(JSON.stringify(hiddenTraits), 21);
    const changedHiddenResponse = await api.request("/api/players/21");
    const changedHidden = (await changedHiddenResponse.json()) as {
      prose: { identity: string };
    };
    expect(changedHidden.prose.identity).toBe(second.prose.identity);

    const ownPlayerResponse = await api.request("/api/players/1");
    const ownPlayer = (await ownPlayerResponse.json()) as {
      certainty: string;
      prose: { identity: string };
      mentalTraits?: unknown;
    };
    expect(ownPlayer.certainty).toBe("Certain");
    expect(ownPlayer.prose.identity).toContain("Club staff regard his professional habits as");
    expect(ownPlayer.mentalTraits).toBeUndefined();
  });
});
