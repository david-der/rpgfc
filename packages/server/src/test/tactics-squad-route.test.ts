// Story 05 AC-08, AC-09, AC-10, AC-11, AC-12 — /api/tactics + /api/squad
// route coverage. Hono test client, no network.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedClubIdentityIfMissing } from "../application/clubs/seed-identity.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import {
  seedListingsIfEmpty,
  seedPreferencesIfEmpty,
} from "../application/transfers/seed-listings.js";
import { seedTacticsIfEmpty } from "../application/tactics/seed.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";
import { createApiApp } from "../index.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

function baseDeps(db: DbClient) {
  return {
    dialect: db.dialect,
    commit: "dev",
    db,
    devEndpointsEnabled: true,
    now: () => REFERENCE_DATE,
  };
}

describe("tactics + squad routes — Story 05", () => {
  let db: DbClient;

  beforeAll(async () => {
    db = createDbClient("sqlite::memory:");
    await runMigrations(db);
    await seedContentIfMissing(db);
    await seedWorldIfEmpty(db, {
      seed: 42,
      clubCount: 6,
      playersPerClub: 15,
      referenceDate: REFERENCE_DATE,
    });
    await seedClubIdentityIfMissing(db);
    await seedListingsIfEmpty(db);
    await seedPreferencesIfEmpty(db);
    await seedTacticsIfEmpty(db);
    await seedSquadIfEmpty(db);
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-11: GET /api/tactics returns RenderedTactics with 11 slot rows for 4-3-3", async () => {
    const app = createApiApp(baseDeps(db));
    const res = await app.request("/api/tactics");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      formation: string;
      formationLabel: string;
      playingStyleLabel: string;
      instructionLabels: string[];
      assignments: Array<{ slot: string; playerId: number | null }>;
    };
    expect(body.formation).toBe("4-3-3");
    expect(body.formationLabel).toBe("4-3-3");
    expect(body.assignments).toHaveLength(11);
    // All eleven slots start empty after seed.
    for (const a of body.assignments) {
      expect(a.playerId).toBeNull();
    }
  });

  it("AC-08: POST /api/tactics/assignments refuses a slot not in the current formation", async () => {
    const app = createApiApp(baseDeps(db));
    const res = await app.request("/api/tactics/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot: "AMC", playerId: 1 }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("slot_not_in_formation");
  });

  it("AC-12: GET /api/squad returns a rendered squad with harmony + per-player mood", async () => {
    const app = createApiApp(baseDeps(db));
    const res = await app.request("/api/squad");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      harmony: string;
      harmonyLabel: string;
      entries: Array<{
        playerId: number;
        playerName: string;
        role: string;
        promiseMood: string | null;
        promiseMoodLabel: string | null;
      }>;
    };
    expect(["Harmonious", "Settled", "Uneasy", "Fractured", "InRevolt"]).toContain(body.harmony);
    expect(body.entries.length).toBeGreaterThan(0);
    for (const entry of body.entries) {
      expect(["Starter", "Rotation", "Backup", "Youth"]).toContain(entry.role);
    }
    // No digit, no currency glyph anywhere in the rendered squad body.
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/[£$€¥]/);
    expect(raw.toLowerCase()).not.toContain("cents");
  });

  it("AC-09 + AC-10: updating a squad role flips the profile's promiseMoodLabel", async () => {
    const app = createApiApp(baseDeps(db));
    if (db.dialect !== "sqlite") return;

    // Find a player who is currently a Starter in the user's club (clubId=1).
    const row = db.sqlite
      .prepare<
        [],
        { player_id: number }
      >(
        `SELECT player_id FROM squad_entries WHERE club_id = 1 AND role = 'Starter' LIMIT 1`,
      )
      .get();
    expect(row).toBeDefined();
    const playerId = row!.player_id;

    // Manually insert a contract that promises Star Player so the mood
    // becomes Content while the player is a Starter.
    const nowIso = REFERENCE_DATE.toISOString();
    db.sqlite
      .prepare(
        `INSERT INTO contracts
           (player_id, club_id, weekly_wage_cents, signing_bonus_cents,
            seasons_remaining, role_promise, release_clause_cents, is_loan,
            loan_details_json, signed_at)
         VALUES (?, 1, 1000000, 0, 3, 'Star Player', NULL, 0, NULL, ?)`,
      )
      .run(playerId, nowIso);

    // Baseline: promiseMoodLabel on /players/:id is the Content template.
    const before = await app.request(`/api/players/${playerId}`);
    const beforeBody = (await before.json()) as { promiseMoodLabel?: string };
    expect(beforeBody.promiseMoodLabel).toContain("Playing the role we promised");

    // Demote to Rotation — mood should flip to Concerned.
    const update = await app.request(`/api/squad/${playerId}/role`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "Rotation" }),
    });
    expect(update.status).toBe(200);

    const after = await app.request(`/api/players/${playerId}`);
    const afterBody = (await after.json()) as { promiseMoodLabel?: string };
    expect(afterBody.promiseMoodLabel).toMatch(/ask|meant|said/);
  });
});
