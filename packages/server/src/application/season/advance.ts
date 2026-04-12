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
import { createSimStub } from "../../sim/stub.js";
import { generateAiBids } from "../transfers/ai-bids.js";
import { tickBids } from "../transfers/bid-ticker.js";
import { pickStarters } from "./starter-picker.js";

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
      .prepare<
        [],
        { n: number }
      >(`SELECT COUNT(*) AS n FROM matches WHERE state = 'Scheduled'`)
      .get();
    return row?.n ?? 0;
  }
  const res = await client.pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM matches WHERE state = 'Scheduled'`,
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function advanceMatchday(
  client: DbClient,
  options: { now?: Date; engine?: SimEngine } = {},
): Promise<AdvanceMatchdayResult> {
  const engine = options.engine ?? createSimStub();
  const now = (options.now ?? new Date()).toISOString();

  const scheduled = await loadScheduled(client);
  if (scheduled.length === 0) {
    return { matchday: null, played: 0, remaining: 0 };
  }

  const matchday = scheduled[0]!.matchday;

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
        home,
        away,
      },
    });
  }

  // Run the engine and stage the writes.
  const results = inputs.map(({ row, input }) => ({
    row,
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
           (match_id, player_id, club_id, goals, assists, tier, event_description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const { row, result } of entries) {
        updateMatch.run(result.homeGoals, result.awayGoals, now, row.id);
        for (const perf of result.performances) {
          // Skip the synthetic filler players the starter picker
          // emits when a club has fewer than 11 contracted players —
          // their playerId is negative and they don't FK to anything.
          if (perf.playerId < 0) continue;
          insertPerf.run(
            row.id,
            perf.playerId,
            perf.clubId,
            perf.goals,
            perf.assists,
            perf.tier,
            perf.eventDescription,
          );
        }
      }
      // Advance the save_state pointer.
      client.sqlite
        .prepare(
          `UPDATE save_state SET next_match_week = ?, updated_at = ? WHERE id = 1`,
        )
        .run(matchday + 1, now);
    });
    tx(results);
  } else {
    const conn = await client.pool.connect();
    try {
      await conn.query("BEGIN");
      for (const { row, result } of results) {
        await conn.query(
          `UPDATE matches
             SET state = 'Played', home_goals = $1, away_goals = $2, played_at = $3
           WHERE id = $4`,
          [result.homeGoals, result.awayGoals, now, row.id],
        );
        for (const perf of result.performances) {
          if (perf.playerId < 0) continue;
          await conn.query(
            `INSERT INTO player_match_performance
               (match_id, player_id, club_id, goals, assists, tier, event_description)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              row.id,
              perf.playerId,
              perf.clubId,
              perf.goals,
              perf.assists,
              perf.tier,
              perf.eventDescription,
            ],
          );
        }
      }
      await conn.query(
        `UPDATE save_state SET next_match_week = $1, updated_at = $2 WHERE id = 1`,
        [matchday + 1, now],
      );
      await conn.query("COMMIT");
    } catch (err) {
      await conn.query("ROLLBACK");
      throw err;
    } finally {
      conn.release();
    }
  }

  // Story 08: tick the transfer market after match results are written.
  // Order matters: tick existing bids first (so they can resolve), THEN
  // generate new AI bids using the current match week.
  await tickBids(client, matchday);
  await generateAiBids(client, matchday);

  const remaining = await countRemaining(client);
  return { matchday, played: results.length, remaining };
}
