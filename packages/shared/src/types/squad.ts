// Squad + promise-mood shapes — Story 05.
//
// A `SquadEntry` buckets one contracted player into one of four squad
// roles. `PromiseMood` is a qualitative derivation from the gap between
// a player's contract.rolePromise (Story 04) and their current squad
// role, and `Harmony` aggregates every player's mood into a squad-level
// tier via min-of-mood (see application/squad/harmony.ts).

import type { PlayingTimeRole } from "./contract.js";
import type { CurrencyTier } from "./currency.js";
import type { FormTier } from "./form.js";

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
  /** Age in years. Allowlisted numeric — ages are facts, not ratings. */
  age: number;
  /** True if this player's a fresh youth arrival (age 17 at their first
   *  club). Drives the "New arrival" chip on the squad page and the
   *  "N youth joined your academy" card on the Home dashboard. */
  isNewArrival: boolean;
  role: SquadRole;
  roleLabel: string;
  rolePromise: PlayingTimeRole | null;
  promiseMood: PromiseMood | null;
  /** Prose template for the Mood chip on the squad row. */
  promiseMoodLabel: string | null;
  /** Weekly wage tier (from the contract). null when uncontracted. */
  wageTier: CurrencyTier | null;
  /** Seasons remaining on current contract. null when uncontracted. */
  seasonsRemaining: number | null;
  /** Most-recent form tier from the last played match. null when no
   *  match has been played yet this season. */
  formTier: FormTier | null;
  /** Per-match rating (rating_x10) for the player's last 5 matches,
   *  newest first. Fewer entries if the player hasn't played 5 matches.
   *  Used by the squad-row form sparkline. */
  last5Ratings: number[];
  /** Number of played match weeks since this player's last start. null
   *  if they have never started a match this season. 0 means they
   *  started the most-recent played match. */
  matchesSinceLastStart: number | null;
}

export interface RenderedSquad {
  clubId: number;
  clubName: string;
  harmony: Harmony;
  harmonyLabel: string;
  entries: RenderedSquadEntry[];
}
