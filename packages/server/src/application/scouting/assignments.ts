// Scout assignments — start, list, end. Story 03.
//
// Each scout has at most one active assignment at any time. Starting a
// new one auto-ends the previous one (closes its `ended_at` timestamp).
// Two assignment kinds ship in Story 03:
//
//   region — the scout roams a region, observing random unsigned/listed
//            players matching that region on each weekly tick.
//   player — the scout watches one named player on each weekly tick.

import type { AssignmentKind, AssignmentRef, ScoutRegion } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";

interface AssignmentRow {
  id: number;
  scout_id: number;
  kind: string;
  target_region: string | null;
  target_player_id: number | null;
  started_at: string;
  ended_at: string | null;
}

interface ScoutMetaRow {
  id: number;
  name: string;
  region: string;
}

function rowToRef(row: AssignmentRow, playerName: string | null): AssignmentRef {
  return {
    id: row.id,
    scoutId: row.scout_id,
    kind: row.kind as AssignmentKind,
    targetRegion: (row.target_region as ScoutRegion | null) ?? null,
    targetPlayerId: row.target_player_id,
    targetPlayerName: playerName,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

export interface StartAssignmentParams {
  scoutId: number;
  kind: AssignmentKind;
  targetRegion?: ScoutRegion | null;
  targetPlayerId?: number | null;
  now?: Date;
}

export async function startAssignment(
  client: DbClient,
  params: StartAssignmentParams,
): Promise<AssignmentRef> {
  const now = (params.now ?? new Date()).toISOString();

  if (params.kind === "region" && !params.targetRegion) {
    throw new Error("Region assignments require a targetRegion");
  }
  if (params.kind === "player" && !params.targetPlayerId) {
    throw new Error("Player assignments require a targetPlayerId");
  }

  if (client.dialect === "sqlite") {
    const sqlite = client.sqlite;
    sqlite.exec("BEGIN");
    try {
      // End any active assignment for this scout.
      sqlite
        .prepare(
          `UPDATE scout_assignments
           SET ended_at = ?
           WHERE scout_id = ? AND ended_at IS NULL`,
        )
        .run(now, params.scoutId);

      const insertResult = sqlite
        .prepare(
          `INSERT INTO scout_assignments
             (scout_id, kind, target_region, target_player_id, started_at, ended_at)
           VALUES (?, ?, ?, ?, ?, NULL)`,
        )
        .run(
          params.scoutId,
          params.kind,
          params.targetRegion ?? null,
          params.targetPlayerId ?? null,
          now,
        );

      const id = Number(insertResult.lastInsertRowid);
      const row = sqlite
        .prepare<[number], AssignmentRow>(
          `SELECT id, scout_id, kind, target_region, target_player_id,
                  started_at, ended_at
           FROM scout_assignments WHERE id = ?`,
        )
        .get(id);
      sqlite.exec("COMMIT");
      if (!row) throw new Error("Failed to read back inserted assignment");

      let playerName: string | null = null;
      if (row.target_player_id) {
        const p = sqlite
          .prepare<[number], { name: string }>(`SELECT name FROM players WHERE id = ?`)
          .get(row.target_player_id);
        playerName = p?.name ?? null;
      }
      return rowToRef(row, playerName);
    } catch (err) {
      sqlite.exec("ROLLBACK");
      throw err;
    }
  }

  // Postgres path
  const pg = await client.pool.connect();
  try {
    await pg.query("BEGIN");
    await pg.query(
      `UPDATE scout_assignments
       SET ended_at = $1
       WHERE scout_id = $2 AND ended_at IS NULL`,
      [now, params.scoutId],
    );
    const inserted = await pg.query<AssignmentRow>(
      `INSERT INTO scout_assignments
         (scout_id, kind, target_region, target_player_id, started_at, ended_at)
       VALUES ($1, $2, $3, $4, $5, NULL)
       RETURNING id, scout_id, kind, target_region, target_player_id, started_at, ended_at`,
      [
        params.scoutId,
        params.kind,
        params.targetRegion ?? null,
        params.targetPlayerId ?? null,
        now,
      ],
    );
    await pg.query("COMMIT");
    const row = inserted.rows[0];
    if (!row) throw new Error("Failed to read back inserted assignment");

    let playerName: string | null = null;
    if (row.target_player_id) {
      const p = await pg.query<{ name: string }>(
        `SELECT name FROM players WHERE id = $1`,
        [row.target_player_id],
      );
      playerName = p.rows[0]?.name ?? null;
    }
    return rowToRef(row, playerName);
  } catch (err) {
    await pg.query("ROLLBACK");
    throw err;
  } finally {
    pg.release();
  }
}

export async function getActiveAssignment(
  client: DbClient,
  scoutId: number,
): Promise<AssignmentRef | null> {
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<[number], AssignmentRow>(
        `SELECT id, scout_id, kind, target_region, target_player_id,
                started_at, ended_at
         FROM scout_assignments
         WHERE scout_id = ? AND ended_at IS NULL
         ORDER BY id DESC LIMIT 1`,
      )
      .get(scoutId);
    if (!row) return null;
    let playerName: string | null = null;
    if (row.target_player_id) {
      const p = client.sqlite
        .prepare<[number], { name: string }>(`SELECT name FROM players WHERE id = ?`)
        .get(row.target_player_id);
      playerName = p?.name ?? null;
    }
    return rowToRef(row, playerName);
  }
  const res = await client.pool.query<AssignmentRow>(
    `SELECT id, scout_id, kind, target_region, target_player_id,
            started_at, ended_at
     FROM scout_assignments
     WHERE scout_id = $1 AND ended_at IS NULL
     ORDER BY id DESC LIMIT 1`,
    [scoutId],
  );
  const row = res.rows[0];
  if (!row) return null;
  let playerName: string | null = null;
  if (row.target_player_id) {
    const p = await client.pool.query<{ name: string }>(
      `SELECT name FROM players WHERE id = $1`,
      [row.target_player_id],
    );
    playerName = p.rows[0]?.name ?? null;
  }
  return rowToRef(row, playerName);
}

export async function listScoutsWithMeta(
  client: DbClient,
  runId: number,
): Promise<ScoutMetaRow[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[number], ScoutMetaRow>(
        `SELECT id, name, region FROM scouts WHERE run_id = ? ORDER BY id`,
      )
      .all(runId);
  }
  const res = await client.pool.query<ScoutMetaRow>(
    `SELECT id, name, region FROM scouts WHERE run_id = $1 ORDER BY id`,
    [runId],
  );
  return res.rows;
}
