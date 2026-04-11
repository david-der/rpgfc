// /players — the List archetype (Style Guide §10.2).
// A column of PlayerIdentityCard rows. The filter bar and right-hand
// Inspector land in later stories; Story 01 keeps this minimal to match
// the story's "no scope creep" discipline.

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PlayerIdentityCard } from "../components/ui/PlayerIdentityCard";
import { SectionHeader } from "../components/ui/SectionHeader";
import { fetchPlayers } from "../lib/api";

export const Route = createFileRoute("/players/")({
  component: PlayersList,
});

function PlayersList() {
  const query = useQuery({
    queryKey: ["players", { limit: 40 }],
    queryFn: () => fetchPlayers({ limit: 40 }),
  });

  return (
    // <main> is provided by the AppShell; this route renders a plain div.
    <div className="mx-auto max-w-5xl px-6 py-10">
      <SectionHeader eyebrow="Story 01" title="Players" />
      <section className="mt-8 space-y-4">
        {query.isPending && <p className="text-parchment-600">Loading roster…</p>}
        {query.isError && (
          <p className="text-semantic-error">
            Could not load the player list. Is the backend running?
          </p>
        )}
        {query.data?.items.map((player) => (
          <PlayerIdentityCard key={player.id} player={player} />
        ))}
      </section>
    </div>
  );
}
