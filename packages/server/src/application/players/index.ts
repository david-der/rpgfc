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
import { ARCHETYPE_BY_ID } from "@rpgfc/shared";
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
  age: number;
  nationality: string;
  preferred_foot: string;
  archetype_id: string;
  hidden_attrs_json: string;
  mental_traits_json: string;
  experience_years: number;
  narrative_seed_json: string;
  preferred_positions_json: string;
}

function rowToHidden(row: PlayerRow): HiddenPlayer {
  let preferredPositions: string[] = [];
  try {
    preferredPositions = JSON.parse(row.preferred_positions_json ?? "[]");
  } catch {
    preferredPositions = [];
  }
  return asHiddenPlayer({
    id: row.id,
    runId: row.run_id,
    clubId: row.club_id,
    name: row.name,
    dob: row.dob,
    age: row.age,
    nationality: row.nationality,
    preferredFoot: row.preferred_foot as PreferredFoot,
    archetypeId: row.archetype_id,
    hiddenAttrs: JSON.parse(row.hidden_attrs_json),
    mentalTraits: JSON.parse(row.mental_traits_json),
    badgeKeys: [],
    preferredPositions,
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
    age: p.age,
    nationality: p.nationality,
    preferred_foot: p.preferredFoot,
    archetype_id: p.archetypeId,
    hidden_attrs_json: JSON.stringify(p.hiddenAttrs),
    mental_traits_json: JSON.stringify(p.mentalTraits),
    experience_years: p.experienceYears,
    narrative_seed_json: JSON.stringify(p.narrativeSeed),
    preferred_positions_json: JSON.stringify(p.preferredPositions),
    created_at: now,
  };
}

async function loadBadgeKeys(client: DbClient, playerId: number): Promise<string[]> {
  if (client.dialect === "sqlite") {
    const rows = client.sqlite
      .prepare<
        [number],
        { badge_key: string }
      >(`SELECT badge_key FROM player_badges WHERE player_id = ?`)
      .all(playerId);
    return rows.map((r) => r.badge_key);
  }
  const res = await client.pool.query<{ badge_key: string }>(
    `SELECT badge_key FROM player_badges WHERE player_id = $1`,
    [playerId],
  );
  return res.rows.map((r) => r.badge_key);
}

async function loadBadgeKeysForPlayers(
  client: DbClient,
  playerIds: number[],
): Promise<Map<number, string[]>> {
  const byPlayer = new Map<number, string[]>();
  for (const id of playerIds) byPlayer.set(id, []);
  if (playerIds.length === 0) return byPlayer;

  if (client.dialect === "sqlite") {
    const placeholders = playerIds.map(() => "?").join(",");
    const rows = client.sqlite
      .prepare<number[], { player_id: number; badge_key: string }>(
        `SELECT player_id, badge_key FROM player_badges
         WHERE player_id IN (${placeholders})
         ORDER BY player_id, id`,
      )
      .all(...playerIds);
    for (const row of rows) byPlayer.get(row.player_id)?.push(row.badge_key);
    return byPlayer;
  }

  const result = await client.pool.query<{ player_id: number; badge_key: string }>(
    `SELECT player_id, badge_key FROM player_badges
     WHERE player_id = ANY($1::int[])
     ORDER BY player_id, id`,
    [playerIds],
  );
  for (const row of result.rows) byPlayer.get(row.player_id)?.push(row.badge_key);
  return byPlayer;
}

// ── public API ────────────────────────────────────────────────────────────

export async function getPlayerById(client: DbClient, id: number): Promise<HiddenPlayer | null> {
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<[number], PlayerRow>(
        `SELECT id, run_id, club_id, name, dob, age, nationality, preferred_foot,
                archetype_id, hidden_attrs_json, mental_traits_json,
                experience_years, narrative_seed_json, preferred_positions_json
         FROM players WHERE id = ?`,
      )
      .get(id);
    if (!row) return null;
    const hidden = rowToHidden(row);
    hidden.badgeKeys = await loadBadgeKeys(client, id);
    return hidden;
  }

  const res = await client.pool.query<PlayerRow>(
    `SELECT id, run_id, club_id, name, dob, age, nationality, preferred_foot,
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
  cursor?: number | undefined;
  limit: number;
  /** Story 07: search by name substring (case-insensitive). */
  search?: string | undefined;
  /** Story 07: filter to players currently on the transfer market. */
  onMarket?: boolean | undefined;
  /** Story 07: filter by archetype position label (e.g. "ST", "CB"). */
  position?: string | undefined;
}

export interface ListResult {
  items: HiddenPlayer[];
  nextCursor: number | null;
}

function archetypeIdsForPosition(position: string): string[] {
  const target = position.toUpperCase();
  return Object.entries(ARCHETYPE_BY_ID)
    .filter(([, archetype]) => archetype.positionLabel.toUpperCase() === target)
    .map(([id]) => id);
}

export async function listPlayers(client: DbClient, query: ListQuery): Promise<ListResult> {
  const limit = Math.min(Math.max(query.limit, 1), 250);
  const positionArchetypes = query.position ? archetypeIdsForPosition(query.position) : [];

  if (client.dialect === "sqlite") {
    const conditions = ["p.id > ?"];
    const params: Array<string | number> = [query.cursor ?? 0];
    if (query.clubId !== undefined) {
      conditions.push("p.club_id = ?");
      params.push(query.clubId);
    }
    if (query.search) {
      conditions.push("LOWER(p.name) LIKE ?");
      params.push(`%${query.search.toLowerCase()}%`);
    }
    if (query.onMarket) {
      conditions.push("EXISTS (SELECT 1 FROM listing l WHERE l.player_id = p.id)");
    }
    if (query.position) {
      if (positionArchetypes.length === 0) return { items: [], nextCursor: null };
      conditions.push(`p.archetype_id IN (${positionArchetypes.map(() => "?").join(",")})`);
      params.push(...positionArchetypes);
    }
    params.push(limit + 1);

    const rows = client.sqlite
      .prepare(
        `SELECT p.id, p.run_id, p.club_id, p.name, p.dob, p.age, p.nationality,
                p.preferred_foot, p.archetype_id, p.hidden_attrs_json,
                p.mental_traits_json, p.experience_years, p.narrative_seed_json,
                p.preferred_positions_json
         FROM players p
         WHERE ${conditions.join(" AND ")}
         ORDER BY p.id ASC
         LIMIT ?`,
      )
      .all(...params) as PlayerRow[];

    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const items = pageRows.map(rowToHidden);
    const badgeMap = await loadBadgeKeysForPlayers(
      client,
      items.map((item) => item.id),
    );
    for (const item of items) item.badgeKeys = badgeMap.get(item.id) ?? [];
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? last.id : null;
    return { items, nextCursor };
  }

  const params: unknown[] = [query.cursor ?? 0];
  const conditions = ["p.id > $1"];
  let sql = `
    SELECT p.id, p.run_id, p.club_id, p.name, p.dob, p.age, p.nationality,
           p.preferred_foot, p.archetype_id, p.hidden_attrs_json,
           p.mental_traits_json, p.experience_years, p.narrative_seed_json,
           p.preferred_positions_json
    FROM players p`;
  if (query.clubId !== undefined) {
    params.push(query.clubId);
    conditions.push(`p.club_id = $${params.length}`);
  }
  if (query.search) {
    params.push(`%${query.search.toLowerCase()}%`);
    conditions.push(`LOWER(p.name) LIKE $${params.length}`);
  }
  if (query.onMarket) {
    conditions.push(`EXISTS (SELECT 1 FROM listing l WHERE l.player_id = p.id)`);
  }
  if (query.position) {
    if (positionArchetypes.length === 0) return { items: [], nextCursor: null };
    params.push(positionArchetypes);
    conditions.push(`p.archetype_id = ANY($${params.length}::text[])`);
  }
  params.push(limit + 1);
  sql += ` WHERE ${conditions.join(" AND ")} ORDER BY p.id ASC LIMIT $${params.length}`;
  const res = await client.pool.query<PlayerRow>(sql, params);

  const hasMore = res.rows.length > limit;
  const items = res.rows.slice(0, limit).map(rowToHidden);
  const badgeMap = await loadBadgeKeysForPlayers(
    client,
    items.map((item) => item.id),
  );
  for (const item of items) item.badgeKeys = badgeMap.get(item.id) ?? [];
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? last.id : null;
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

export async function seedWorldIfEmpty(client: DbClient, config: SeedConfig): Promise<SeedResult> {
  // Idempotent: if players already exist, do nothing.
  const existing = await countPlayers(client);
  if (existing > 0) {
    return { clubsCreated: 0, playersCreated: 0, skipped: true };
  }

  const world = generateWorld(config);
  const now = new Date().toISOString();

  if (client.dialect === "sqlite") {
    const sqlite = client.sqlite;
    const insertRun = sqlite.prepare(`INSERT INTO runs (seed, started_at) VALUES (?, ?)`);
    const insertClub = sqlite.prepare(
      `INSERT INTO clubs (run_id, name, nationality, founded_year, created_at) VALUES (?, ?, ?, ?, ?)`,
    );
    const insertPlayer = sqlite.prepare(
      `INSERT INTO players (run_id, club_id, name, dob, age, nationality, preferred_foot,
                            archetype_id, hidden_attrs_json, mental_traits_json,
                            experience_years, narrative_seed_json, preferred_positions_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        const clubInfo = insertClub.run(runId, club.name, club.nationality, club.foundedYear, now);
        const clubId = Number(clubInfo.lastInsertRowid);
        clubsCreated++;
        for (const p of club.players) {
          const insert = newPlayerToInsert(p, clubId, now);
          const pInfo = insertPlayer.run(
            runId,
            clubId,
            insert.name,
            insert.dob,
            insert.age,
            insert.nationality,
            insert.preferred_foot,
            insert.archetype_id,
            insert.hidden_attrs_json,
            insert.mental_traits_json,
            insert.experience_years,
            insert.narrative_seed_json,
            insert.preferred_positions_json,
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
          `INSERT INTO players (run_id, club_id, name, dob, age, nationality, preferred_foot,
                                archetype_id, hidden_attrs_json, mental_traits_json,
                                experience_years, narrative_seed_json, preferred_positions_json, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING id`,
          [
            runId,
            clubId,
            insert.name,
            insert.dob,
            insert.age,
            insert.nationality,
            insert.preferred_foot,
            insert.archetype_id,
            insert.hidden_attrs_json,
            insert.mental_traits_json,
            insert.experience_years,
            insert.narrative_seed_json,
            insert.preferred_positions_json,
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
    const row = client.sqlite.prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM players`).get();
    return row?.n ?? 0;
  }
  const res = await client.pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM players`);
  return Number(res.rows[0]?.n ?? 0);
}

// ── club resolver ────────────────────────────────────────────────────────

export function findClubSync(client: DbClient, id: number): { id: number; name: string } | null {
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<[number], { id: number; name: string }>(`SELECT id, name FROM clubs WHERE id = ?`)
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
  const res = await client.pool.query<{ id: number; name: string }>(`SELECT id, name FROM clubs`);
  for (const r of res.rows) map.set(r.id, r);
  return map;
}
