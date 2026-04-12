// Match rendering orchestration — Story 06.
//
// Routes import from this module (and only this module). The
// no-hidden-in-routes ESLint rule blocks them from reaching into
// application/season/* directly.

import type {
  FormTier,
  MatchState,
  RenderedMatch,
  RenderedMatchClub,
  RenderedMatchPerformance,
} from "@rpgfc/shared";
import { ARCHETYPE_BY_ID, FORM_TIER_LABELS, MATCH_STATES } from "@rpgfc/shared";

import {
  advanceMatchday as advanceMatchdayApp,
  type AdvanceMatchdayResult,
} from "../application/season/advance.js";
import type { DbClient } from "../db/client.js";

import { buildMatchNarrative } from "./prose/match.js";

interface MatchRow {
  id: number;
  matchday: number;
  state: string;
  home_club_id: number;
  away_club_id: number;
  home_goals: number | null;
  away_goals: number | null;
  seed: number;
}

interface PerformanceJoinRow {
  player_id: number;
  player_name: string;
  archetype_id: string;
  club_id: number;
  goals: number;
  assists: number;
  tier: string;
  event_description: string | null;
  minutes_played: number;
  shots: number;
  shots_on_target: number;
  xg_x100: number;
  key_passes: number;
  passes_attempted: number;
  passes_completed: number;
  tackles_attempted: number;
  tackles_won: number;
  interceptions: number;
  clearances: number;
  aerials_won: number;
  aerials_contested: number;
  dribbles_completed: number;
  fouls_committed: number;
  fouls_drawn: number;
  saves: number;
  yellow_cards: number;
  red_cards: number;
}

interface ClubRow {
  id: number;
  name: string;
}

function parseState(raw: string): MatchState {
  return (MATCH_STATES as readonly string[]).includes(raw)
    ? (raw as MatchState)
    : "Scheduled";
}

async function loadMatch(client: DbClient, matchId: number): Promise<MatchRow | null> {
  if (client.dialect === "sqlite") {
    return (
      client.sqlite
        .prepare<[number], MatchRow>(
          `SELECT id, matchday, state, home_club_id, away_club_id,
                  home_goals, away_goals, seed
           FROM matches WHERE id = ?`,
        )
        .get(matchId) ?? null
    );
  }
  const res = await client.pool.query<MatchRow>(
    `SELECT id, matchday, state, home_club_id, away_club_id,
            home_goals, away_goals, seed
     FROM matches WHERE id = $1`,
    [matchId],
  );
  return res.rows[0] ?? null;
}

async function loadPerformances(
  client: DbClient,
  matchId: number,
): Promise<PerformanceJoinRow[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[number], PerformanceJoinRow>(
        `SELECT pmp.player_id, p.name AS player_name, p.archetype_id,
                pmp.club_id, pmp.goals, pmp.assists, pmp.tier, pmp.event_description,
                pmp.minutes_played, pmp.shots, pmp.shots_on_target, pmp.xg_x100,
                pmp.key_passes, pmp.passes_attempted, pmp.passes_completed,
                pmp.tackles_attempted, pmp.tackles_won, pmp.interceptions,
                pmp.clearances, pmp.aerials_won, pmp.aerials_contested,
                pmp.dribbles_completed, pmp.fouls_committed, pmp.fouls_drawn,
                pmp.saves, pmp.yellow_cards, pmp.red_cards
         FROM player_match_performance pmp
         JOIN players p ON p.id = pmp.player_id
         WHERE pmp.match_id = ?
         ORDER BY pmp.club_id, pmp.id`,
      )
      .all(matchId);
  }
  const res = await client.pool.query<PerformanceJoinRow>(
    `SELECT pmp.player_id, p.name AS player_name, p.archetype_id,
            pmp.club_id, pmp.goals, pmp.assists, pmp.tier, pmp.event_description,
                pmp.minutes_played, pmp.shots, pmp.shots_on_target, pmp.xg_x100,
                pmp.key_passes, pmp.passes_attempted, pmp.passes_completed,
                pmp.tackles_attempted, pmp.tackles_won, pmp.interceptions,
                pmp.clearances, pmp.aerials_won, pmp.aerials_contested,
                pmp.dribbles_completed, pmp.fouls_committed, pmp.fouls_drawn,
                pmp.saves, pmp.yellow_cards, pmp.red_cards
     FROM player_match_performance pmp
     JOIN players p ON p.id = pmp.player_id
     WHERE pmp.match_id = $1
     ORDER BY pmp.club_id, pmp.id`,
    [matchId],
  );
  return res.rows;
}

async function loadClubMap(client: DbClient): Promise<Map<number, ClubRow>> {
  const out = new Map<number, ClubRow>();
  if (client.dialect === "sqlite") {
    const rows = client.sqlite
      .prepare<[], ClubRow>(`SELECT id, name FROM clubs`)
      .all();
    for (const r of rows) out.set(r.id, r);
    return out;
  }
  const res = await client.pool.query<ClubRow>(`SELECT id, name FROM clubs`);
  for (const r of res.rows) out.set(r.id, r);
  return out;
}

function buildPerformance(row: PerformanceJoinRow): RenderedMatchPerformance {
  const archetype = ARCHETYPE_BY_ID[row.archetype_id];
  const tier = (row.tier as FormTier) ?? "Average";
  const passAccuracy = row.passes_attempted > 0
    ? row.passes_completed / row.passes_attempted
    : 0;
  return {
    playerId: row.player_id,
    playerName: row.player_name,
    positionLabel: archetype?.positionLabel ?? "??",
    clubId: row.club_id,
    goals: row.goals,
    assists: row.assists,
    tier,
    tierLabel: FORM_TIER_LABELS[tier],
    eventDescription: row.event_description,
    minutesPlayed: row.minutes_played,
    shots: row.shots,
    shotsOnTarget: row.shots_on_target,
    xg: row.xg_x100 / 100,
    keyPasses: row.key_passes,
    passesAttempted: row.passes_attempted,
    passesCompleted: row.passes_completed,
    passAccuracy,
    tacklesAttempted: row.tackles_attempted,
    tacklesWon: row.tackles_won,
    interceptions: row.interceptions,
    clearances: row.clearances,
    aerialsWon: row.aerials_won,
    aerialsContested: row.aerials_contested,
    dribblesCompleted: row.dribbles_completed,
    foulsCommitted: row.fouls_committed,
    foulsDrawn: row.fouls_drawn,
    saves: row.saves,
    yellowCards: row.yellow_cards,
    redCards: row.red_cards,
  };
}

function clubFor(map: Map<number, ClubRow>, id: number, goals: number | null): RenderedMatchClub {
  const club = map.get(id);
  return {
    id,
    name: club?.name ?? "Unknown",
    goals,
  };
}

export async function renderMatchById(
  client: DbClient,
  matchId: number,
): Promise<RenderedMatch | null> {
  const row = await loadMatch(client, matchId);
  if (!row) return null;

  const clubs = await loadClubMap(client);
  const home = clubFor(clubs, row.home_club_id, row.home_goals);
  const away = clubFor(clubs, row.away_club_id, row.away_goals);
  const state = parseState(row.state);

  let performances: RenderedMatchPerformance[] = [];
  let narrative: string[] = [];
  if (state === "Played") {
    const rows = await loadPerformances(client, matchId);
    performances = rows.map(buildPerformance);
    narrative = buildMatchNarrative({
      seed: row.seed,
      home,
      away,
      performances,
    });
  }

  return {
    id: row.id,
    matchday: row.matchday,
    state,
    home,
    away,
    narrative,
    performances,
  };
}

// Pass-through that the route layer calls so it never has to import
// from application/season/* directly.
export async function advanceMatchdayRendered(
  client: DbClient,
  options: { now?: Date } = {},
): Promise<AdvanceMatchdayResult> {
  return advanceMatchdayApp(client, options);
}
