// Story 11 AC-09 — absolute balance bands.
//
// The relative cohorts in causal-balance.test.ts prove better squads win
// more; they cannot catch a league-wide goal drought (observed 2026-07-12:
// 76% of matches 0-0 because every seeded tactic stacked attacker
// penalties). These bands pin the absolute output of the engine so a
// calibration regression fails CI instead of shipping a drawfest.
//
// Bands (documented rationale, per the Story 11 change policy):
//   goals/match 2.0–3.4   — football-plausible scoring (real leagues ≈2.7)
//   draws ≤ 40%           — a double round-robin must separate the table
//   shots/match 8–30      — enough events for reports to have material

import { describe, expect, it } from "vitest";

import type { MentalTraits, NaturalGifts, PlayingStyle, TeamInstruction } from "@rpgfc/shared";

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

function side(clubId: number, overrides: Partial<SimSide> = {}): SimSide {
  const starters: SimPlayer[] = Array.from({ length: 11 }, (_, index) => ({
    playerId: clubId * 100 + index,
    badgeCount: 0,
    badgeKeys: [],
    positionFit: true,
    positionFamily:
      index === 0 ? "gk" : index <= 4 ? "defender" : index <= 7 ? "midfielder" : "forward",
    primaryRole: index === 0 ? "Goalkeeper" : "Central Midfielder",
    gifts: gifts(55),
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
    ...overrides,
  };
}

interface Bands {
  goalsPerMatch: number;
  drawRate: number;
  shotsPerMatch: number;
}

function measure(home: SimSide, away: SimSide, count = 1_000): Bands {
  const engine = createSimStub();
  let goals = 0;
  let draws = 0;
  let shots = 0;
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
    goals += result.homeGoals + result.awayGoals;
    if (result.homeGoals === result.awayGoals) draws += 1;
    shots += result.performances.reduce((sum, p) => sum + p.shots, 0);
  }
  return { goalsPerMatch: goals / count, drawRate: draws / count, shotsPerMatch: shots / count };
}

// The tactical identities world generation actually seeds — the bands must
// hold for the league as it ships, not just for instruction-free fixtures.
const SEEDED_PROFILES: Array<{ playingStyle: PlayingStyle; instructions: TeamInstruction[] }> = [
  { playingStyle: "Possession", instructions: ["PlayOutFromTheBack", "WorkBallIntoBox"] },
  { playingStyle: "High Press", instructions: ["PressHigh", "HighTempo"] },
  { playingStyle: "Counter-Attack", instructions: ["StayCompact", "HighTempo"] },
  { playingStyle: "Balanced", instructions: ["PressHigh", "StayCompact"] },
  { playingStyle: "Direct", instructions: ["HighTempo", "HighLine"] },
];

describe("causal engine absolute goal bands (Story 11 AC-09)", () => {
  it("keeps neutral equal sides inside the scoring bands", () => {
    const bands = measure(side(1), side(2));

    expect(bands.goalsPerMatch).toBeGreaterThanOrEqual(2.0);
    expect(bands.goalsPerMatch).toBeLessThanOrEqual(3.4);
    expect(bands.drawRate).toBeLessThanOrEqual(0.4);
    expect(bands.shotsPerMatch).toBeGreaterThanOrEqual(8);
    expect(bands.shotsPerMatch).toBeLessThanOrEqual(30);
  });

  it("keeps every seeded tactical matchup out of drought territory", () => {
    for (const homeProfile of SEEDED_PROFILES) {
      for (const awayProfile of SEEDED_PROFILES) {
        const bands = measure(side(1, homeProfile), side(2, awayProfile), 300);

        expect(bands.goalsPerMatch, JSON.stringify({ homeProfile, awayProfile })).toBeGreaterThan(
          1.4,
        );
        expect(bands.drawRate, JSON.stringify({ homeProfile, awayProfile })).toBeLessThan(0.5);
      }
    }
  });

  // AC-06/AC-09: no supported style may dominate every representative
  // opponent profile. First 3-season playtest after recalibration
  // (2026-07-12): both Possession clubs finished 1–2 in all three seasons,
  // both Direct clubs finished last — style was destiny. This gate bounds
  // the spread of average expected points across the seeded identities.
  it("lets no seeded style dominate the whole league", () => {
    const expectedPoints = SEEDED_PROFILES.map((profile) => {
      let points = 0;
      let matches = 0;
      for (const opponent of SEEDED_PROFILES) {
        if (opponent === profile) continue;
        for (const orientation of ["home", "away"] as const) {
          const engine = createSimStub();
          for (let seed = 1; seed <= 300; seed++) {
            const input: SimMatchInput = {
              matchId: seed,
              matchday: 1,
              seed,
              context: { season: 0, pressure: "Normal" },
              home: side(1, orientation === "home" ? profile : opponent),
              away: side(2, orientation === "home" ? opponent : profile),
            };
            const result = engine.simulateMatch(input);
            const mine = orientation === "home" ? result.homeGoals : result.awayGoals;
            const theirs = orientation === "home" ? result.awayGoals : result.homeGoals;
            points += mine > theirs ? 3 : mine === theirs ? 1 : 0;
            matches += 1;
          }
        }
      }
      return { style: profile.playingStyle, ppg: points / matches };
    });

    const sorted = [...expectedPoints].sort((a, b) => b.ppg - a.ppg);
    const spread = sorted[0]!.ppg - sorted[sorted.length - 1]!.ppg;

    // ~0.25 expected-points-per-game spread ≈ 4–5 points over an 18-match
    // season: a real identity edge a manager can exploit, not a decided
    // title. The drought-era engine measured 0 here; the dominant-
    // Possession engine measured ≈0.9.
    expect(spread, JSON.stringify(sorted)).toBeLessThan(0.25);
  });
});
