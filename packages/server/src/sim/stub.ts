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
    result.push({
      playerId: player.playerId,
      clubId: side.clubId,
      goals,
      assists,
      tier,
      eventDescription: null,
    });
  }
  // Per-side, attach an event sentence to the highest-tier performer
  // (and to the standout in second place if it's also Excellent / Good).
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
