import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedContentIfMissing } from "../application/content-seed.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { pickStarters } from "../application/season/starter-picker.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";
import { seedTacticsIfEmpty } from "../application/tactics/seed.js";
import { setAssignment } from "../application/tactics/repository.js";
import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

describe("availability-aware lineup compiler", () => {
  let db: DbClient;

  beforeAll(async () => {
    db = createDbClient("sqlite::memory:");
    await runMigrations(db);
    await seedContentIfMissing(db);
    await seedWorldIfEmpty(db, {
      seed: 42,
      clubCount: 2,
      playersPerClub: 22,
      referenceDate: REFERENCE_DATE,
    });
    await seedTacticsIfEmpty(db);
    await seedSquadIfEmpty(db);
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("excludes an injured pinned player and compiles private gifts and traits", async () => {
    if (db.dialect !== "sqlite") return;
    const pinned = db.sqlite
      .prepare<
        [],
        { player_id: number }
      >(`SELECT player_id FROM squad_entries WHERE club_id = 1 ORDER BY player_id LIMIT 1`)
      .get();
    expect(pinned).toBeDefined();

    await setAssignment(db, { clubId: 1, slot: "ST1", playerId: pinned!.player_id });
    db.sqlite
      .prepare(
        `INSERT INTO player_condition
           (player_id, fatigue_load, injury_kind, injury_matches_remaining,
            updated_season, updated_match_week, updated_at)
         VALUES (?, 0, 'strain', 2, 0, 1, ?)`,
      )
      .run(pinned!.player_id, REFERENCE_DATE.toISOString());

    const lineup = await pickStarters(db, 1);
    expect(lineup.starters.map((p) => p.playerId)).not.toContain(pinned!.player_id);
    expect(lineup.bench).toHaveLength(7);
    expect(lineup.starters.every((p) => p.gifts !== undefined && p.traits !== undefined)).toBe(
      true,
    );
  });

  it("excludes suspended players and prefers a rested rotation option", async () => {
    if (db.dialect !== "sqlite") return;
    const rows = db.sqlite
      .prepare<
        [],
        { player_id: number }
      >(`SELECT player_id FROM squad_entries WHERE club_id = 2 ORDER BY player_id LIMIT 2`)
      .all();
    const suspended = rows[0]!;
    const tired = rows[1]!;
    db.sqlite
      .prepare(
        `INSERT INTO player_discipline
           (player_id, competition_key, season, yellow_cards, suspension_matches_remaining)
         VALUES (?, 'league', 0, 0, 1)`,
      )
      .run(suspended.player_id);
    db.sqlite
      .prepare(
        `INSERT INTO player_condition
           (player_id, fatigue_load, injury_kind, injury_matches_remaining,
            updated_season, updated_match_week, updated_at)
         VALUES (?, 95, NULL, 0, 0, 1, ?)`,
      )
      .run(tired.player_id, REFERENCE_DATE.toISOString());

    const lineup = await pickStarters(db, 2);
    expect(lineup.starters.map((p) => p.playerId)).not.toContain(suspended.player_id);
    expect(lineup.starters).toHaveLength(11);
    expect(lineup.bench).toHaveLength(7);
  });

  it("throws an actionable error when fewer than eleven eligible players remain", async () => {
    if (db.dialect !== "sqlite") return;

    db.sqlite
      .prepare(
        `DELETE FROM player_condition
         WHERE player_id IN (
           SELECT player_id FROM squad_entries WHERE club_id = 1
         )`,
      )
      .run();
    db.sqlite
      .prepare(
        `INSERT INTO player_condition
           (player_id, fatigue_load, injury_kind, injury_matches_remaining,
            updated_season, updated_match_week, updated_at)
         SELECT player_id, 0, 'strain', 2, 0, 1, ?
         FROM squad_entries
         WHERE club_id = 1
         ORDER BY player_id
         LIMIT 12`,
      )
      .run(REFERENCE_DATE.toISOString());

    await expect(pickStarters(db, 1)).rejects.toThrow(
      "Cannot field club 1: only 10 eligible players are available; 11 are required. Restore player availability or add eligible players before advancing.",
    );
  });
});
