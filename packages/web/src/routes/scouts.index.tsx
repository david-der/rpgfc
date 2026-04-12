// /scouts — Scouting rework (Story 07+).
//
// Scouting is a search/filter tool over all players — not an
// assignment-and-wait system. The user can search by name, filter by
// on-the-market status, position, experience tier, and club. Each
// result row links to the player profile and (if listed) to the
// transfer bid page.
//
// The "Scouts" nav entry stays — it's the search lens. The /players
// page is the owned-roster lens; this page is the "find someone new"
// lens.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { CertaintyText } from "../components/ui/CertaintyText";
import { SectionHeader } from "../components/ui/SectionHeader";
import { fetchPlayers } from "../lib/api";

export const Route = createFileRoute("/scouts/")({
  component: ScoutingSearch,
});

const POSITION_OPTIONS = ["GK", "CB", "LB", "RB", "DM", "CM", "AM", "LW", "RW", "ST"];

function ScoutingSearch() {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [onMarket, setOnMarket] = useState(false);

  const query = useQuery({
    queryKey: ["scouting-search", { search, position, onMarket }],
    queryFn: () => {
      const params: {
        limit: number;
        search?: string;
        position?: string;
        onMarket?: boolean;
      } = { limit: 100 };
      if (search) params.search = search;
      if (position) params.position = position;
      if (onMarket) params.onMarket = true;
      return fetchPlayers(params);
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <SectionHeader eyebrow="Intelligence" title="Scouting" />

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex-1">
          <div className="text-xs uppercase tracking-wide text-parchment-500">Search by name</div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Player name…"
            className="mt-1 w-full border border-parchment-400 bg-parchment-50 px-3 py-2 font-sans text-sm text-parchment-900 placeholder:text-parchment-400"
          />
        </label>
        <label>
          <div className="text-xs uppercase tracking-wide text-parchment-500">Position</div>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="mt-1 border border-parchment-400 bg-parchment-50 px-3 py-2 font-sans text-sm text-parchment-900"
          >
            <option value="">All positions</option>
            {POSITION_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={onMarket}
            onChange={(e) => setOnMarket(e.target.checked)}
            className="h-4 w-4 border-parchment-400 text-moss-600"
          />
          <span className="text-xs uppercase tracking-wide text-parchment-500">On the market</span>
        </label>
      </div>

      {/* Results */}
      <section className="mt-8">
        {query.isPending && <p className="text-parchment-600">Searching…</p>}
        {query.isError && (
          <p className="text-semantic-error">Could not load players.</p>
        )}
        {query.data && (
          <>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
              Results ({query.data.items.length})
            </h2>
            <div className="divide-y divide-parchment-200 border border-parchment-300 bg-parchment-100">
              {query.data.items.length === 0 && (
                <p className="p-6 text-sm italic text-parchment-500">
                  No players match your filters.
                </p>
              )}
              {query.data.items.map((player) => (
                <div
                  key={player.id}
                  className="flex items-start justify-between gap-4 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-wide text-parchment-500">
                      {player.positionLabel} · {player.nationality}
                      {player.club && <> · {player.club.name}</>}
                    </div>
                    <Link
                      to="/players/$id"
                      params={{ id: String(player.id) }}
                      className="mt-1 block font-serif text-lg text-parchment-900 hover:text-moss-700"
                    >
                      <span data-testid="player-facing">{player.name}</span>
                    </Link>
                    <div className="mt-1 flex items-center gap-3 text-xs text-parchment-500">
                      <CertaintyText certainty={player.certainty}>
                        {player.certainty}
                      </CertaintyText>
                      <span>·</span>
                      <span>{player.experience}</span>
                      {player.formTier && (
                        <>
                          <span>·</span>
                          <span>Form: {player.formTierLabel}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1">
                    <Link
                      to="/players/$id"
                      params={{ id: String(player.id) }}
                      className="border border-parchment-400 bg-parchment-50 px-3 py-1 font-sans text-xs font-medium uppercase tracking-wide text-parchment-700 hover:border-parchment-700"
                    >
                      Profile
                    </Link>
                    <Link
                      to="/transfers/$playerId"
                      params={{ playerId: String(player.id) }}
                      className="border border-moss-500 bg-parchment-50 px-3 py-1 font-sans text-xs font-medium uppercase tracking-wide text-moss-700 hover:bg-moss-50"
                    >
                      Transfer
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
