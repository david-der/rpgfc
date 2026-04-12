// Season end handler — Story 07.
//
// Fires when the full season is Played. Increments the season counter,
// generates a fresh 38-match-week schedule for the next season,
// decrements contract seasons_remaining, and returns a summary.

import type { SeasonSummary } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";
import { computeLeagueTable } from "../../rendering/league-table.js";
import { generateFullSeason } from "./schedule.js";

function hashSeed(matchday: number, homeId: number, awayId: number): number {
  let h = 31;
  h = (h * 73856093) ^ matchday;
  h = (h * 19349663) ^ homeId;
  h = (h * 83492791) ^ awayId;
  return h >>> 0;
}

export async function endSeason(
  client: DbClient,
  userClubId: number,
): Promise<SeasonSummary | null> {
  // Check if every fixture in the current season is Played.
  let currentSeason: number;
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<[], { season: number }>(`SELECT season FROM save_state WHERE id = 1`)
      .get();
    currentSeason = row?.season ?? 0;
    const remaining = client.sqlite
      .prepare<
        [number],
        { n: number }
      >(`SELECT COUNT(*) AS n FROM matches WHERE season = ? AND state = 'Scheduled'`)
      .get(currentSeason);
    if ((remaining?.n ?? 0) > 0) return null;
  } else {
    const sRow = await client.pool.query<{ season: number }>(
      `SELECT season FROM save_state WHERE id = 1`,
    );
    currentSeason = sRow.rows[0]?.season ?? 0;
    const rem = await client.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM matches WHERE season = $1 AND state = 'Scheduled'`,
      [currentSeason],
    );
    if (Number(rem.rows[0]?.n ?? 0) > 0) return null;
  }

  // Compute the final table for the narrative.
  const table = await computeLeagueTable(client, currentSeason);
  const userPosition = table.findIndex((r) => r.clubId === userClubId) + 1;
  const champion = table[0];
  const narrative = champion
    ? userPosition === 1
      ? `Season ${currentSeason} ends in triumph. Your side claimed the title.`
      : `Season ${currentSeason} is over. ${champion.clubName} took the title; you finished in position ${userPosition}.`
    : `Season ${currentSeason} is complete.`;

  const nextSeason = currentSeason + 1;
  const now = new Date().toISOString();

  // Load club ids for the next schedule.
  let clubIds: number[];
  if (client.dialect === "sqlite") {
    clubIds = client.sqlite
      .prepare<[], { id: number }>(`SELECT id FROM clubs ORDER BY id`)
      .all()
      .map((r) => r.id);
  } else {
    const res = await client.pool.query<{ id: number }>(
      `SELECT id FROM clubs ORDER BY id`,
    );
    clubIds = res.rows.map((r) => r.id);
  }

  const schedule = generateFullSeason(clubIds);

  if (client.dialect === "sqlite") {
    const tx = client.sqlite.transaction(() => {
      // Update save_state.
      client.sqlite
        .prepare(
          `UPDATE save_state SET season = ?, next_match_week = 1, updated_at = ? WHERE id = 1`,
        )
        .run(nextSeason, now);

      // Decrement contract seasons; expire contracts at 0.
      client.sqlite
        .prepare(
          `UPDATE contracts SET seasons_remaining = seasons_remaining - 1
           WHERE seasons_remaining > 0`,
        )
        .run();
      // Free-agent expired contracts: clear club_id on player.
      const expired = client.sqlite
        .prepare<
          [],
          { player_id: number }
        >(`SELECT player_id FROM contracts WHERE seasons_remaining <= 0`)
        .all();
      for (const { player_id } of expired) {
        client.sqlite
          .prepare(`UPDATE players SET club_id = NULL WHERE id = ?`)
          .run(player_id);
        client.sqlite
          .prepare(`DELETE FROM squad_entries WHERE player_id = ?`)
          .run(player_id);
      }
      client.sqlite
        .prepare(`DELETE FROM contracts WHERE seasons_remaining <= 0`)
        .run();

      // Generate new season's fixtures.
      for (const md of schedule) {
        for (const fx of md.fixtures) {
          const seed = hashSeed(md.matchday, fx.homeClubId, fx.awayClubId);
          client.sqlite
            .prepare(
              `INSERT INTO matches
                 (matchday, home_club_id, away_club_id, state, seed, season)
               VALUES (?, ?, ?, 'Scheduled', ?, ?)`,
            )
            .run(md.matchday, fx.homeClubId, fx.awayClubId, seed, nextSeason);
        }
      }
    });
    tx();
  } else {
    const conn = await client.pool.connect();
    try {
      await conn.query("BEGIN");
      await conn.query(
        `UPDATE save_state SET season = $1, next_match_week = 1, updated_at = $2 WHERE id = 1`,
        [nextSeason, now],
      );
      await conn.query(
        `UPDATE contracts SET seasons_remaining = seasons_remaining - 1
         WHERE seasons_remaining > 0`,
      );
      const expiredRes = await conn.query<{ player_id: number }>(
        `SELECT player_id FROM contracts WHERE seasons_remaining <= 0`,
      );
      for (const { player_id } of expiredRes.rows) {
        await conn.query(`UPDATE players SET club_id = NULL WHERE id = $1`, [player_id]);
        await conn.query(`DELETE FROM squad_entries WHERE player_id = $1`, [player_id]);
      }
      await conn.query(`DELETE FROM contracts WHERE seasons_remaining <= 0`);
      for (const md of schedule) {
        for (const fx of md.fixtures) {
          const seed = hashSeed(md.matchday, fx.homeClubId, fx.awayClubId);
          await conn.query(
            `INSERT INTO matches
               (matchday, home_club_id, away_club_id, state, seed, season)
             VALUES ($1, $2, $3, 'Scheduled', $4, $5)`,
            [md.matchday, fx.homeClubId, fx.awayClubId, seed, nextSeason],
          );
        }
      }
      await conn.query("COMMIT");
    } catch (err) {
      await conn.query("ROLLBACK");
      throw err;
    } finally {
      conn.release();
    }
  }

  return {
    season: currentSeason,
    table,
    userPosition,
    narrative,
  };
}
