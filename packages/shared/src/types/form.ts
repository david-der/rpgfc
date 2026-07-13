// Form tiers — Story 06.
//
// The qualitative axis the match engine writes to and the form
// sparkline reads from. Five stops, paired with the form gradient
// from Style Guide §2.3 (form-dreadful → form-excellent).

export const FORM_TIERS = ["Excellent", "Good", "Average", "Poor", "Dreadful"] as const;
export type FormTier = (typeof FORM_TIERS)[number];

export const FORM_TIER_LABELS: Record<FormTier, string> = {
  Excellent: "Excellent",
  Good: "Good",
  Average: "Average",
  Poor: "Poor",
  Dreadful: "Dreadful",
};

// Match state — Scheduled before kick-off, Played after the engine
// writes a result. Story 07 may add more states (Postponed, Cancelled).
export const MATCH_STATES = ["Scheduled", "Played"] as const;
export type MatchState = (typeof MATCH_STATES)[number];

// ── wire shapes ───────────────────────────────────────────────────────────

export interface RenderedMatchClub {
  id: number;
  name: string;
  goals: number | null;
}

export interface RenderedMatchPerformance {
  playerId: number;
  playerName: string;
  positionLabel: string;
  clubId: number;
  goals: number;
  assists: number;
  tier: FormTier;
  tierLabel: string;
  eventDescription: string | null;
  // Opta-style facts. All allowlisted numerics in the UI — they
  // describe what happened, not a quality judgement.
  minutesPlayed: number;
  shots: number;
  shotsOnTarget: number;
  xg: number; // already divided by 100 — e.g. 0.27
  keyPasses: number;
  passesAttempted: number;
  passesCompleted: number;
  passAccuracy: number; // 0..1
  tacklesAttempted: number;
  tacklesWon: number;
  interceptions: number;
  clearances: number;
  aerialsWon: number;
  aerialsContested: number;
  dribblesCompleted: number;
  foulsCommitted: number;
  foulsDrawn: number;
  saves: number;
  yellowCards: number;
  redCards: number;
}

export type RenderedMatchEventKind =
  | "Chance"
  | "Save"
  | "Goal"
  | "Card"
  | "Injury"
  | "Substitution";

export interface RenderedMatchEvent {
  sequence: number;
  minute: number;
  kind: RenderedMatchEventKind;
  clubId: number | null;
  primaryPlayerName: string | null;
  secondaryPlayerName: string | null;
  description: string;
}

export interface RenderedMatch {
  id: number;
  matchday: number;
  state: MatchState;
  home: RenderedMatchClub;
  away: RenderedMatchClub;
  /** At least four short paragraphs derived from the score, performers,
   *  and persisted causal evidence. Empty when Scheduled. */
  narrative: string[];
  /** Key moments projected from the persisted causal event ledger. */
  events: RenderedMatchEvent[];
  performances: RenderedMatchPerformance[];
}

export interface RenderedFixture {
  id: number;
  matchday: number;
  state: MatchState;
  home: RenderedMatchClub;
  away: RenderedMatchClub;
  /** "W" / "D" / "L" from the user-club's perspective when this
   *  fixture has been played and the user club is one of the two
   *  sides. Null otherwise. */
  userResult: "W" | "D" | "L" | null;
}

export interface RenderedFixturesPage {
  /** All matchday groups, ordered ascending. */
  matchdays: Array<{
    matchday: number;
    fixtures: RenderedFixture[];
  }>;
  /** The matchday number the next Advance call will simulate, or
   *  null if every fixture in the half-season is already Played. */
  nextMatchday: number | null;
}

export interface FormSeriesPoint {
  matchday: number;
  matchId: number;
  tier: FormTier;
  tierLabel: string;
}

export interface FormSeries {
  playerId: number;
  /** Most recent first… NO, ascending matchday order so the
   *  sparkline reads left-to-right naturally. */
  points: FormSeriesPoint[];
  /** The player's current form tier — `recentFormFor(player, 5)`. */
  currentTier: FormTier;
  currentTierLabel: string;
}
