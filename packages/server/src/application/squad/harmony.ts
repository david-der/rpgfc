// Promise-mood + harmony — Story 05 §3.4, §3.5.
//
// Pure functions. Stdlib only. The rendering layer imports these and the
// routes never see them directly — promise moods are always attached to
// a Rendered* shape before they cross the wire.
//
// The contract with the rest of the codebase is narrow on purpose:
//   moodFor(promise, role)   → PromiseMood
//   moodLabel(mood)          → one prose template line
//   harmonyFor(moods)        → Harmony (min-of-mood)
//   harmonyLabel(harmony)    → tier word for UI chips
//
// If a new PlayingTimeRole or SquadRole lands, the exhaustive (promise,
// role) cross-product test in src/test/harmony-mood.test.ts fails until
// squadRoleFor and the index tables are updated deliberately.

import type { Harmony, PromiseMood, SquadRole } from "@rpgfc/shared";
import type { PlayingTimeRole } from "@rpgfc/shared";

// Collapse the five PlayingTimeRole values onto four SquadRole values.
// "Star Player" and "Important Player" both map to Starter — Story 05
// does not distinguish the two tiers within the squad page.
const PROMISE_TO_SQUAD: Record<PlayingTimeRole, SquadRole> = {
  "Star Player": "Starter",
  "Important Player": "Starter",
  Rotation: "Rotation",
  Backup: "Backup",
  "Youth/Development": "Youth",
};

export function squadRoleFor(promise: PlayingTimeRole): SquadRole {
  return PROMISE_TO_SQUAD[promise];
}

// Ordered most-senior → most-junior. A negative delta (actual − promised)
// means the player is playing below what was promised.
const SQUAD_ROLE_INDEX: Record<SquadRole, number> = {
  Starter: 3,
  Rotation: 2,
  Backup: 1,
  Youth: 0,
};

function squadRoleIndex(role: SquadRole): number {
  return SQUAD_ROLE_INDEX[role];
}

export function moodFor(promise: PlayingTimeRole | null, role: SquadRole): PromiseMood {
  if (promise === null) return "Content";
  const promisedRole = squadRoleFor(promise);
  const delta = squadRoleIndex(role) - squadRoleIndex(promisedRole);
  if (delta > 0) return "Eager";
  if (delta === 0) return "Content";
  if (delta === -1) return "Concerned";
  if (delta === -2) return "Disappointed";
  return "Furious";
}

// Short prose templates — a small pool per mood, ≤80 chars so a
// PromiseMoodChip renders on one line at the standard column widths.
// Selection is deterministic per player (seed = player id) so a player
// keeps one voice while a watch list of three no longer repeats a
// single sentence verbatim.
export const MOOD_LABEL_POOLS: Record<PromiseMood, readonly string[]> = {
  Eager: [
    "Exceeding the role we promised him — watch him thrive.",
    "Given more than his word demanded, and repaying it.",
    "The promise undersold him. He plays like he knows it.",
  ],
  Content: [
    "Playing the role we promised.",
    "Getting exactly the football he signed up for.",
    "No complaints — the word given is the word kept.",
  ],
  Concerned: [
    "Beginning to ask whether we meant what we said.",
    "Watching the team sheet a little too closely lately.",
    "Not angry yet. But he counts the weeks since we promised.",
  ],
  Disappointed: [
    "We promised him more than this. He remembers.",
    "The gap between the promise and the minutes is widening.",
    "Told he mattered; the selections keep saying otherwise.",
  ],
  Furious: [
    "A star was promised. A youth slot is what he got.",
    "He calls the promise what it was — a lie with a signature.",
    "Done waiting. Everyone in the dressing room knows it.",
  ],
};

export function moodLabel(mood: PromiseMood, seed = 0): string {
  const pool = MOOD_LABEL_POOLS[mood];
  return pool[Math.abs(seed) % pool.length]!;
}

// Harmony is min-of-mood, not average: one furious player drags the
// whole squad into InRevolt. This is deliberate — harmony is a canary,
// not a scoreboard. See Story 05 §3.5.
export function harmonyFor(moods: readonly PromiseMood[]): Harmony {
  if (moods.length === 0) return "Settled";
  if (moods.includes("Furious")) return "InRevolt";
  if (moods.includes("Disappointed")) return "Fractured";
  if (moods.includes("Concerned")) return "Uneasy";
  if (moods.includes("Eager")) return "Harmonious";
  return "Settled";
}
