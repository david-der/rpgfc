// Story 09 — Ten-Team League Contract & Complete Search.
// These acceptance tests intentionally pin the first play-ready world to
// ten clubs. Expansion is a later scaling story, not an implicit default.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ARCHETYPE_BY_ID } from "@rpgfc/shared";

import { generateWorld } from "../application/generation/generate-world.js";
import { listPlayers, seedWorldIfEmpty } from "../application/players/index.js";
import { generateFullSeason } from "../application/season/schedule.js";
import { fixtureSeed } from "../application/season/seed-value.js";
import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedContentIfMissing } from "../application/content-seed.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

describe("Story 09 — intentional ten-team league", () => {
  it("AC-09-01: the canonical world is deterministic, unique, and positionally viable", () => {
    const config = {
      seed: 42,
      clubCount: 10,
      playersPerClub: 20,
      referenceDate: REFERENCE_DATE,
    };
    const first = generateWorld(config);
    const second = generateWorld(config);

    expect(first).toEqual(second);
    expect(first.clubs).toHaveLength(10);
    expect(new Set(first.clubs.map((club) => club.name)).size).toBe(10);

    for (const club of first.clubs) {
      expect(club.players).toHaveLength(20);
      const families = club.players.map((player) => {
        const position = ARCHETYPE_BY_ID[player.archetypeId]?.positionLabel;
        if (position === "GK") return "gk";
        if (position === "CB" || position === "FB") return "def";
        if (position === "DM" || position === "CM" || position === "AM") return "mid";
        return "fwd";
      });
      expect(families.filter((family) => family === "gk")).toHaveLength(2);
      expect(families.filter((family) => family === "def").length).toBeGreaterThanOrEqual(6);
      expect(families.filter((family) => family === "mid").length).toBeGreaterThanOrEqual(6);
      expect(families.filter((family) => family === "fwd").length).toBeGreaterThanOrEqual(5);
    }
  });

  it("AC-09-02: ten clubs produce eighteen weeks and ninety home-and-away fixtures", () => {
    const clubIds = Array.from({ length: 10 }, (_, index) => index + 1);
    const weeks = generateFullSeason(clubIds);
    const fixtures = weeks.flatMap((week) => week.fixtures);

    expect(weeks).toHaveLength(18);
    expect(fixtures).toHaveLength(90);
    expect(weeks.every((week) => week.fixtures.length === 5)).toBe(true);

    for (const clubId of clubIds) {
      expect(
        fixtures.filter(
          (fixture) => fixture.homeClubId === clubId || fixture.awayClubId === clubId,
        ),
      ).toHaveLength(18);
    }
  });

  it("AC-09-03: fixture seeds are stable within a season and distinct across seasons", () => {
    expect(fixtureSeed(42, 0, 1, 1, 2)).toBe(fixtureSeed(42, 0, 1, 1, 2));
    expect(fixtureSeed(42, 0, 1, 1, 2)).not.toBe(fixtureSeed(42, 1, 1, 1, 2));
  });
});

describe("Story 09 — complete player search", () => {
  let db: DbClient;

  beforeAll(async () => {
    db = createDbClient("sqlite::memory:");
    await runMigrations(db);
    await seedContentIfMissing(db);
    await seedWorldIfEmpty(db, {
      seed: 42,
      clubCount: 10,
      playersPerClub: 20,
      referenceDate: REFERENCE_DATE,
    });
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-09-04: cursor pagination reaches all two hundred players without gaps", async () => {
    const seen = new Set<number>();
    let cursor: number | undefined;
    do {
      const page = await listPlayers(db, { limit: 37, ...(cursor ? { cursor } : {}) });
      for (const player of page.items) seen.add(player.id);
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);

    expect(seen.size).toBe(200);
    expect(Math.max(...seen)).toBeGreaterThan(100);
  });

  it("AC-09-05: filters execute before LIMIT and can find a player beyond the first page", async () => {
    if (db.dialect !== "sqlite") return;
    const target = db.sqlite
      .prepare<
        [],
        { id: number; name: string }
      >(`SELECT id, name FROM players WHERE id > 150 ORDER BY id DESC LIMIT 1`)
      .get();
    expect(target).toBeDefined();

    const page = await listPlayers(db, { limit: 1, search: target!.name });
    expect(page.items.map((player) => player.id)).toEqual([target!.id]);
  });

  it("AC-09-06: the market filter reaches listed players beyond the first page", async () => {
    if (db.dialect !== "sqlite") return;
    const targetId = 180;
    db.sqlite
      .prepare(
        `INSERT INTO listing (player_id, asking_price_cents, reason, listed_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(targetId, 1_000_000, "Squad planning", REFERENCE_DATE.toISOString());

    const page = await listPlayers(db, { limit: 10, onMarket: true });
    expect(page.items.map((player) => player.id)).toContain(targetId);
  });
});
