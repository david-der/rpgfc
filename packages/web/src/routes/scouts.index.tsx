// /scouts — Story 03 List archetype.
//
// Renders every named scout in the run as a ScoutCard. Story 03 ships
// 4 seed scouts. Filtering and search land in later stories.

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ScoutCard } from "../components/ui/ScoutCard";
import { SectionHeader } from "../components/ui/SectionHeader";
import { fetchScouts } from "../lib/api";

export const Route = createFileRoute("/scouts/")({
  component: ScoutsList,
});

function ScoutsList() {
  const query = useQuery({
    queryKey: ["scouts"],
    queryFn: fetchScouts,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <SectionHeader eyebrow="Story 03" title="Scout network" />
      <section className="mt-8 space-y-4">
        {query.isPending && <p className="text-parchment-600">Loading scouts…</p>}
        {query.isError && <p className="text-semantic-error">Could not load the scout network.</p>}
        {query.data?.items.map((scout) => (
          <ScoutCard key={scout.id} scout={scout} />
        ))}
      </section>
    </div>
  );
}
