// MatchPerformanceList — Story 06.
//
// One row per starter on /matches/$id, grouped by club. Player names
// carry data-testid="player-facing"; goal/assist counts wear their
// allowlist suffixes; the per-row event description is also player-
// facing because it names a player and quotes the engine's prose.

import type { FormTier, RenderedMatchPerformance } from "@rpgfc/shared";

interface MatchPerformanceListProps {
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

function PerformanceRow({ perf }: { perf: RenderedMatchPerformance }) {
  return (
    <li className="flex items-start gap-3 border-b border-parchment-200 py-3 last:border-b-0">
      <span
        className={`mt-1 inline-flex h-5 items-center border bg-parchment-50 px-2 font-sans text-[10px] uppercase tracking-wide ${TIER_CLASS[perf.tier]}`}
      >
        {perf.tier}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <span data-testid="player-facing" className="font-serif text-base text-parchment-900">
            {perf.playerName}
          </span>
          <span className="text-xs uppercase tracking-wide text-parchment-500">
            {perf.positionLabel}
          </span>
        </div>
        {perf.eventDescription && (
          <p
            data-testid="player-facing"
            className="mt-1 font-serif text-sm italic leading-relaxed text-parchment-700"
          >
            {perf.eventDescription}.
          </p>
        )}
      </div>
      <div className="flex flex-none flex-col items-end gap-1 font-mono text-xs text-parchment-700">
        {perf.goals > 0 && (
          <span>
            <span
              data-testid="goals-allowlist-number"
              className="font-semibold text-parchment-900"
            >
              {perf.goals}
            </span>
            <span className="ml-1 uppercase tracking-wide">G</span>
          </span>
        )}
        {perf.assists > 0 && (
          <span>
            <span
              data-testid="assists-allowlist-number"
              className="font-semibold text-parchment-900"
            >
              {perf.assists}
            </span>
            <span className="ml-1 uppercase tracking-wide">A</span>
          </span>
        )}
      </div>
    </li>
  );
}

export function MatchPerformanceList({
  homeName,
  awayName,
  homeId,
  awayId,
  performances,
}: MatchPerformanceListProps) {
  const home = performances.filter((p) => p.clubId === homeId);
  const away = performances.filter((p) => p.clubId === awayId);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
          {homeName}
        </h3>
        <ul className="border border-parchment-300 bg-parchment-100 px-4">
          {home.map((perf) => (
            <PerformanceRow key={perf.playerId} perf={perf} />
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
          {awayName}
        </h3>
        <ul className="border border-parchment-300 bg-parchment-100 px-4">
          {away.map((perf) => (
            <PerformanceRow key={perf.playerId} perf={perf} />
          ))}
        </ul>
      </section>
    </div>
  );
}
