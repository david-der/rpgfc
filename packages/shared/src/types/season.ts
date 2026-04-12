// Season types — Story 07.
//
// The game's time system is (Season N, Match Week M) — no calendar
// dates, no years, no months.

export interface SeasonState {
  season: number;
  matchWeek: number;
  transferWindowOpen: boolean;
  nextWindowOpens: number | null;
  nextWindowCloses: number | null;
}

export const TRANSFER_WINDOWS: ReadonlyArray<{ from: number; to: number }> = [
  { from: 1, to: 4 },
  { from: 19, to: 22 },
];

export function isTransferWindowOpen(matchWeek: number): boolean {
  return TRANSFER_WINDOWS.some((w) => matchWeek >= w.from && matchWeek <= w.to);
}

export function nextWindowBoundary(matchWeek: number): {
  opens: number | null;
  closes: number | null;
} {
  for (const w of TRANSFER_WINDOWS) {
    if (matchWeek >= w.from && matchWeek <= w.to) {
      return { opens: null, closes: w.to };
    }
  }
  for (const w of TRANSFER_WINDOWS) {
    if (matchWeek < w.from) {
      return { opens: w.from, closes: null };
    }
  }
  return { opens: null, closes: null };
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
