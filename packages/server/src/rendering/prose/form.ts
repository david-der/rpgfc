// Current-form one-liner. Story 01 produces a placeholder form sentence
// drawn from a small rotating pool, keyed by a stable hash of the player's
// name so re-renders are deterministic. Real form data lands in Story 03+
// once matches have been simulated.

import type { HiddenPlayer } from "@rpgfc/shared/types/hidden";

const SHAPES = [
  "Fresh, fit, and in training with the first team.",
  "Coming off a reliable week of sessions.",
  "Looking sharp in practice, yet to be tested on a match day.",
  "Settled in recently; coaches are still getting a read on form.",
  "Quiet week of training — nothing concerning, nothing alarming.",
];

function stableIndex(seed: string, mod: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % mod;
}

export function generateFormProse(hidden: HiddenPlayer): string {
  const idx = stableIndex(hidden.name + ":form", SHAPES.length);
  const line = SHAPES[idx] ?? SHAPES[0]!;
  return line.replace(/\d+(\.\d+)?/g, "");
}
