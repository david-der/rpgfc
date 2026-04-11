// Players application service. Returns HiddenPlayer shapes internally.
// Routes never reach into this module — the `no-hidden-in-routes` ESLint
// rule makes that a lint error. Routes see only the RenderedPlayer output
// of `renderPlayer(hidden, ctx, deps)`.
//
// Story 01 scope:
//   - getPlayerById(db, id)       → HiddenPlayer | null
//   - listPlayers(db, query)      → { items, nextCursor }
//   - seedWorldIfEmpty(db, cfg)   → idempotent; runs generation once per DB
//
// All queries go through Drizzle. The JSON TEXT columns are parsed at the
// boundary — nothing deep in the stack cares that storage is TEXT.

import type { PreferredFoot } from "@rpgfc/shared";
import type { HiddenPlayer, NewHiddenPlayer } from "@rpgfc/shared/types/hidden";
import { asHiddenPlayer } from "@rpgfc/shared/types/hidden";

import type { DbClient } from "../../db/client.js";
import { generateWorld } from "../generation/generate-world.js";

// ── row ↔ domain conversion ────────────────────────────────────────────────

interface PlayerRow {
  id: number;
  run_id: number;
  club_id: number | null;
  name: string;
  dob: string;
  nationality: string;
  preferred_foot: string;
  archetype_id: string;
  hidden_attrs_json: string;
  mental_traits_json: string;
  experience_years: number;
  narrative_seed_json: string;
}

function rowToHidden(row: PlayerRow): HiddenPlayer {
  return asHiddenPlayer({
    id: row.id,
    runId: row.run_id,
    clubId: row.club_id,
    name: row.name,
    dob: row.dob,
    nationality: row.nationality,
    preferredFoot: row.preferred_foot as PreferredFoot,
    archetypeId: row.archetype_id,
    hiddenAttrs: JSON.parse(row.hidden_attrs_json),
    mentalTraits: JSON.parse(row.mental_traits_json),
    badgeKeys: [], // joined separately — see loadBadgeKeys below
    experienceYears: row.experience_years,
    narrativeSeed: JSON.parse(row.narrative_seed_json),
  });
}

function newPlayerToInsert(p: NewHiddenPlayer, clubId: number | null, now: string) {
  return {
    run_id: p.runId,
    club_id: clubId,
    name: p.name,
    dob: p.dob,
    nationality: p.nationality,
    preferred_foot: p.preferredFoot,
    archetype_id: p.archetypeId,
    hidden_attrs_json: JSON.stringify(p.hiddenAttrs),
    mental_traits_json: JSON.stringify(p.mentalTraits),
    experience_years: p.experienceYears,
    narrative_seed_json: JSON.stringify(p.narrativeSeed),
    created_at: now,
  };
}

async function loadBadgeKeys(client: DbClient, playerId: number): Promise<string[]> {
  if (client.dialect === "sqlite") {
    const rows = client.sqlite
      .prepare<[number], { badge_key: string }>(
        `SELECT badge_key FROM player_badges WHERE player_id = ?`,
      )
      .all(playerId);
    return rows.map((r) => r.badge_key);
  }
  const res = await client.pool.query<{ badge_key: string }>(
    `SELECT badge_key FROM player_badges WHERE player_id = $1`,
    [playerId],
  );
  return res.rows.map((r) => r.badge_key);
}

// ── public API ────────────────────────────────────────────────────────────

export async function getPlayerById(
  client: DbClient,
  id: number,
): Promise<HiddenPlayer | null> {
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<[number], PlayerRow>(
        `SELECT id, run_id, club_id, name, dob, nationality, preferred_foot,
                archetype_id, hidden_attrs_json, mental_traits_json,
                experience_years, narrative_seed_json
         FROM players WHERE id = ?`,
      )
      .get(id);
    if (!row) return null;
    const hidden = rowToHidden(row);
    hidden.badgeKeys = await loadBadgeKeys(client, id);
    return hidden;
  }

  const res = await client.pool.query<PlayerRow>(
    `SELECT id, run_id, club_id, name, dob, nationality, preferred_foot,
            archetype_id, hidden_attrs_json, mental_traits_json,
            experience_years, narrative_seed_json
     FROM players WHERE id = $1`,
    [id],
  );
  const row = res.rows[0];
  if (!row) return null;
  const hidden = rowToHidden(row);
  hidden.badgeKeys = await loadBadgeKeys(client, id);
  return hidden;
}

export interface ListQuery {
  clubId?: number | undefined;
  cursor?: number | undefined; // cursor = last id seen; null = start
  limit: number; // Zod-validated at the route boundary
}

export interface ListResult {
  items: HiddenPlayer[];
  nextCursor: number | null;
}

export async function listPlayers(
  client: DbClient,
  query: ListQuery,
): Promise<ListResult> {
  const limit = Math.min(Math.max(query.limit, 1), 100);

  if (client.dialect === "sqlite") {
    // Keep the SQL simple: paginate by id cursor, then apply the clubId
    // filter in JS. Story 01's largest realistic list (all players, one
    // page of 100) is small enough that this is effectively free, and it
    // avoids the `? IS NULL` sentinel gymnastics across dialects.
    const rows = client.sqlite
      .prepare<[number, number], PlayerRow>(
        `SELECT id, run_id, club_id, name, dob, nationality, preferred_foot,
                archetype_id, hidden_attrs_json, mental_traits_json,
                experience_years, narrative_seed_json
         FROM players
         WHERE id > ?
         ORDER BY id ASC
         LIMIT ?`,
      )
      .all(query.cursor ?? 0, limit);

    const filtered =
      query.clubId !== undefined ? rows.filter((r) => r.club_id === query.clubId) : rows;
    const items = filtered.map(rowToHidden);
    for (const item of items) {
      item.badgeKeys = await loadBadgeKeys(client, item.id);
    }
    const last = items[items.length - 1];
    const nextCursor = items.length === limit && last ? last.id : null;
    return { items, nextCursor };
  }

  // Postgres path — raw SQL keeps the parameter shape consistent with the
  // SQLite branch above.
  const params: unknown[] = [query.cursor ?? 0, limit];
  let sql = `
    SELECT id, run_id, club_id, name, dob, nationality, preferred_foot,
           archetype_id, hidden_attrs_json, mental_traits_json,
           experience_years, narrative_seed_json
    FROM players
    WHERE id > $1`;
  if (query.clubId !== undefined) {
    sql += ` AND club_id = $3`;
    params.push(query.clubId);
  }
  sql += ` ORDER BY id ASC LIMIT $2`;
  const res = await client.pool.query<PlayerRow>(sql, params);
  const items = res.rows.map(rowToHidden);
  for (const item of items) {
    item.badgeKeys = await loadBadgeKeys(client, item.id);
  }
  const last = items[items.length - 1];
  const nextCursor = items.length === limit && last ? last.id : null;
  return { items, nextCursor };
}

// ── one-shot world seeder ─────────────────────────────────────────────────

export interface SeedConfig {
  seed: number;
  clubCount: number;
  playersPerClub: number;
  referenceDate: Date;
}

export interface SeedResult {
  clubsCreated: number;
  playersCreated: number;
  skipped: boolean;
}

export async function seedWorldIfEmpty(
  client: DbClient,
  config: SeedConfig,
): Promise<SeedResult> {
  // Idempotent: if players already exist, do nothing.
  const existing = await countPlayers(client);
  if (existing > 0) {
    return { clubsCreated: 0, playersCreated: 0, skipped: true };
  }

  const world = generateWorld(config);
  const now = new Date().toISOString();

  if (client.dialect === "sqlite") {
    const sqlite = client.sqlite;
    const insertRun = sqlite.prepare(
      `INSERT INTO runs (seed, started_at) VALUES (?, ?)`,
    );
    const insertClub = sqlite.prepare(
      `INSERT INTO clubs (run_id, name, nationality, founded_year, created_at) VALUES (?, ?, ?, ?, ?)`,
    );
    const insertPlayer = sqlite.prepare(
      `INSERT INTO players (run_id, club_id, name, dob, nationality, preferred_foot,
                            archetype_id, hidden_attrs_json, mental_traits_json,
                            experience_years, narrative_seed_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertBadge = sqlite.prepare(
      `INSERT INTO player_badges (player_id, badge_key, tier, awarded_at, awarded_reason)
       VALUES (?, ?, ?, ?, ?)`,
    );

    sqlite.exec("BEGIN");
    try {
      const runInfo = insertRun.run(config.seed, now);
      const runId = Number(runInfo.lastInsertRowid);

      let clubsCreated = 0;
      let playersCreated = 0;

      for (const club of world.clubs) {
        const clubInfo = insertClub.run(
          runId,
          club.name,
          club.nationality,
          club.foundedYear,
          now,
        );
        const clubId = Number(clubInfo.lastInsertRowid);
        clubsCreated++;
        for (const p of club.players) {
          const insert = newPlayerToInsert(p, clubId, now);
          const pInfo = insertPlayer.run(
            runId,
            clubId,
            insert.name,
            insert.dob,
            insert.nationality,
            insert.preferred_foot,
            insert.archetype_id,
            insert.hidden_attrs_json,
            insert.mental_traits_json,
            insert.experience_years,
            insert.narrative_seed_json,
            now,
          );
          const playerId = Number(pInfo.lastInsertRowid);
          for (const key of p.badgeKeys) {
            insertBadge.run(playerId, key, null, now, "generation");
          }
          playersCreated++;
        }
      }
      sqlite.exec("COMMIT");
      return { clubsCreated, playersCreated, skipped: false };
    } catch (err) {
      sqlite.exec("ROLLBACK");
      throw err;
    }
  }

  // Postgres path
  const pg = await client.pool.connect();
  try {
    await pg.query("BEGIN");
    const runRes = await pg.query<{ id: number }>(
      `INSERT INTO runs (seed, started_at) VALUES ($1, $2) RETURNING id`,
      [config.seed, now],
    );
    const runId = runRes.rows[0]!.id;

    let clubsCreated = 0;
    let playersCreated = 0;

    for (const club of world.clubs) {
      const clubRes = await pg.query<{ id: number }>(
        `INSERT INTO clubs (run_id, name, nationality, founded_year, created_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [runId, club.name, club.nationality, club.foundedYear, now],
      );
      const clubId = clubRes.rows[0]!.id;
      clubsCreated++;
      for (const p of club.players) {
        const insert = newPlayerToInsert(p, clubId, now);
        const pRes = await pg.query<{ id: number }>(
          `INSERT INTO players (run_id, club_id, name, dob, nationality, preferred_foot,
                                archetype_id, hidden_attrs_json, mental_traits_json,
                                experience_years, narrative_seed_json, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id`,
          [
            runId,
            clubId,
            insert.name,
            insert.dob,
            insert.nationality,
            insert.preferred_foot,
            insert.archetype_id,
            insert.hidden_attrs_json,
            insert.mental_traits_json,
            insert.experience_years,
            insert.narrative_seed_json,
            now,
          ],
        );
        const playerId = pRes.rows[0]!.id;
        for (const key of p.badgeKeys) {
          await pg.query(
            `INSERT INTO player_badges (player_id, badge_key, tier, awarded_at, awarded_reason)
             VALUES ($1, $2, $3, $4, $5)`,
            [playerId, key, null, now, "generation"],
          );
        }
        playersCreated++;
      }
    }
    await pg.query("COMMIT");
    return { clubsCreated, playersCreated, skipped: false };
  } catch (err) {
    await pg.query("ROLLBACK");
    throw err;
  } finally {
    pg.release();
  }
}

export async function countPlayers(client: DbClient): Promise<number> {
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM players`)
      .get();
    return row?.n ?? 0;
  }
  const res = await client.pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM players`,
  );
  return Number(res.rows[0]?.n ?? 0);
}

// ── club resolver ────────────────────────────────────────────────────────

export function findClubSync(
  client: DbClient,
  id: number,
): { id: number; name: string } | null {
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<[number], { id: number; name: string }>(
        `SELECT id, name FROM clubs WHERE id = ?`,
      )
      .get(id);
    return row ?? null;
  }
  // The render path prefers sync club lookup for simplicity in Story 01.
  // For Postgres we preload clubs into a map on the service boundary; see
  // the route module for the preload pattern.
  return null;
}

export async function loadClubMap(
  client: DbClient,
): Promise<Map<number, { id: number; name: string }>> {
  const map = new Map<number, { id: number; name: string }>();
  if (client.dialect === "sqlite") {
    const rows = client.sqlite
      .prepare<[], { id: number; name: string }>(`SELECT id, name FROM clubs`)
      .all();
    for (const r of rows) map.set(r.id, r);
    return map;
  }
  const res = await client.pool.query<{ id: number; name: string }>(
    `SELECT id, name FROM clubs`,
  );
  for (const r of res.rows) map.set(r.id, r);
  return map;
}
