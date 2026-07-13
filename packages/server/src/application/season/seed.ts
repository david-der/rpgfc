// Fixture seed — Story 06.
//
// Runs after Story 05's tactics + squad seeders on world gen. Generates
// a round-robin half-season for every seeded club, writes one Scheduled
// match per fixture, and stamps a deterministic per-match seed so the
// sim engine produces the same result on every re-run.

import type { DbClient } from "../../db/client.js";
import { generateFullSeason } from "./schedule.js";
import { fixtureSeed } from "./seed-value.js";

// ── save_state auto-create ───────────────────────────────────────────────

export async function ensureSaveState(client: DbClient): Promise<void> {
  const now = new Date().toISOString();
  if (client.dialect === "sqlite") {
    client.sqlite
      .prepare(
        `INSERT OR IGNORE INTO save_state
           (id, save_name, season, next_match_week, created_at, updated_at)
         VALUES (1, 'Default', 0, 1, ?, ?)`,
      )
      .run(now, now);
    return;
  }
  await client.pool.query(
    `INSERT INTO save_state
       (id, save_name, season, next_match_week, created_at, updated_at)
     VALUES (1, 'Default', 0, 1, $1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [now, now],
  );
}

export interface FixturesSeedResult {
  matchesCreated: number;
  matchdays: number;
  skipped: boolean;
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
  const worldSeed = await loadWorldSeed(client);

  const schedule = generateFullSeason(clubIds);
  let created = 0;

  for (const md of schedule) {
    for (const fx of md.fixtures) {
      const seed = fixtureSeed(worldSeed, 0, md.matchday, fx.homeClubId, fx.awayClubId);
      await insertMatch(client, md.matchday, fx.homeClubId, fx.awayClubId, seed, 0);
      created++;
    }
  }

  return { matchesCreated: created, matchdays: schedule.length, skipped: false };
}

async function loadWorldSeed(client: DbClient): Promise<number> {
  if (client.dialect === "sqlite") {
    return (
      client.sqlite.prepare<[], { seed: number }>(`SELECT seed FROM runs ORDER BY id LIMIT 1`).get()
        ?.seed ?? 42
    );
  }
  const result = await client.pool.query<{ seed: number }>(
    `SELECT seed FROM runs ORDER BY id LIMIT 1`,
  );
  return result.rows[0]?.seed ?? 42;
}

async function loadClubIds(client: DbClient): Promise<number[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[], { id: number }>(`SELECT id FROM clubs ORDER BY id`)
      .all()
      .map((r) => r.id);
  }
  const res = await client.pool.query<{ id: number }>(`SELECT id FROM clubs ORDER BY id`);
  return res.rows.map((r) => r.id);
}

async function insertMatch(
  client: DbClient,
  matchday: number,
  homeClubId: number,
  awayClubId: number,
  seed: number,
  season: number,
): Promise<void> {
  if (client.dialect === "sqlite") {
    client.sqlite
      .prepare(
        `INSERT INTO matches
           (matchday, home_club_id, away_club_id, state, seed, season)
         VALUES (?, ?, ?, 'Scheduled', ?, ?)`,
      )
      .run(matchday, homeClubId, awayClubId, seed, season);
    return;
  }
  await client.pool.query(
    `INSERT INTO matches
       (matchday, home_club_id, away_club_id, state, seed, season)
     VALUES ($1, $2, $3, 'Scheduled', $4, $5)`,
    [matchday, homeClubId, awayClubId, seed, season],
  );
}
