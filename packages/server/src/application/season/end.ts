// Season end handler — Story 07.
//
// Fires when the full season is Played. Increments the season counter,
// generates a fresh 38-match-week schedule for the next season,
// decrements contract seasons_remaining, and returns a summary.

import type { SeasonSummary } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";
import { computeLeagueTable } from "../../rendering/league-table.js";
import { generatePlayer } from "../generation/generate-player.js";
import { mulberry32 } from "../generation/rng.js";
import { generateFullSeason } from "./schedule.js";

const YOUTH_INTAKE_AGE = 17;
const YOUTH_INTAKE_PER_CLUB = 3;

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

  const RETIREMENT_AGE = 38;

  if (client.dialect === "sqlite") {
    const tx = client.sqlite.transaction(() => {
      // Update save_state.
      client.sqlite
        .prepare(
          `UPDATE save_state SET season = ?, next_match_week = 1, updated_at = ? WHERE id = 1`,
        )
        .run(nextSeason, now);

      // Age everyone up by one year. One season == one year, no calendar.
      client.sqlite.prepare(`UPDATE players SET age = age + 1`).run();

      // Retire anyone past the retirement cutoff: they vacate their
      // club, their contract ends, and they leave the squad + market.
      const retired = client.sqlite
        .prepare<[number], { id: number }>(
          `SELECT id FROM players WHERE age >= ? AND club_id IS NOT NULL`,
        )
        .all(RETIREMENT_AGE);
      for (const { id } of retired) {
        client.sqlite.prepare(`DELETE FROM contracts WHERE player_id = ?`).run(id);
        client.sqlite.prepare(`DELETE FROM squad_entries WHERE player_id = ?`).run(id);
        client.sqlite.prepare(`DELETE FROM listing WHERE player_id = ?`).run(id);
        client.sqlite.prepare(`UPDATE players SET club_id = NULL WHERE id = ?`).run(id);
      }

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
        // A free agent isn't on anyone's market — drop any stale listing
        // row so the Transfers tab doesn't expose an unbuyable player.
        client.sqlite
          .prepare(`DELETE FROM listing WHERE player_id = ?`)
          .run(player_id);
      }
      client.sqlite
        .prepare(`DELETE FROM contracts WHERE seasons_remaining <= 0`)
        .run();

      // Youth intake: every club gets a fresh crop of 17-year-olds on
      // modest starter contracts. Keeps the pipeline full and the
      // transfer market alive.
      const runRow = client.sqlite
        .prepare<[], { run_id: number }>(`SELECT run_id FROM clubs LIMIT 1`)
        .get();
      const runId = runRow?.run_id ?? 1;
      const youthRng = mulberry32((runId * 131 + nextSeason * 7919) >>> 0);
      const insertYouth = client.sqlite.prepare(
        `INSERT INTO players (run_id, club_id, name, dob, age, nationality, preferred_foot,
                              archetype_id, hidden_attrs_json, mental_traits_json,
                              experience_years, narrative_seed_json, preferred_positions_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const insertBadge = client.sqlite.prepare(
        `INSERT INTO player_badges (player_id, badge_key, tier, awarded_at, awarded_reason)
         VALUES (?, ?, ?, ?, ?)`,
      );
      const insertContract = client.sqlite.prepare(
        `INSERT INTO contracts
           (player_id, club_id, weekly_wage_cents, signing_bonus_cents,
            seasons_remaining, role_promise, release_clause_cents, is_loan,
            loan_details_json, wages_by_season_json, signed_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?)`,
      );
      const insertSquad = client.sqlite.prepare(
        `INSERT INTO squad_entries (club_id, player_id, role, updated_at)
         VALUES (?, ?, ?, ?)`,
      );
      const insertPreferences = client.sqlite.prepare(
        `INSERT INTO player_preferences
           (player_id, wage_floor_cents, min_playing_time,
            preferred_regions_json, forbidden_club_ids_json)
         VALUES (?, ?, ?, ?, ?)`,
      );
      const allClubs = client.sqlite
        .prepare<[], { id: number; nationality: string }>(
          `SELECT id, nationality FROM clubs ORDER BY id`,
        )
        .all();
      for (const club of allClubs) {
        for (let i = 0; i < YOUTH_INTAKE_PER_CLUB; i++) {
          const np = generatePlayer({
            runId,
            clubId: club.id,
            referenceDate: new Date(),
            rng: youthRng,
            overrideAge: YOUTH_INTAKE_AGE,
          });
          const info = insertYouth.run(
            runId, club.id, np.name, np.dob, np.age, np.nationality,
            np.preferredFoot, np.archetypeId,
            JSON.stringify(np.hiddenAttrs), JSON.stringify(np.mentalTraits),
            np.experienceYears, JSON.stringify(np.narrativeSeed),
            JSON.stringify(np.preferredPositions), now,
          );
          const pid = Number(info.lastInsertRowid);
          for (const key of np.badgeKeys) {
            insertBadge.run(pid, key, null, now, "generation");
          }
          // Modest starter: $5K/wk, 3-year deal, Rotation.
          insertContract.run(pid, club.id, 500_000, 0, 3, "Rotation",
            JSON.stringify([500_000, 550_000, 600_000]), now);
          insertSquad.run(club.id, pid, "Rotation", now);
          insertPreferences.run(pid, 300_000, "Rotation",
            JSON.stringify([np.nationality]), JSON.stringify([]));
        }
      }

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
      await conn.query(`UPDATE players SET age = age + 1`);
      const retiredRes = await conn.query<{ id: number }>(
        `SELECT id FROM players WHERE age >= $1 AND club_id IS NOT NULL`,
        [RETIREMENT_AGE],
      );
      for (const { id } of retiredRes.rows) {
        await conn.query(`DELETE FROM contracts WHERE player_id = $1`, [id]);
        await conn.query(`DELETE FROM squad_entries WHERE player_id = $1`, [id]);
        await conn.query(`DELETE FROM listing WHERE player_id = $1`, [id]);
        await conn.query(`UPDATE players SET club_id = NULL WHERE id = $1`, [id]);
      }
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
        await conn.query(`DELETE FROM listing WHERE player_id = $1`, [player_id]);
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
