import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedContentIfMissing } from "../application/content-seed.js";
import { seedContractsIfEmpty } from "../application/players/seed-contracts.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { advanceMatchday } from "../application/season/advance.js";
import { ensureSaveState, seedFixturesIfEmpty } from "../application/season/seed.js";
import { pickStarters } from "../application/season/starter-picker.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";
import { seedTacticsIfEmpty } from "../application/tactics/seed.js";
import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { renderSquadForClub } from "../rendering/squad-response.js";
import type { SimEngine, SimMatchInput, SimPerformance } from "../sim/interface.js";

const NOW = new Date("2026-06-01T00:00:00Z");

const quietEngine: SimEngine = {
  simulateMatch(input: SimMatchInput) {
    const performances: SimPerformance[] = [input.home, input.away].flatMap((side) =>
      side.starters.map((player) => ({
        playerId: player.playerId,
        clubId: side.clubId,
        goals: 0,
        assists: 0,
        tier: "Average",
        eventDescription: null,
        minutesPlayed: 90,
        shots: 0,
        shotsOnTarget: 0,
        xgX100: 0,
        keyPasses: 0,
        passesAttempted: 0,
        passesCompleted: 0,
        tacklesAttempted: 0,
        tacklesWon: 0,
        interceptions: 0,
        clearances: 0,
        aerialsWon: 0,
        aerialsContested: 0,
        dribblesCompleted: 0,
        foulsCommitted: 0,
        foulsDrawn: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        ratingX10: 60,
        started: true,
        enteredMinute: null,
        leftMinute: null,
        positionSlot: player.slot ?? null,
      })),
    );
    return {
      matchId: input.matchId,
      homeGoals: 0,
      awayGoals: 0,
      performances,
      events: [],
      playerUpdates: [],
    };
  },
};

describe("Story 12 AC-09 — actual starts drive playing-time promises", () => {
  let db: DbClient;
  let starPlayerId: number;

  beforeAll(async () => {
    db = createDbClient("sqlite::memory:");
    await runMigrations(db);
    await seedContentIfMissing(db);
    await seedWorldIfEmpty(db, {
      seed: 42,
      clubCount: 10,
      playersPerClub: 20,
      referenceDate: NOW,
    });
    await seedContractsIfEmpty(db);
    await seedTacticsIfEmpty(db);
    await seedSquadIfEmpty(db);
    await ensureSaveState(db);
    await seedFixturesIfEmpty(db);

    if (db.dialect !== "sqlite") return;
    db.sqlite.prepare(`UPDATE squad_entries SET role = 'Starter' WHERE club_id = 1`).run();
    const initialSide = await pickStarters(db, 1);
    const starterIds = new Set(initialSide.starters.map((player) => player.playerId));
    const reserve = db.sqlite
      .prepare<[], { id: number }>(`SELECT id FROM players WHERE club_id = 1 ORDER BY id DESC`)
      .all()
      .find((player) => !starterIds.has(player.id));
    expect(reserve).toBeDefined();
    starPlayerId = reserve!.id;

    db.sqlite
      .prepare(`UPDATE contracts SET role_promise = 'Star Player' WHERE player_id = ?`)
      .run(starPlayerId);
    db.sqlite
      .prepare(`UPDATE squad_entries SET role = 'Youth' WHERE player_id = ?`)
      .run(starPlayerId);
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("counts only eligible non-starts, emits once at four, and resets on a start", async () => {
    if (db.dialect !== "sqlite") return;

    await advanceQuietly();
    await advanceQuietly();
    expect(readStreak()).toBe(2);
    expect(readEventCount()).toBe(0);

    db.sqlite
      .prepare(
        `INSERT INTO player_condition
           (player_id, fatigue_load, injury_kind, injury_matches_remaining,
            updated_season, updated_match_week, updated_at)
         VALUES (?, 0, 'match_injury', 1, 0, 2, ?)
         ON CONFLICT(player_id) DO UPDATE SET
           injury_kind = excluded.injury_kind,
           injury_matches_remaining = excluded.injury_matches_remaining,
           updated_at = excluded.updated_at`,
      )
      .run(starPlayerId, NOW.toISOString());
    await advanceQuietly();
    expect(readStreak()).toBe(2);

    db.sqlite
      .prepare(
        `INSERT INTO player_discipline
           (player_id, competition_key, season, yellow_cards, suspension_matches_remaining)
         VALUES (?, 'league', 0, 0, 1)
         ON CONFLICT(player_id, competition_key, season) DO UPDATE SET
           suspension_matches_remaining = excluded.suspension_matches_remaining`,
      )
      .run(starPlayerId);
    await advanceQuietly();
    expect(readStreak()).toBe(2);

    await advanceQuietly();
    expect(readStreak()).toBe(3);
    expect(readEventCount()).toBe(0);

    await advanceQuietly();
    expect(readStreak()).toBe(4);
    expect(readEventCount()).toBe(1);

    await advanceQuietly();
    expect(readStreak()).toBe(5);
    expect(readEventCount()).toBe(1);

    db.sqlite
      .prepare(`UPDATE tactics SET assignments_json = ? WHERE club_id = 1`)
      .run(JSON.stringify({ GK: starPlayerId }));
    await advanceQuietly();
    expect(readStreak()).toBe(0);
    expect(readEventCount()).toBe(1);

    const squad = await renderSquadForClub(db, 1);
    const player = squad?.entries.find((entry) => entry.playerId === starPlayerId);
    expect(player?.promiseMood).toBe("Disappointed");
    expect(player?.promiseMoodLabel).toBe("A promised place has gone unfulfilled. He remembers.");
  });

  async function advanceQuietly(): Promise<void> {
    await advanceMatchday(db, { now: NOW, engine: quietEngine, skipAiBids: true });
  }

  function readStreak(): number {
    if (db.dialect !== "sqlite") return -1;
    return db.sqlite
      .prepare<[number], { eligible_non_start_streak: number }>(
        `SELECT eligible_non_start_streak
         FROM playing_time_promise_state WHERE player_id = ?`,
      )
      .get(starPlayerId)!.eligible_non_start_streak;
  }

  function readEventCount(): number {
    if (db.dialect !== "sqlite") return -1;
    return db.sqlite
      .prepare<[number], { n: number }>(
        `SELECT COUNT(*) AS n FROM player_relationship_events
         WHERE player_id = ? AND event_type = 'playing_time_promise_broken'`,
      )
      .get(starPlayerId)!.n;
  }
});
