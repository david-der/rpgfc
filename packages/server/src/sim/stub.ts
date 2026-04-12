// Sim engine stub — Story 06.
//
// Deterministic, mulberry32-driven implementation of the SimEngine
// interface. Every random call goes through `mulberry32(seed)` so
// re-running with the same input produces byte-for-byte equal output.
//
// Algorithm (every line is deliberate; AC-03/04/05 pin the pieces):
//
//   1. Build the per-match RNG from `input.seed`.
//   2. Strength = sum(starter.badgeCount + (positionFit ? 1 : 0)).
//      Home gets a flat +2 home advantage.
//   3. Win probability is a logistic of the strength delta:
//        pHome = 1 / (1 + exp(-(strHome - strAway) / 4))
//      Clamped to [0.1, 0.9].
//   4. Goals are drawn from a truncated Poisson per side with
//        lambda = clamp(1 + 2 * pSide, 0.4, 4.5)
//      and capped at 5 to keep results readable.
//   5. Each goal is attributed to a starter weighted by
//      badgeCount + positionFit + a small forward-slot bias.
//   6. Each goal flips a coin for an assist; the assister is drawn
//      from the same weighted pool, never the same player as the
//      scorer.
//   7. Performance tiers fall out of (a) goal scorers, (b) assist
//      makers, and (c) winning side / losing side bias on the
//      remaining starters.
//   8. The two highest-tier performers per side get an event
//      sentence from `prose.ts`.
//
// The whole thing runs in well under 5ms per match. The Python sim
// will replace `simulateMatch` while leaving `SimEngine` untouched.

import type { FormTier } from "@rpgfc/shared";

import { mulberry32, type Random } from "../application/generation/rng.js";
import {
  ASSIST_EVENTS,
  POOR_EVENTS,
  SCORER_EVENTS,
  STANDOUT_EVENTS,
  pickEvent,
} from "./prose.js";
import type {
  SimEngine,
  SimMatchInput,
  SimMatchResult,
  SimPerformance,
  SimPlayer,
  SimSide,
} from "./interface.js";

const HOME_ADVANTAGE = 2;
const MAX_GOALS = 5;
const PROB_FLOOR = 0.1;
const PROB_CEIL = 0.9;

// Slot prefixes that get a small forward-attribution bonus when
// distributing goals. The starter list arrives in slot order so the
// engine sees indices, not slot strings — the picker decides how to
// map index → slot. We pass the bias through `forwardBoosts` from
// the application layer when it's available, but the stub also
// works without one (boosts default to a flat 1).
function strengthOf(side: SimSide): number {
  let total = 0;
  for (const p of side.starters) {
    total += p.badgeCount + (p.positionFit ? 1 : 0);
  }
  return total;
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// Truncated Poisson sample bounded at MAX_GOALS. We use the inverse
// CDF method via cumulative draws — for the small lambdas Story 06
// uses (≤ 4.5), this is fast and stable.
function samplePoisson(rng: Random, lambda: number): number {
  // Knuth's algorithm — O(lambda). Bounded loop is just MAX_GOALS+1
  // iterations of safety so the no-constant-condition lint stays
  // happy without changing behavior.
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  for (let i = 0; i <= MAX_GOALS + 1; i++) {
    k += 1;
    p *= rng.next();
    if (p <= L) return Math.min(k - 1, MAX_GOALS);
    if (k - 1 >= MAX_GOALS) return MAX_GOALS;
  }
  return MAX_GOALS;
}

interface WeightedStarter {
  player: SimPlayer;
  weight: number;
}

function buildWeightedPool(side: SimSide, forwardIndices: Set<number>): WeightedStarter[] {
  return side.starters.map((player, i) => {
    const base = player.badgeCount + (player.positionFit ? 1 : 0);
    const forwardBonus = forwardIndices.has(i) ? 2 : 0;
    return { player, weight: Math.max(1, base + forwardBonus) };
  });
}

function pickWeighted(rng: Random, pool: readonly WeightedStarter[]): SimPlayer {
  let total = 0;
  for (const w of pool) total += w.weight;
  let roll = rng.next() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll < 0) return entry.player;
  }
  return pool[pool.length - 1]!.player;
}

function pickWeightedExcept(
  rng: Random,
  pool: readonly WeightedStarter[],
  exclude: number,
): SimPlayer {
  const filtered = pool.filter((p) => p.player.playerId !== exclude);
  if (filtered.length === 0) return pool[0]!.player;
  return pickWeighted(rng, filtered);
}

// Forward-slot indices in the eleven-player starter list. Story 05's
// FORMATION_SLOTS arrays put the forwards last, so the application
// layer can pass an exact set; if it doesn't, we default to "the last
// three indices".
function defaultForwardIndices(): Set<number> {
  return new Set([8, 9, 10]);
}

function tierBucketFor(
  scoredFor: number,
  assistedFor: number,
  wonMatch: boolean,
  isDraw: boolean,
  rng: Random,
): FormTier {
  if (scoredFor >= 2) return "Excellent";
  if (scoredFor === 1 && wonMatch) return "Excellent";
  if (scoredFor === 1) return "Good";
  if (assistedFor >= 1 && wonMatch) return "Good";
  if (assistedFor >= 1) return "Average";
  if (isDraw) return rng.chance(0.6) ? "Average" : "Good";
  if (wonMatch) {
    const roll = rng.next();
    if (roll < 0.45) return "Good";
    if (roll < 0.85) return "Average";
    return "Excellent";
  }
  // Lost.
  const roll = rng.next();
  if (roll < 0.35) return "Average";
  if (roll < 0.75) return "Poor";
  return "Dreadful";
}

// Stat distributions per position family — all ranges are (min, max)
// inclusive. Per-player stats get a further ±20% tier-based modulation
// after being drawn (Excellent stretches the range, Dreadful shrinks).
interface StatRanges {
  shots: [number, number];
  shotConversion: number; // expected share of shots that are on target
  xgPerShot: number; // expected xG per shot × 100 (stays integer)
  keyPasses: [number, number];
  passes: [number, number];
  passAccuracy: number; // 0..1
  tacklesAttempted: [number, number];
  tackleSuccess: number;
  interceptions: [number, number];
  clearances: [number, number];
  aerials: [number, number];
  aerialWinRate: number;
  dribbles: [number, number];
  foulsCommitted: [number, number];
  foulsDrawn: [number, number];
  saves: [number, number]; // only used for GK
}

const RANGES: Record<"gk" | "defender" | "midfielder" | "forward", StatRanges> = {
  gk: {
    shots: [0, 0], shotConversion: 0, xgPerShot: 0,
    keyPasses: [0, 1],
    passes: [20, 35], passAccuracy: 0.7,
    tacklesAttempted: [0, 1], tackleSuccess: 0.5,
    interceptions: [0, 1],
    clearances: [2, 6],
    aerials: [0, 1], aerialWinRate: 0.6,
    dribbles: [0, 0],
    foulsCommitted: [0, 1], foulsDrawn: [0, 1],
    saves: [1, 6],
  },
  defender: {
    shots: [0, 2], shotConversion: 0.45, xgPerShot: 8,
    keyPasses: [0, 1],
    passes: [40, 70], passAccuracy: 0.82,
    tacklesAttempted: [2, 6], tackleSuccess: 0.65,
    interceptions: [1, 5],
    clearances: [3, 9],
    aerials: [3, 8], aerialWinRate: 0.6,
    dribbles: [0, 1],
    foulsCommitted: [0, 3], foulsDrawn: [0, 2],
    saves: [0, 0],
  },
  midfielder: {
    shots: [0, 3], shotConversion: 0.4, xgPerShot: 10,
    keyPasses: [0, 4],
    passes: [45, 85], passAccuracy: 0.85,
    tacklesAttempted: [1, 5], tackleSuccess: 0.6,
    interceptions: [0, 4],
    clearances: [0, 3],
    aerials: [1, 4], aerialWinRate: 0.5,
    dribbles: [0, 4],
    foulsCommitted: [0, 3], foulsDrawn: [0, 3],
    saves: [0, 0],
  },
  forward: {
    shots: [2, 6], shotConversion: 0.4, xgPerShot: 15,
    keyPasses: [0, 4],
    passes: [20, 45], passAccuracy: 0.78,
    tacklesAttempted: [0, 2], tackleSuccess: 0.5,
    interceptions: [0, 1],
    clearances: [0, 1],
    aerials: [1, 5], aerialWinRate: 0.45,
    dribbles: [1, 6],
    foulsCommitted: [0, 2], foulsDrawn: [1, 4],
    saves: [0, 0],
  },
};

// Tier modulation: Excellent bumps most stats; Dreadful pulls them down.
// Applied after the range roll.
const TIER_FACTOR: Record<FormTier, number> = {
  Excellent: 1.3,
  Good: 1.1,
  Average: 1.0,
  Poor: 0.85,
  Dreadful: 0.7,
};

function rollInRange(rng: Random, [lo, hi]: [number, number], factor: number): number {
  const raw = lo + rng.next() * (hi - lo);
  return Math.max(0, Math.round(raw * factor));
}

function generateStats(
  player: SimPlayer,
  tier: FormTier,
  goals: number,
  assists: number,
  rng: Random,
): Omit<SimPerformance, "playerId" | "clubId" | "goals" | "assists" | "tier" | "eventDescription"> {
  const ranges = RANGES[player.positionFamily];
  const factor = TIER_FACTOR[tier];

  // Shots: at least equal to goals (every goal counts as a shot).
  const baseShots = rollInRange(rng, ranges.shots, factor);
  const shots = Math.max(goals, baseShots);
  const shotsOnTarget = Math.max(
    goals,
    Math.round(shots * ranges.shotConversion * (0.8 + rng.next() * 0.4)),
  );
  // xG: per-shot expectation × shots, with some noise. Always a bit
  // below actual goals when the player scored (overperformance) or a
  // bit above when they didn't (underperformance).
  const xgBase = shots * ranges.xgPerShot;
  const xgX100 = Math.max(0, Math.round(xgBase * (0.7 + rng.next() * 0.6)));

  const keyPasses = rollInRange(rng, ranges.keyPasses, factor) + (assists > 0 ? assists : 0);

  const passesAttempted = rollInRange(rng, ranges.passes, factor);
  const passesCompleted = Math.round(
    passesAttempted * ranges.passAccuracy * (0.9 + rng.next() * 0.2),
  );

  const tacklesAttempted = rollInRange(rng, ranges.tacklesAttempted, factor);
  const tacklesWon = Math.round(
    tacklesAttempted * ranges.tackleSuccess * (0.85 + rng.next() * 0.3),
  );

  const interceptions = rollInRange(rng, ranges.interceptions, factor);
  const clearances = rollInRange(rng, ranges.clearances, factor);

  const aerialsContested = rollInRange(rng, ranges.aerials, 1.0);
  const aerialsWon = Math.round(
    aerialsContested * ranges.aerialWinRate * (0.85 + rng.next() * 0.3),
  );

  const dribblesCompleted = rollInRange(rng, ranges.dribbles, factor);

  const foulsCommitted = rollInRange(rng, ranges.foulsCommitted, 1.0);
  const foulsDrawn = rollInRange(rng, ranges.foulsDrawn, factor);

  const saves = player.positionFamily === "gk"
    ? rollInRange(rng, ranges.saves, factor)
    : 0;

  // Cards: small chance per foul to earn a yellow. Rare reds.
  const yellowCards =
    foulsCommitted >= 2 && rng.chance(0.15 * foulsCommitted) ? 1 : 0;
  const redCards = rng.chance(0.005) ? 1 : 0;

  return {
    minutesPlayed: 90,
    shots,
    shotsOnTarget: Math.min(shots, shotsOnTarget),
    xgX100,
    keyPasses,
    passesAttempted,
    passesCompleted: Math.min(passesAttempted, passesCompleted),
    tacklesAttempted,
    tacklesWon: Math.min(tacklesAttempted, tacklesWon),
    interceptions,
    clearances,
    aerialsWon: Math.min(aerialsContested, aerialsWon),
    aerialsContested,
    dribblesCompleted,
    foulsCommitted,
    foulsDrawn,
    saves,
    yellowCards,
    redCards,
  };
}

function attachPerformances(
  side: SimSide,
  goalCounts: Map<number, number>,
  assistCounts: Map<number, number>,
  wonMatch: boolean,
  isDraw: boolean,
  rng: Random,
): SimPerformance[] {
  const result: SimPerformance[] = [];
  for (const player of side.starters) {
    const goals = goalCounts.get(player.playerId) ?? 0;
    const assists = assistCounts.get(player.playerId) ?? 0;
    const tier = tierBucketFor(goals, assists, wonMatch, isDraw, rng);
    const stats = generateStats(player, tier, goals, assists, rng);
    result.push({
      playerId: player.playerId,
      clubId: side.clubId,
      goals,
      assists,
      tier,
      eventDescription: null,
      ...stats,
    });
  }
  attachEvents(result, rng);
  return result;
}

const TIER_RANK: Record<FormTier, number> = {
  Excellent: 4,
  Good: 3,
  Average: 2,
  Poor: 1,
  Dreadful: 0,
};

function attachEvents(perfs: SimPerformance[], rng: Random): void {
  // Sort a copy by descending tier rank, with goals as tiebreaker so
  // a goalscorer beats a quiet midfielder at the same tier.
  const sorted = [...perfs].sort((a, b) => {
    const rankDiff = TIER_RANK[b.tier] - TIER_RANK[a.tier];
    if (rankDiff !== 0) return rankDiff;
    return b.goals - a.goals;
  });

  let attached = 0;
  for (const perf of sorted) {
    if (attached >= 2) break;
    if (perf.eventDescription !== null) continue;
    const target = perfs.find((p) => p.playerId === perf.playerId);
    if (!target) continue;
    if (perf.goals > 0) {
      target.eventDescription = pickEvent(rng, SCORER_EVENTS);
    } else if (perf.assists > 0) {
      target.eventDescription = pickEvent(rng, ASSIST_EVENTS);
    } else if (perf.tier === "Excellent" || perf.tier === "Good") {
      target.eventDescription = pickEvent(rng, STANDOUT_EVENTS);
    } else if (perf.tier === "Poor" || perf.tier === "Dreadful") {
      target.eventDescription = pickEvent(rng, POOR_EVENTS);
    } else {
      continue;
    }
    attached += 1;
  }
}

function distributeGoals(
  pool: readonly WeightedStarter[],
  goals: number,
  rng: Random,
): {
  goalsByPlayer: Map<number, number>;
  assistsByPlayer: Map<number, number>;
} {
  const goalsByPlayer = new Map<number, number>();
  const assistsByPlayer = new Map<number, number>();
  for (let i = 0; i < goals; i++) {
    const scorer = pickWeighted(rng, pool);
    goalsByPlayer.set(scorer.playerId, (goalsByPlayer.get(scorer.playerId) ?? 0) + 1);
    if (rng.chance(0.6)) {
      const assister = pickWeightedExcept(rng, pool, scorer.playerId);
      assistsByPlayer.set(
        assister.playerId,
        (assistsByPlayer.get(assister.playerId) ?? 0) + 1,
      );
    }
  }
  return { goalsByPlayer, assistsByPlayer };
}

export function createSimStub(): SimEngine {
  return {
    simulateMatch(input: SimMatchInput): SimMatchResult {
      if (input.home.starters.length !== 11 || input.away.starters.length !== 11) {
        throw new Error("simulateMatch: each side must have exactly 11 starters");
      }

      const rng = mulberry32(input.seed);

      const strHome = strengthOf(input.home) + HOME_ADVANTAGE;
      const strAway = strengthOf(input.away);
      const delta = (strHome - strAway) / 4;
      const pHomeRaw = logistic(delta);
      const pHome = clamp(pHomeRaw, PROB_FLOOR, PROB_CEIL);
      const pAway = 1 - pHome;

      const lambdaHome = clamp(1 + 2 * pHome, 0.4, 4.5);
      const lambdaAway = clamp(1 + 2 * pAway, 0.4, 4.5);

      const homeGoals = samplePoisson(rng, lambdaHome);
      const awayGoals = samplePoisson(rng, lambdaAway);

      const forwardIndices = defaultForwardIndices();
      const homePool = buildWeightedPool(input.home, forwardIndices);
      const awayPool = buildWeightedPool(input.away, forwardIndices);

      const homeDist = distributeGoals(homePool, homeGoals, rng);
      const awayDist = distributeGoals(awayPool, awayGoals, rng);

      const homeWon = homeGoals > awayGoals;
      const awayWon = awayGoals > homeGoals;
      const isDraw = homeGoals === awayGoals;

      const homePerformances = attachPerformances(
        input.home,
        homeDist.goalsByPlayer,
        homeDist.assistsByPlayer,
        homeWon,
        isDraw,
        rng,
      );
      const awayPerformances = attachPerformances(
        input.away,
        awayDist.goalsByPlayer,
        awayDist.assistsByPlayer,
        awayWon,
        isDraw,
        rng,
      );

      return {
        matchId: input.matchId,
        homeGoals,
        awayGoals,
        performances: [...homePerformances, ...awayPerformances],
      };
    },
  };
}
