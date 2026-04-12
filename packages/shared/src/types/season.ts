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
}

export interface SeasonSummary {
  season: number;
  table: LeagueTableRow[];
  userPosition: number;
  narrative: string;
}
