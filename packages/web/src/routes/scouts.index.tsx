// /scouts — Full player search and filter.
//
// The primary "find someone" tool. Filters across every visible
// attribute: name, position, nationality, club, experience tier,
// certainty, form tier, badge category, on-the-market status. Results
// link to player profiles and transfer bids.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  BADGE_CATEGORIES,
  CERTAINTY_TIERS,
  EXPERIENCE_TIERS,
  FORM_TIERS,
} from "@rpgfc/shared";

import { usePlayerModal } from "../components/PlayerModalProvider";
import { BadgeChip } from "../components/ui/BadgeChip";
import { CertaintyText } from "../components/ui/CertaintyText";
import { SectionHeader } from "../components/ui/SectionHeader";
import { addToWatchlist, fetchPlayers } from "../lib/api";

export const Route = createFileRoute("/scouts/")({
  component: ScoutingSearch,
});

const POSITIONS = ["GK", "CB", "LB", "RB", "DM", "CM", "AM", "LW", "RW", "ST"];

type PlayerItem = Awaited<ReturnType<typeof fetchPlayers>>["items"][number];

function ScoutingSearch() {
  const modal = usePlayerModal();
  const queryClient = useQueryClient();
  const watchMutation = useMutation({
    mutationFn: addToWatchlist,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [nationality, setNationality] = useState("");
  const [club, setClub] = useState("");
  const [experience, setExperience] = useState("");
  const [certainty, setCertainty] = useState("");
  const [form, setForm] = useState("");
  const [badgeCategory, setBadgeCategory] = useState("");
  const [onMarket, setOnMarket] = useState(false);
  const [preferredFoot, setPreferredFoot] = useState("");

  // Fetch a large page — full database is 400 players, client-side
  // filtering is fast and gives instant feedback as filters change.
  const query = useQuery({
    queryKey: ["scouting-search"],
    queryFn: () => fetchPlayers({ limit: 100 }),
    staleTime: 30_000,
  });

  // Derive unique clubs + nationalities from the data for filter options.
  const clubs = useMemo(() => {
    if (!query.data) return [];
    const set = new Set<string>();
    for (const p of query.data.items) {
      if (p.club) set.add(p.club.name);
    }
    return [...set].sort();
  }, [query.data]);

  const nationalities = useMemo(() => {
    if (!query.data) return [];
    const set = new Set<string>();
    for (const p of query.data.items) set.add(p.nationality);
    return [...set].sort();
  }, [query.data]);

  // Client-side filtering for instant response.
  const filtered = useMemo(() => {
    if (!query.data) return [];
    let items: PlayerItem[] = query.data.items;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (position) {
      items = items.filter((p) => p.positionLabel === position);
    }
    if (nationality) {
      items = items.filter((p) => p.nationality === nationality);
    }
    if (club) {
      items = items.filter((p) => p.club?.name === club);
    }
    if (experience) {
      items = items.filter((p) => p.experience === experience);
    }
    if (certainty) {
      items = items.filter((p) => p.certainty === certainty);
    }
    if (form) {
      items = items.filter((p) => p.formTier === form);
    }
    if (badgeCategory) {
      items = items.filter((p) =>
        p.badges.some((b) => b.category === badgeCategory),
      );
    }
    if (preferredFoot) {
      items = items.filter((p) => p.preferredFoot === preferredFoot);
    }
    if (onMarket) {
      // On-market filter was implemented server-side; for now we
      // surface it as a UI hint. A proper filter would need the
      // listings data joined — for now all players show.
      // TODO: wire server-side onMarket filter when paginating.
    }
    return items;
  }, [
    query.data,
    search,
    position,
    nationality,
    club,
    experience,
    certainty,
    form,
    badgeCategory,
    preferredFoot,
    onMarket,
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <SectionHeader eyebrow="Intelligence" title="Scouting" />

      {/* Filter grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
        <label className="col-span-2">
          <div className="text-xs uppercase tracking-wide text-parchment-500">Name</div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="mt-1 w-full border border-parchment-400 bg-parchment-50 px-3 py-2 font-sans text-sm text-parchment-900 placeholder:text-parchment-400"
          />
        </label>

        <FilterSelect label="Position" value={position} onChange={setPosition} options={POSITIONS} />
        <FilterSelect label="Nationality" value={nationality} onChange={setNationality} options={nationalities} />
        <FilterSelect label="Club" value={club} onChange={setClub} options={clubs} />
        <FilterSelect
          label="Experience"
          value={experience}
          onChange={setExperience}
          options={EXPERIENCE_TIERS as unknown as string[]}
        />
        <FilterSelect
          label="Certainty"
          value={certainty}
          onChange={setCertainty}
          options={CERTAINTY_TIERS as unknown as string[]}
        />
        <FilterSelect
          label="Form"
          value={form}
          onChange={setForm}
          options={FORM_TIERS as unknown as string[]}
        />
        <FilterSelect
          label="Badge type"
          value={badgeCategory}
          onChange={setBadgeCategory}
          options={BADGE_CATEGORIES as unknown as string[]}
        />
        <FilterSelect
          label="Foot"
          value={preferredFoot}
          onChange={setPreferredFoot}
          options={["Left", "Right", "Both"]}
        />
      </div>

      {/* Result count + clear */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-parchment-500">
          {filtered.length} player{filtered.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setPosition("");
            setNationality("");
            setClub("");
            setExperience("");
            setCertainty("");
            setForm("");
            setBadgeCategory("");
            setPreferredFoot("");
            setOnMarket(false);
          }}
          className="text-xs uppercase tracking-wide text-parchment-500 hover:text-parchment-900"
        >
          Clear all filters
        </button>
      </div>

      {/* Results table */}
      <section className="mt-4">
        {query.isPending && <p className="text-parchment-600">Loading…</p>}
        {query.isError && <p className="text-semantic-error">Could not load players.</p>}
        {query.data && (
          <div className="overflow-x-auto border border-parchment-300">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-parchment-300 bg-parchment-100 text-xs uppercase tracking-wide text-parchment-500">
                  <th className="px-4 py-3">Player</th>
                  <th className="px-3 py-3">Pos</th>
                  <th className="hidden px-3 py-3 md:table-cell">Club</th>
                  <th className="hidden px-3 py-3 lg:table-cell">Nat</th>
                  <th className="px-3 py-3">Value</th>
                  <th className="px-3 py-3">Experience</th>
                  <th className="hidden px-3 py-3 md:table-cell">Certainty</th>
                  <th className="hidden px-3 py-3 lg:table-cell">Form</th>
                  <th className="hidden px-3 py-3 lg:table-cell">Badges</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-parchment-200 bg-parchment-50">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-6 text-center italic text-parchment-500">
                      No players match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((player) => (
                  <tr key={player.id} className="hover:bg-parchment-100">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => modal.open(player.id)}
                        className="text-left font-serif text-base text-parchment-900 hover:text-moss-700"
                      >
                        <span data-testid="player-facing">{player.name}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-parchment-700">
                      {player.positionLabel}
                    </td>
                    <td className="hidden px-3 py-3 text-parchment-700 md:table-cell">
                      {player.club?.name ?? "Free"}
                    </td>
                    <td className="hidden px-3 py-3 text-parchment-700 lg:table-cell">
                      {player.nationality}
                    </td>
                    <td className="px-3 py-3 text-xs font-medium text-parchment-700">
                      {player.marketValue ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-parchment-700">{player.experience}</td>
                    <td className="hidden px-3 py-3 md:table-cell">
                      <CertaintyText certainty={player.certainty}>
                        {player.certainty}
                      </CertaintyText>
                    </td>
                    <td className="hidden px-3 py-3 text-parchment-700 lg:table-cell">
                      {player.formTierLabel ?? "—"}
                    </td>
                    <td className="hidden px-3 py-3 lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {player.badges.slice(0, 3).map((b) => (
                          <BadgeChip key={b.key} badge={b} />
                        ))}
                        {player.badges.length > 3 && (
                          <span className="text-xs text-parchment-500">
                            +{player.badges.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        {/* User club id is hardcoded to 1 until auth lands.
                            Can't bid on your own players. */}
                        {player.club?.id !== 1 && (
                          <Link
                            to="/transfers/$playerId"
                            params={{ playerId: String(player.id) }}
                            className="border border-moss-500 bg-parchment-50 px-2 py-1 font-sans text-xs font-medium uppercase tracking-wide text-moss-700 hover:bg-moss-50"
                          >
                            Bid
                          </Link>
                        )}
                        {player.club?.id !== 1 && (
                          <button
                            type="button"
                            onClick={() => watchMutation.mutate(player.id)}
                            disabled={watchMutation.isPending}
                            className="border border-parchment-400 bg-parchment-50 px-2 py-1 font-sans text-xs text-parchment-600 hover:border-parchment-700 hover:text-parchment-900"
                          >
                            Watch
                          </button>
                        )}
                        {player.club?.id === 1 && (
                          <span className="text-xs italic text-parchment-500">Your player</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label>
      <div className="text-xs uppercase tracking-wide text-parchment-500">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-parchment-400 bg-parchment-50 px-2 py-2 font-sans text-sm text-parchment-900"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
