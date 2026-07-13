// MatchStatsTable — rich Opta-style per-player stats for the match
// report's Stats tab.
//
// All numeric cells are allowlisted facts (goals, xG, passes, etc.),
// not ratings. The qualitative tier chip is the performance headline.

import type { FormTier, RenderedMatchPerformance } from "@rpgfc/shared";

import { usePlayerModal } from "../PlayerModalProvider";

interface Props {
  homeName: string;
  awayName: string;
  homeId: number;
  awayId: number;
  performances: RenderedMatchPerformance[];
}

const TIER_CLASS: Record<FormTier, string> = {
  Excellent: "border-form-excellent text-form-excellent font-semibold",
  Good: "border-form-good text-form-good font-medium",
  Average: "border-parchment-500 text-parchment-700 font-medium",
  Poor: "border-form-poor text-form-poor font-medium italic",
  Dreadful: "border-form-dreadful text-form-dreadful font-semibold italic",
};

export function MatchStatsTable({ homeName, awayName, homeId, awayId, performances }: Props) {
  const home = performances.filter((p) => p.clubId === homeId);
  const away = performances.filter((p) => p.clubId === awayId);
  return (
    <div className="space-y-8">
      <StatsBlock title={homeName} rows={home} />
      <StatsBlock title={awayName} rows={away} />
    </div>
  );
}

function StatsBlock({ title, rows }: { title: string; rows: RenderedMatchPerformance[] }) {
  const modal = usePlayerModal();
  return (
    <section>
      <h3 className="mb-3 font-serif text-xl text-parchment-900">{title}</h3>
      <div className="overflow-x-auto border border-parchment-300">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="border-b border-parchment-300 bg-parchment-100 uppercase tracking-wide text-[10px] text-parchment-500">
            <tr>
              <th className="px-3 py-2 text-left">Player</th>
              <th className="px-2 py-2 text-left">Performance</th>
              <th className="px-2 py-2 text-right" title="Goals">
                G
              </th>
              <th className="px-2 py-2 text-right" title="Assists">
                A
              </th>
              <th className="px-2 py-2 text-right" title="Shots (on target)">
                Sh
              </th>
              <th className="px-2 py-2 text-right" title="Expected Goals">
                xG
              </th>
              <th className="px-2 py-2 text-right" title="Key passes">
                KP
              </th>
              <th className="px-2 py-2 text-right" title="Passes completed / attempted">
                Passes
              </th>
              <th className="px-2 py-2 text-right" title="Pass accuracy">
                Pass %
              </th>
              <th className="px-2 py-2 text-right" title="Dribbles completed">
                Drb
              </th>
              <th className="px-2 py-2 text-right" title="Tackles won / attempted">
                Tk
              </th>
              <th className="px-2 py-2 text-right" title="Interceptions">
                Int
              </th>
              <th className="px-2 py-2 text-right" title="Clearances">
                Clr
              </th>
              <th className="px-2 py-2 text-right" title="Aerials won / contested">
                Aer
              </th>
              <th className="px-2 py-2 text-right" title="Saves">
                Sv
              </th>
              <th className="px-2 py-2 text-right" title="Fouls committed / drawn">
                Fo
              </th>
              <th className="px-2 py-2 text-right" title="Cards (yellow/red)">
                Crd
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-parchment-200 bg-parchment-50">
            {rows.map((p) => (
              <tr key={p.playerId} className="hover:bg-parchment-100">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    data-testid="player-facing"
                    onClick={() => modal.open(p.playerId)}
                    className="text-left font-serif text-sm text-parchment-900 hover:text-moss-700"
                  >
                    {p.playerName}
                  </button>
                  <div className="text-[10px] uppercase tracking-wide text-parchment-500">
                    {p.positionLabel}
                  </div>
                </td>
                <td className="px-2 py-2">
                  <span
                    className={`inline-flex h-5 items-center border bg-parchment-50 px-2 text-[10px] uppercase tracking-wide ${TIER_CLASS[p.tier]}`}
                  >
                    {p.tier}
                  </span>
                </td>
                <Num v={p.goals} testid="goals-allowlist-number" strong={p.goals > 0} />
                <Num v={p.assists} testid="assists-allowlist-number" strong={p.assists > 0} />
                <td className="px-2 py-2 text-right font-mono tabular-nums text-parchment-700">
                  {p.shots}
                  <span className="text-parchment-500">
                    {p.shots > 0 ? ` (${p.shotsOnTarget})` : ""}
                  </span>
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-parchment-700">
                  {p.xg.toFixed(2)}
                </td>
                <Num v={p.keyPasses} />
                <td className="px-2 py-2 text-right font-mono tabular-nums text-parchment-700">
                  {p.passesCompleted}/{p.passesAttempted}
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-parchment-700">
                  {p.passesAttempted > 0 ? `${Math.round(p.passAccuracy * 100)}%` : "—"}
                </td>
                <Num v={p.dribblesCompleted} />
                <td className="px-2 py-2 text-right font-mono tabular-nums text-parchment-700">
                  {p.tacklesWon}/{p.tacklesAttempted}
                </td>
                <Num v={p.interceptions} />
                <Num v={p.clearances} />
                <td className="px-2 py-2 text-right font-mono tabular-nums text-parchment-700">
                  {p.aerialsContested > 0 ? `${p.aerialsWon}/${p.aerialsContested}` : "—"}
                </td>
                <Num v={p.saves} strong={p.saves > 0} />
                <td className="px-2 py-2 text-right font-mono tabular-nums text-parchment-700">
                  {p.foulsCommitted}/{p.foulsDrawn}
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums">
                  {p.yellowCards > 0 && <span className="text-form-average">▉</span>}
                  {p.redCards > 0 && <span className="ml-1 text-form-dreadful">▉</span>}
                  {p.yellowCards === 0 && p.redCards === 0 && (
                    <span className="text-parchment-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Num({ v, testid, strong }: { v: number; testid?: string; strong?: boolean }) {
  return (
    <td
      className={`px-2 py-2 text-right font-mono tabular-nums ${
        strong ? "font-semibold text-parchment-900" : "text-parchment-700"
      }`}
    >
      {testid && v > 0 ? (
        <span data-testid={testid}>{v}</span>
      ) : v === 0 ? (
        <span className="text-parchment-400">—</span>
      ) : (
        v
      )}
    </td>
  );
}
