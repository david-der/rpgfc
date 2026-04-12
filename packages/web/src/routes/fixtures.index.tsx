// /fixtures — Story 06/07 List archetype.
//
// Match-week-grouped FixtureCard list. The active match week header
// carries the Advance affordance. A collapsible league table section
// sits below the fixture list. Season header reads "Season N".
// No calendar dates anywhere — time is (Season N, Match Week M).

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { FixtureCard } from "../components/ui/FixtureCard";
import { SectionHeader } from "../components/ui/SectionHeader";
import {
  advanceMatchday,
  endSeason,
  fetchFixtures,
  fetchLeagueTable,
  fetchSeasonState,
} from "../lib/api";

export const Route = createFileRoute("/fixtures/")({
  component: FixturesList,
});

function FixturesList() {
  const queryClient = useQueryClient();
  const fixturesQuery = useQuery({
    queryKey: ["fixtures"],
    queryFn: fetchFixtures,
  });
  const stateQuery = useQuery({
    queryKey: ["season-state"],
    queryFn: fetchSeasonState,
  });
  const tableQuery = useQuery({
    queryKey: ["league-table"],
    queryFn: fetchLeagueTable,
  });

  const advanceMutation = useMutation({
    mutationFn: advanceMatchday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixtures"] });
      queryClient.invalidateQueries({ queryKey: ["season-state"] });
      queryClient.invalidateQueries({ queryKey: ["league-table"] });
    },
  });

  const endSeasonMutation = useMutation({
    mutationFn: endSeason,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixtures"] });
      queryClient.invalidateQueries({ queryKey: ["season-state"] });
      queryClient.invalidateQueries({ queryKey: ["league-table"] });
    },
  });

  if (fixturesQuery.isPending || stateQuery.isPending) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-parchment-600">Loading fixtures…</p>
      </div>
    );
  }
  if (fixturesQuery.isError || !fixturesQuery.data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-semantic-error">Could not load fixtures.</p>
      </div>
    );
  }

  const { matchdays, nextMatchday } = fixturesQuery.data;
  const season = stateQuery.data?.season ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <SectionHeader
        eyebrow={
          <>
            Season{" "}
            <span
              data-testid="season-allowlist-number"
              className="font-mono tabular-nums text-parchment-700"
            >
              {season}
            </span>
          </>
        }
        title="Fixtures"
      />

      {/* League table */}
      {tableQuery.data?.table && tableQuery.data.table.length > 0 && (
        <details className="mt-6 border border-parchment-300 bg-parchment-100 px-6 py-4">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-parchment-500">
            League table
          </summary>
          <table className="mt-4 w-full text-left font-mono text-xs tabular-nums">
            <thead>
              <tr className="border-b border-parchment-300 text-parchment-500">
                <th className="pb-2 pr-2">#</th>
                <th className="pb-2 pr-4 font-sans">Club</th>
                <th className="pb-2 pr-2">P</th>
                <th className="pb-2 pr-2">W</th>
                <th className="pb-2 pr-2">D</th>
                <th className="pb-2 pr-2">L</th>
                <th className="pb-2 pr-2">GF</th>
                <th className="pb-2 pr-2">GA</th>
                <th className="pb-2 pr-2">GD</th>
                <th className="pb-2">Pts</th>
              </tr>
            </thead>
            <tbody>
              {tableQuery.data.table.map((row, idx) => (
                <tr
                  key={row.clubId}
                  className="border-b border-parchment-200 last:border-b-0"
                >
                  <td
                    data-testid="league-table-allowlist-number"
                    className="py-1 pr-2 text-parchment-500"
                  >
                    {idx + 1}
                  </td>
                  <td className="py-1 pr-4 font-sans text-parchment-900">{row.clubName}</td>
                  <td data-testid="league-table-allowlist-number" className="py-1 pr-2">
                    {row.played}
                  </td>
                  <td data-testid="league-table-allowlist-number" className="py-1 pr-2">
                    {row.won}
                  </td>
                  <td data-testid="league-table-allowlist-number" className="py-1 pr-2">
                    {row.drawn}
                  </td>
                  <td data-testid="league-table-allowlist-number" className="py-1 pr-2">
                    {row.lost}
                  </td>
                  <td data-testid="league-table-allowlist-number" className="py-1 pr-2">
                    {row.goalsFor}
                  </td>
                  <td data-testid="league-table-allowlist-number" className="py-1 pr-2">
                    {row.goalsAgainst}
                  </td>
                  <td data-testid="league-table-allowlist-number" className="py-1 pr-2">
                    {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                  </td>
                  <td
                    data-testid="league-table-allowlist-number"
                    className="py-1 font-semibold text-parchment-900"
                  >
                    {row.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <div className="mt-8 space-y-8">
        {matchdays.map((md) => {
          const isNext = nextMatchday === md.matchday;
          return (
            <section key={md.matchday}>
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-medium uppercase tracking-wide text-parchment-500">
                  Match Week{" "}
                  <span
                    data-testid="match-week-allowlist-number"
                    className="font-mono tabular-nums text-parchment-700"
                  >
                    {md.matchday}
                  </span>
                </h2>
                {isNext && (
                  <button
                    type="button"
                    data-testid="advance-matchday"
                    onClick={() => advanceMutation.mutate()}
                    disabled={advanceMutation.isPending}
                    className="border border-moss-600 bg-moss-500 px-4 py-2 font-sans text-xs font-semibold uppercase tracking-wide text-parchment-50 outline-offset-2 transition-colors hover:bg-moss-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {advanceMutation.isPending ? "Simulating…" : "Advance to next match week"}
                  </button>
                )}
              </header>
              <div className="space-y-2">
                {md.fixtures.map((fixture) => (
                  <FixtureCard key={fixture.id} fixture={fixture} />
                ))}
              </div>
            </section>
          );
        })}

        {nextMatchday === null && (
          <div className="space-y-4">
            <p className="text-sm italic text-parchment-500">
              Every fixture in the season has been played.
            </p>
            <button
              type="button"
              data-testid="end-season"
              onClick={() => endSeasonMutation.mutate()}
              disabled={endSeasonMutation.isPending}
              className="border border-moss-600 bg-moss-500 px-4 py-2 font-sans text-sm font-semibold uppercase tracking-wide text-parchment-50 hover:bg-moss-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {endSeasonMutation.isPending ? "Ending season…" : "End season and start next"}
            </button>
            {endSeasonMutation.data && (
              <div className="border border-parchment-300 bg-parchment-50 p-4">
                <p data-testid="player-facing" className="font-serif text-base text-parchment-800">
                  {endSeasonMutation.data.narrative}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
