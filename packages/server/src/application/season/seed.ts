// Fixture seed — Story 06.
//
// Runs after Story 05's tactics + squad seeders on world gen. Generates
// a round-robin half-season for every seeded club, writes one Scheduled
// match per fixture, and stamps a deterministic per-match seed so the
// sim engine produces the same result on every re-run.

import type { DbClient } from "../../db/client.js";
import { generateRoundRobin } from "./schedule.js";

export interface FixturesSeedResult {
  matchesCreated: number;
  matchdays: number;
  skipped: boolean;
}

const WORLD_SEED_MULTIPLIER = 31;

function hashSeed(matchday: number, homeId: number, awayId: number): number {
  // Simple deterministic hash. The shape doesn't matter much — what
  // matters is that the per-match seeds are unique and stable across
  // restarts so the sim's PRNG produces the same goals on rerun.
  let h = WORLD_SEED_MULTIPLIER;
  h = (h * 73856093) ^ matchday;
  h = (h * 19349663) ^ homeId;
  h = (h * 83492791) ^ awayId;
  return h >>> 0;
}

export async function seedFixturesIfEmpty(client: DbClient): Promise<FixturesSeedResult> {
  if (client.dialect === "sqlite") {
    const existing = client.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM matches`)
      .get();
    if ((existing?.n ?? 0) > 0) {
      return { matchesCreated: 0, matchdays: 0, skipped: true };
    }
  } else {
    const { rows } = await client.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM matches`,
    );
    if (Number(rows[0]?.n ?? 0) > 0) {
      return { matchesCreated: 0, matchdays: 0, skipped: true };
    }
  }

  const clubIds = await loadClubIds(client);
  if (clubIds.length < 2) return { matchesCreated: 0, matchdays: 0, skipped: false };

  const schedule = generateRoundRobin(clubIds);
  let created = 0;

  for (const md of schedule) {
    for (const fx of md.fixtures) {
      const seed = hashSeed(md.matchday, fx.homeClubId, fx.awayClubId);
      await insertMatch(client, md.matchday, fx.homeClubId, fx.awayClubId, seed);
      created++;
    }
  }

  return { matchesCreated: created, matchdays: schedule.length, skipped: false };
}

async function loadClubIds(client: DbClient): Promise<number[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[], { id: number }>(`SELECT id FROM clubs ORDER BY id`)
      .all()
      .map((r) => r.id);
  }
  const res = await client.pool.query<{ id: number }>(
    `SELECT id FROM clubs ORDER BY id`,
  );
  return res.rows.map((r) => r.id);
}

async function insertMatch(
  client: DbClient,
  matchday: number,
  homeClubId: number,
  awayClubId: number,
  seed: number,
): Promise<void> {
  if (client.dialect === "sqlite") {
    client.sqlite
      .prepare(
        `INSERT INTO matches
           (matchday, home_club_id, away_club_id, state, seed)
         VALUES (?, ?, ?, 'Scheduled', ?)`,
      )
      .run(matchday, homeClubId, awayClubId, seed);
    return;
  }
  await client.pool.query(
    `INSERT INTO matches
       (matchday, home_club_id, away_club_id, state, seed)
     VALUES ($1, $2, $3, 'Scheduled', $4)`,
    [matchday, homeClubId, awayClubId, seed],
  );
}
