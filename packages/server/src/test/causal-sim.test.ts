import { describe, expect, it } from "vitest";

import type { SimMatchInput, SimPlayer, SimSide } from "../sim/interface.js";
import { createSimStub } from "../sim/stub.js";

const gifts = {
  pace: 65,
  finishing: 65,
  composure: 65,
  aerial: 65,
  tackling: 65,
  passing: 65,
  vision: 65,
  stamina: 65,
  strength: 65,
  reflexes: 65,
};

const traits = {
  ambition: 60,
  leadership: 60,
  temperament: 60,
  workEthic: 60,
  sociability: 60,
  riskTolerance: 60,
  professionalism: 60,
};

function player(clubId: number, index: number, overrides: Partial<SimPlayer> = {}): SimPlayer {
  const positionFamily =
    index === 0 ? "gk" : index <= 4 ? "defender" : index <= 7 ? "midfielder" : "forward";
  return {
    playerId: clubId * 100 + index + 1,
    badgeCount: 1,
    badgeKeys: [],
    positionFit: true,
    positionFamily,
    primaryRole:
      positionFamily === "gk"
        ? "Goalkeeper"
        : positionFamily === "defender"
          ? "Center-Back"
          : positionFamily === "midfielder"
            ? "Central Midfielder"
            : "Striker",
    gifts: { ...gifts },
    traits: { ...traits },
    fatigue: 0,
    slot: index === 0 ? "GK" : index <= 4 ? `DC${index}` : index <= 7 ? `MC${index}` : `ST${index}`,
    ...overrides,
  };
}

function side(clubId: number, overrides: Partial<SimSide> = {}): SimSide {
  return {
    clubId,
    formation: "4-3-3",
    playingStyle: "Balanced",
    instructions: [],
    starters: Array.from({ length: 11 }, (_, index) => player(clubId, index)),
    bench: Array.from({ length: 7 }, (_, index) =>
      player(clubId, index + 11, {
        playerId: clubId * 1000 + index + 1,
        positionFamily:
          index === 0 ? "gk" : index <= 3 ? "defender" : index <= 5 ? "midfielder" : "forward",
      }),
    ),
    ...overrides,
  };
}

function input(seed: number, home: SimSide = side(1), away: SimSide = side(2)): SimMatchInput {
  return {
    matchId: seed + 1,
    matchday: 31,
    seed,
    context: { season: 0, pressure: "RunIn" },
    home,
    away,
  };
}

describe("causal match simulation", () => {
  const engine = createSimStub();

  it("is deterministic and derives the score from persisted goal events", () => {
    const a = engine.simulateMatch(input(42));
    const b = engine.simulateMatch(input(42));

    expect(a).toEqual(b);
    expect(a.events.length).toBeGreaterThan(0);
    expect(a.events.filter((event) => event.kind === "Goal" && event.clubId === 1)).toHaveLength(
      a.homeGoals,
    );
    expect(a.events.filter((event) => event.kind === "Goal" && event.clubId === 2)).toHaveLength(
      a.awayGoals,
    );
    expect(a.events.every((event) => event.evidence.length > 0)).toBe(true);
  });

  it("uses contextual tactics and badges rather than a global formation bonus", () => {
    let counterGoals = 0;
    let balancedGoals = 0;
    for (let seed = 1; seed <= 160; seed++) {
      const quickCounter = side(1, {
        playingStyle: "Counter-Attack",
        starters: side(1).starters.map((p, index) =>
          index >= 8
            ? {
                ...p,
                badgeKeys: ["lightning_quick"],
                gifts: { ...(p.gifts ?? gifts), pace: 90 },
              }
            : p,
        ),
      });
      const highLine = side(2, { instructions: ["HighLine", "PressHigh"] });
      counterGoals += engine.simulateMatch(input(seed, quickCounter, highLine)).homeGoals;

      const balanced = { ...quickCounter, playingStyle: "Balanced" as const };
      balancedGoals += engine.simulateMatch(input(seed, balanced, highLine)).homeGoals;
    }
    expect(counterGoals).toBeGreaterThan(balancedGoals);
  });

  it("uses the bench when fatigue forces automatic substitutions", () => {
    const tired = side(1, {
      starters: side(1).starters.map((p) => ({
        ...p,
        fatigue: 95,
        gifts: { ...(p.gifts ?? gifts), stamina: 30 },
      })),
    });
    const result = engine.simulateMatch(input(73, tired, side(2)));

    expect(result.events.some((event) => event.kind === "Substitution" && event.clubId === 1)).toBe(
      true,
    );
    const benchIds = new Set((tired.bench ?? []).map((p) => p.playerId));
    expect(result.performances.some((performance) => benchIds.has(performance.playerId))).toBe(
      true,
    );
  });

  it("turns temperament and Hot-Headed into causal discipline events", () => {
    let volatileCards = 0;
    let calmCards = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const volatile = side(1, {
        playingStyle: "High Press",
        instructions: ["PressHigh"],
        starters: side(1).starters.map((p) => ({
          ...p,
          badgeKeys: ["hot_headed"],
          traits: { ...(p.traits ?? traits), temperament: 15 },
        })),
      });
      const calm = side(1, {
        playingStyle: "High Press",
        instructions: ["PressHigh"],
        starters: side(1).starters.map((p) => ({
          ...p,
          traits: { ...(p.traits ?? traits), temperament: 90 },
        })),
      });
      volatileCards += engine
        .simulateMatch(input(seed, side(2), volatile))
        .events.filter((event) => event.kind === "Card" && event.clubId === 1).length;
      calmCards += engine
        .simulateMatch(input(seed, side(2), calm))
        .events.filter((event) => event.kind === "Card" && event.clubId === 1).length;
    }
    expect(volatileCards).toBeGreaterThan(calmCards);
  });
});
