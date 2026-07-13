// Sim engine interface — Story 06.
//
// The application layer calls SimEngine.simulateMatch with a fully-formed
// SimMatchInput. The Story 06 stub implementation lives in stub.ts. A
// future Python sim service will implement the same interface in
// pythonClient.ts and the swap will be one env-var change.
//
// Routes never import from this directory directly. The rendering layer's
// match-response module is the only bridge between routes and the engine.

import type {
  Formation,
  FormTier,
  MentalTraits,
  NaturalGifts,
  PlayingStyle,
  TeamInstruction,
} from "@rpgfc/shared";

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
  /** Archetype's primaryRole (e.g. "Goalkeeper", "Center-Back",
   *  "Striker"). Drives the position-aware match rating formula. */
  primaryRole: string;
  /** Private simulator inputs. These never cross the rendering boundary. */
  gifts?: NaturalGifts;
  traits?: MentalTraits;
  badgeKeys?: string[];
  fatigue?: number;
  slot?: string;
}

export interface SimSide {
  clubId: number;
  /** Eleven players in slot order. The starter picker fills empty
   *  slots before reaching the engine, so this array is always
   *  exactly 11. */
  starters: SimPlayer[];
  bench?: SimPlayer[];
  formation?: Formation;
  playingStyle?: PlayingStyle;
  instructions?: TeamInstruction[];
  /** Private training-ground familiarity, 0..100. Public surfaces receive
   *  only the qualitative tier. */
  familiarity?: number;
}

export type SimPressureContext = "Normal" | "Contested" | "RunIn";

export interface SimMatchContext {
  season: number;
  pressure: SimPressureContext;
}

export interface SimMatchInput {
  matchId: number;
  matchday: number;
  /** Per-match seed; the stub builds its mulberry32 from it. */
  seed: number;
  context?: SimMatchContext;
  home: SimSide;
  away: SimSide;
}

export type SimEventKind =
  | "Turnover"
  | "Chance"
  | "Shot"
  | "Save"
  | "Goal"
  | "Foul"
  | "Card"
  | "Injury"
  | "Substitution";

export interface SimEvent {
  sequence: number;
  minute: number;
  kind: SimEventKind;
  phase: "build_up" | "transition" | "final_third" | "stoppage";
  clubId: number | null;
  primaryPlayerId: number | null;
  secondaryPlayerId: number | null;
  outcome: string | null;
  /** Stable semantic cause codes. Raw gifts and modifiers are never persisted. */
  evidence: string[];
}

export interface SimPlayerUpdate {
  playerId: number;
  clubId: number;
  fatigueDelta: number;
  injuryMatches: number;
  yellowCards: number;
  redCard: boolean;
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
  /** Position-aware "media consensus" rating, INTEGER × 10
   *  (60 = 6.0, 100 = 10.0). Clamped to [40, 100]. */
  ratingX10: number;
  started?: boolean;
  enteredMinute?: number | null;
  leftMinute?: number | null;
  positionSlot?: string | null;
}

export interface SimMatchResult {
  matchId: number;
  homeGoals: number;
  awayGoals: number;
  performances: SimPerformance[];
  events: SimEvent[];
  playerUpdates: SimPlayerUpdate[];
}

export interface SimEngine {
  simulateMatch(input: SimMatchInput): SimMatchResult;
}
