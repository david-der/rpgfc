// Roster floor enforcement — after retirements and contract expiries,
// every club must end the season-rollover with at least 18 contracted
// players. This test creates a deliberately-drained club and asserts
// the enforcer fills it to exactly 18.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedClubIdentityIfMissing } from "../application/clubs/seed-identity.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import {
  ROSTER_FLOOR,
  ROSTER_FLOORS,
  bucketForArchetype,
  enforceMinimumRosterSqlite,
} from "../application/season/enforce-roster.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

describe("enforceMinimumRosterSqlite — roster floor safety net", () => {
  let db: DbClient;

  beforeAll(async () => {
    db = createDbClient("sqlite::memory:");
    await runMigrations(db);
    await seedContentIfMissing(db);
    await seedWorldIfEmpty(db, {
      seed: 42,
      clubCount: 10,
      playersPerClub: 14,
      referenceDate: REFERENCE_DATE,
    });
    await seedClubIdentityIfMissing(db);
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  function rosterSize(clubId: number): number {
    if (db.dialect !== "sqlite") throw new Error("sqlite only");
    return (
      db.sqlite
        .prepare<[number], { n: number }>(`SELECT COUNT(*) AS n FROM players WHERE club_id = ?`)
        .get(clubId)?.n ?? 0
    );
  }

  it("fills a drained club back to exactly 18 players with minimum-wage contracts", () => {
    if (db.dialect !== "sqlite") return;

    // Drain club 1 down to 9 players: free the rest.
    const roster = db.sqlite
      .prepare<[number], { id: number }>(`SELECT id FROM players WHERE club_id = ?`)
      .all(1);
    const keep = new Set(roster.slice(0, 9).map((r) => r.id));
    for (const r of roster) {
      if (keep.has(r.id)) continue;
      db.sqlite.prepare(`UPDATE players SET club_id = NULL WHERE id = ?`).run(r.id);
      db.sqlite.prepare(`DELETE FROM contracts WHERE player_id = ?`).run(r.id);
      db.sqlite.prepare(`DELETE FROM squad_entries WHERE player_id = ?`).run(r.id);
    }
    expect(rosterSize(1)).toBe(9);

    const now = REFERENCE_DATE.toISOString();
    const result = enforceMinimumRosterSqlite(db, now);
    expect(result.signings).toBeGreaterThan(0);
    expect(rosterSize(1)).toBe(ROSTER_FLOOR);

    // Every other club should also meet the floor.
    const clubIds = db.sqlite.prepare<[], { id: number }>(`SELECT id FROM clubs ORDER BY id`).all();
    for (const { id } of clubIds) {
      expect(rosterSize(id)).toBeGreaterThanOrEqual(ROSTER_FLOOR);
    }

    // New contracts are minimum-wage, 2-year.
    const contracts = db.sqlite
      .prepare<[number, number], { wage: number; seasons: number }>(
        `SELECT weekly_wage_cents AS wage, seasons_remaining AS seasons
         FROM contracts WHERE club_id = ? AND seasons_remaining = ?`,
      )
      .all(1, 2);
    expect(contracts.length).toBeGreaterThan(0);
    for (const c of contracts) expect(c.wage).toBe(300_000);
  });

  it("is idempotent — running twice doesn't over-sign", () => {
    if (db.dialect !== "sqlite") return;
    const before = rosterSize(1);
    const result = enforceMinimumRosterSqlite(db, REFERENCE_DATE.toISOString());
    expect(result.signings).toBe(0);
    expect(rosterSize(1)).toBe(before);
  });

  it("regenerates free agents when the pool is exhausted", () => {
    if (db.dialect !== "sqlite") return;

    // Sign every free agent to a throwaway sentinel club so the pool is
    // empty from the enforcer's perspective. Use club 3 as the sink and
    // then drain club 4 below the floor.
    const freeAgents = db.sqlite
      .prepare<[], { id: number }>(`SELECT id FROM players WHERE club_id IS NULL`)
      .all();
    for (const { id } of freeAgents) {
      db.sqlite.prepare(`UPDATE players SET club_id = 3 WHERE id = ?`).run(id);
    }
    // Drain club 4 to 5 players. Pool has zero free agents.
    const roster = db.sqlite
      .prepare<[number], { id: number }>(`SELECT id FROM players WHERE club_id = ?`)
      .all(4);
    const drop = roster.slice(0, roster.length - 5);
    for (const r of drop) {
      db.sqlite.prepare(`UPDATE players SET club_id = 3 WHERE id = ?`).run(r.id);
    }

    const result = enforceMinimumRosterSqlite(db, REFERENCE_DATE.toISOString());
    expect(result.generated).toBeGreaterThan(0);
    expect(rosterSize(4)).toBeGreaterThanOrEqual(ROSTER_FLOOR);
  });

  it("enforces absolute positional floors even when starting roster is lopsided", () => {
    if (db.dialect !== "sqlite") return;
    const sqlite = db.sqlite;

    // Drain club 5 entirely, then manually re-assign a lopsided roster:
    // 2 GK + 8 FWD, 0 CB / FB / MID. After enforcement every bucket
    // floor (GK=2, CB=3, FB=2, MID=4, FWD=3) must be satisfied.
    const roster = sqlite
      .prepare<[number], { id: number }>(`SELECT id FROM players WHERE club_id = ?`)
      .all(5);
    for (const r of roster) {
      sqlite.prepare(`UPDATE players SET club_id = NULL WHERE id = ?`).run(r.id);
      sqlite.prepare(`DELETE FROM contracts WHERE player_id = ?`).run(r.id);
      sqlite.prepare(`DELETE FROM squad_entries WHERE player_id = ?`).run(r.id);
    }

    const takeFreeAgentWithArchetype = (archetypeIds: readonly string[]): number | null => {
      const placeholders = archetypeIds.map(() => "?").join(",");
      const row = sqlite
        .prepare<string[], { id: number }>(
          `SELECT id FROM players
           WHERE club_id IS NULL AND archetype_id IN (${placeholders})
           LIMIT 1`,
        )
        .get(...archetypeIds);
      return row?.id ?? null;
    };

    const forceSign = (playerId: number, clubId: number) => {
      sqlite.prepare(`UPDATE players SET club_id = ? WHERE id = ?`).run(clubId, playerId);
      sqlite
        .prepare(
          `INSERT INTO contracts (player_id, club_id, weekly_wage_cents, signing_bonus_cents,
                                  seasons_remaining, role_promise, release_clause_cents,
                                  is_loan, loan_details_json, wages_by_season_json, signed_at)
           VALUES (?, ?, 300000, 0, 2, 'Squad', NULL, 0, NULL, ?, ?)`,
        )
        .run(playerId, clubId, JSON.stringify([300000, 300000]), REFERENCE_DATE.toISOString());
    };

    const GK_ARCHS = ["sweeper_keeper", "shot_stopper"];
    const FWD_ARCHS = ["pressing_forward", "target_man", "classic_nine"];
    let planted = 0;
    for (let i = 0; i < 2; i++) {
      const id = takeFreeAgentWithArchetype(GK_ARCHS);
      if (id !== null) {
        forceSign(id, 5);
        planted++;
      }
    }
    for (let i = 0; i < 8; i++) {
      const id = takeFreeAgentWithArchetype(FWD_ARCHS);
      if (id !== null) {
        forceSign(id, 5);
        planted++;
      }
    }
    // `planted` varies because earlier tests in this suite churn the
    // free-agent pool; what matters is that the enforcer satisfies every
    // bucket floor regardless of the starting shape.
    void planted;

    enforceMinimumRosterSqlite(db, REFERENCE_DATE.toISOString());

    const archRows = sqlite
      .prepare<
        [number],
        { archetype_id: string }
      >(`SELECT archetype_id FROM players WHERE club_id = ?`)
      .all(5);
    const counts: Record<string, number> = { GK: 0, CB: 0, FB: 0, MID: 0, FWD: 0 };
    for (const r of archRows) {
      const b = bucketForArchetype(r.archetype_id);
      if (b) counts[b]!++;
    }
    expect(counts.GK).toBeGreaterThanOrEqual(ROSTER_FLOORS.GK);
    expect(counts.CB).toBeGreaterThanOrEqual(ROSTER_FLOORS.CB);
    expect(counts.FB).toBeGreaterThanOrEqual(ROSTER_FLOORS.FB);
    expect(counts.MID).toBeGreaterThanOrEqual(ROSTER_FLOORS.MID);
    expect(counts.FWD).toBeGreaterThanOrEqual(ROSTER_FLOORS.FWD);
    expect(rosterSize(5)).toBeGreaterThanOrEqual(ROSTER_FLOOR);
  });
});
