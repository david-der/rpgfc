import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedClubIdentityIfMissing } from "../application/clubs/seed-identity.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { seedContractsIfEmpty } from "../application/players/seed-contracts.js";
import { seedScoutsIfMissing } from "../application/scouting/seed-scouts.js";
import { advanceMatchday } from "../application/season/advance.js";
import { ensureSaveState, seedFixturesIfEmpty } from "../application/season/seed.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";
import { seedTacticsIfEmpty } from "../application/tactics/seed.js";
import {
  seedListingsIfEmpty,
  seedPreferencesIfEmpty,
} from "../application/transfers/seed-listings.js";
import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

interface AvailabilitySnapshot {
  fresh: number;
  ready: number;
  heavy: number;
  spent: number;
  average: number;
  maximum: number;
}

interface WeekAudit extends AvailabilitySnapshot {
  week: number;
  durationMs: number;
  activeInjuries: number;
  activeSuspensions: number;
  minimumEligibleSquad: number;
}

describe("full-season baseline characterization (non-AC)", () => {
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
    await seedListingsIfEmpty(db);
    await seedPreferencesIfEmpty(db);
    await seedTacticsIfEmpty(db);
    await seedSquadIfEmpty(db);
    await seedContractsIfEmpty(db);
    await seedFixturesIfEmpty(db);
    await ensureSaveState(db);
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("completes the real ten-club causal season without fabricated players", async () => {
    if (db.dialect !== "sqlite") return;

    const seasonStartedAt = performance.now();
    const weeks: WeekAudit[] = [];
    const everInjured = new Set<number>();
    const everSuspended = new Set<number>();

    for (let week = 1; week <= 18; week += 1) {
      const weekStartedAt = performance.now();
      const result = await advanceMatchday(db, {
        now: new Date(Date.UTC(2026, 5, week)),
        skipAiBids: true,
      });
      const durationMs = performance.now() - weekStartedAt;

      expect(result).toEqual({
        matchday: week,
        played: 5,
        remaining: 90 - week * 5,
      });

      const injured = db.sqlite
        .prepare<[], { player_id: number }>(
          `SELECT player_id FROM player_condition
             WHERE injury_matches_remaining > 0`,
        )
        .all();
      const suspended = db.sqlite
        .prepare<[], { player_id: number }>(
          `SELECT player_id FROM player_discipline
             WHERE competition_key = 'league'
               AND season = 0
               AND suspension_matches_remaining > 0`,
        )
        .all();
      for (const player of injured) everInjured.add(player.player_id);
      for (const player of suspended) everSuspended.add(player.player_id);

      const eligibility = db.sqlite
        .prepare<[], { minimum: number }>(
          `SELECT MIN(eligible) AS minimum
             FROM (
               SELECT club.id,
                      SUM(
                        CASE WHEN COALESCE(condition.injury_matches_remaining, 0) <= 0
                                   AND COALESCE(discipline.suspension_matches_remaining, 0) <= 0
                             THEN 1 ELSE 0 END
                      ) AS eligible
               FROM clubs club
               JOIN players player ON player.club_id = club.id
               LEFT JOIN player_condition condition ON condition.player_id = player.id
               LEFT JOIN player_discipline discipline
                 ON discipline.player_id = player.id
                AND discipline.competition_key = 'league'
                AND discipline.season = 0
               GROUP BY club.id
             )`,
        )
        .get()!;

      const availability = db.sqlite
        .prepare<[], AvailabilitySnapshot>(
          `SELECT
               SUM(CASE WHEN COALESCE(pc.fatigue_load, 0) <= 20 THEN 1 ELSE 0 END) AS fresh,
               SUM(CASE WHEN COALESCE(pc.fatigue_load, 0) > 20
                         AND COALESCE(pc.fatigue_load, 0) <= 55 THEN 1 ELSE 0 END) AS ready,
               SUM(CASE WHEN COALESCE(pc.fatigue_load, 0) > 55
                         AND COALESCE(pc.fatigue_load, 0) <= 80 THEN 1 ELSE 0 END) AS heavy,
               SUM(CASE WHEN COALESCE(pc.fatigue_load, 0) > 80 THEN 1 ELSE 0 END) AS spent,
               AVG(COALESCE(pc.fatigue_load, 0)) AS average,
               MAX(COALESCE(pc.fatigue_load, 0)) AS maximum
             FROM players p
             LEFT JOIN player_condition pc ON pc.player_id = p.id`,
        )
        .get()!;
      weeks.push({
        week,
        durationMs,
        activeInjuries: injured.length,
        activeSuspensions: suspended.length,
        minimumEligibleSquad: eligibility.minimum,
        ...availability,
      });
    }

    await expect(
      advanceMatchday(db, {
        now: new Date("2026-07-01T00:00:00Z"),
        skipAiBids: true,
      }),
    ).resolves.toEqual({ matchday: null, played: 0, remaining: 0 });

    const matchStates = db.sqlite
      .prepare<[], { state: string; count: number }>(
        `SELECT state, COUNT(*) AS count
           FROM matches
           GROUP BY state
           ORDER BY state`,
      )
      .all();
    const duplicateDirectedFixtures = db.sqlite
      .prepare<[], { count: number }>(
        `SELECT COUNT(*) AS count
           FROM (
             SELECT home_club_id, away_club_id
             FROM matches
             GROUP BY home_club_id, away_club_id
             HAVING COUNT(*) != 1
           )`,
      )
      .get()!;
    const invalidPerformances = db.sqlite
      .prepare<[], { count: number }>(
        `SELECT COUNT(*) AS count
           FROM player_match_performance performance
           LEFT JOIN players player ON player.id = performance.player_id
           JOIN matches match ON match.id = performance.match_id
           WHERE player.id IS NULL
              OR player.club_id IS NULL
              OR player.club_id != performance.club_id
              OR performance.club_id NOT IN (match.home_club_id, match.away_club_id)`,
      )
      .get()!;
    const duplicatePerformances = db.sqlite
      .prepare<[], { count: number }>(
        `SELECT COUNT(*) AS count
           FROM (
             SELECT match_id, player_id
             FROM player_match_performance
             GROUP BY match_id, player_id
             HAVING COUNT(*) != 1
           )`,
      )
      .get()!;

    const playerClub = new Map(
      db.sqlite
        .prepare<[], { id: number; club_id: number | null }>(`SELECT id, club_id FROM players`)
        .all()
        .map((player) => [player.id, player.club_id]),
    );
    const snapshots = db.sqlite
      .prepare<
        [],
        {
          club_id: number;
          starter_ids_json: string;
          bench_ids_json: string;
        }
      >(
        `SELECT club_id, starter_ids_json, bench_ids_json
           FROM match_side_snapshots`,
      )
      .all();
    const invalidSnapshotPlayers: number[] = [];
    const invalidSnapshotShapes: Array<{ clubId: number; reason: string }> = [];
    for (const snapshot of snapshots) {
      const starters = JSON.parse(snapshot.starter_ids_json) as number[];
      const bench = JSON.parse(snapshot.bench_ids_json) as number[];
      const starterSet = new Set(starters);
      if (starters.length !== 11 || starterSet.size !== 11) {
        invalidSnapshotShapes.push({ clubId: snapshot.club_id, reason: "starting XI" });
      }
      if (bench.some((playerId) => starterSet.has(playerId))) {
        invalidSnapshotShapes.push({ clubId: snapshot.club_id, reason: "bench overlap" });
      }
      for (const playerId of [...starters, ...bench]) {
        if (playerClub.get(playerId) !== snapshot.club_id) {
          invalidSnapshotPlayers.push(playerId);
        }
      }
    }

    const counts = db.sqlite
      .prepare<
        [],
        {
          clubs: number;
          players: number;
          playedMatches: number;
          snapshots: number;
          events: number;
          performances: number;
          injuries: number;
          substitutions: number;
        }
      >(
        `SELECT
             (SELECT COUNT(*) FROM clubs) AS clubs,
             (SELECT COUNT(*) FROM players) AS players,
             (SELECT COUNT(*) FROM matches WHERE state = 'Played') AS playedMatches,
             (SELECT COUNT(*) FROM match_side_snapshots) AS snapshots,
             (SELECT COUNT(*) FROM match_events) AS events,
             (SELECT COUNT(*) FROM player_match_performance) AS performances,
             (SELECT COUNT(*) FROM match_events WHERE kind = 'Injury') AS injuries,
             (SELECT COUNT(*) FROM match_events WHERE kind = 'Substitution') AS substitutions`,
      )
      .get()!;
    const cards = db.sqlite
      .prepare<[], { yellows: number; reds: number }>(
        `SELECT COALESCE(SUM(yellow_cards), 0) AS yellows,
                  COALESCE(SUM(red_cards), 0) AS reds
           FROM player_match_performance`,
      )
      .get()!;

    expect(matchStates).toEqual([{ state: "Played", count: 90 }]);
    expect(duplicateDirectedFixtures.count).toBe(0);
    expect(invalidPerformances.count).toBe(0);
    expect(duplicatePerformances.count).toBe(0);
    expect(snapshots).toHaveLength(180);
    expect(invalidSnapshotPlayers).toEqual([]);
    expect(invalidSnapshotShapes).toEqual([]);
    expect(counts.clubs).toBe(10);
    expect(counts.players).toBe(200);

    const seasonDurationMs = performance.now() - seasonStartedAt;
    const finalAvailability = weeks.at(-1)!;
    const summary = {
      ...counts,
      injuries: {
        events: counts.injuries,
        distinctPlayersEverActive: everInjured.size,
        activeAtEnd: finalAvailability.activeInjuries,
        peakActive: Math.max(...weeks.map((week) => week.activeInjuries)),
      },
      discipline: {
        yellowCards: cards.yellows,
        redCards: cards.reds,
        distinctPlayersEverSuspended: everSuspended.size,
        activeAtEnd: finalAvailability.activeSuspensions,
        peakActive: Math.max(...weeks.map((week) => week.activeSuspensions)),
      },
      fatigueAtEnd: {
        fresh: finalAvailability.fresh,
        ready: finalAvailability.ready,
        heavy: finalAvailability.heavy,
        spent: finalAvailability.spent,
        average: Number(finalAvailability.average.toFixed(2)),
        maximum: finalAvailability.maximum,
      },
      fatigueSeasonPeak: {
        heavy: Math.max(...weeks.map((week) => week.heavy)),
        spent: Math.max(...weeks.map((week) => week.spent)),
        average: Number(Math.max(...weeks.map((week) => week.average)).toFixed(2)),
      },
      minimumEligibleSquad: Math.min(...weeks.map((week) => week.minimumEligibleSquad)),
      runtimeMs: {
        season: Number(seasonDurationMs.toFixed(2)),
        minimumWeek: Number(Math.min(...weeks.map((week) => week.durationMs)).toFixed(2)),
        averageWeek: Number(
          (weeks.reduce((total, week) => total + week.durationMs, 0) / weeks.length).toFixed(2),
        ),
        maximumWeek: Number(Math.max(...weeks.map((week) => week.durationMs)).toFixed(2)),
      },
    };

    console.info("FULL_SEASON_CHARACTERIZATION", JSON.stringify(summary));
  }, 30_000);
});
