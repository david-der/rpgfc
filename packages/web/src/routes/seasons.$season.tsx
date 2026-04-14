// Historical season detail — same shape as /season/summary, but for
// any prior season in the archive. Includes the Best XI section.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { usePlayerModal } from "../components/PlayerModalProvider";
import { BestXISection } from "../components/features/BestXI";
import { Card } from "../components/ui/Card";
import { fetchClubFinances, fetchSeasonSummary } from "../lib/api";

export const Route = createFileRoute("/seasons/$season")({
  component: HistoricalSeason,
});

function HistoricalSeason() {
  const { season } = Route.useParams();
  const seasonNum = Number(season);
  const summaryQ = useQuery({
    queryKey: ["season-summary", seasonNum],
    queryFn: () => fetchSeasonSummary(seasonNum),
  });
  const financesQ = useQuery({ queryKey: ["club-finances"], queryFn: fetchClubFinances });
  const modal = usePlayerModal();

  if (summaryQ.isPending) {
    return (
      <div className="mx-auto max-w-prose px-6 py-16">
        <p className="text-parchment-600">Loading the season review…</p>
      </div>
    );
  }
  if (summaryQ.isError || !summaryQ.data) {
    return (
      <div className="mx-auto max-w-prose px-6 py-16">
        <p className="text-semantic-error">Could not load that season.</p>
        <p className="mt-3 text-parchment-600">
          <Link to="/seasons" className="underline">
            Back to the archive
          </Link>
        </p>
      </div>
    );
  }

  const s = summaryQ.data;
  const myClubId = financesQ.data?.clubId;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-4">
        <Link
          to="/seasons"
          className="text-xs uppercase tracking-wide text-parchment-500 underline hover:text-parchment-900"
        >
          ← All seasons
        </Link>
      </div>
      <h1
        data-testid="history-season-title-allowlist-number"
        className="font-mono text-xs uppercase tracking-wide tabular-nums text-parchment-500"
      >
        Season {s.season + 1}
      </h1>
      <p className="mt-1 mb-6 max-w-prose font-serif text-xl text-parchment-900">
        {s.narrative}
      </p>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card eyebrow="Champion" className="lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <span
              data-testid="player-facing"
              className="font-serif text-3xl text-parchment-900"
            >
              {s.champion.clubName}
            </span>
            <span
              data-testid="history-champion-pts-allowlist-number"
              className="font-mono text-2xl tabular-nums text-parchment-900"
            >
              {s.champion.points} <span className="text-sm text-parchment-500">pts</span>
            </span>
          </div>
          {s.champion.clubId !== myClubId && s.userFinish && (
            <p className="mt-3 text-parchment-600">
              You finished{" "}
              <span
                data-testid="history-user-pos-allowlist-number"
                className="font-mono tabular-nums text-parchment-900"
              >
                {s.userFinish.position}
              </span>{" "}
              with{" "}
              <span
                data-testid="history-user-pts-allowlist-number"
                className="font-mono tabular-nums"
              >
                {s.userFinish.points}
              </span>{" "}
              points.
            </p>
          )}
        </Card>
        <Card eyebrow="Wooden spoon">
          <div className="font-serif text-lg text-parchment-900">
            <span data-testid="player-facing">{s.woodenSpoon.clubName}</span>
          </div>
          <div
            data-testid="history-spoon-pts-allowlist-number"
            className="mt-1 font-mono text-sm tabular-nums text-parchment-500"
          >
            {s.woodenSpoon.points} pts
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        {s.topScorer && (
          <Card eyebrow="Golden boot">
            <div className="flex items-baseline justify-between">
              <button
                type="button"
                onClick={() => modal.open(s.topScorer!.player_id)}
                className="text-left font-serif text-2xl text-parchment-900 hover:text-moss-700"
              >
                <span data-testid="player-facing">{s.topScorer.player_name}</span>
              </button>
              <div className="flex items-baseline gap-3 text-parchment-600">
                <span className="text-xs uppercase tracking-wide">
                  <span data-testid="player-facing">{s.topScorer.club_name}</span>
                </span>
                <span
                  data-testid="history-scorer-goals-allowlist-number"
                  className="font-mono text-2xl tabular-nums text-parchment-900"
                >
                  {s.topScorer.goals}
                </span>
                <span className="text-xs uppercase tracking-wide text-parchment-500">goals</span>
              </div>
            </div>
          </Card>
        )}
        {s.topAssister && (
          <Card eyebrow="Playmaker of the season">
            <div className="flex items-baseline justify-between">
              <button
                type="button"
                onClick={() => modal.open(s.topAssister!.player_id)}
                className="text-left font-serif text-2xl text-parchment-900 hover:text-moss-700"
              >
                <span data-testid="player-facing">{s.topAssister.player_name}</span>
              </button>
              <div className="flex items-baseline gap-3 text-parchment-600">
                <span className="text-xs uppercase tracking-wide">
                  <span data-testid="player-facing">{s.topAssister.club_name}</span>
                </span>
                <span
                  data-testid="history-assister-count-allowlist-number"
                  className="font-mono text-2xl tabular-nums text-parchment-900"
                >
                  {s.topAssister.assists}
                </span>
                <span className="text-xs uppercase tracking-wide text-parchment-500">
                  assists
                </span>
              </div>
            </div>
          </Card>
        )}
      </section>

      {s.bestXI && <BestXISection bestXI={s.bestXI} />}

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
          Final table
        </h2>
        <div className="overflow-x-auto border border-parchment-300">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-parchment-300 bg-parchment-100 text-xs uppercase tracking-wide text-parchment-500">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Club</th>
                <th className="px-3 py-2">Pts</th>
              </tr>
            </thead>
            <tbody>
              {s.table.map((row, i) => {
                const mine = row.clubId === myClubId;
                return (
                  <tr
                    key={row.clubId}
                    className={`border-b border-parchment-200 ${mine ? "bg-parchment-100 font-medium" : ""}`}
                  >
                    <td
                      data-testid={`history-row-${i}-pos-allowlist-number`}
                      className="px-3 py-2 font-mono tabular-nums text-parchment-500"
                    >
                      {i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <span data-testid="player-facing" className="text-parchment-900">
                        {row.clubName}
                      </span>
                    </td>
                    <td
                      data-testid={`history-row-${i}-pts-allowlist-number`}
                      className="px-3 py-2 font-mono font-semibold tabular-nums"
                    >
                      {row.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
