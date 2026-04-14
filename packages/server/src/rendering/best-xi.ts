// Best XI of the season — aggregates player_match_performance rows by
// avg rating_x10 within position buckets drawn from the player's
// archetype primaryRole. 1-3-4-3 shape.

import { ARCHETYPE_BY_ID } from "@rpgfc/shared";

import type { DbClient } from "../db/client.js";

export interface BestXIEntry {
  player_id: number;
  player_name: string;
  club_name: string;
  role: string;
  appearances: number;
  avg_rating_x10: number;
  goals: number;
  assists: number;
}

export interface BestXI {
  gk: BestXIEntry | null;
  def: BestXIEntry[];
  mid: BestXIEntry[];
  fwd: BestXIEntry[];
}

interface RawRow {
  player_id: number;
  player_name: string;
  club_name: string;
  archetype_id: string;
  appearances: number;
  avg_rating_x10: number;
  goals: number;
  assists: number;
}

const MIN_APPEARANCES = 10;

function bucketFor(primaryRole: string): "gk" | "def" | "mid" | "fwd" | "flex" {
  if (primaryRole === "Goalkeeper") return "gk";
  if (primaryRole === "Center-Back" || primaryRole === "Fullback") return "def";
  if (
    primaryRole === "Defensive Midfielder" ||
    primaryRole === "Central Midfielder"
  )
    return "mid";
  if (primaryRole === "Striker") return "fwd";
  // Attacking Midfielder + Winger are flex — eligible for mid or fwd.
  return "flex";
}

function cmp(a: BestXIEntry, b: BestXIEntry): number {
  if (b.avg_rating_x10 !== a.avg_rating_x10) return b.avg_rating_x10 - a.avg_rating_x10;
  if (b.appearances !== a.appearances) return b.appearances - a.appearances;
  return b.goals - a.goals;
}

export async function computeBestXI(db: DbClient, season: number): Promise<BestXI> {
  const rows = await loadSeasonRows(db, season);

  const gkPool: BestXIEntry[] = [];
  const defPool: BestXIEntry[] = [];
  const midPool: BestXIEntry[] = [];
  const fwdPool: BestXIEntry[] = [];
  const flexPool: BestXIEntry[] = [];

  for (const r of rows) {
    if (r.appearances < MIN_APPEARANCES) continue;
    const archetype = ARCHETYPE_BY_ID[r.archetype_id];
    const role = archetype?.primaryRole ?? "Central Midfielder";
    const entry: BestXIEntry = {
      player_id: r.player_id,
      player_name: r.player_name,
      club_name: r.club_name,
      role,
      appearances: Number(r.appearances),
      avg_rating_x10: Math.round(Number(r.avg_rating_x10)),
      goals: Number(r.goals),
      assists: Number(r.assists),
    };
    const bucket = bucketFor(role);
    if (bucket === "gk") gkPool.push(entry);
    else if (bucket === "def") defPool.push(entry);
    else if (bucket === "mid") midPool.push(entry);
    else if (bucket === "fwd") fwdPool.push(entry);
    else flexPool.push(entry);
  }

  gkPool.sort(cmp);
  defPool.sort(cmp);
  // Mid bucket accepts strict mids + flex (AM/Winger).
  const midCombined = [...midPool, ...flexPool].sort(cmp);
  // Fwd bucket accepts strikers + flex (AM/Winger).
  const fwdCombined = [...fwdPool, ...flexPool].sort(cmp);

  const gk = gkPool[0] ?? null;
  const def = defPool.slice(0, 3);

  // Pick mid first (top 4) then fwd (top 3) without overlap.
  const used = new Set<number>();
  const mid: BestXIEntry[] = [];
  for (const e of midCombined) {
    if (mid.length >= 4) break;
    if (used.has(e.player_id)) continue;
    used.add(e.player_id);
    mid.push(e);
  }
  const fwd: BestXIEntry[] = [];
  for (const e of fwdCombined) {
    if (fwd.length >= 3) break;
    if (used.has(e.player_id)) continue;
    used.add(e.player_id);
    fwd.push(e);
  }

  return { gk, def, mid, fwd };
}

async function loadSeasonRows(db: DbClient, season: number): Promise<RawRow[]> {
  if (db.dialect === "sqlite") {
    return db.sqlite
      .prepare<[number], RawRow>(
        `SELECT pmp.player_id, p.name AS player_name, c.name AS club_name,
                p.archetype_id,
                COUNT(*) AS appearances,
                AVG(pmp.rating_x10) AS avg_rating_x10,
                SUM(pmp.goals) AS goals,
                SUM(pmp.assists) AS assists
         FROM player_match_performance pmp
         JOIN matches m ON m.id = pmp.match_id
         JOIN players p ON p.id = pmp.player_id
         JOIN clubs c ON c.id = pmp.club_id
         WHERE m.season = ? AND m.state = 'Played'
         GROUP BY pmp.player_id
         HAVING COUNT(*) >= 1`,
      )
      .all(season);
  }
  const res = await db.pool.query<RawRow>(
    `SELECT pmp.player_id, p.name AS player_name, c.name AS club_name,
            p.archetype_id,
            COUNT(*)::int AS appearances,
            AVG(pmp.rating_x10)::float AS avg_rating_x10,
            SUM(pmp.goals)::int AS goals,
            SUM(pmp.assists)::int AS assists
     FROM player_match_performance pmp
     JOIN matches m ON m.id = pmp.match_id
     JOIN players p ON p.id = pmp.player_id
     JOIN clubs c ON c.id = pmp.club_id
     WHERE m.season = $1 AND m.state = 'Played'
     GROUP BY pmp.player_id, p.name, c.name, p.archetype_id
     HAVING COUNT(*) >= 1`,
    [season],
  );
  return res.rows;
}
