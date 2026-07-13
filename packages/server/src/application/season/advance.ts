// Advance matchday — Story 06.
//
// Picks the next Scheduled matchday, calls the SimEngine for every
// fixture in it, writes match + per-player performance rows in a
// single Drizzle transaction. Returns the matchday number simulated
// and the count of matches played, or { remaining: 0 } when the
// half-season is exhausted.
//
// The single-transaction guarantee matters: if any fixture fails to
// simulate (in practice the stub never fails, but the Python sim
// might once it's wired), the partial state is rolled back so the
// next call sees the same Scheduled matchday and the user can try
// again.

import type { DbClient } from "../../db/client.js";
import type { SimEngine, SimMatchInput } from "../../sim/interface.js";
import { CAUSAL_ENGINE_VERSION } from "../../sim/causal.js";
import { createSimStub } from "../../sim/stub.js";
import { tickWeeklyFinance } from "../finance/weekly-tick.js";
import {
  applyDiscipline,
  applyMatchLoad,
  type ConditionState,
  type DisciplineState,
} from "../players/condition.js";
import { runObservationTick } from "../scouting/observations.js";
import { generateAiBids } from "../transfers/ai-bids.js";
import { tickBids } from "../transfers/bid-ticker.js";
import { pickStarters } from "./starter-picker.js";

const STAR_PLAYER_BENCH_EVENT_THRESHOLD = 4;
const PLAYING_TIME_EVENT = "playing_time_promise_broken";
const PLAYING_TIME_EVENT_MOOD = "Disappointed";
const PLAYING_TIME_EVENT_SUMMARY = "A promised place has gone unfulfilled. He remembers.";

export interface AdvanceMatchdayResult {
  matchday: number | null;
  played: number;
  remaining: number;
}

interface ScheduledMatchRow {
  id: number;
  matchday: number;
  home_club_id: number;
  away_club_id: number;
  seed: number;
}

async function loadScheduled(client: DbClient): Promise<ScheduledMatchRow[]> {
  if (client.dialect === "sqlite") {
    const next = client.sqlite
      .prepare<
        [],
        { matchday: number }
      >(`SELECT MIN(matchday) AS matchday FROM matches WHERE state = 'Scheduled'`)
      .get();
    if (!next || next.matchday === null) return [];
    return client.sqlite
      .prepare<[number], ScheduledMatchRow>(
        `SELECT id, matchday, home_club_id, away_club_id, seed
         FROM matches
         WHERE state = 'Scheduled' AND matchday = ?
         ORDER BY id`,
      )
      .all(next.matchday);
  }
  const next = await client.pool.query<{ matchday: number | null }>(
    `SELECT MIN(matchday) AS matchday FROM matches WHERE state = 'Scheduled'`,
  );
  const md = next.rows[0]?.matchday ?? null;
  if (md === null) return [];
  const res = await client.pool.query<ScheduledMatchRow>(
    `SELECT id, matchday, home_club_id, away_club_id, seed
     FROM matches
     WHERE state = 'Scheduled' AND matchday = $1
     ORDER BY id`,
    [md],
  );
  return res.rows;
}

async function countRemaining(client: DbClient): Promise<number> {
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM matches WHERE state = 'Scheduled'`)
      .get();
    return row?.n ?? 0;
  }
  const res = await client.pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM matches WHERE state = 'Scheduled'`,
  );
  return Number(res.rows[0]?.n ?? 0);
}

async function loadSeasonContext(
  client: DbClient,
): Promise<{ season: number; maxMatchday: number }> {
  if (client.dialect === "sqlite") {
    const state = client.sqlite
      .prepare<[], { season: number }>(`SELECT season FROM save_state WHERE id = 1`)
      .get();
    const schedule = client.sqlite
      .prepare<
        [],
        { max_matchday: number | null }
      >(`SELECT MAX(matchday) AS max_matchday FROM matches`)
      .get();
    return { season: state?.season ?? 0, maxMatchday: schedule?.max_matchday ?? 1 };
  }
  const [state, schedule] = await Promise.all([
    client.pool.query<{ season: number }>(`SELECT season FROM save_state WHERE id = 1`),
    client.pool.query<{ max_matchday: number | null }>(
      `SELECT MAX(matchday) AS max_matchday FROM matches`,
    ),
  ]);
  return {
    season: state.rows[0]?.season ?? 0,
    maxMatchday: schedule.rows[0]?.max_matchday ?? 1,
  };
}

export async function advanceMatchday(
  client: DbClient,
  options: { now?: Date; engine?: SimEngine; skipAiBids?: boolean } = {},
): Promise<AdvanceMatchdayResult> {
  const engine = options.engine ?? createSimStub();
  const now = (options.now ?? new Date()).toISOString();

  const scheduled = await loadScheduled(client);
  if (scheduled.length === 0) {
    return { matchday: null, played: 0, remaining: 0 };
  }

  const matchday = scheduled[0]!.matchday;
  const seasonContext = await loadSeasonContext(client);
  const pressure =
    matchday >= Math.max(1, seasonContext.maxMatchday - 5)
      ? "RunIn"
      : matchday > seasonContext.maxMatchday / 2
        ? "Contested"
        : "Normal";

  // Build all SimMatchInputs first so the picker reads happen outside
  // the write transaction. Picker reads use the same DbClient — they
  // don't mutate.
  const inputs: Array<{ row: ScheduledMatchRow; input: SimMatchInput }> = [];
  for (const row of scheduled) {
    const home = await pickStarters(client, row.home_club_id);
    const away = await pickStarters(client, row.away_club_id);
    inputs.push({
      row,
      input: {
        matchId: row.id,
        matchday: row.matchday,
        seed: row.seed,
        context: { season: seasonContext.season, pressure },
        home,
        away,
      },
    });
  }

  // Run the engine and stage the writes.
  const results = inputs.map(({ row, input }) => ({
    row,
    input,
    result: engine.simulateMatch(input),
  }));

  if (client.dialect === "sqlite") {
    const tx = client.sqlite.transaction((entries: typeof results) => {
      const updateMatch = client.sqlite.prepare(
        `UPDATE matches
           SET state = 'Played', home_goals = ?, away_goals = ?, played_at = ?
         WHERE id = ?`,
      );
      const insertPerf = client.sqlite.prepare(
        `INSERT INTO player_match_performance
           (match_id, player_id, club_id, goals, assists, tier, event_description,
            minutes_played, shots, shots_on_target, xg_x100, key_passes,
            passes_attempted, passes_completed, tackles_attempted, tackles_won,
            interceptions, clearances, aerials_won, aerials_contested,
            dribbles_completed, fouls_committed, fouls_drawn, saves,
            yellow_cards, red_cards, rating_x10, started, entered_minute,
            left_minute, position_slot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const insertSnapshot = client.sqlite.prepare(
        `INSERT INTO match_side_snapshots
           (match_id, club_id, formation, playing_style, instructions_json,
            starter_ids_json, bench_ids_json, pressure_context, engine_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const insertEvent = client.sqlite.prepare(
        `INSERT INTO match_events
           (match_id, sequence, minute, kind, phase, club_id, primary_player_id,
            secondary_player_id, outcome, evidence_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const improveFamiliarity = client.sqlite.prepare(
        `UPDATE tactical_familiarity
         SET familiarity_load = MIN(100, familiarity_load + 30), updated_at = ?
         WHERE club_id = ?`,
      );
      const getCondition = client.sqlite.prepare<
        [number],
        { fatigue_load: number; injury_matches_remaining: number; injury_kind: string | null }
      >(
        `SELECT fatigue_load, injury_matches_remaining, injury_kind
         FROM player_condition WHERE player_id = ?`,
      );
      const upsertCondition = client.sqlite.prepare(
        `INSERT INTO player_condition
           (player_id, fatigue_load, injury_kind, injury_matches_remaining,
            updated_season, updated_match_week, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(player_id) DO UPDATE SET
           fatigue_load = excluded.fatigue_load,
           injury_kind = excluded.injury_kind,
           injury_matches_remaining = excluded.injury_matches_remaining,
           updated_season = excluded.updated_season,
           updated_match_week = excluded.updated_match_week,
           updated_at = excluded.updated_at`,
      );
      const getDiscipline = client.sqlite.prepare<
        [number, number],
        { yellow_cards: number; suspension_matches_remaining: number }
      >(
        `SELECT yellow_cards, suspension_matches_remaining
         FROM player_discipline
         WHERE player_id = ? AND competition_key = 'league' AND season = ?`,
      );
      const upsertDiscipline = client.sqlite.prepare(
        `INSERT INTO player_discipline
           (player_id, competition_key, season, yellow_cards, suspension_matches_remaining)
         VALUES (?, 'league', ?, ?, ?)
         ON CONFLICT(player_id, competition_key, season) DO UPDATE SET
           yellow_cards = excluded.yellow_cards,
           suspension_matches_remaining = excluded.suspension_matches_remaining`,
      );
      const loadPromisedStars = client.sqlite.prepare<
        [number, number],
        {
          player_id: number;
          club_id: number;
          injury_matches_remaining: number;
          suspension_matches_remaining: number;
          state_club_id: number | null;
          state_season: number | null;
          eligible_non_start_streak: number | null;
          last_processed_match_week: number | null;
        }
      >(
        `SELECT c.player_id, c.club_id,
                COALESCE(pc.injury_matches_remaining, 0) AS injury_matches_remaining,
                COALESCE(pd.suspension_matches_remaining, 0) AS suspension_matches_remaining,
                pts.club_id AS state_club_id, pts.season AS state_season,
                pts.eligible_non_start_streak, pts.last_processed_match_week
         FROM contracts c
         JOIN players p ON p.id = c.player_id AND p.club_id = c.club_id
         LEFT JOIN player_condition pc ON pc.player_id = c.player_id
         LEFT JOIN player_discipline pd
           ON pd.player_id = c.player_id
          AND pd.competition_key = 'league'
          AND pd.season = ?
         LEFT JOIN playing_time_promise_state pts ON pts.player_id = c.player_id
         WHERE c.club_id = ? AND c.role_promise = 'Star Player'
         ORDER BY c.player_id`,
      );
      const upsertPromiseState = client.sqlite.prepare(
        `INSERT INTO playing_time_promise_state
           (player_id, club_id, season, eligible_non_start_streak,
            last_processed_match_week, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(player_id) DO UPDATE SET
           club_id = excluded.club_id,
           season = excluded.season,
           eligible_non_start_streak = excluded.eligible_non_start_streak,
           last_processed_match_week = excluded.last_processed_match_week,
           updated_at = excluded.updated_at`,
      );
      const insertRelationshipEvent = client.sqlite.prepare(
        `INSERT OR IGNORE INTO player_relationship_events
           (player_id, club_id, season, match_week, event_type, mood, summary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      for (const { input, result } of entries) {
        for (const side of [input.home, input.away]) {
          const actualStarterIds = new Set(
            result.performances
              .filter(
                (performance) =>
                  performance.clubId === side.clubId && performance.started !== false,
              )
              .map((performance) => performance.playerId),
          );
          const promisedStars = loadPromisedStars.all(seasonContext.season, side.clubId);
          for (const player of promisedStars) {
            const sameContext =
              player.state_club_id === side.clubId && player.state_season === seasonContext.season;
            if (sameContext && (player.last_processed_match_week ?? 0) >= matchday) {
              continue;
            }

            let streak = sameContext ? (player.eligible_non_start_streak ?? 0) : 0;
            const started = actualStarterIds.has(player.player_id);
            const eligible =
              player.injury_matches_remaining <= 0 && player.suspension_matches_remaining <= 0;
            if (started) streak = 0;
            else if (eligible) streak += 1;

            upsertPromiseState.run(
              player.player_id,
              side.clubId,
              seasonContext.season,
              streak,
              matchday,
              now,
            );
            if (!started && eligible && streak === STAR_PLAYER_BENCH_EVENT_THRESHOLD) {
              insertRelationshipEvent.run(
                player.player_id,
                side.clubId,
                seasonContext.season,
                matchday,
                PLAYING_TIME_EVENT,
                PLAYING_TIME_EVENT_MOOD,
                PLAYING_TIME_EVENT_SUMMARY,
                now,
              );
            }
          }
        }
      }

      client.sqlite
        .prepare(
          `UPDATE player_condition SET
             fatigue_load = MAX(0, fatigue_load - 18),
             injury_matches_remaining = MAX(0, injury_matches_remaining - 1),
             injury_kind = CASE WHEN injury_matches_remaining <= 1 THEN NULL ELSE injury_kind END`,
        )
        .run();
      client.sqlite
        .prepare(
          `UPDATE player_discipline SET
             suspension_matches_remaining = MAX(0, suspension_matches_remaining - 1)
           WHERE competition_key = 'league' AND season = ?`,
        )
        .run(seasonContext.season);

      for (const { row, input, result } of entries) {
        updateMatch.run(result.homeGoals, result.awayGoals, now, row.id);
        for (const side of [input.home, input.away]) {
          insertSnapshot.run(
            row.id,
            side.clubId,
            side.formation ?? "4-3-3",
            side.playingStyle ?? "Balanced",
            JSON.stringify(side.instructions ?? []),
            JSON.stringify(side.starters.map((player) => player.playerId)),
            JSON.stringify((side.bench ?? []).map((player) => player.playerId)),
            input.context?.pressure ?? "Normal",
            CAUSAL_ENGINE_VERSION,
          );
        }
        for (const event of result.events) {
          insertEvent.run(
            row.id,
            event.sequence,
            event.minute,
            event.kind,
            event.phase,
            event.clubId,
            event.primaryPlayerId !== null && event.primaryPlayerId >= 0
              ? event.primaryPlayerId
              : null,
            event.secondaryPlayerId !== null && event.secondaryPlayerId >= 0
              ? event.secondaryPlayerId
              : null,
            event.outcome,
            JSON.stringify(event.evidence),
          );
        }
        for (const perf of result.performances) {
          if (perf.playerId < 0) continue;
          insertPerf.run(
            row.id,
            perf.playerId,
            perf.clubId,
            perf.goals,
            perf.assists,
            perf.tier,
            perf.eventDescription,
            perf.minutesPlayed,
            perf.shots,
            perf.shotsOnTarget,
            perf.xgX100,
            perf.keyPasses,
            perf.passesAttempted,
            perf.passesCompleted,
            perf.tacklesAttempted,
            perf.tacklesWon,
            perf.interceptions,
            perf.clearances,
            perf.aerialsWon,
            perf.aerialsContested,
            perf.dribblesCompleted,
            perf.foulsCommitted,
            perf.foulsDrawn,
            perf.saves,
            perf.yellowCards,
            perf.redCards,
            perf.ratingX10,
            perf.started === false ? 0 : 1,
            perf.enteredMinute ?? null,
            perf.leftMinute ?? null,
            perf.positionSlot ?? null,
          );
        }
        for (const update of result.playerUpdates) {
          if (update.playerId < 0) continue;
          const rowState = getCondition.get(update.playerId);
          const recovered: ConditionState = rowState
            ? {
                fatigueLoad: rowState.fatigue_load,
                injuryMatchesRemaining: rowState.injury_matches_remaining,
                injuryKind: rowState.injury_kind,
              }
            : { fatigueLoad: 0, injuryMatchesRemaining: 0, injuryKind: null };
          const condition = applyMatchLoad(recovered, update);
          upsertCondition.run(
            update.playerId,
            condition.fatigueLoad,
            condition.injuryKind,
            condition.injuryMatchesRemaining,
            seasonContext.season,
            matchday,
            now,
          );

          if (update.yellowCards > 0 || update.redCard) {
            const disciplineRow = getDiscipline.get(update.playerId, seasonContext.season);
            const served: DisciplineState = disciplineRow
              ? {
                  yellowCards: disciplineRow.yellow_cards,
                  suspensionMatchesRemaining: disciplineRow.suspension_matches_remaining,
                }
              : { yellowCards: 0, suspensionMatchesRemaining: 0 };
            const discipline = applyDiscipline(served, update);
            upsertDiscipline.run(
              update.playerId,
              seasonContext.season,
              discipline.yellowCards,
              discipline.suspensionMatchesRemaining,
            );
          }
        }
        improveFamiliarity.run(now, input.home.clubId);
        improveFamiliarity.run(now, input.away.clubId);
      }
      // Advance the save_state pointer.
      client.sqlite
        .prepare(`UPDATE save_state SET next_match_week = ?, updated_at = ? WHERE id = 1`)
        .run(matchday + 1, now);
    });
    tx(results);
  } else {
    const conn = await client.pool.connect();
    try {
      await conn.query("BEGIN");
      for (const { input, result } of results) {
        for (const side of [input.home, input.away]) {
          const actualStarterIds = new Set(
            result.performances
              .filter(
                (performance) =>
                  performance.clubId === side.clubId && performance.started !== false,
              )
              .map((performance) => performance.playerId),
          );
          const promisedStars = await conn.query<{
            player_id: number;
            club_id: number;
            injury_matches_remaining: number;
            suspension_matches_remaining: number;
            state_club_id: number | null;
            state_season: number | null;
            eligible_non_start_streak: number | null;
            last_processed_match_week: number | null;
          }>(
            `SELECT c.player_id, c.club_id,
                    COALESCE(pc.injury_matches_remaining, 0) AS injury_matches_remaining,
                    COALESCE(pd.suspension_matches_remaining, 0) AS suspension_matches_remaining,
                    pts.club_id AS state_club_id, pts.season AS state_season,
                    pts.eligible_non_start_streak, pts.last_processed_match_week
             FROM contracts c
             JOIN players p ON p.id = c.player_id AND p.club_id = c.club_id
             LEFT JOIN player_condition pc ON pc.player_id = c.player_id
             LEFT JOIN player_discipline pd
               ON pd.player_id = c.player_id
              AND pd.competition_key = 'league'
              AND pd.season = $1
             LEFT JOIN playing_time_promise_state pts ON pts.player_id = c.player_id
             WHERE c.club_id = $2 AND c.role_promise = 'Star Player'
             ORDER BY c.player_id`,
            [seasonContext.season, side.clubId],
          );
          for (const player of promisedStars.rows) {
            const sameContext =
              player.state_club_id === side.clubId && player.state_season === seasonContext.season;
            if (sameContext && (player.last_processed_match_week ?? 0) >= matchday) {
              continue;
            }

            let streak = sameContext ? (player.eligible_non_start_streak ?? 0) : 0;
            const started = actualStarterIds.has(player.player_id);
            const eligible =
              player.injury_matches_remaining <= 0 && player.suspension_matches_remaining <= 0;
            if (started) streak = 0;
            else if (eligible) streak += 1;

            await conn.query(
              `INSERT INTO playing_time_promise_state
                 (player_id, club_id, season, eligible_non_start_streak,
                  last_processed_match_week, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (player_id) DO UPDATE SET
                 club_id = EXCLUDED.club_id,
                 season = EXCLUDED.season,
                 eligible_non_start_streak = EXCLUDED.eligible_non_start_streak,
                 last_processed_match_week = EXCLUDED.last_processed_match_week,
                 updated_at = EXCLUDED.updated_at`,
              [player.player_id, side.clubId, seasonContext.season, streak, matchday, now],
            );
            if (!started && eligible && streak === STAR_PLAYER_BENCH_EVENT_THRESHOLD) {
              await conn.query(
                `INSERT INTO player_relationship_events
                   (player_id, club_id, season, match_week, event_type, mood, summary, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (player_id, club_id, season, match_week, event_type) DO NOTHING`,
                [
                  player.player_id,
                  side.clubId,
                  seasonContext.season,
                  matchday,
                  PLAYING_TIME_EVENT,
                  PLAYING_TIME_EVENT_MOOD,
                  PLAYING_TIME_EVENT_SUMMARY,
                  now,
                ],
              );
            }
          }
        }
      }
      await conn.query(
        `UPDATE player_condition SET
           fatigue_load = GREATEST(0, fatigue_load - 18),
           injury_matches_remaining = GREATEST(0, injury_matches_remaining - 1),
           injury_kind = CASE WHEN injury_matches_remaining <= 1 THEN NULL ELSE injury_kind END`,
      );
      await conn.query(
        `UPDATE player_discipline SET
           suspension_matches_remaining = GREATEST(0, suspension_matches_remaining - 1)
         WHERE competition_key = 'league' AND season = $1`,
        [seasonContext.season],
      );
      for (const { row, input, result } of results) {
        await conn.query(
          `UPDATE matches
             SET state = 'Played', home_goals = $1, away_goals = $2, played_at = $3
           WHERE id = $4`,
          [result.homeGoals, result.awayGoals, now, row.id],
        );
        for (const side of [input.home, input.away]) {
          await conn.query(
            `INSERT INTO match_side_snapshots
               (match_id, club_id, formation, playing_style, instructions_json,
                starter_ids_json, bench_ids_json, pressure_context, engine_version)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              row.id,
              side.clubId,
              side.formation ?? "4-3-3",
              side.playingStyle ?? "Balanced",
              JSON.stringify(side.instructions ?? []),
              JSON.stringify(side.starters.map((player) => player.playerId)),
              JSON.stringify((side.bench ?? []).map((player) => player.playerId)),
              input.context?.pressure ?? "Normal",
              CAUSAL_ENGINE_VERSION,
            ],
          );
        }
        for (const event of result.events) {
          await conn.query(
            `INSERT INTO match_events
               (match_id, sequence, minute, kind, phase, club_id, primary_player_id,
                secondary_player_id, outcome, evidence_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              row.id,
              event.sequence,
              event.minute,
              event.kind,
              event.phase,
              event.clubId,
              event.primaryPlayerId !== null && event.primaryPlayerId >= 0
                ? event.primaryPlayerId
                : null,
              event.secondaryPlayerId !== null && event.secondaryPlayerId >= 0
                ? event.secondaryPlayerId
                : null,
              event.outcome,
              JSON.stringify(event.evidence),
            ],
          );
        }
        for (const perf of result.performances) {
          if (perf.playerId < 0) continue;
          await conn.query(
            `INSERT INTO player_match_performance
               (match_id, player_id, club_id, goals, assists, tier, event_description,
                minutes_played, shots, shots_on_target, xg_x100, key_passes,
                passes_attempted, passes_completed, tackles_attempted, tackles_won,
                interceptions, clearances, aerials_won, aerials_contested,
                dribbles_completed, fouls_committed, fouls_drawn, saves,
                yellow_cards, red_cards, rating_x10, started, entered_minute,
                left_minute, position_slot)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                     $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
                     $28, $29, $30, $31)`,
            [
              row.id,
              perf.playerId,
              perf.clubId,
              perf.goals,
              perf.assists,
              perf.tier,
              perf.eventDescription,
              perf.minutesPlayed,
              perf.shots,
              perf.shotsOnTarget,
              perf.xgX100,
              perf.keyPasses,
              perf.passesAttempted,
              perf.passesCompleted,
              perf.tacklesAttempted,
              perf.tacklesWon,
              perf.interceptions,
              perf.clearances,
              perf.aerialsWon,
              perf.aerialsContested,
              perf.dribblesCompleted,
              perf.foulsCommitted,
              perf.foulsDrawn,
              perf.saves,
              perf.yellowCards,
              perf.redCards,
              perf.ratingX10,
              perf.started === false ? 0 : 1,
              perf.enteredMinute ?? null,
              perf.leftMinute ?? null,
              perf.positionSlot ?? null,
            ],
          );
        }
        for (const update of result.playerUpdates) {
          if (update.playerId < 0) continue;
          const conditionRes = await conn.query<{
            fatigue_load: number;
            injury_matches_remaining: number;
            injury_kind: string | null;
          }>(
            `SELECT fatigue_load, injury_matches_remaining, injury_kind
             FROM player_condition WHERE player_id = $1`,
            [update.playerId],
          );
          const conditionRow = conditionRes.rows[0];
          const recovered: ConditionState = conditionRow
            ? {
                fatigueLoad: conditionRow.fatigue_load,
                injuryMatchesRemaining: conditionRow.injury_matches_remaining,
                injuryKind: conditionRow.injury_kind,
              }
            : { fatigueLoad: 0, injuryMatchesRemaining: 0, injuryKind: null };
          const condition = applyMatchLoad(recovered, update);
          await conn.query(
            `INSERT INTO player_condition
               (player_id, fatigue_load, injury_kind, injury_matches_remaining,
                updated_season, updated_match_week, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (player_id) DO UPDATE SET
               fatigue_load = EXCLUDED.fatigue_load,
               injury_kind = EXCLUDED.injury_kind,
               injury_matches_remaining = EXCLUDED.injury_matches_remaining,
               updated_season = EXCLUDED.updated_season,
               updated_match_week = EXCLUDED.updated_match_week,
               updated_at = EXCLUDED.updated_at`,
            [
              update.playerId,
              condition.fatigueLoad,
              condition.injuryKind,
              condition.injuryMatchesRemaining,
              seasonContext.season,
              matchday,
              now,
            ],
          );

          if (update.yellowCards > 0 || update.redCard) {
            const disciplineRes = await conn.query<{
              yellow_cards: number;
              suspension_matches_remaining: number;
            }>(
              `SELECT yellow_cards, suspension_matches_remaining
               FROM player_discipline
               WHERE player_id = $1 AND competition_key = 'league' AND season = $2`,
              [update.playerId, seasonContext.season],
            );
            const disciplineRow = disciplineRes.rows[0];
            const served: DisciplineState = disciplineRow
              ? {
                  yellowCards: disciplineRow.yellow_cards,
                  suspensionMatchesRemaining: disciplineRow.suspension_matches_remaining,
                }
              : { yellowCards: 0, suspensionMatchesRemaining: 0 };
            const discipline = applyDiscipline(served, update);
            await conn.query(
              `INSERT INTO player_discipline
                 (player_id, competition_key, season, yellow_cards, suspension_matches_remaining)
               VALUES ($1, 'league', $2, $3, $4)
               ON CONFLICT (player_id, competition_key, season) DO UPDATE SET
                 yellow_cards = EXCLUDED.yellow_cards,
                 suspension_matches_remaining = EXCLUDED.suspension_matches_remaining`,
              [
                update.playerId,
                seasonContext.season,
                discipline.yellowCards,
                discipline.suspensionMatchesRemaining,
              ],
            );
          }
        }
        await conn.query(
          `UPDATE tactical_familiarity
           SET familiarity_load = LEAST(100, familiarity_load + 30), updated_at = $1
           WHERE club_id = ANY($2::int[])`,
          [now, [input.home.clubId, input.away.clubId]],
        );
      }
      await conn.query(`UPDATE save_state SET next_match_week = $1, updated_at = $2 WHERE id = 1`, [
        matchday + 1,
        now,
      ]);
      await conn.query("COMMIT");
    } catch (err) {
      await conn.query("ROLLBACK");
      throw err;
    } finally {
      conn.release();
    }
  }

  // Finance v2: weekly revenue + wage expenses.
  await tickWeeklyFinance(client, seasonContext.season, matchday);

  // Scouting is part of the authoritative calendar. Active assignments
  // progress once per matchweek; the deterministic tick index makes save
  // replays produce the same reports and observations.
  await runObservationTick(client, {
    runId: 1,
    tickIndex: seasonContext.season * 100 + matchday,
    now: new Date(now),
  });

  // Story 08: tick the transfer market after match results.
  await tickBids(client, matchday);
  if (!options.skipAiBids) {
    await generateAiBids(client, matchday);
  }

  const remaining = await countRemaining(client);
  return { matchday, played: results.length, remaining };
}
