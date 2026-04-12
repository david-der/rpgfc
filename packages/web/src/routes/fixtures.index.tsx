// /fixtures — Story 06 List archetype.
//
// Matchday-grouped FixtureCard list. The active matchday header
// carries the global Advance affordance — a single Editor-style
// action button on a List page is acceptable for global mutations
// (Style Guide §10.2 footnote).

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { FixtureCard } from "../components/ui/FixtureCard";
import { SectionHeader } from "../components/ui/SectionHeader";
import { advanceMatchday, fetchFixtures } from "../lib/api";

export const Route = createFileRoute("/fixtures/")({
  component: FixturesList,
});

function FixturesList() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["fixtures"],
    queryFn: fetchFixtures,
  });

  const advanceMutation = useMutation({
    mutationFn: advanceMatchday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixtures"] });
    },
  });

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-parchment-600">Loading fixtures…</p>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-semantic-error">Could not load fixtures.</p>
      </div>
    );
  }

  const { matchdays, nextMatchday } = query.data;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <SectionHeader eyebrow="Story 06" title="Fixtures" />

      <div className="mt-8 space-y-8">
        {matchdays.map((md) => {
          const isNext = nextMatchday === md.matchday;
          return (
            <section key={md.matchday}>
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-medium uppercase tracking-wide text-parchment-500">
                  Matchday{" "}
                  <span
                    data-testid="matchday-allowlist-number"
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
                    {advanceMutation.isPending ? "Simulating…" : "Advance to next matchday"}
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
          <p className="text-sm italic text-parchment-500">
            Every fixture in the half-season has been played. Story 07 will let you start a
            new season.
          </p>
        )}
      </div>
    </div>
  );
}
