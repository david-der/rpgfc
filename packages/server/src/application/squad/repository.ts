// Squad repository — Story 05.
//
// One squad_entries row per contracted player, keyed on player_id. The
// repository is a thin wrapper over the SQL; the mood computation lives
// in `./harmony.ts` and is imported by the rendering layer.

import type { SquadEntry, SquadRole } from "@rpgfc/shared";
import { SQUAD_ROLES } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";

interface SquadEntryRow {
  id: number;
  club_id: number;
  player_id: number;
  role: string;
  updated_at: string;
}

function parseRole(raw: string): SquadRole {
  return (SQUAD_ROLES as readonly string[]).includes(raw) ? (raw as SquadRole) : "Rotation";
}

function rowToEntry(row: SquadEntryRow): SquadEntry {
  return {
    id: row.id,
    clubId: row.club_id,
    playerId: row.player_id,
    role: parseRole(row.role),
    updatedAt: row.updated_at,
  };
}

export async function listSquadByClub(client: DbClient, clubId: number): Promise<SquadEntry[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[number], SquadEntryRow>(
        `SELECT id, club_id, player_id, role, updated_at
         FROM squad_entries WHERE club_id = ? ORDER BY id`,
      )
      .all(clubId)
      .map(rowToEntry);
  }
  const res = await client.pool.query<SquadEntryRow>(
    `SELECT id, club_id, player_id, role, updated_at
     FROM squad_entries WHERE club_id = $1 ORDER BY id`,
    [clubId],
  );
  return res.rows.map(rowToEntry);
}

export async function getSquadEntryByPlayer(
  client: DbClient,
  playerId: number,
): Promise<SquadEntry | null> {
  if (client.dialect === "sqlite") {
    const row =
      client.sqlite
        .prepare<[number], SquadEntryRow>(
          `SELECT id, club_id, player_id, role, updated_at
           FROM squad_entries WHERE player_id = ?`,
        )
        .get(playerId) ?? null;
    return row ? rowToEntry(row) : null;
  }
  const res = await client.pool.query<SquadEntryRow>(
    `SELECT id, club_id, player_id, role, updated_at
     FROM squad_entries WHERE player_id = $1`,
    [playerId],
  );
  return res.rows[0] ? rowToEntry(res.rows[0]) : null;
}

export async function upsertSquadEntry(
  client: DbClient,
  input: { clubId: number; playerId: number; role: SquadRole; now?: Date },
): Promise<SquadEntry> {
  const existing = await getSquadEntryByPlayer(client, input.playerId);
  const nowIso = (input.now ?? new Date()).toISOString();
  if (existing) {
    if (client.dialect === "sqlite") {
      client.sqlite
        .prepare(`UPDATE squad_entries SET club_id = ?, role = ?, updated_at = ? WHERE id = ?`)
        .run(input.clubId, input.role, nowIso, existing.id);
    } else {
      await client.pool.query(
        `UPDATE squad_entries SET club_id = $1, role = $2, updated_at = $3 WHERE id = $4`,
        [input.clubId, input.role, nowIso, existing.id],
      );
    }
    return { ...existing, clubId: input.clubId, role: input.role, updatedAt: nowIso };
  }

  if (client.dialect === "sqlite") {
    const result = client.sqlite
      .prepare(
        `INSERT INTO squad_entries (club_id, player_id, role, updated_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(input.clubId, input.playerId, input.role, nowIso);
    return {
      id: Number(result.lastInsertRowid),
      clubId: input.clubId,
      playerId: input.playerId,
      role: input.role,
      updatedAt: nowIso,
    };
  }
  const res = await client.pool.query<{ id: number }>(
    `INSERT INTO squad_entries (club_id, player_id, role, updated_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.clubId, input.playerId, input.role, nowIso],
  );
  return {
    id: res.rows[0]!.id,
    clubId: input.clubId,
    playerId: input.playerId,
    role: input.role,
    updatedAt: nowIso,
  };
}

export async function setSquadRole(
  client: DbClient,
  input: { playerId: number; role: SquadRole; now?: Date },
): Promise<SquadEntry | null> {
  const existing = await getSquadEntryByPlayer(client, input.playerId);
  if (!existing) return null;
  return upsertSquadEntry(client, {
    clubId: existing.clubId,
    playerId: input.playerId,
    role: input.role,
    ...(input.now ? { now: input.now } : {}),
  });
}
