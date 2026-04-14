// Season types — Story 07.
//
// The game's time system is (Season N, Match Week M) — no calendar
// dates, no years, no months. Transfers are always open — no
// window gating.

export interface SeasonState {
  season: number;
  matchWeek: number;
}

// ── league table ──────────────────────────────────────────────────────────

export interface LeagueTableRow {
  clubId: number;
  clubName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Where this club finished the previous season. `null` in Season 0
   *  or when no prior data is available. */
  lastSeasonPosition: number | null;
  /** Last up-to-5 results, oldest → newest. Empty pre-play. */
  recentForm: Array<"W" | "D" | "L">;
}

export interface SeasonSummary {
  season: number;
  table: LeagueTableRow[];
  userPosition: number;
  narrative: string;
}
