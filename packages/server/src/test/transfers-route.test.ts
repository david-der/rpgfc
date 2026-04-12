// Story 04 AC-12, AC-14 — /api/transfers + /api/players/:id/contract
// route coverage. Hono test client, no network.
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
import { createApiApp } from "../index.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

function baseDeps(db: DbClient, devEndpointsEnabled = true) {
  return {
    dialect: db.dialect,
    commit: "dev",
    db,
    devEndpointsEnabled,
    now: () => REFERENCE_DATE,
  };
}

describe("transfer routes — Story 04", () => {
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

  it("AC-12: GET /api/transfers returns listings without any cents fields", async () => {
    const app = createApiApp(baseDeps(db));
    const res = await app.request("/api/transfers");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      listings: Array<Record<string, unknown>>;
      pending: unknown[];
    };
    expect(body.listings.length).toBeGreaterThan(0);
    const raw = JSON.stringify(body);
    // No "cents" substring should appear anywhere in the wire payload.
    expect(raw.toLowerCase()).not.toContain("cents");
    // Every listing carries a qualitative askingTier word.
    for (const listing of body.listings) {
      expect(["Minimal", "Modest", "Notable", "Significant", "Elite"]).toContain(
        listing.askingTier,
      );
    }
  });

  it("AC-13: POST /api/transfers/:playerId/bid persists and returns a rendered bid", async () => {
    const app = createApiApp(baseDeps(db));
    const pickRes = await app.request("/api/transfers");
    const listings = (await pickRes.json()) as { listings: Array<{ playerId: number }> };
    const target = listings.listings[0]!;
    const res = await app.request(`/api/transfers/${target.playerId}/bid`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        feeTier: "Notable",
        wageTier: "Modest",
        rolePromise: "Rotation",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: number; state: string };
    expect(typeof body.id).toBe("number");
    // Story 08: bids enter Submitted state; resolution happens during
    // advanceMatchday. The state should be Submitted immediately.
    expect(body.state).toBe("Submitted");
  });

  it("AC-14: GET /api/players/:id/contract returns null when no contract exists", async () => {
    const app = createApiApp(baseDeps(db));
    // Player 199 is almost certainly still under its original (null)
    // contract — no bid has fired on it.
    const res = await app.request("/api/players/199/contract");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { contract: unknown };
    expect(body.contract).toBeNull();
  });

  it("AC-14: after a force-accepted bid, GET /api/players/:id/contract returns a RenderedContract", async () => {
    const app = createApiApp(baseDeps(db));

    // Submit a bid then force-accept it via the dev-only endpoint.
    const listingsRes = await app.request("/api/transfers");
    const listings = (await listingsRes.json()) as { listings: Array<{ playerId: number }> };
    const target = listings.listings[0]!;
    const submitRes = await app.request(`/api/transfers/${target.playerId}/bid`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        feeTier: "Significant",
        wageTier: "Significant",
        rolePromise: "Star Player",
      }),
    });
    const submitted = (await submitRes.json()) as { id: number };
    await app.request(`/api/transfers/bids/${submitted.id}/force-accept`, {
      method: "POST",
    });

    const contractRes = await app.request(`/api/players/${target.playerId}/contract`);
    const body = (await contractRes.json()) as {
      contract: { wageTier: string; rolePromise: string } | null;
    };
    expect(body.contract).not.toBeNull();
    expect(["Minimal", "Modest", "Notable", "Significant", "Elite"]).toContain(
      body.contract!.wageTier,
    );
    // No cents anywhere.
    expect(JSON.stringify(body).toLowerCase()).not.toContain("cents");
  });

  it("AC-13: force-accept is dev-only (404 when devEndpointsEnabled=false)", async () => {
    const app = createApiApp(baseDeps(db, false));
    const res = await app.request("/api/transfers/bids/1/force-accept", {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});
