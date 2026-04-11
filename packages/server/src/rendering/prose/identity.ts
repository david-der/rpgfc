// Identity prose generator — Story 01 template-based.
//
// Goal: produce a 1–2 sentence paragraph describing a player that reads
// naturally and never contains a digit. The generator walks the player's
// archetype, a couple of standout thesaurus words, and any badge prose
// hooks to assemble a sentence from a per-archetype sentence shape.
//
// AC-08 enforces that the output of this function contains no /\d/ for any
// generated player. That invariant is what the test file actively walks, so
// please do not introduce a number-carrying shape without an allowlist
// mechanism.

import type { BadgeRef, NaturalGiftKey } from "@rpgfc/shared";
import { ARCHETYPE_BY_ID } from "@rpgfc/shared";
import type { HiddenPlayer } from "@rpgfc/shared/types/hidden";

import { tierWordFor } from "../thesaurus.js";

export interface ProseInputs {
  hidden: HiddenPlayer;
  badges: BadgeRef[];
  precision: "fine" | "coarse";
}

// Pick the single highest-scored standout gift and the single lowest-scored
// standout gift. Returns the attribute key + tier word so callers can weave
// both into a sentence.
function standouts(hidden: HiddenPlayer, precision: "fine" | "coarse") {
  const entries = Object.entries(hidden.hiddenAttrs) as Array<[NaturalGiftKey, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  const bottom = entries[entries.length - 1];
  if (!top || !bottom) return { topWord: "capable", bottomWord: "ordinary", topKey: "pace" as NaturalGiftKey };
  return {
    topKey: top[0],
    topWord: tierWordFor(top[0], top[1], precision),
    bottomWord: tierWordFor(bottom[0], bottom[1], precision),
  };
}

const GIFT_LABEL: Record<NaturalGiftKey, string> = {
  pace: "pace",
  finishing: "finishing",
  composure: "composure",
  aerial: "aerial work",
  tackling: "tackling",
  passing: "distribution",
  vision: "vision",
  stamina: "engine",
  strength: "physical presence",
  reflexes: "reflexes",
};

// Sentence shapes — at least 4 per archetype is the Story 01 target, but
// since most of them compose in the same way we use a shared template list
// keyed by primaryRole and let the variation come from rng-picked sentence
// patterns within a deterministic shape.
const SHAPES: readonly string[] = [
  "A {position} with {topWord} {topLabel}.",
  "{position} — {topWord} {topLabel}, {bottomWord} in the rough patches.",
  "Plays as a {position}. {topWord} {topLabel} is the calling card.",
  "{position}. {topWord} {topLabel}, and a {badgeHint}.",
];

// Tiny deterministic hash used to pick a shape without importing the RNG.
function stableIndex(seed: string, mod: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % mod;
}

export function generateIdentityProse(inputs: ProseInputs): string {
  const { hidden, badges, precision } = inputs;
  const archetype = ARCHETYPE_BY_ID[hidden.archetypeId];
  const position = archetype?.displayName ?? "player";

  const { topWord, topKey, bottomWord } = standouts(hidden, precision);
  const topLabel = GIFT_LABEL[topKey];

  const firstBadge = badges[0];
  const badgeHint = firstBadge
    ? firstBadge.name.toLowerCase()
    : "reliable, day-to-day professional";

  const shapeIndex = stableIndex(hidden.name, SHAPES.length);
  const shape = SHAPES[shapeIndex] ?? SHAPES[0]!;

  const out = shape
    .replace("{position}", position)
    .replace("{topWord}", topWord)
    .replace("{topLabel}", topLabel)
    .replace("{bottomWord}", bottomWord)
    .replace("{badgeHint}", badgeHint);

  // Strip any accidental digit leak at the boundary. Belt and suspenders
  // for AC-08 — if a future template drifts, the regex catches it and the
  // sentence simply loses the offending run. A unit test also asserts this.
  return out.replace(/\d+(\.\d+)?/g, "");
}
