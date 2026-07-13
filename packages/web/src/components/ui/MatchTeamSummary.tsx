// MatchTeamSummary — head-to-head team totals.
//
// Aggregates per-player performances into team-level totals and
// renders them as paired rows with the dominant side bolded. Pure
// facts, all allowlisted numerics.

import type { RenderedMatchPerformance } from "@rpgfc/shared";

interface Props {
  homeName: string;
  awayName: string;
  homeId: number;
  awayId: number;
  performances: RenderedMatchPerformance[];
}

interface TeamTotals {
  shots: number;
  shotsOnTarget: number;
  xg: number;
  keyPasses: number;
  passesAttempted: number;
  passesCompleted: number;
  tacklesWon: number;
  tacklesAttempted: number;
  interceptions: number;
  clearances: number;
  aerialsWon: number;
  aerialsContested: number;
  dribblesCompleted: number;
  foulsCommitted: number;
  yellowCards: number;
  redCards: number;
  saves: number;
}

function aggregate(rows: RenderedMatchPerformance[]): TeamTotals {
  return rows.reduce(
    (t, p) => ({
      shots: t.shots + p.shots,
      shotsOnTarget: t.shotsOnTarget + p.shotsOnTarget,
      xg: t.xg + p.xg,
      keyPasses: t.keyPasses + p.keyPasses,
      passesAttempted: t.passesAttempted + p.passesAttempted,
      passesCompleted: t.passesCompleted + p.passesCompleted,
      tacklesWon: t.tacklesWon + p.tacklesWon,
      tacklesAttempted: t.tacklesAttempted + p.tacklesAttempted,
      interceptions: t.interceptions + p.interceptions,
      clearances: t.clearances + p.clearances,
      aerialsWon: t.aerialsWon + p.aerialsWon,
      aerialsContested: t.aerialsContested + p.aerialsContested,
      dribblesCompleted: t.dribblesCompleted + p.dribblesCompleted,
      foulsCommitted: t.foulsCommitted + p.foulsCommitted,
      yellowCards: t.yellowCards + p.yellowCards,
      redCards: t.redCards + p.redCards,
      saves: t.saves + p.saves,
    }),
    {
      shots: 0,
      shotsOnTarget: 0,
      xg: 0,
      keyPasses: 0,
      passesAttempted: 0,
      passesCompleted: 0,
      tacklesWon: 0,
      tacklesAttempted: 0,
      interceptions: 0,
      clearances: 0,
      aerialsWon: 0,
      aerialsContested: 0,
      dribblesCompleted: 0,
      foulsCommitted: 0,
      yellowCards: 0,
      redCards: 0,
      saves: 0,
    },
  );
}

interface StatSpec {
  label: string;
  format: (t: TeamTotals) => string;
  // For the bar visualization: numeric value + scale comparator.
  value: (t: TeamTotals) => number;
}

const STATS: StatSpec[] = [
  { label: "Shots", value: (t) => t.shots, format: (t) => String(t.shots) },
  {
    label: "Shots on target",
    value: (t) => t.shotsOnTarget,
    format: (t) => String(t.shotsOnTarget),
  },
  { label: "Expected goals", value: (t) => t.xg, format: (t) => t.xg.toFixed(2) },
  { label: "Key passes", value: (t) => t.keyPasses, format: (t) => String(t.keyPasses) },
  {
    label: "Passes",
    value: (t) => t.passesCompleted,
    format: (t) => {
      const pct =
        t.passesAttempted > 0 ? Math.round((t.passesCompleted / t.passesAttempted) * 100) : 0;
      return `${t.passesCompleted}/${t.passesAttempted} (${pct}%)`;
    },
  },
  {
    label: "Dribbles",
    value: (t) => t.dribblesCompleted,
    format: (t) => String(t.dribblesCompleted),
  },
  {
    label: "Tackles won",
    value: (t) => t.tacklesWon,
    format: (t) => `${t.tacklesWon}/${t.tacklesAttempted}`,
  },
  { label: "Interceptions", value: (t) => t.interceptions, format: (t) => String(t.interceptions) },
  { label: "Clearances", value: (t) => t.clearances, format: (t) => String(t.clearances) },
  {
    label: "Aerial duels won",
    value: (t) => t.aerialsWon,
    format: (t) => (t.aerialsContested > 0 ? `${t.aerialsWon}/${t.aerialsContested}` : "0"),
  },
  { label: "Saves", value: (t) => t.saves, format: (t) => String(t.saves) },
  { label: "Fouls", value: (t) => t.foulsCommitted, format: (t) => String(t.foulsCommitted) },
];

export function MatchTeamSummary({ homeName, awayName, homeId, awayId, performances }: Props) {
  const homeTotals = aggregate(performances.filter((p) => p.clubId === homeId));
  const awayTotals = aggregate(performances.filter((p) => p.clubId === awayId));

  return (
    <div className="border border-parchment-300 bg-parchment-100 p-6">
      {/* Header row */}
      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-baseline gap-4 border-b border-parchment-300 pb-3">
        <div className="text-right font-serif text-lg text-parchment-900">{homeName}</div>
        <div className="text-xs uppercase tracking-wide text-parchment-500">Team stats</div>
        <div className="font-serif text-lg text-parchment-900">{awayName}</div>
      </div>

      <div className="space-y-3">
        {STATS.map((s) => {
          const h = s.value(homeTotals);
          const a = s.value(awayTotals);
          const total = h + a;
          const homePct = total > 0 ? (h / total) * 100 : 50;
          const homeDominant = h > a;
          const awayDominant = a > h;
          return (
            <div key={s.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div
                className={`text-right font-mono text-sm tabular-nums ${
                  homeDominant ? "font-semibold text-parchment-900" : "text-parchment-500"
                }`}
              >
                {s.format(homeTotals)}
              </div>
              <div className="min-w-[120px] text-center">
                <div className="text-[10px] uppercase tracking-wide text-parchment-500">
                  {s.label}
                </div>
                <div className="mt-1 flex h-1.5 w-[120px] overflow-hidden bg-parchment-200">
                  <div
                    className={homeDominant ? "bg-moss-600" : "bg-parchment-400"}
                    style={{ width: `${homePct}%` }}
                  />
                  <div
                    className={awayDominant ? "bg-moss-600" : "bg-parchment-400"}
                    style={{ width: `${100 - homePct}%` }}
                  />
                </div>
              </div>
              <div
                className={`font-mono text-sm tabular-nums ${
                  awayDominant ? "font-semibold text-parchment-900" : "text-parchment-500"
                }`}
              >
                {s.format(awayTotals)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
