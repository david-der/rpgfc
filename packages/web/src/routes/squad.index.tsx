// /squad — Story 05 List archetype.
//
// Main column: players grouped by position bucket (GK/DEF/MID/FWD).
// Within each bucket sorted by squad-role tier. Right inspector:
// Harmony + watch list.

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";

import type { PromiseMood, SquadRole } from "@rpgfc/shared";

import { usePlayerModal } from "../components/PlayerModalProvider";
import { HarmonyChip } from "../components/ui/HarmonyChip";
import { PlayerAvatar } from "../components/ui/PlayerAvatar";
import { RatingSparkline } from "../components/ui/RatingSparkline";
import { SectionHeader } from "../components/ui/SectionHeader";
import { SquadRoleSelect } from "../components/ui/SquadRoleSelect";
import { fetchSquad, setSquadRole } from "../lib/api";

export const Route = createFileRoute("/squad/")({
  component: SquadList,
});

type SquadResponse = Awaited<ReturnType<typeof fetchSquad>>;
type SquadEntry = SquadResponse["entries"][number];

type PositionBucket = "GK" | "DEF" | "MID" | "FWD";

const BUCKET_LABELS: Record<PositionBucket, string> = {
  GK: "Goalkeepers",
  DEF: "Defenders",
  MID: "Midfielders",
  FWD: "Forwards",
};

const BUCKET_ORDER: PositionBucket[] = ["GK", "DEF", "MID", "FWD"];

function bucketFor(positionLabel: string): PositionBucket {
  const p = positionLabel.toUpperCase();
  if (p === "GK") return "GK";
  if (p === "CB" || p === "FB" || p === "LB" || p === "RB" || p === "WB") return "DEF";
  if (p === "DM" || p === "CM" || p === "AM" || p === "MC") return "MID";
  return "FWD";
}

const ROLE_SORT: Record<SquadRole, number> = {
  Starter: 0,
  Rotation: 1,
  Backup: 2,
  Youth: 3,
};

const MOOD_ORDER: Record<PromiseMood, number> = {
  Furious: 0,
  Disappointed: 1,
  Concerned: 2,
  Content: 3,
  Eager: 4,
};

function SquadList() {
  const queryClient = useQueryClient();
  const modal = usePlayerModal();
  const query = useQuery({
    queryKey: ["squad"],
    queryFn: fetchSquad,
  });

  const roleMutation = useMutation({
    mutationFn: ({ playerId, role }: { playerId: number; role: SquadRole }) =>
      setSquadRole(playerId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["squad"] });
      queryClient.invalidateQueries({ queryKey: ["tactics"] });
    },
  });

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-parchment-600">Loading the squad…</p>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-semantic-error">Could not load the squad.</p>
      </div>
    );
  }

  const squad: SquadResponse = query.data;

  const grouped = new Map<PositionBucket, SquadEntry[]>();
  for (const bucket of BUCKET_ORDER) grouped.set(bucket, []);
  for (const entry of squad.entries) {
    grouped.get(bucketFor(entry.positionLabel))?.push(entry);
  }
  // Sort each bucket: primary position, then squad-role tier.
  for (const bucket of BUCKET_ORDER) {
    const rows = grouped.get(bucket) ?? [];
    rows.sort((a, b) => {
      if (a.positionLabel !== b.positionLabel) {
        return a.positionLabel.localeCompare(b.positionLabel);
      }
      return ROLE_SORT[a.role as SquadRole] - ROLE_SORT[b.role as SquadRole];
    });
  }

  const worstMoods = [...squad.entries]
    .filter((e) => e.promiseMood !== null)
    .sort(
      (a, b) =>
        MOOD_ORDER[a.promiseMood as PromiseMood] - MOOD_ORDER[b.promiseMood as PromiseMood],
    )
    .slice(0, 3);

  const newArrivals = squad.entries.filter((e) => e.isNewArrival);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <SectionHeader eyebrow="Story 05" title="Squad" />

      {newArrivals.length > 0 && (
        <section
          data-testid="squad-new-arrivals"
          className="mt-6 border border-moss-500 bg-parchment-50 p-4"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-moss-700">
            New arrivals this season
          </div>
          <p className="mt-1 font-serif text-base text-parchment-900">
            <span
              data-testid="squad-new-arrivals-count-allowlist-number"
              className="font-mono tabular-nums"
            >
              {newArrivals.length}
            </span>{" "}
            youth player{newArrivals.length === 1 ? "" : "s"} joined your academy:
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-parchment-700">
            {newArrivals.map((e) => (
              <li key={e.playerId} data-testid="player-facing">
                {e.playerName}{" "}
                <span className="text-xs text-parchment-500">({e.positionLabel})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 grid gap-8 md:grid-cols-[2fr_1fr]">
        <section className="space-y-6">
          {BUCKET_ORDER.map((bucket) => {
            const rows = grouped.get(bucket) ?? [];
            if (rows.length === 0) return null;
            return (
              <section key={bucket} data-testid={`squad-bucket-${bucket.toLowerCase()}`}>
                <header className="mb-2 flex items-baseline justify-between border-b border-parchment-300 pb-1">
                  <h2 className="font-serif text-lg text-parchment-900">
                    {BUCKET_LABELS[bucket]}
                  </h2>
                  <span
                    data-testid={`squad-bucket-${bucket.toLowerCase()}-count-allowlist-number`}
                    className="font-mono text-xs uppercase tracking-wide tabular-nums text-parchment-500"
                  >
                    {rows.length}
                  </span>
                </header>
                <div className="divide-y divide-parchment-200 border border-parchment-300 bg-parchment-100">
                  {rows.map((entry) => (
                    <SquadRow
                      key={entry.playerId}
                      entry={entry}
                      onOpen={() => modal.open(entry.playerId)}
                      onRoleChange={(nextRole) =>
                        roleMutation.mutate({ playerId: entry.playerId, role: nextRole })
                      }
                      disabled={roleMutation.isPending}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </section>

        {/* Right inspector */}
        <aside className="space-y-4">
          <div className="border border-parchment-300 bg-parchment-100 p-6">
            <h2 className="text-xs font-medium uppercase tracking-wide text-parchment-500">
              Harmony
            </h2>
            <div className="mt-3" data-testid="harmony-chip">
              <HarmonyChip harmony={squad.harmony} label={squad.harmonyLabel} />
            </div>
          </div>
          {worstMoods.length > 0 && (
            <div className="border border-parchment-300 bg-parchment-50 p-6">
              <h2 className="text-xs font-medium uppercase tracking-wide text-parchment-500">
                Watch list
              </h2>
              <ul className="mt-3 space-y-3">
                {worstMoods.map((entry) => (
                  <li key={entry.playerId}>
                    <div
                      data-testid="player-facing"
                      className="font-serif text-sm text-parchment-900"
                    >
                      {entry.playerName}
                    </div>
                    {entry.promiseMoodLabel && (
                      <div
                        data-testid="player-facing"
                        className="text-xs italic text-parchment-600"
                      >
                        {entry.promiseMoodLabel}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SquadRow({
  entry,
  onOpen,
  onRoleChange,
  disabled,
}: {
  entry: SquadEntry;
  onOpen: () => void;
  onRoleChange: (role: SquadRole) => void;
  disabled: boolean;
}) {
  const isFreeAgent = entry.seasonsRemaining === null;
  const showNudge =
    entry.role !== "Youth" &&
    entry.matchesSinceLastStart !== null &&
    entry.matchesSinceLastStart >= 3;

  return (
    <div
      data-testid="squad-row"
      className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 p-4"
    >
      <PlayerAvatar playerId={entry.playerId} size={48} />

      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-parchment-500">
          {entry.positionLabel}
          {entry.archetypeLabel && <> · {entry.archetypeLabel}</>}
          {entry.isNewArrival && (
            <span className="ml-2 border border-moss-600 bg-parchment-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss-700">
              New arrival
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <button
            type="button"
            data-testid="player-facing"
            onClick={onOpen}
            className="text-left font-serif text-lg text-parchment-900 hover:text-moss-700"
          >
            {entry.playerName}
          </button>
          <span
            data-testid="squad-age-allowlist-number"
            className="font-mono text-xs tabular-nums text-parchment-600"
          >
            {entry.age}
          </span>
          <RatingSparkline ratings={entry.last5Ratings} size={10} />
        </div>
        {showNudge && (
          <div className="mt-1 text-xs italic text-parchment-600">
            Hasn&rsquo;t started in a while
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 text-xs">
        {isFreeAgent ? (
          <span className="italic text-parchment-500">Free agent</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-parchment-700">
            <Clock size={12} strokeWidth={1.5} className="text-parchment-500" />
            <span
              data-testid="squad-contract-years-allowlist-number"
              className="font-mono tabular-nums font-semibold text-parchment-900"
            >
              {entry.seasonsRemaining}
            </span>
            <span className="text-parchment-500">
              {entry.seasonsRemaining === 1 ? "season" : "seasons"}
            </span>
          </span>
        )}
        {entry.wageTier && (
          <span className="border border-parchment-300 bg-parchment-50 px-2 py-0.5 uppercase tracking-wide text-parchment-700">
            {entry.wageTier}
          </span>
        )}
      </div>

      <div className="flex-none">
        <SquadRoleSelect
          value={entry.role as SquadRole}
          disabled={disabled}
          testId={`squad-role-select-${entry.playerId}`}
          onChange={onRoleChange}
        />
      </div>
    </div>
  );
}
