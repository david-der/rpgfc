// Squad seed — Story 05.
//
// Buckets every contracted player into a SquadRole on world gen.
// Age-based heuristic: within each club, the three oldest players
// become Starter, the three youngest become Youth, everyone else is
// Rotation. No Backup bucket from the seed — the manager gets to
// discover unhappiness and demote voluntarily.
//
// Idempotent: any prior squad_entries row prevents the seeder from
// running a second time. Deterministic: within-age ties break on
// player id so the output stays stable across runs.

import type { DbClient } from "../../db/client.js";

export interface SquadSeedResult {
  entriesCreated: number;
  skipped: boolean;
}

interface PlayerRow {
  id: number;
  club_id: number | null;
  experience_years: number;
}

export async function seedSquadIfEmpty(client: DbClient): Promise<SquadSeedResult> {
  if (client.dialect === "sqlite") {
    const existing = client.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM squad_entries`)
      .get();
    if ((existing?.n ?? 0) > 0) return { entriesCreated: 0, skipped: true };
  } else {
    const { rows } = await client.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM squad_entries`,
    );
    if (Number(rows[0]?.n ?? 0) > 0) return { entriesCreated: 0, skipped: true };
  }

  const players = await loadPlayers(client);
  const byClub = new Map<number, PlayerRow[]>();
  for (const p of players) {
    if (p.club_id === null) continue;
    const list = byClub.get(p.club_id) ?? [];
    list.push(p);
    byClub.set(p.club_id, list);
  }

  const now = new Date().toISOString();
  let created = 0;

  for (const [clubId, roster] of byClub) {
    // Oldest first for Starter, youngest first for Youth. Tie-break on id
    // keeps the ordering deterministic.
    const sorted = [...roster].sort((a, b) => {
      if (b.experience_years !== a.experience_years) {
        return b.experience_years - a.experience_years;
      }
      return a.id - b.id;
    });

    const starterCount = Math.min(3, sorted.length);
    const youthCount = Math.min(3, Math.max(0, sorted.length - starterCount));

    for (let i = 0; i < sorted.length; i++) {
      const player = sorted[i]!;
      let role: "Starter" | "Rotation" | "Youth";
      if (i < starterCount) role = "Starter";
      else if (i >= sorted.length - youthCount) role = "Youth";
      else role = "Rotation";
      await insertEntry(client, clubId, player.id, role, now);
      created++;
    }
  }

  return { entriesCreated: created, skipped: false };
}

async function loadPlayers(client: DbClient): Promise<PlayerRow[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[], PlayerRow>(`SELECT id, club_id, experience_years FROM players ORDER BY id`)
      .all();
  }
  const res = await client.pool.query<PlayerRow>(
    `SELECT id, club_id, experience_years FROM players ORDER BY id`,
  );
  return res.rows;
}

async function insertEntry(
  client: DbClient,
  clubId: number,
  playerId: number,
  role: string,
  now: string,
): Promise<void> {
  if (client.dialect === "sqlite") {
    client.sqlite
      .prepare(
        `INSERT INTO squad_entries (club_id, player_id, role, updated_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(clubId, playerId, role, now);
    return;
  }
  await client.pool.query(
    `INSERT INTO squad_entries (club_id, player_id, role, updated_at)
     VALUES ($1, $2, $3, $4)`,
    [clubId, playerId, role, now],
  );
}
