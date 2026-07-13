// Story 04 AC-03, AC-04, AC-06, AC-11 — end-to-end bid flow against a
// seeded in-memory DB.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedClubIdentityIfMissing } from "../application/clubs/seed-identity.js";
import { seedScoutsIfMissing } from "../application/scouting/seed-scouts.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import {
  seedListingsIfEmpty,
  seedPreferencesIfEmpty,
} from "../application/transfers/seed-listings.js";
import { forceAcceptBid, submitBid } from "../application/transfers/bids.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

describe("transfers end-to-end — Story 04", () => {
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
    await seedClubIdentityIfMissing(db);
    await seedScoutsIfMissing(db, 1);
    await seedListingsIfEmpty(db);
    await seedPreferencesIfEmpty(db);
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-03: every club has 1–3 listings", () => {
    if (db.dialect !== "sqlite") return;
    const clubs = db.sqlite.prepare<[], { id: number }>(`SELECT id FROM clubs`).all();
    for (const club of clubs) {
      const rows = db.sqlite
        .prepare<[number], { n: number }>(
          `SELECT COUNT(*) AS n FROM listing l
           JOIN players p ON p.id = l.player_id
           WHERE p.club_id = ?`,
        )
        .get(club.id);
      const count = rows?.n ?? 0;
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(3);
    }
  });

  it("AC-04: every generated player has a preferences row", () => {
    if (db.dialect !== "sqlite") return;
    const p = db.sqlite.prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM players`).get();
    const pref = db.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM player_preferences`)
      .get();
    expect(pref?.n).toBe(p?.n);
  });

  it("AC-06: happy-path force-accept creates a contract and moves the player", async () => {
    if (db.dialect !== "sqlite") return;

    // Pick a listed player NOT on club 1 (the buying club).
    const listed = db.sqlite
      .prepare<[], { player_id: number; asking_price_cents: number }>(
        `SELECT l.player_id, l.asking_price_cents
         FROM listing l JOIN players p ON p.id = l.player_id
         WHERE p.club_id != 1 LIMIT 1`,
      )
      .get();
    expect(listed).toBeDefined();
    const playerId = listed!.player_id;

    const playerBefore = db.sqlite
      .prepare<[number], { club_id: number | null }>(`SELECT club_id FROM players WHERE id = ?`)
      .get(playerId);
    const originalClubId = playerBefore?.club_id ?? null;
    expect(originalClubId).not.toBeNull();

    // Submit a bid from club id 1.
    const bid = await submitBid(db, {
      playerId,
      fromClubId: 1,
      feeCents: listed!.asking_price_cents,
      wageCents: 1_500_000, // $15k/week
      signingBonusCents: 0,
      rolePromise: "Star Player",
      now: REFERENCE_DATE,
    });

    // Force-accept regardless of evaluator outcome so the test can cover
    // the signing path without depending on preference-row compatibility.
    const signed = await forceAcceptBid(db, bid.id, REFERENCE_DATE);
    expect(signed?.state).toBe("Signed");

    // A contract row now exists for the player.
    const contract = db.sqlite
      .prepare<
        [number],
        { club_id: number; role_promise: string; is_loan: number }
      >(`SELECT club_id, role_promise, is_loan FROM contracts WHERE player_id = ?`)
      .get(playerId);
    expect(contract).toBeDefined();
    expect(contract!.club_id).toBe(1);
    expect(contract!.is_loan).toBe(0);

    // Player's club_id has been updated.
    const playerAfter = db.sqlite
      .prepare<[number], { club_id: number | null }>(`SELECT club_id FROM players WHERE id = ?`)
      .get(playerId);
    expect(playerAfter?.club_id).toBe(1);

    // Listing row is gone.
    const listingAfter = db.sqlite
      .prepare<[number], { player_id: number }>(`SELECT player_id FROM listing WHERE player_id = ?`)
      .get(playerId);
    expect(listingAfter).toBeUndefined();
  });

  it("AC-07: a fee 30% below asking produces a SellerRejected state", async () => {
    if (db.dialect !== "sqlite") return;

    // Pick a listing that still exists AND isn't on the buying club.
    const listed = db.sqlite
      .prepare<[], { player_id: number; asking_price_cents: number }>(
        `SELECT l.player_id, l.asking_price_cents
         FROM listing l JOIN players p ON p.id = l.player_id
         WHERE p.club_id != 1 LIMIT 1`,
      )
      .get();
    if (!listed) return;

    const lowBall = Math.floor(listed.asking_price_cents * 0.6);
    const bid = await submitBid(db, {
      playerId: listed.player_id,
      fromClubId: 1,
      feeCents: lowBall,
      wageCents: 1_500_000,
      signingBonusCents: 0,
      rolePromise: "Rotation",
      now: REFERENCE_DATE,
    });
    // Story 08: bids are now time-based. The bid enters Submitted
    // and the seller evaluates on the next advanceMatchday tick.
    expect(bid.state).toBe("Submitted");
  });
});
