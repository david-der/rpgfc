// Story 11 AC-09 — the merit half of the balance gate.
//
// A graded ten-side league (quality 50…68 in steps of 2, identical
// neutral tactics) plays three full double round-robins. Over that
// sample, squad quality must predict finishing position strongly but
// not perfectly: Spearman rank correlation between quality and points
// inside [0.55, 0.995]. Below the band, merit is invisible (the
// pre-2026-07-13 engine measured ≈0); a flawless 1.0 would mean variance
// is dead and the table is just a quality readout. A 3-season aggregate
// over a 20-point quality range is expected to sort almost perfectly —
// the measured baseline is ≈0.988 with one adjacent inversion.

import { describe, expect, it } from "vitest";

import type { MentalTraits, NaturalGifts } from "@rpgfc/shared";

import type { SimMatchInput, SimPlayer, SimSide } from "../sim/interface.js";
import { createSimStub } from "../sim/stub.js";

const TRAITS: MentalTraits = {
  ambition: 55,
  leadership: 55,
  temperament: 55,
  workEthic: 55,
  sociability: 55,
  riskTolerance: 55,
  professionalism: 55,
};

function gifts(value: number): NaturalGifts {
  return {
    pace: value,
    finishing: value,
    composure: value,
    aerial: value,
    tackling: value,
    passing: value,
    vision: value,
    stamina: value,
    strength: value,
    reflexes: value,
  };
}

function side(clubId: number, quality: number): SimSide {
  const starters: SimPlayer[] = Array.from({ length: 11 }, (_, index) => ({
    playerId: clubId * 100 + index,
    badgeCount: 0,
    badgeKeys: [],
    positionFit: true,
    positionFamily:
      index === 0 ? "gk" : index <= 4 ? "defender" : index <= 7 ? "midfielder" : "forward",
    primaryRole: index === 0 ? "Goalkeeper" : "Central Midfielder",
    gifts: gifts(quality),
    traits: TRAITS,
    fatigue: 30,
    slot: index === 0 ? "GK" : `S${index}`,
  }));
  return {
    clubId,
    formation: "4-3-3",
    playingStyle: "Balanced",
    instructions: [],
    starters,
    bench: [],
    familiarity: 100,
  };
}

function spearman(xs: readonly number[], ys: readonly number[]): number {
  const rank = (values: readonly number[]): number[] => {
    const sorted = [...values].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = new Array<number>(values.length);
    sorted.forEach((entry, position) => {
      ranks[entry.i] = position;
    });
    return ranks;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const n = xs.length;
  let d2 = 0;
  for (let i = 0; i < n; i++) d2 += (rx[i]! - ry[i]!) ** 2;
  return 1 - (6 * d2) / (n * (n * n - 1));
}

describe("causal engine merit band (Story 11 AC-09)", () => {
  it("lets squad quality predict the table strongly but not perfectly", () => {
    const engine = createSimStub();
    const qualities = Array.from({ length: 10 }, (_, i) => 50 + i * 2);
    const sides = qualities.map((quality, i) => side(i + 1, quality));
    const points = new Array<number>(10).fill(0);

    let seed = 1;
    for (let season = 0; season < 3; season++) {
      for (let homeIndex = 0; homeIndex < 10; homeIndex++) {
        for (let awayIndex = 0; awayIndex < 10; awayIndex++) {
          if (homeIndex === awayIndex) continue;
          const input: SimMatchInput = {
            matchId: seed,
            matchday: 1,
            seed: seed++,
            context: { season, pressure: "Normal" },
            home: sides[homeIndex]!,
            away: sides[awayIndex]!,
          };
          const result = engine.simulateMatch(input);
          if (result.homeGoals > result.awayGoals) points[homeIndex] = points[homeIndex]! + 3;
          else if (result.homeGoals < result.awayGoals)
            points[awayIndex] = points[awayIndex]! + 3;
          else {
            points[homeIndex] = points[homeIndex]! + 1;
            points[awayIndex] = points[awayIndex]! + 1;
          }
        }
      }
    }

    const correlation = spearman(qualities, points);
    expect(correlation, JSON.stringify(points)).toBeGreaterThanOrEqual(0.55);
    expect(correlation, JSON.stringify(points)).toBeLessThanOrEqual(0.995);
  });
});
