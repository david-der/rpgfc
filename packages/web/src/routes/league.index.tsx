// /league — Anchored on the standings table with Fixtures as a
// sub-tab. Clicking any club in the table drills into
// /league/clubs/$clubId.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { FixtureCard } from "../components/ui/FixtureCard";
import { SectionHeader } from "../components/ui/SectionHeader";
import { TabBar, type TabDefinition } from "../components/ui/TabBar";
import {
  advanceMatchday,
  endSeason,
  fetchFixtures,
  fetchLeagueTable,
  fetchSeasonState,
} from "../lib/api";

export const Route = createFileRoute("/league/")({
  component: LeagueDashboard,
});

function LeagueDashboard() {
  const stateQuery = useQuery({ queryKey: ["season-state"], queryFn: fetchSeasonState });
  const season = stateQuery.data?.season ?? 0;

  const tabs: TabDefinition[] = [
    { key: "table", label: "Table", content: <TableTab /> },
    { key: "fixtures", label: "Fixtures", content: <FixturesTab /> },
  ];

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
        title="League"
      />
      <div className="mt-6">
        <TabBar tabs={tabs} />
      </div>
    </div>
  );
}

// ── Table tab ─────────────────────────────────────────────────────────────

function TableTab() {
  const query = useQuery({ queryKey: ["league-table"], queryFn: fetchLeagueTable });

  if (query.isPending) return <p className="text-parchment-600">Loading…</p>;
  if (query.isError) return <p className="text-semantic-error">Could not load the table.</p>;

  const rows = query.data?.table ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-sm italic text-parchment-500">
        No matches played yet. Advance some match weeks to populate the table.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-parchment-300 bg-parchment-50">
      <table className="w-full text-left font-mono text-sm tabular-nums">
        <thead>
          <tr className="border-b border-parchment-300 bg-parchment-100 text-xs uppercase tracking-wide text-parchment-500">
            <th className="px-3 py-3">#</th>
            <th className="px-4 py-3 font-sans">Club</th>
            <th className="px-2 py-3">P</th>
            <th className="px-2 py-3">W</th>
            <th className="px-2 py-3">D</th>
            <th className="px-2 py-3">L</th>
            <th className="px-2 py-3">GF</th>
            <th className="px-2 py-3">GA</th>
            <th className="px-2 py-3">GD</th>
            <th className="px-2 py-3">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.clubId}
              className="border-b border-parchment-200 last:border-b-0 hover:bg-parchment-100"
            >
              <td
                data-testid="league-table-allowlist-number"
                className="px-3 py-2 text-parchment-500"
              >
                {idx + 1}
              </td>
              <td className="px-4 py-2 font-sans">
                <Link
                  to="/league/clubs/$clubId"
                  params={{ clubId: String(row.clubId) }}
                  className="text-parchment-900 hover:text-moss-700"
                >
                  {row.clubName}
                </Link>
              </td>
              <td data-testid="league-table-allowlist-number" className="px-2 py-2">
                {row.played}
              </td>
              <td data-testid="league-table-allowlist-number" className="px-2 py-2">
                {row.won}
              </td>
              <td data-testid="league-table-allowlist-number" className="px-2 py-2">
                {row.drawn}
              </td>
              <td data-testid="league-table-allowlist-number" className="px-2 py-2">
                {row.lost}
              </td>
              <td data-testid="league-table-allowlist-number" className="px-2 py-2">
                {row.goalsFor}
              </td>
              <td data-testid="league-table-allowlist-number" className="px-2 py-2">
                {row.goalsAgainst}
              </td>
              <td data-testid="league-table-allowlist-number" className="px-2 py-2">
                {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
              </td>
              <td
                data-testid="league-table-allowlist-number"
                className="px-2 py-2 font-semibold text-parchment-900"
              >
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Fixtures tab ──────────────────────────────────────────────────────────

function FixturesTab() {
  const queryClient = useQueryClient();
  const fixturesQuery = useQuery({ queryKey: ["fixtures"], queryFn: fetchFixtures });

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

  if (fixturesQuery.isPending) return <p className="text-parchment-600">Loading…</p>;
  if (fixturesQuery.isError || !fixturesQuery.data) {
    return <p className="text-semantic-error">Could not load fixtures.</p>;
  }

  const { matchdays, nextMatchday } = fixturesQuery.data;

  return (
    <div className="space-y-8">
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
                  className="border border-moss-600 bg-moss-500 px-4 py-2 font-sans text-xs font-semibold uppercase tracking-wide text-parchment-50 hover:bg-moss-600 disabled:cursor-not-allowed disabled:opacity-60"
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
  );
}
