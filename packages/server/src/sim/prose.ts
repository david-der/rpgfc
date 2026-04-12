// Sim stub prose pool — Story 06.
//
// Two flavors of templated copy live here:
//
//   - SCORE_BAND_ADJECTIVES: maps a goal differential to a single
//     short adjective the rendering layer threads into the lead
//     paragraph of the match report ("a comfortable afternoon at
//     the Dragão", "a thumping result").
//   - PLAYER_EVENTS: short event sentences attached to the highest-
//     tier performers per side. The stub picks one from the bucket
//     that fits the player's contribution.
//
// All three pools are deliberately small in Story 06 — the goal is
// for re-runs to feel stable, not infinite. Story 06+ stories can
// grow the pools without changing the API surface.

import type { Random } from "../application/generation/rng.js";

export type ScoreBand = "draw" | "narrow" | "comfortable" | "thumping";

export function bandFor(homeGoals: number, awayGoals: number): ScoreBand {
  const diff = Math.abs(homeGoals - awayGoals);
  if (diff === 0) return "draw";
  if (diff === 1) return "narrow";
  if (diff <= 3) return "comfortable";
  return "thumping";
}

export const BAND_ADJECTIVES: Record<ScoreBand, readonly string[]> = {
  draw: ["an even", "a stalemate", "a measured", "a careful"],
  narrow: ["a narrow", "a hard-won", "a tense", "a one-score"],
  comfortable: ["a comfortable", "a controlled", "an authoritative", "a steady"],
  thumping: ["a thumping", "an emphatic", "a one-sided", "a runaway"],
};

// ── per-player event sentences ────────────────────────────────────────────
//
// Buckets are keyed by what the engine knows about the player after a
// match. The rendering layer picks one sentence per bucket using the
// match PRNG.

export const SCORER_EVENTS: readonly string[] = [
  "opened the scoring with a sharp turn inside the box",
  "found the net from the edge of the area",
  "swept home a low cross at the back post",
  "rolled the ball past the keeper after a flowing move",
  "took his chance with a confident first-time finish",
  "headed in from a corner that the defenders had failed to clear",
];

export const ASSIST_EVENTS: readonly string[] = [
  "drew the defenders out and slipped the ball through for the opener",
  "delivered the cross of the afternoon",
  "found the perfect through-ball at the perfect moment",
  "stayed patient on the wing and picked the right pass",
];

export const STANDOUT_EVENTS: readonly string[] = [
  "anchored the back line through a nervous opening half",
  "ran the midfield with composure",
  "broke up attack after attack",
  "looked a class above his teammates from first whistle to last",
];

export const POOR_EVENTS: readonly string[] = [
  "rarely found a teammate when it mattered",
  "looked off the pace from the first ten minutes",
  "was overrun in midfield and never recovered",
  "could not get on the ball in any meaningful way",
];

export function pickEvent(rng: Random, bucket: readonly string[]): string {
  return rng.pick(bucket);
}
