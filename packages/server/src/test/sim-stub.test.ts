// Story 06 AC-03, AC-04, AC-05 — sim stub determinism + sanity bounds
// + merit-must-win pillar.

import { describe, expect, it } from "vitest";

import { createSimStub } from "../sim/stub.js";
import type { SimMatchInput, SimSide } from "../sim/interface.js";

function makeSide(clubId: number, badgePerStarter: number): SimSide {
  return {
    clubId,
    starters: Array.from({ length: 11 }, (_, i) => {
      // 1 GK, 4 defenders, 3 mids, 3 forwards.
      const family: "gk" | "defender" | "midfielder" | "forward" =
        i === 0 ? "gk" : i <= 4 ? "defender" : i <= 7 ? "midfielder" : "forward";
      return {
        playerId: clubId * 100 + i + 1,
        badgeCount: badgePerStarter,
        positionFit: true,
        positionFamily: family,
      };
    }),
  };
}

function makeInput(
  matchId: number,
  matchday: number,
  seed: number,
  homeBadges: number,
  awayBadges: number,
): SimMatchInput {
  return {
    matchId,
    matchday,
    seed,
    home: makeSide(1, homeBadges),
    away: makeSide(2, awayBadges),
  };
}

describe("sim stub — Story 06", () => {
  const engine = createSimStub();

  it("AC-03: simulateMatch is deterministic for the same input", () => {
    const input = makeInput(1, 1, 42, 3, 3);
    const a = engine.simulateMatch(input);
    const b = engine.simulateMatch(input);
    expect(a).toEqual(b);
  });

  it("AC-03: different seeds produce different results", () => {
    const a = engine.simulateMatch(makeInput(1, 1, 42, 3, 3));
    const b = engine.simulateMatch(makeInput(1, 1, 43, 3, 3));
    // The full result objects should differ on at least one field —
    // the chance of two distinct seeds producing identical goals +
    // identical performance arrays is vanishingly small.
    expect(a).not.toEqual(b);
  });

  it("AC-04: goals stay in [0, 5] across 1000 random matches", () => {
    for (let i = 0; i < 1000; i++) {
      const input = makeInput(i, 1, i * 7919 + 13, 2 + (i % 5), 2 + ((i + 3) % 5));
      const r = engine.simulateMatch(input);
      expect(r.homeGoals).toBeGreaterThanOrEqual(0);
      expect(r.homeGoals).toBeLessThanOrEqual(5);
      expect(r.awayGoals).toBeGreaterThanOrEqual(0);
      expect(r.awayGoals).toBeLessThanOrEqual(5);
    }
  });

  it("AC-05: a 6x stronger home side avoids loss in ≥60% of 200 matches", () => {
    let nonLoss = 0;
    for (let i = 0; i < 200; i++) {
      const input = makeInput(i, 1, i * 1009 + 5, 6, 1);
      const r = engine.simulateMatch(input);
      if (r.homeGoals >= r.awayGoals) nonLoss++;
    }
    const ratio = nonLoss / 200;
    expect(ratio).toBeGreaterThanOrEqual(0.6);
  });

  it("performances cover every starter on both sides", () => {
    const r = engine.simulateMatch(makeInput(1, 1, 42, 3, 3));
    expect(r.performances).toHaveLength(22);
    const homeIds = r.performances.filter((p) => p.clubId === 1).map((p) => p.playerId);
    const awayIds = r.performances.filter((p) => p.clubId === 2).map((p) => p.playerId);
    expect(homeIds).toHaveLength(11);
    expect(awayIds).toHaveLength(11);
  });

  it("the throwing path: simulateMatch refuses incomplete sides", () => {
    expect(() =>
      engine.simulateMatch({
        matchId: 1,
        matchday: 1,
        seed: 1,
        home: { clubId: 1, starters: [] },
        away: makeSide(2, 1),
      }),
    ).toThrow(/exactly 11/);
  });
});
