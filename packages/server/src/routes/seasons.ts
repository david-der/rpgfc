// Seasons archive — list of completed seasons for the history page.
// A season is "completed" when save_state.season > N.

import { Hono } from "hono";

import { computeLeagueTable, loadSeasonState } from "../rendering/index.js";
import type { DbClient } from "../db/client.js";

export interface SeasonsRouteDeps {
  db: DbClient;
  userClubId: number;
}

interface SeasonListEntry {
  season: number;
  championClubName: string;
  userFinishPosition: number | null;
  userWasChampion: boolean;
  goldenBootName: string | null;
  goldenBootGoals: number;
  userFormRibbon: Array<"W" | "D" | "L">;
}

interface AllTimeSummary {
  trophies: number;
  bestFinish: number | null;
  topScorerName: string | null;
  topScorerGoals: number;
}

interface GoldenBootRow {
  name: string;
  goals: number;
}

async function loadGoldenBoot(db: DbClient, season: number): Promise<GoldenBootRow | null> {
  if (db.dialect === "sqlite") {
    const row = db.sqlite
      .prepare<[number], { name: string; goals: number }>(
        `SELECT p.name AS name, SUM(pmp.goals) AS goals
         FROM player_match_performance pmp
         JOIN matches m ON m.id = pmp.match_id
         JOIN players p ON p.id = pmp.player_id
         WHERE m.state = 'Played' AND m.season = ?
         GROUP BY p.id, p.name
         ORDER BY goals DESC, p.id ASC
         LIMIT 1`,
      )
      .get(season);
    if (!row || !row.goals || row.goals <= 0) return null;
    return { name: row.name, goals: Number(row.goals) };
  }
  const res = await db.pool.query<{ name: string; goals: string }>(
    `SELECT p.name AS name, SUM(pmp.goals)::text AS goals
     FROM player_match_performance pmp
     JOIN matches m ON m.id = pmp.match_id
     JOIN players p ON p.id = pmp.player_id
     WHERE m.state = 'Played' AND m.season = $1
     GROUP BY p.id, p.name
     ORDER BY SUM(pmp.goals) DESC, p.id ASC
     LIMIT 1`,
    [season],
  );
  const row = res.rows[0];
  if (!row) return null;
  const goals = Number(row.goals);
  if (!goals || goals <= 0) return null;
  return { name: row.name, goals };
}

interface UserMatchRow {
  home_club_id: number;
  away_club_id: number;
  home_goals: number;
  away_goals: number;
}

async function loadUserMatches(
  db: DbClient,
  season: number,
  userClubId: number,
): Promise<UserMatchRow[]> {
  if (db.dialect === "sqlite") {
    return db.sqlite
      .prepare<[number, number, number], UserMatchRow>(
        `SELECT home_club_id, away_club_id, home_goals, away_goals
         FROM matches
         WHERE state = 'Played' AND season = ?
           AND (home_club_id = ? OR away_club_id = ?)
         ORDER BY matchday ASC, id ASC`,
      )
      .all(season, userClubId, userClubId);
  }
  const res = await db.pool.query<UserMatchRow>(
    `SELECT home_club_id, away_club_id, home_goals, away_goals
     FROM matches
     WHERE state = 'Played' AND season = $1
       AND (home_club_id = $2 OR away_club_id = $2)
     ORDER BY matchday ASC, id ASC`,
    [season, userClubId],
  );
  return res.rows;
}

function computeUserForm(rows: UserMatchRow[], userClubId: number): Array<"W" | "D" | "L"> {
  const all: Array<"W" | "D" | "L"> = rows.map((m) => {
    const isHome = m.home_club_id === userClubId;
    const userGoals = isHome ? m.home_goals : m.away_goals;
    const oppGoals = isHome ? m.away_goals : m.home_goals;
    if (userGoals > oppGoals) return "W";
    if (userGoals < oppGoals) return "L";
    return "D";
  });
  return all.slice(-5);
}

export function createSeasonsRoute(deps: SeasonsRouteDeps) {
  const app = new Hono().get("/", async (c) => {
    const state = await loadSeasonState(deps.db);
    const seasons: SeasonListEntry[] = [];
    let trophies = 0;
    let bestFinish: number | null = null;

    // Every season strictly before the current one is complete.
    for (let s = 0; s < state.season; s++) {
      const table = await computeLeagueTable(deps.db, s);
      if (table.length === 0) continue;
      const champion = table[0]!;
      const userIdx = table.findIndex((r) => r.clubId === deps.userClubId);
      const userFinishPosition = userIdx >= 0 ? userIdx + 1 : null;
      const userWasChampion = champion.clubId === deps.userClubId;
      if (userWasChampion) trophies += 1;
      if (userFinishPosition !== null) {
        if (bestFinish === null || userFinishPosition < bestFinish) {
          bestFinish = userFinishPosition;
        }
      }
      const gb = await loadGoldenBoot(deps.db, s);
      const userMatches = await loadUserMatches(deps.db, s, deps.userClubId);
      const userFormRibbon = computeUserForm(userMatches, deps.userClubId);

      seasons.push({
        season: s,
        championClubName: champion.clubName,
        userFinishPosition,
        userWasChampion,
        goldenBootName: gb?.name ?? null,
        goldenBootGoals: gb?.goals ?? 0,
        userFormRibbon,
      });
    }
    // Newest first.
    seasons.reverse();

    // All-time top scorer across user club's history — count goals by
    // players while appearing for the user club (pmp.club_id).
    let topScorerName: string | null = null;
    let topScorerGoals = 0;
    if (deps.db.dialect === "sqlite") {
      const row = deps.db.sqlite
        .prepare<[number], { name: string; goals: number }>(
          `SELECT p.name AS name, SUM(pmp.goals) AS goals
           FROM player_match_performance pmp
           JOIN matches m ON m.id = pmp.match_id
           JOIN players p ON p.id = pmp.player_id
           WHERE m.state = 'Played' AND pmp.club_id = ?
           GROUP BY p.id, p.name
           ORDER BY goals DESC, p.id ASC
           LIMIT 1`,
        )
        .get(deps.userClubId);
      if (row && Number(row.goals) > 0) {
        topScorerName = row.name;
        topScorerGoals = Number(row.goals);
      }
    } else {
      const res = await deps.db.pool.query<{ name: string; goals: string }>(
        `SELECT p.name AS name, SUM(pmp.goals)::text AS goals
         FROM player_match_performance pmp
         JOIN matches m ON m.id = pmp.match_id
         JOIN players p ON p.id = pmp.player_id
         WHERE m.state = 'Played' AND pmp.club_id = $1
         GROUP BY p.id, p.name
         ORDER BY SUM(pmp.goals) DESC, p.id ASC
         LIMIT 1`,
        [deps.userClubId],
      );
      const row = res.rows[0];
      if (row && Number(row.goals) > 0) {
        topScorerName = row.name;
        topScorerGoals = Number(row.goals);
      }
    }

    const allTime: AllTimeSummary = {
      trophies,
      bestFinish,
      topScorerName,
      topScorerGoals,
    };

    return c.json({ seasons, allTime });
  });
  return app;
}
