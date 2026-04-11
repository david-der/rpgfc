// Tactics seed — Story 05.
//
// Inserts exactly one tactics row per club on world gen, with the
// Story 05 defaults (4-3-3, Balanced, PressHigh + StayCompact, empty
// assignments). The user fills in slot assignments through the UI.

import type { DbClient } from "../../db/client.js";

export interface TacticsSeedResult {
  rowsCreated: number;
  skipped: boolean;
}

const DEFAULT_FORMATION = "4-3-3";
const DEFAULT_PLAYING_STYLE = "Balanced";
const DEFAULT_INSTRUCTIONS_JSON = JSON.stringify(["PressHigh", "StayCompact"]);
const EMPTY_ASSIGNMENTS_JSON = "{}";

export async function seedTacticsIfEmpty(client: DbClient): Promise<TacticsSeedResult> {
  if (client.dialect === "sqlite") {
    const existing = client.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM tactics`)
      .get();
    if ((existing?.n ?? 0) > 0) return { rowsCreated: 0, skipped: true };
  } else {
    const { rows } = await client.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM tactics`,
    );
    if (Number(rows[0]?.n ?? 0) > 0) return { rowsCreated: 0, skipped: true };
  }

  const clubs = await loadClubs(client);
  const now = new Date().toISOString();
  let created = 0;

  for (const club of clubs) {
    if (client.dialect === "sqlite") {
      client.sqlite
        .prepare(
          `INSERT INTO tactics
             (club_id, name, formation, playing_style,
              instructions_json, assignments_json, updated_at)
           VALUES (?, 'Default', ?, ?, ?, ?, ?)`,
        )
        .run(
          club.id,
          DEFAULT_FORMATION,
          DEFAULT_PLAYING_STYLE,
          DEFAULT_INSTRUCTIONS_JSON,
          EMPTY_ASSIGNMENTS_JSON,
          now,
        );
    } else {
      await client.pool.query(
        `INSERT INTO tactics
           (club_id, name, formation, playing_style,
            instructions_json, assignments_json, updated_at)
         VALUES ($1, 'Default', $2, $3, $4, $5, $6)`,
        [
          club.id,
          DEFAULT_FORMATION,
          DEFAULT_PLAYING_STYLE,
          DEFAULT_INSTRUCTIONS_JSON,
          EMPTY_ASSIGNMENTS_JSON,
          now,
        ],
      );
    }
    created++;
  }

  return { rowsCreated: created, skipped: false };
}

async function loadClubs(client: DbClient): Promise<Array<{ id: number }>> {
  if (client.dialect === "sqlite") {
    return client.sqlite.prepare<[], { id: number }>(`SELECT id FROM clubs`).all();
  }
  const res = await client.pool.query<{ id: number }>(`SELECT id FROM clubs`);
  return res.rows;
}
