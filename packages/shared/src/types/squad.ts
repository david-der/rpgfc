// Squad + promise-mood shapes — Story 05.
//
// A `SquadEntry` buckets one contracted player into one of four squad
// roles. `PromiseMood` is a qualitative derivation from the gap between
// a player's contract.rolePromise (Story 04) and their current squad
// role, and `Harmony` aggregates every player's mood into a squad-level
// tier via min-of-mood (see application/squad/harmony.ts).

import type { PlayingTimeRole } from "./contract.js";

export const SQUAD_ROLES = ["Starter", "Rotation", "Backup", "Youth"] as const;
export type SquadRole = (typeof SQUAD_ROLES)[number];

export const SQUAD_ROLE_LABELS: Record<SquadRole, string> = {
  Starter: "Starter",
  Rotation: "Rotation",
  Backup: "Backup",
  Youth: "Youth",
};

export interface SquadEntry {
  id: number;
  clubId: number;
  playerId: number;
  role: SquadRole;
  updatedAt: string;
}

export const PROMISE_MOODS = [
  "Eager",
  "Content",
  "Concerned",
  "Disappointed",
  "Furious",
] as const;
export type PromiseMood = (typeof PROMISE_MOODS)[number];

export const HARMONY_TIERS = [
  "Harmonious",
  "Settled",
  "Uneasy",
  "Fractured",
  "InRevolt",
] as const;
export type Harmony = (typeof HARMONY_TIERS)[number];

export const HARMONY_LABELS: Record<Harmony, string> = {
  Harmonious: "Harmonious",
  Settled: "Settled",
  Uneasy: "Uneasy",
  Fractured: "Fractured",
  InRevolt: "On the brink",
};

// ── wire shapes ───────────────────────────────────────────────────────────

export interface RenderedSquadEntry {
  playerId: number;
  playerName: string;
  positionLabel: string;
  archetypeLabel: string | null;
  role: SquadRole;
  roleLabel: string;
  rolePromise: PlayingTimeRole | null;
  promiseMood: PromiseMood | null;
  /** Prose template for the Mood chip on the squad row. */
  promiseMoodLabel: string | null;
}

export interface RenderedSquad {
  clubId: number;
  clubName: string;
  harmony: Harmony;
  harmonyLabel: string;
  entries: RenderedSquadEntry[];
}
