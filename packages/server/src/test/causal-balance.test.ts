import { describe, expect, it } from "vitest";

import type { MentalTraits, NaturalGifts } from "@rpgfc/shared";

import type { SimMatchInput, SimPlayer, SimSide } from "../sim/interface.js";
import { createSimStub } from "../sim/stub.js";

const TRAITS: MentalTraits = {
  ambition: 60,
  leadership: 60,
  temperament: 60,
  workEthic: 60,
  sociability: 60,
  riskTolerance: 60,
  professionalism: 60,
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

function side(clubId: number, value = 60, overrides: Partial<SimSide> = {}): SimSide {
  const starters: SimPlayer[] = Array.from({ length: 11 }, (_, index) => ({
    playerId: clubId * 100 + index,
    badgeCount: 0,
    badgeKeys: [],
    positionFit: true,
    positionFamily:
      index === 0 ? "gk" : index <= 4 ? "defender" : index <= 7 ? "midfielder" : "forward",
    primaryRole: index === 0 ? "Goalkeeper" : "Central Midfielder",
    gifts: gifts(value),
    traits: TRAITS,
    fatigue: 0,
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
    ...overrides,
  };
}

interface Cohort {
  homeWinRate: number;
  awayWinRate: number;
}

function cohort(home: SimSide, away: SimSide, count = 1_000): Cohort {
  const engine = createSimStub();
  let homeWins = 0;
  let awayWins = 0;
  for (let seed = 1; seed <= count; seed++) {
    const input: SimMatchInput = {
      matchId: seed,
      matchday: 1,
      seed,
      context: { season: 0, pressure: "Normal" },
      home,
      away,
    };
    const result = engine.simulateMatch(input);
    if (result.homeGoals > result.awayGoals) homeWins += 1;
    if (result.awayGoals > result.homeGoals) awayWins += 1;
  }
  return { homeWinRate: homeWins / count, awayWinRate: awayWins / count };
}

describe("causal simulation balance cohorts", () => {
  // Band widened 2026-07-13 (was 1–10%): playtests showed edges under
  // ~10% cohort win-rate drown in league noise over 90 fixtures — 0.03
  // build edge produced 92 home vs 97 away wins across 270 matches. The
  // product wants a home advantage the reader can see in the table, so
  // the floor rises and the ceiling allows it to be felt: 5–18%.
  it("gives otherwise identical home sides a bounded advantage", () => {
    const equal = cohort(side(1), side(2));
    const homeEdge = equal.homeWinRate - equal.awayWinRate;

    expect(homeEdge).toBeGreaterThan(0.05);
    expect(homeEdge).toBeLessThan(0.18);
  });

  // Styles are trade-offs, not power-ups (Story 11 AC-06/AC-09; the
  // no-dominance gate lives in causal-goal-bands.test.ts). This cohort
  // guards the seed contract instead: whatever effect Possession has, it
  // must be the same effect from either orientation, and it may not be a
  // hidden universal buff.
  it("applies Possession symmetrically when home and away are swapped", () => {
    // 2 000 seeds: at 1 000 the ±0.03 sampling noise on each win rate
    // eats most of the 0.07 symmetry budget.
    const equal = cohort(side(1), side(2), 2_000);
    const homePossession = cohort(side(1, 60, { playingStyle: "Possession" }), side(2), 2_000);
    const awayPossession = cohort(side(1), side(2, 60, { playingStyle: "Possession" }), 2_000);
    const baselineHomeEdge = equal.homeWinRate - equal.awayWinRate;
    const homeTacticEdge = homePossession.homeWinRate - homePossession.awayWinRate;
    const awayTacticEdge = awayPossession.awayWinRate - awayPossession.homeWinRate;
    const homeTacticLift = homeTacticEdge - baselineHomeEdge;
    const awayTacticLift = awayTacticEdge + baselineHomeEdge;

    expect(Math.abs(homeTacticLift)).toBeLessThan(0.15);
    expect(Math.abs(awayTacticLift)).toBeLessThan(0.15);
    expect(Math.abs(homeTacticLift - awayTacticLift)).toBeLessThan(0.07);
  });

  it("lets clearly better relevant qualities win from either orientation", () => {
    const strongerAtHome = cohort(side(1, 75), side(2, 45));
    const strongerAway = cohort(side(1, 45), side(2, 75));

    expect(strongerAtHome.homeWinRate).toBeGreaterThan(0.75);
    expect(strongerAway.awayWinRate).toBeGreaterThan(0.75);
    expect(Math.abs(strongerAtHome.homeWinRate - strongerAway.awayWinRate)).toBeLessThan(0.05);
  });
});
