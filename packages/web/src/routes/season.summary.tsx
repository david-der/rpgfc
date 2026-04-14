// Season summary — the ceremony page you land on right after clicking
// "End season" on the League screen. Champion hero, your finish, final
// table, and the golden boot. Replaces the silent season-rollover that
// made every new season feel like a fresh install.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { usePlayerModal } from "../components/PlayerModalProvider";
import { Card } from "../components/ui/Card";
import { HeroIllustration } from "../components/ui/HeroIllustration";
import { fetchClubFinances, fetchSeasonSummary } from "../lib/api";

export const Route = createFileRoute("/season/summary")({
  component: SeasonSummary,
});

type Summary = Awaited<ReturnType<typeof fetchSeasonSummary>>;

function SeasonSummary() {
  const summaryQ = useQuery({ queryKey: ["season-summary"], queryFn: () => fetchSeasonSummary() });
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
        <p className="text-semantic-error">Could not load the season summary.</p>
        <p className="mt-3 text-parchment-600">
          <Link to="/league" className="underline">
            Back to the league page
          </Link>
        </p>
      </div>
    );
  }

  const s = summaryQ.data as NonNullable<Summary>;
  const myClubId = financesQ.data?.clubId;
  const isUserChampion = s.userFinish?.position === 1;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <HeroIllustration
        folder="ceremony-art"
        artKey={s.season}
        eyebrow={
          <span data-testid="summary-eyebrow-allowlist-number">
            Season {s.season + 1} · Final review
          </span>
        }
        title={isUserChampion ? "Champions" : "Season review"}
        subtitle={s.narrative}
      />

      {/* Champion hero */}
      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card eyebrow="Champion" className="lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <span
              data-testid="player-facing"
              className="font-serif text-3xl text-parchment-900"
            >
              {s.champion.clubName}
            </span>
            <span
              data-testid="summary-champion-pts-allowlist-number"
              className="font-mono text-2xl tabular-nums text-parchment-900"
            >
              {s.champion.points} <span className="text-sm text-parchment-500">pts</span>
            </span>
          </div>
          {s.champion.clubId !== myClubId && s.userFinish && (
            <p className="mt-3 text-parchment-600">
              You finished{" "}
              <span
                data-testid="summary-user-pos-allowlist-number"
                className="font-mono tabular-nums text-parchment-900"
              >
                {ordinal(s.userFinish.position)}
              </span>{" "}
              with{" "}
              <span
                data-testid="summary-user-pts-allowlist-number"
                className="font-mono tabular-nums"
              >
                {s.userFinish.points}
              </span>{" "}
              points.
            </p>
          )}
        </Card>

        {/* Wooden spoon */}
        <Card eyebrow="Wooden spoon">
          <div className="font-serif text-lg text-parchment-900">
            <span data-testid="player-facing">{s.woodenSpoon.clubName}</span>
          </div>
          <div
            data-testid="summary-spoon-pts-allowlist-number"
            className="mt-1 font-mono text-sm tabular-nums text-parchment-500"
          >
            {s.woodenSpoon.points} pts
          </div>
        </Card>
      </section>

      {/* Golden boot */}
      {s.topScorer && (
        <section className="mt-4">
          <Card eyebrow="Golden boot">
            <div className="flex items-baseline justify-between">
              <button
                type="button"
                onClick={() => modal.open(s.topScorer!.player_id)}
                className="text-left font-serif text-2xl text-parchment-900 hover:text-moss-700"
              >
                <span data-testid="player-facing">{s.topScorer.player_name}</span>
              </button>
              <div className="flex items-baseline gap-4 text-parchment-600">
                <span className="text-xs uppercase tracking-wide">
                  <span data-testid="player-facing">{s.topScorer.club_name}</span>
                </span>
                <span
                  data-testid="summary-scorer-goals-allowlist-number"
                  className="font-mono text-2xl tabular-nums text-parchment-900"
                >
                  {s.topScorer.goals}
                </span>
                <span className="text-xs uppercase tracking-wide text-parchment-500">goals</span>
              </div>
            </div>
            {s.topScorer.assists > 0 && (
              <div className="mt-1 text-xs uppercase tracking-wide text-parchment-500">
                + {" "}
                <span
                  data-testid="summary-scorer-assists-allowlist-number"
                  className="font-mono tabular-nums"
                >
                  {s.topScorer.assists}
                </span>{" "}
                assists
              </div>
            )}
          </Card>
        </section>
      )}

      {/* Full final table */}
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
                <th className="px-3 py-2">P</th>
                <th className="px-3 py-2">W</th>
                <th className="px-3 py-2">D</th>
                <th className="px-3 py-2">L</th>
                <th className="px-3 py-2">GF</th>
                <th className="px-3 py-2">GA</th>
                <th className="px-3 py-2">GD</th>
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
                      data-testid={`summary-row-${i}-pos-allowlist-number`}
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
                      data-testid={`summary-row-${i}-p-allowlist-number`}
                      className="px-3 py-2 font-mono tabular-nums"
                    >
                      {row.played}
                    </td>
                    <td
                      data-testid={`summary-row-${i}-w-allowlist-number`}
                      className="px-3 py-2 font-mono tabular-nums"
                    >
                      {row.won}
                    </td>
                    <td
                      data-testid={`summary-row-${i}-d-allowlist-number`}
                      className="px-3 py-2 font-mono tabular-nums"
                    >
                      {row.drawn}
                    </td>
                    <td
                      data-testid={`summary-row-${i}-l-allowlist-number`}
                      className="px-3 py-2 font-mono tabular-nums"
                    >
                      {row.lost}
                    </td>
                    <td
                      data-testid={`summary-row-${i}-gf-allowlist-number`}
                      className="px-3 py-2 font-mono tabular-nums"
                    >
                      {row.goalsFor}
                    </td>
                    <td
                      data-testid={`summary-row-${i}-ga-allowlist-number`}
                      className="px-3 py-2 font-mono tabular-nums"
                    >
                      {row.goalsAgainst}
                    </td>
                    <td
                      data-testid={`summary-row-${i}-gd-allowlist-number`}
                      className="px-3 py-2 font-mono tabular-nums"
                    >
                      {row.goalDifference > 0 ? "+" : ""}
                      {row.goalDifference}
                    </td>
                    <td
                      data-testid={`summary-row-${i}-pts-allowlist-number`}
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

      {/* Rollover CTA */}
      <div className="mt-10 flex items-center gap-4 border-t border-parchment-300 pt-6">
        <Link
          to="/"
          className="border border-moss-600 bg-moss-500 px-5 py-2 font-sans text-sm font-semibold uppercase tracking-wide text-parchment-50 hover:bg-moss-600"
        >
          Start the next season
        </Link>
        <Link
          to="/league"
          className="text-xs uppercase tracking-wide text-parchment-500 underline hover:text-parchment-900"
        >
          Back to the league
        </Link>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
