// Roster floor enforcement — last pass of the season rollover.
//
// After retirements, contract expiries, and youth intake, some clubs may
// still be below the 18-player roster floor. This module signs free agents
// (generating new ones if the pool is empty) on minimum-wage 2-year
// contracts until every club has at least 18 contracted players AND meets
// the per-bucket positional floors (GK, CB, FB, MID, FWD).
//
// This is a survival mechanism, not a gameplay choice: cash checks are
// bypassed, and the forced signings keep the fixture list playable.
//
// Positional floors are ABSOLUTE. If a club ends up at 19 players because
// it was at 18 with 0 midfielders, that's the correct outcome — a playable
// fixture list requires at least one player in every bucket.

import { ARCHETYPE_BY_ID, ARCHETYPE_LIBRARY } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";
import { generatePlayer } from "../generation/generate-player.js";
import { mulberry32, type Random } from "../generation/rng.js";

export const ROSTER_FLOOR = 18;

const MIN_WAGE_CENTS = 300_000; // $3K/wk — lowest wage tier.
const FORCED_CONTRACT_SEASONS = 2;

export type RosterBucket = "GK" | "CB" | "FB" | "MID" | "FWD";

// Archetype → bucket. Derived from each archetype's primaryRole so this
// stays correct if the library grows. Winger + Attacking Midfielder are
// "flex" in Best XI but count as MID for roster-floor purposes (they keep
// a midfield/flank slot playable).
function bucketForPrimaryRole(role: string): RosterBucket {
  if (role === "Goalkeeper") return "GK";
  if (role === "Center-Back") return "CB";
  if (role === "Fullback") return "FB";
  if (role === "Striker") return "FWD";
  // Defensive/Central/Attacking Midfielder and Winger.
  return "MID";
}

export function bucketForArchetype(archetypeId: string | null | undefined): RosterBucket | null {
  if (!archetypeId) return null;
  const a = ARCHETYPE_BY_ID[archetypeId];
  if (!a) return null;
  return bucketForPrimaryRole(a.primaryRole);
}

// Eligible archetype ids per bucket, for targeted generation.
const ARCHETYPES_BY_BUCKET: Record<RosterBucket, readonly string[]> = (() => {
  const out: Record<RosterBucket, string[]> = { GK: [], CB: [], FB: [], MID: [], FWD: [] };
  for (const a of ARCHETYPE_LIBRARY) {
    out[bucketForPrimaryRole(a.primaryRole)].push(a.id);
  }
  return out;
})();

export const ROSTER_FLOORS: Readonly<Record<RosterBucket, number>> = {
  GK: 2,
  CB: 3,
  FB: 2,
  MID: 4,
  FWD: 3,
};

const BUCKET_ORDER: readonly RosterBucket[] = ["GK", "CB", "FB", "MID", "FWD"];

interface ClubRow {
  id: number;
  nationality: string;
}

interface FreeAgentRow {
  id: number;
  archetype_id: string;
  preferred_positions_json: string;
}

function pickBiggestDeficit(
  have: Record<RosterBucket, number>,
): RosterBucket | null {
  let best: RosterBucket | null = null;
  let bestDeficit = 0;
  for (const b of BUCKET_ORDER) {
    const d = ROSTER_FLOORS[b] - have[b];
    if (d > bestDeficit) {
      bestDeficit = d;
      best = b;
    }
  }
  return best;
}

export function enforceMinimumRosterSqlite(
  client: Extract<DbClient, { dialect: "sqlite" }>,
  now: string,
): { signings: number; generated: number } {
  let signings = 0;
  let generated = 0;
  {
    const runRow = client.sqlite
      .prepare<[], { run_id: number }>(`SELECT run_id FROM clubs LIMIT 1`)
      .get();
    const runId = runRow?.run_id ?? 1;

    const seasonRow = client.sqlite
      .prepare<[], { season: number }>(`SELECT season FROM save_state WHERE id = 1`)
      .get();
    const season = seasonRow?.season ?? 0;

    const rng = mulberry32((runId * 2654435761 + season * 97 + 13) >>> 0);

    const clubs = client.sqlite
      .prepare<[], ClubRow>(`SELECT id, nationality FROM clubs ORDER BY id`)
      .all();

    const clubPlayersStmt = client.sqlite.prepare<[number], { archetype_id: string }>(
      `SELECT archetype_id FROM players WHERE club_id = ?`,
    );
    const freeAgentsStmt = client.sqlite.prepare<[], FreeAgentRow>(
      `SELECT id, archetype_id, preferred_positions_json FROM players WHERE club_id IS NULL`,
    );

    const insertPlayer = client.sqlite.prepare(
      `INSERT INTO players (run_id, club_id, name, dob, age, nationality, preferred_foot,
                            archetype_id, hidden_attrs_json, mental_traits_json,
                            experience_years, narrative_seed_json, preferred_positions_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertBadge = client.sqlite.prepare(
      `INSERT INTO player_badges (player_id, badge_key, tier, awarded_at, awarded_reason)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const insertPreferences = client.sqlite.prepare(
      `INSERT INTO player_preferences
         (player_id, wage_floor_cents, min_playing_time,
          preferred_regions_json, forbidden_club_ids_json)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const deleteContract = client.sqlite.prepare(`DELETE FROM contracts WHERE player_id = ?`);
    const insertContract = client.sqlite.prepare(
      `INSERT INTO contracts
         (player_id, club_id, weekly_wage_cents, signing_bonus_cents,
          seasons_remaining, role_promise, release_clause_cents, is_loan,
          loan_details_json, wages_by_season_json, signed_at)
       VALUES (?, ?, ?, 0, ?, 'Squad', NULL, 0, NULL, ?, ?)`,
    );
    const deleteSquadEntry = client.sqlite.prepare(
      `DELETE FROM squad_entries WHERE player_id = ?`,
    );
    const insertSquad = client.sqlite.prepare(
      `INSERT INTO squad_entries (club_id, player_id, role, updated_at)
       VALUES (?, ?, ?, ?)`,
    );
    const movePlayer = client.sqlite.prepare(`UPDATE players SET club_id = ? WHERE id = ?`);
    const clearListing = client.sqlite.prepare(`DELETE FROM listing WHERE player_id = ?`);
    const hasPrefsStmt = client.sqlite.prepare<[number], { n: number }>(
      `SELECT COUNT(*) AS n FROM player_preferences WHERE player_id = ?`,
    );

    const generateForBucket = (bucket: RosterBucket | null): FreeAgentRow => {
      // Target generation: sample until we hit a matching archetype, then
      // persist. With up to 40 tries against a uniform archetype pick this
      // is effectively guaranteed to succeed for any bucket.
      const eligible = bucket ? ARCHETYPES_BY_BUCKET[bucket] : null;
      let np: ReturnType<typeof generatePlayer> | null = null;
      for (let i = 0; i < 60; i++) {
        const candidate = generatePlayer({
          runId,
          clubId: null,
          referenceDate: new Date(),
          rng,
          overrideAge: 18,
        });
        if (!eligible || eligible.includes(candidate.archetypeId)) {
          np = candidate;
          break;
        }
      }
      if (!np) {
        np = generatePlayer({
          runId, clubId: null, referenceDate: new Date(), rng, overrideAge: 18,
        });
      }
      const info = insertPlayer.run(
        runId, null, np.name, np.dob, np.age, np.nationality,
        np.preferredFoot, np.archetypeId,
        JSON.stringify(np.hiddenAttrs), JSON.stringify(np.mentalTraits),
        np.experienceYears, JSON.stringify(np.narrativeSeed),
        JSON.stringify(np.preferredPositions), now,
      );
      const pid = Number(info.lastInsertRowid);
      for (const key of np.badgeKeys) insertBadge.run(pid, key, null, now, "generation");
      insertPreferences.run(pid, MIN_WAGE_CENTS, "Squad",
        JSON.stringify([np.nationality]), JSON.stringify([]));
      generated++;
      return {
        id: pid,
        archetype_id: np.archetypeId,
        preferred_positions_json: JSON.stringify(np.preferredPositions),
      };
    };

    const takeFreeAgent = (
      pool: FreeAgentRow[],
      bucket: RosterBucket | null,
      rngLocal: Random,
    ): FreeAgentRow | null => {
      if (pool.length === 0) return null;
      if (bucket) {
        const matchIdxs: number[] = [];
        for (let i = 0; i < pool.length; i++) {
          if (bucketForArchetype(pool[i]!.archetype_id) === bucket) matchIdxs.push(i);
        }
        if (matchIdxs.length > 0) {
          const idx = matchIdxs[Math.floor(rngLocal.next() * matchIdxs.length)]!;
          const [row] = pool.splice(idx, 1);
          return row!;
        }
        return null;
      }
      const idx = Math.floor(rngLocal.next() * pool.length);
      const [row] = pool.splice(idx, 1);
      return row!;
    };

    const signOne = (clubId: number, fa: FreeAgentRow) => {
      deleteContract.run(fa.id);
      insertContract.run(
        fa.id, clubId, MIN_WAGE_CENTS, FORCED_CONTRACT_SEASONS,
        JSON.stringify([MIN_WAGE_CENTS, MIN_WAGE_CENTS]), now,
      );
      movePlayer.run(clubId, fa.id);
      deleteSquadEntry.run(fa.id);
      insertSquad.run(clubId, fa.id, "Squad", now);
      clearListing.run(fa.id);
      const hasPrefs = hasPrefsStmt.get(fa.id);
      if (!hasPrefs || hasPrefs.n === 0) {
        insertPreferences.run(fa.id, MIN_WAGE_CENTS, "Squad",
          JSON.stringify([]), JSON.stringify([]));
      }
      signings++;
    };

    for (const club of clubs) {
      const have: Record<RosterBucket, number> = { GK: 0, CB: 0, FB: 0, MID: 0, FWD: 0 };
      const currentArchs = clubPlayersStmt.all(club.id);
      let count = currentArchs.length;
      for (const r of currentArchs) {
        const b = bucketForArchetype(r.archetype_id);
        if (b) have[b]++;
      }

      // Snapshot free-agent pool for this club; we mutate it as we sign.
      const pool: FreeAgentRow[] = freeAgentsStmt.all();

      const needsMore = (): boolean => {
        if (pickBiggestDeficit(have) !== null) return true;
        return count < ROSTER_FLOOR;
      };

      while (needsMore()) {
        const bucket = pickBiggestDeficit(have);
        let fa = takeFreeAgent(pool, bucket, rng);
        if (!fa) {
          fa = generateForBucket(bucket);
        }
        signOne(club.id, fa);
        const b = bucketForArchetype(fa.archetype_id);
        if (b) have[b]++;
        count++;
      }
    }
  }
  return { signings, generated };
}

interface PgQueryable {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export async function enforceMinimumRosterPostgres(
  conn: PgQueryable,
  now: string,
): Promise<{ signings: number; generated: number }> {
  let signings = 0;
  let generated = 0;
  {
    const runRow = await conn.query<{ run_id: number }>(
      `SELECT run_id FROM clubs LIMIT 1`,
    );
    const runId = runRow.rows[0]?.run_id ?? 1;
    const seasonRow = await conn.query<{ season: number }>(
      `SELECT season FROM save_state WHERE id = 1`,
    );
    const season = seasonRow.rows[0]?.season ?? 0;
    const rng = mulberry32((runId * 2654435761 + season * 97 + 13) >>> 0);

    const clubsRes = await conn.query<ClubRow>(
      `SELECT id, nationality FROM clubs ORDER BY id`,
    );

    const fetchFreeAgents = async (): Promise<FreeAgentRow[]> => {
      const r = await conn.query<FreeAgentRow>(
        `SELECT id, archetype_id, preferred_positions_json FROM players WHERE club_id IS NULL`,
      );
      return r.rows;
    };

    const takeFreeAgent = (
      pool: FreeAgentRow[],
      bucket: RosterBucket | null,
    ): FreeAgentRow | null => {
      if (pool.length === 0) return null;
      if (bucket) {
        const matchIdxs: number[] = [];
        for (let i = 0; i < pool.length; i++) {
          if (bucketForArchetype(pool[i]!.archetype_id) === bucket) matchIdxs.push(i);
        }
        if (matchIdxs.length > 0) {
          const idx = matchIdxs[Math.floor(rng.next() * matchIdxs.length)]!;
          const [row] = pool.splice(idx, 1);
          return row!;
        }
        return null;
      }
      const idx = Math.floor(rng.next() * pool.length);
      const [row] = pool.splice(idx, 1);
      return row!;
    };

    const generateForBucket = async (bucket: RosterBucket | null): Promise<FreeAgentRow> => {
      const eligible = bucket ? ARCHETYPES_BY_BUCKET[bucket] : null;
      let np: ReturnType<typeof generatePlayer> | null = null;
      for (let i = 0; i < 60; i++) {
        const candidate = generatePlayer({
          runId, clubId: null, referenceDate: new Date(), rng, overrideAge: 18,
        });
        if (!eligible || eligible.includes(candidate.archetypeId)) {
          np = candidate;
          break;
        }
      }
      if (!np) {
        np = generatePlayer({
          runId, clubId: null, referenceDate: new Date(), rng, overrideAge: 18,
        });
      }
      const ins = await conn.query<{ id: number }>(
        `INSERT INTO players (run_id, club_id, name, dob, age, nationality, preferred_foot,
                              archetype_id, hidden_attrs_json, mental_traits_json,
                              experience_years, narrative_seed_json, preferred_positions_json, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id`,
        [
          runId, null, np.name, np.dob, np.age, np.nationality,
          np.preferredFoot, np.archetypeId,
          JSON.stringify(np.hiddenAttrs), JSON.stringify(np.mentalTraits),
          np.experienceYears, JSON.stringify(np.narrativeSeed),
          JSON.stringify(np.preferredPositions), now,
        ],
      );
      const pid = ins.rows[0]!.id;
      for (const key of np.badgeKeys) {
        await conn.query(
          `INSERT INTO player_badges (player_id, badge_key, tier, awarded_at, awarded_reason)
           VALUES ($1,$2,NULL,$3,'generation')`,
          [pid, key, now],
        );
      }
      await conn.query(
        `INSERT INTO player_preferences (player_id, wage_floor_cents, min_playing_time,
                                         preferred_regions_json, forbidden_club_ids_json)
         VALUES ($1,$2,'Squad',$3,'[]')`,
        [pid, MIN_WAGE_CENTS, JSON.stringify([np.nationality])],
      );
      generated++;
      return {
        id: pid,
        archetype_id: np.archetypeId,
        preferred_positions_json: JSON.stringify(np.preferredPositions),
      };
    };

    const signOne = async (clubId: number, fa: FreeAgentRow) => {
      await conn.query(`DELETE FROM contracts WHERE player_id = $1`, [fa.id]);
      await conn.query(
        `INSERT INTO contracts (player_id, club_id, weekly_wage_cents, signing_bonus_cents,
                                seasons_remaining, role_promise, release_clause_cents, is_loan,
                                loan_details_json, wages_by_season_json, signed_at)
         VALUES ($1,$2,$3,0,$4,'Squad',NULL,0,NULL,$5,$6)`,
        [fa.id, clubId, MIN_WAGE_CENTS, FORCED_CONTRACT_SEASONS,
          JSON.stringify([MIN_WAGE_CENTS, MIN_WAGE_CENTS]), now],
      );
      await conn.query(`UPDATE players SET club_id = $1 WHERE id = $2`, [clubId, fa.id]);
      await conn.query(`DELETE FROM squad_entries WHERE player_id = $1`, [fa.id]);
      await conn.query(
        `INSERT INTO squad_entries (club_id, player_id, role, updated_at)
         VALUES ($1,$2,'Squad',$3)`,
        [clubId, fa.id, now],
      );
      await conn.query(`DELETE FROM listing WHERE player_id = $1`, [fa.id]);
      const prefsCheck = await conn.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM player_preferences WHERE player_id = $1`,
        [fa.id],
      );
      if (Number(prefsCheck.rows[0]?.n ?? 0) === 0) {
        await conn.query(
          `INSERT INTO player_preferences (player_id, wage_floor_cents, min_playing_time,
                                           preferred_regions_json, forbidden_club_ids_json)
           VALUES ($1,$2,'Squad','[]','[]')`,
          [fa.id, MIN_WAGE_CENTS],
        );
      }
      signings++;
    };

    for (const club of clubsRes.rows) {
      const have: Record<RosterBucket, number> = { GK: 0, CB: 0, FB: 0, MID: 0, FWD: 0 };
      const archRes = await conn.query<{ archetype_id: string }>(
        `SELECT archetype_id FROM players WHERE club_id = $1`,
        [club.id],
      );
      let count = archRes.rows.length;
      for (const r of archRes.rows) {
        const b = bucketForArchetype(r.archetype_id);
        if (b) have[b]++;
      }

      const pool: FreeAgentRow[] = await fetchFreeAgents();

      const needsMore = (): boolean => {
        if (pickBiggestDeficit(have) !== null) return true;
        return count < ROSTER_FLOOR;
      };

      while (needsMore()) {
        const bucket = pickBiggestDeficit(have);
        let fa = takeFreeAgent(pool, bucket);
        if (!fa) {
          fa = await generateForBucket(bucket);
        }
        await signOne(club.id, fa);
        const b = bucketForArchetype(fa.archetype_id);
        if (b) have[b]++;
        count++;
      }
    }
  }

  return { signings, generated };
}
