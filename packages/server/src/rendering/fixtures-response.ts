// Fixtures rendering orchestration — Story 06.
//
// Loads every match for the user's club perspective and groups them
// by matchday. The user-club result ('W' / 'D' / 'L' / null) is
// computed once per fixture so the UI can render a ResultPill
// directly.

import type { MatchState, RenderedFixture, RenderedFixturesPage } from "@rpgfc/shared";
import { MATCH_STATES } from "@rpgfc/shared";

import type { DbClient } from "../db/client.js";

interface MatchRow {
  id: number;
  matchday: number;
  state: string;
  home_club_id: number;
  home_name: string;
  home_goals: number | null;
  away_club_id: number;
  away_name: string;
  away_goals: number | null;
}

function parseState(raw: string): MatchState {
  return (MATCH_STATES as readonly string[]).includes(raw)
    ? (raw as MatchState)
    : "Scheduled";
}

async function loadCurrentSeason(client: DbClient): Promise<number> {
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<[], { season: number }>(`SELECT season FROM save_state WHERE id = 1`)
      .get();
    return row?.season ?? 0;
  }
  const res = await client.pool.query<{ season: number }>(
    `SELECT season FROM save_state WHERE id = 1`,
  );
  return res.rows[0]?.season ?? 0;
}

async function loadAllMatches(client: DbClient, season: number): Promise<MatchRow[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[number], MatchRow>(
        `SELECT m.id, m.matchday, m.state,
                m.home_club_id, h.name AS home_name, m.home_goals,
                m.away_club_id, a.name AS away_name, m.away_goals
         FROM matches m
         JOIN clubs h ON h.id = m.home_club_id
         JOIN clubs a ON a.id = m.away_club_id
         WHERE m.season = ?
         ORDER BY m.matchday, m.id`,
      )
      .all(season);
  }
  const res = await client.pool.query<MatchRow>(
    `SELECT m.id, m.matchday, m.state,
            m.home_club_id, h.name AS home_name, m.home_goals,
            m.away_club_id, a.name AS away_name, m.away_goals
     FROM matches m
     JOIN clubs h ON h.id = m.home_club_id
     JOIN clubs a ON a.id = m.away_club_id
     WHERE m.season = $1
     ORDER BY m.matchday, m.id`,
    [season],
  );
  return res.rows;
}

function userResult(
  row: MatchRow,
  state: MatchState,
  userClubId: number,
): "W" | "D" | "L" | null {
  if (state !== "Played") return null;
  if (row.home_goals === null || row.away_goals === null) return null;
  const isHome = row.home_club_id === userClubId;
  const isAway = row.away_club_id === userClubId;
  if (!isHome && !isAway) return null;
  if (row.home_goals === row.away_goals) return "D";
  const userScore = isHome ? row.home_goals : row.away_goals;
  const oppScore = isHome ? row.away_goals : row.home_goals;
  return userScore > oppScore ? "W" : "L";
}

export async function renderFixturesForUser(
  client: DbClient,
  userClubId: number,
): Promise<RenderedFixturesPage> {
  const season = await loadCurrentSeason(client);
  const rows = await loadAllMatches(client, season);

  const grouped = new Map<number, RenderedFixture[]>();
  let nextMatchday: number | null = null;

  for (const row of rows) {
    const state = parseState(row.state);
    if (state === "Scheduled" && nextMatchday === null) {
      nextMatchday = row.matchday;
    }
    const fixture: RenderedFixture = {
      id: row.id,
      matchday: row.matchday,
      state,
      home: {
        id: row.home_club_id,
        name: row.home_name,
        goals: row.home_goals,
      },
      away: {
        id: row.away_club_id,
        name: row.away_name,
        goals: row.away_goals,
      },
      userResult: userResult(row, state, userClubId),
    };
    const list = grouped.get(row.matchday) ?? [];
    list.push(fixture);
    grouped.set(row.matchday, list);
  }

  const matchdays = [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([matchday, fixtures]) => ({ matchday, fixtures }));

  return { matchdays, nextMatchday };
}
