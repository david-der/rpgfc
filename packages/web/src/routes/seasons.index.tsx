// Seasons archive — scrapbook of completed seasons. Each card shows
// champion, golden boot, your finish, and a 5-match form ribbon.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Card } from "../components/ui/Card";
import { fetchSeasonsArchive } from "../lib/api";

export const Route = createFileRoute("/seasons/")({
  component: SeasonsArchive,
});

function ResultChip({ result }: { result: "W" | "D" | "L" }) {
  const cls =
    result === "W"
      ? "border-result-win bg-result-win text-parchment-50 font-bold"
      : result === "L"
        ? "border-result-loss bg-result-loss text-parchment-50 font-bold"
        : "border-parchment-500 bg-parchment-50 text-parchment-700 font-medium";
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center border font-mono text-[10px] uppercase tracking-wide ${cls}`}
      aria-label={result === "W" ? "Win" : result === "L" ? "Loss" : "Draw"}
    >
      {result}
    </span>
  );
}

function SeasonsArchive() {
  const q = useQuery({ queryKey: ["seasons-archive"], queryFn: fetchSeasonsArchive });

  if (q.isPending) {
    return (
      <div className="mx-auto max-w-prose px-6 py-16">
        <p className="text-parchment-600">Loading the archive…</p>
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-prose px-6 py-16">
        <p className="text-semantic-error">Could not load the archive.</p>
      </div>
    );
  }

  const seasons = q.data.seasons;
  const allTime = q.data.allTime;

  // Best-finish-yet detection helper: a season's finish is "best yet"
  // when, among seasons strictly before it (numerically earlier), none
  // had a smaller finish position. `seasons` comes newest-first, so we
  // scan the tail.
  const bestFinishYetMap = new Map<number, boolean>();
  {
    const chrono = [...seasons].sort((a, b) => a.season - b.season);
    // Skip the very first season — "best yet" is trivially true when
    // there's nothing prior to compare against, and the callout reads
    // like false praise on the opening chapter.
    let runningBest: number | null = null;
    for (const s of chrono) {
      if (s.userFinishPosition !== null) {
        const hasPriorBaseline = runningBest !== null;
        if (runningBest === null || s.userFinishPosition < runningBest) {
          bestFinishYetMap.set(s.season, hasPriorBaseline);
          runningBest =
            runningBest === null
              ? s.userFinishPosition
              : Math.min(runningBest, s.userFinishPosition);
        } else {
          bestFinishYetMap.set(s.season, false);
        }
      } else {
        bestFinishYetMap.set(s.season, false);
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-2 font-serif text-3xl text-parchment-900">History</h1>
      <p className="mb-6 max-w-prose text-parchment-600">
        Every completed season, with its champion and your finish. The current season isn&rsquo;t
        here yet — end it from the League page to lock it in.
      </p>

      {/* All-time ribbon */}
      <div
        data-testid="archive-all-time"
        className="mb-8 grid grid-cols-1 gap-0 border border-parchment-300 bg-parchment-100 sm:grid-cols-3 sm:divide-x sm:divide-parchment-300"
      >
        <div className="flex flex-col px-5 py-4">
          <span className="text-[10px] uppercase tracking-wide text-parchment-500">Trophies</span>
          <span
            data-testid="archive-all-time-trophies-allowlist-number"
            className="mt-1 font-mono text-3xl tabular-nums text-parchment-900"
          >
            {allTime.trophies}
          </span>
        </div>
        <div className="flex flex-col border-t border-parchment-300 px-5 py-4 sm:border-t-0">
          <span className="text-[10px] uppercase tracking-wide text-parchment-500">
            Best finish
          </span>
          {allTime.bestFinish !== null ? (
            <span
              data-testid="archive-all-time-best-finish-allowlist-number"
              className="mt-1 font-mono text-3xl tabular-nums text-parchment-900"
            >
              {allTime.bestFinish}
            </span>
          ) : (
            <span className="mt-1 font-serif text-lg italic text-parchment-500">None yet</span>
          )}
        </div>
        <div className="flex flex-col border-t border-parchment-300 px-5 py-4 sm:border-t-0">
          <span className="text-[10px] uppercase tracking-wide text-parchment-500">
            All-time top scorer
          </span>
          {allTime.topScorerName ? (
            <>
              <span
                data-testid="player-facing"
                className="mt-1 font-serif text-lg text-parchment-900"
              >
                {allTime.topScorerName}
              </span>
              <span className="text-xs text-parchment-600">
                <span
                  data-testid="archive-all-time-top-goals-allowlist-number"
                  className="font-mono tabular-nums font-semibold text-parchment-900"
                >
                  {allTime.topScorerGoals}
                </span>{" "}
                goals
              </span>
            </>
          ) : (
            <span className="mt-1 font-serif text-lg italic text-parchment-500">
              No goals scored yet
            </span>
          )}
        </div>
      </div>

      {seasons.length === 0 ? (
        <Card>
          <p className="text-parchment-600">No seasons have been completed yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {seasons.map((s) => {
            const bestYet = bestFinishYetMap.get(s.season) ?? false;
            const isTopThree =
              !s.userWasChampion && s.userFinishPosition !== null && s.userFinishPosition <= 3;
            const stripeClass = s.userWasChampion
              ? "border-l-4 border-l-moss-500"
              : isTopThree
                ? "border-l-4 border-l-clay-500"
                : "border-l-4 border-l-parchment-400";
            const bgClass = s.userWasChampion ? "bg-parchment-100" : "bg-parchment-50";

            return (
              <Link
                key={s.season}
                to="/seasons/$season"
                params={{ season: String(s.season) }}
                className="block"
              >
                <div
                  className={`border border-parchment-300 ${stripeClass} ${bgClass} p-5 hover:bg-parchment-100`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="min-w-0">
                      <div
                        data-testid={`archive-season-${s.season}-allowlist-number`}
                        className="font-mono text-xs uppercase tracking-wide tabular-nums text-parchment-500"
                      >
                        Season {s.season + 1}
                      </div>
                      <div className="mt-0.5 font-serif text-xl text-parchment-900">
                        <span data-testid="player-facing">{s.championClubName}</span>
                      </div>
                      <div className="text-[11px] uppercase tracking-wide text-parchment-500">
                        Champions
                      </div>
                      {s.goldenBootName && (
                        <div className="mt-2 text-sm text-parchment-700">
                          <span className="text-[10px] uppercase tracking-wide text-parchment-500">
                            Golden boot:
                          </span>{" "}
                          <span data-testid="player-facing" className="font-serif">
                            {s.goldenBootName}
                          </span>{" "}
                          <span
                            data-testid={`archive-golden-boot-${s.season}-allowlist-number`}
                            className="font-mono tabular-nums text-parchment-900"
                          >
                            {s.goldenBootGoals}
                          </span>{" "}
                          <span className="text-xs text-parchment-500">goals</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {s.userWasChampion ? (
                        <div className="border border-moss-600 bg-moss-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-parchment-50">
                          Champions
                        </div>
                      ) : bestYet && s.userFinishPosition !== null ? (
                        <div className="border border-clay-600 bg-parchment-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-clay-700">
                          New club-best finish
                        </div>
                      ) : null}

                      {s.userFinishPosition !== null && !s.userWasChampion && (
                        <div className="text-right">
                          <div
                            data-testid={`archive-finish-${s.season}-allowlist-number`}
                            className="font-mono text-2xl tabular-nums text-parchment-900"
                          >
                            {s.userFinishPosition}
                          </div>
                          <div className="text-[11px] uppercase tracking-wide text-parchment-500">
                            Your finish
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {s.userFormRibbon.length > 0 && (
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-parchment-500">
                        Your last 5
                      </span>
                      <div className="flex items-center gap-1">
                        {s.userFormRibbon.map((r, i) => (
                          <ResultChip key={i} result={r} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
