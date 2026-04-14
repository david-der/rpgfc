// League table rendering — Story 07.
//
// Computes the current standings from `matches` rows — no separate
// table entity. Points, GD, and position are allowlisted numerics.

import type { LeagueTableRow } from "@rpgfc/shared";

import type { DbClient } from "../db/client.js";

interface MatchResultRow {
  home_club_id: number;
  away_club_id: number;
  home_goals: number;
  away_goals: number;
}

interface ClubRow {
  id: number;
  name: string;
}

async function loadResults(
  client: DbClient,
  season: number,
): Promise<MatchResultRow[]> {
  // ORDER BY matchday, id so the "recent form" scan below processes the
  // played matches chronologically — same as the UI's fixtures list.
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[number], MatchResultRow>(
        `SELECT home_club_id, away_club_id, home_goals, away_goals
         FROM matches
         WHERE state = 'Played' AND season = ?
         ORDER BY matchday, id`,
      )
      .all(season);
  }
  const res = await client.pool.query<MatchResultRow>(
    `SELECT home_club_id, away_club_id, home_goals, away_goals
     FROM matches
     WHERE state = 'Played' AND season = $1
     ORDER BY matchday, id`,
    [season],
  );
  return res.rows;
}

/** Map of clubId → finish position (1-indexed) for the given season,
 *  or empty when the season has no played matches. */
async function lastSeasonFinishMap(
  client: DbClient,
  season: number,
): Promise<Map<number, number>> {
  if (season < 0) return new Map();
  // Avoid recursive lookups by computing without last-season context.
  const prior = await computeLeagueTableRaw(client, season);
  const out = new Map<number, number>();
  prior.forEach((r, i) => out.set(r.clubId, i + 1));
  return out;
}

/** Compute without last-season context (used internally to seed the
 *  last-season lookup for the CURRENT season without recursion). */
async function computeLeagueTableRaw(
  client: DbClient,
  season: number,
): Promise<LeagueTableRow[]> {
  return computeTableInner(client, season, new Map());
}

export async function computeLeagueTable(
  client: DbClient,
  season: number,
): Promise<LeagueTableRow[]> {
  const lastMap = await lastSeasonFinishMap(client, season - 1);
  return computeTableInner(client, season, lastMap);
}

async function computeTableInner(
  client: DbClient,
  season: number,
  lastMap: Map<number, number>,
): Promise<LeagueTableRow[]> {
  const results = await loadResults(client, season);
  let clubs: ClubRow[];

  if (client.dialect === "sqlite") {
    clubs = client.sqlite
      .prepare<[], ClubRow>(`SELECT id, name FROM clubs`)
      .all();
  } else {
    const resClubs = await client.pool.query<ClubRow>(
      `SELECT id, name FROM clubs`,
    );
    clubs = resClubs.rows;
  }

  const clubMap = new Map(clubs.map((c) => [c.id, c.name]));
  const stats = new Map<
    number,
    { w: number; d: number; l: number; gf: number; ga: number }
  >();

  for (const club of clubs) {
    stats.set(club.id, { w: 0, d: 0, l: 0, gf: 0, ga: 0 });
  }

  // Oldest → newest W/D/L per club. Results came back ordered by
  // (matchday, id) so we just push as we scan.
  const formByClub = new Map<number, Array<"W" | "D" | "L">>();
  const pushForm = (clubId: number, r: "W" | "D" | "L") => {
    let arr = formByClub.get(clubId);
    if (!arr) {
      arr = [];
      formByClub.set(clubId, arr);
    }
    arr.push(r);
  };

  for (const m of results) {
    const homeStats = stats.get(m.home_club_id);
    const awayStats = stats.get(m.away_club_id);
    if (!homeStats || !awayStats) continue;

    homeStats.gf += m.home_goals;
    homeStats.ga += m.away_goals;
    awayStats.gf += m.away_goals;
    awayStats.ga += m.home_goals;

    if (m.home_goals > m.away_goals) {
      homeStats.w += 1;
      awayStats.l += 1;
      pushForm(m.home_club_id, "W");
      pushForm(m.away_club_id, "L");
    } else if (m.home_goals < m.away_goals) {
      awayStats.w += 1;
      homeStats.l += 1;
      pushForm(m.home_club_id, "L");
      pushForm(m.away_club_id, "W");
    } else {
      homeStats.d += 1;
      awayStats.d += 1;
      pushForm(m.home_club_id, "D");
      pushForm(m.away_club_id, "D");
    }
  }

  const table: LeagueTableRow[] = [];
  for (const [clubId, s] of stats) {
    const form = formByClub.get(clubId) ?? [];
    table.push({
      clubId,
      clubName: clubMap.get(clubId) ?? "Unknown",
      played: s.w + s.d + s.l,
      won: s.w,
      drawn: s.d,
      lost: s.l,
      goalsFor: s.gf,
      goalsAgainst: s.ga,
      goalDifference: s.gf - s.ga,
      points: s.w * 3 + s.d,
      lastSeasonPosition: lastMap.get(clubId) ?? null,
      recentForm: form.slice(-5),
    });
  }

  // Before the first match of a new season, every row has 0 points.
  // Sorting purely by points → a stable tie that collapses to club id,
  // which is what the playtest saw — no memory of last season. Fall
  // back to last-season finish for the pre-play view.
  const anyPlayed = table.some((r) => r.played > 0);
  table.sort((a, b) => {
    if (!anyPlayed) {
      // Never-played clubs (and Season 0) → fall back to club id for
      // a stable order.
      const aLast = a.lastSeasonPosition ?? Number.MAX_SAFE_INTEGER;
      const bLast = b.lastSeasonPosition ?? Number.MAX_SAFE_INTEGER;
      if (aLast !== bLast) return aLast - bLast;
      return a.clubId - b.clubId;
    }
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  return table;
}
