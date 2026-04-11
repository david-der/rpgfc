// AC-07, AC-08: tactics repository invariants.
//
// AC-07 — pinning a player to a slot clears any prior slot for that
//         player in the same write (one player, one pin).
// AC-08 — assigning to a slot that isn't part of the current formation
//         returns { ok: false, reason: "slot_not_in_formation" }.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { getTactics, setAssignment, upsertTactics } from "../application/tactics/repository.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

describe("tactics repository — Story 05", () => {
  let db: DbClient;
  let clubId: number;

  beforeAll(async () => {
    db = createDbClient("sqlite::memory:");
    await runMigrations(db);
    await seedContentIfMissing(db);
    await seedWorldIfEmpty(db, {
      seed: 42,
      clubCount: 4,
      playersPerClub: 15,
      referenceDate: REFERENCE_DATE,
    });
    if (db.dialect !== "sqlite") return;
    const row = db.sqlite.prepare<[], { id: number }>(`SELECT id FROM clubs LIMIT 1`).get();
    clubId = row!.id;
  });

  afterAll(() => {
    if (db.dialect === "sqlite") db.close();
  });

  it("AC-07: pinning a player to a new slot clears the prior slot", async () => {
    if (db.dialect !== "sqlite") return;
    // Default tactics is 4-3-3. LW and ST1 both exist.
    const first = await setAssignment(db, { clubId, slot: "LW", playerId: 42 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.tactics.assignments.LW).toBe(42);

    const second = await setAssignment(db, { clubId, slot: "ST1", playerId: 42 });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.tactics.assignments.LW).toBeUndefined();
    expect(second.tactics.assignments.ST1).toBe(42);

    // And the write is durable: reloading sees the same shape.
    const reloaded = await getTactics(db, clubId);
    expect(reloaded.assignments.LW).toBeUndefined();
    expect(reloaded.assignments.ST1).toBe(42);
  });

  it("AC-08: setAssignment refuses a slot outside the current formation", async () => {
    // Clear any leftover state so the test is hermetic.
    await upsertTactics(db, {
      clubId,
      formation: "4-3-3",
      playingStyle: "Balanced",
      instructions: ["PressHigh"],
    });
    // 4-3-3 has no AMC slot.
    const result = await setAssignment(db, { clubId, slot: "AMC", playerId: 1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("slot_not_in_formation");
  });

  it("formation change drops assignments for slots outside the new set", async () => {
    // Pin a player to LW on 4-3-3.
    await upsertTactics(db, {
      clubId,
      formation: "4-3-3",
      playingStyle: "Balanced",
      instructions: [],
    });
    const pinned = await setAssignment(db, { clubId, slot: "LW", playerId: 7 });
    expect(pinned.ok).toBe(true);

    // Switch to 3-5-2, which has no LW — the pin should be dropped.
    await upsertTactics(db, {
      clubId,
      formation: "3-5-2",
      playingStyle: "Counter-Attack",
      instructions: [],
    });
    const reloaded = await getTactics(db, clubId);
    expect(reloaded.formation).toBe("3-5-2");
    expect(reloaded.assignments.LW).toBeUndefined();
  });
});
