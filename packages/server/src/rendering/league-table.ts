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

export async function computeLeagueTable(
  client: DbClient,
  season: number,
): Promise<LeagueTableRow[]> {
  let results: MatchResultRow[];
  let clubs: ClubRow[];

  if (client.dialect === "sqlite") {
    results = client.sqlite
      .prepare<[number], MatchResultRow>(
        `SELECT home_club_id, away_club_id, home_goals, away_goals
         FROM matches
         WHERE state = 'Played' AND season = ?`,
      )
      .all(season);
    clubs = client.sqlite
      .prepare<[], ClubRow>(`SELECT id, name FROM clubs`)
      .all();
  } else {
    const resMatches = await client.pool.query<MatchResultRow>(
      `SELECT home_club_id, away_club_id, home_goals, away_goals
       FROM matches
       WHERE state = 'Played' AND season = $1`,
      [season],
    );
    results = resMatches.rows;
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
    } else if (m.home_goals < m.away_goals) {
      awayStats.w += 1;
      homeStats.l += 1;
    } else {
      homeStats.d += 1;
      awayStats.d += 1;
    }
  }

  const table: LeagueTableRow[] = [];
  for (const [clubId, s] of stats) {
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
    });
  }

  table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  return table;
}
