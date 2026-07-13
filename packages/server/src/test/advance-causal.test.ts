import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedContentIfMissing } from "../application/content-seed.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { advanceMatchday } from "../application/season/advance.js";
import { ensureSaveState, seedFixturesIfEmpty } from "../application/season/seed.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";
import { seedTacticsIfEmpty } from "../application/tactics/seed.js";
import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

describe("advanceMatchday causal persistence", () => {
  let db: DbClient;
  let suspendedPlayerId: number;

  beforeAll(async () => {
    db = createDbClient("sqlite::memory:");
    await runMigrations(db);
    await seedContentIfMissing(db);
    await seedWorldIfEmpty(db, {
      seed: 73,
      clubCount: 2,
      playersPerClub: 22,
      referenceDate: REFERENCE_DATE,
    });
    await seedTacticsIfEmpty(db);
    await seedSquadIfEmpty(db);
    await ensureSaveState(db);
    await seedFixturesIfEmpty(db);

    if (db.dialect !== "sqlite") return;
    const player = db.sqlite
      .prepare<[], { id: number }>(`SELECT id FROM players WHERE club_id = 1 ORDER BY id LIMIT 1`)
      .get();
    suspendedPlayerId = player!.id;
    db.sqlite
      .prepare(
        `INSERT INTO player_discipline
           (player_id, competition_key, season, yellow_cards, suspension_matches_remaining)
         VALUES (?, 'league', 0, 0, 1)`,
      )
      .run(suspendedPlayerId);
    db.sqlite
      .prepare(
        `INSERT INTO player_condition
           (player_id, fatigue_load, injury_kind, injury_matches_remaining,
            updated_season, updated_match_week, updated_at)
         SELECT id, 95, NULL, 0, 0, 1, ? FROM players WHERE club_id = 1 AND id != ?`,
      )
      .run(REFERENCE_DATE.toISOString(), suspendedPlayerId);
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("persists evidence, substitutions, condition updates, and serves a suspension", async () => {
    if (db.dialect !== "sqlite") return;
    const result = await advanceMatchday(db, {
      now: REFERENCE_DATE,
      skipAiBids: true,
    });
    expect(result.played).toBe(1);

    const match = db.sqlite
      .prepare<
        [],
        { id: number; home_goals: number; away_goals: number }
      >(`SELECT id, home_goals, away_goals FROM matches WHERE state = 'Played' LIMIT 1`)
      .get()!;
    const eventCount = db.sqlite
      .prepare<[number], { n: number }>(`SELECT COUNT(*) AS n FROM match_events WHERE match_id = ?`)
      .get(match.id)!.n;
    const goalCount = db.sqlite
      .prepare<
        [number],
        { n: number }
      >(`SELECT COUNT(*) AS n FROM match_events WHERE match_id = ? AND kind = 'Goal'`)
      .get(match.id)!.n;
    const snapshots = db.sqlite
      .prepare<
        [number],
        { n: number }
      >(`SELECT COUNT(*) AS n FROM match_side_snapshots WHERE match_id = ?`)
      .get(match.id)!.n;
    const substitutePerformances = db.sqlite
      .prepare<[number], { n: number }>(
        `SELECT COUNT(*) AS n FROM player_match_performance
         WHERE match_id = ? AND started = 0`,
      )
      .get(match.id)!.n;
    const suspendedAppearance = db.sqlite
      .prepare<
        [number, number],
        { n: number }
      >(`SELECT COUNT(*) AS n FROM player_match_performance WHERE match_id = ? AND player_id = ?`)
      .get(match.id, suspendedPlayerId)!.n;
    const suspension = db.sqlite
      .prepare<[number], { suspension_matches_remaining: number }>(
        `SELECT suspension_matches_remaining FROM player_discipline
         WHERE player_id = ? AND competition_key = 'league' AND season = 0`,
      )
      .get(suspendedPlayerId)!;
    const conditionRows = db.sqlite
      .prepare<
        [],
        { n: number }
      >(`SELECT COUNT(*) AS n FROM player_condition WHERE fatigue_load > 0`)
      .get()!.n;

    expect(eventCount).toBeGreaterThan(0);
    expect(goalCount).toBe(match.home_goals + match.away_goals);
    expect(snapshots).toBe(2);
    expect(substitutePerformances).toBeGreaterThan(0);
    expect(suspendedAppearance).toBe(0);
    expect(suspension.suspension_matches_remaining).toBe(0);
    expect(conditionRows).toBeGreaterThan(0);
  });
});
