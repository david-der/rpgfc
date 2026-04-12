// Sim engine interface — Story 06.
//
// The application layer calls SimEngine.simulateMatch with a fully-formed
// SimMatchInput. The Story 06 stub implementation lives in stub.ts. A
// future Python sim service will implement the same interface in
// pythonClient.ts and the swap will be one env-var change.
//
// Routes never import from this directory directly. The rendering layer's
// match-response module is the only bridge between routes and the engine.

import type { FormTier } from "@rpgfc/shared";

export type PositionFamily = "gk" | "defender" | "midfielder" | "forward";

export interface SimPlayer {
  playerId: number;
  /** Sum of badge counts on this player. The stub uses this scalar
   *  as the per-player strength contribution; the Python sim can
   *  swap it for a richer signal without changing the interface. */
  badgeCount: number;
  /** Whether the player is in a slot that fits their archetype.
   *  The stub bonuses fit and penalises misfit. */
  positionFit: boolean;
  /** Coarse position family. Drives stat distributions (forwards get
   *  more shots, defenders more tackles, etc). */
  positionFamily: PositionFamily;
}

export interface SimSide {
  clubId: number;
  /** Eleven players in slot order. The starter picker fills empty
   *  slots before reaching the engine, so this array is always
   *  exactly 11. */
  starters: SimPlayer[];
}

export interface SimMatchInput {
  matchId: number;
  matchday: number;
  /** Per-match seed; the stub builds its mulberry32 from it. */
  seed: number;
  home: SimSide;
  away: SimSide;
}

export interface SimPerformance {
  playerId: number;
  clubId: number;
  goals: number;
  assists: number;
  /** Qualitative — never a 0..10 rating. */
  tier: FormTier;
  /** A short event sentence for the match report's prose body, or
   *  null if the engine had nothing notable to say about this
   *  player. */
  eventDescription: string | null;
  // ── Opta-style stats — all facts, not ratings ─────────────────────────
  minutesPlayed: number;
  shots: number;
  shotsOnTarget: number;
  /** Expected goals × 100 to keep it INTEGER (e.g. 27 = 0.27 xG). */
  xgX100: number;
  keyPasses: number;
  passesAttempted: number;
  passesCompleted: number;
  tacklesAttempted: number;
  tacklesWon: number;
  interceptions: number;
  clearances: number;
  aerialsWon: number;
  aerialsContested: number;
  dribblesCompleted: number;
  foulsCommitted: number;
  foulsDrawn: number;
  /** Goalkeepers only. */
  saves: number;
  yellowCards: number;
  redCards: number;
}

export interface SimMatchResult {
  matchId: number;
  homeGoals: number;
  awayGoals: number;
  performances: SimPerformance[];
}

export interface SimEngine {
  simulateMatch(input: SimMatchInput): SimMatchResult;
}
