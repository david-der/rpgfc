// /squad — Story 05 List archetype.
//
// Main column: players grouped by SquadRole with name + position +
// promise-mood chip per row. Right inspector: HarmonyChip + the
// three worst-affected players by mood (Fractured / Uneasy call-outs).

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PromiseMood, SquadRole } from "@rpgfc/shared";
import { SQUAD_ROLES } from "@rpgfc/shared";

import { HarmonyChip } from "../components/ui/HarmonyChip";
import { PlayerAvatar } from "../components/ui/PlayerAvatar";
import { PromiseMoodChip } from "../components/ui/PromiseMoodChip";
import { SectionHeader } from "../components/ui/SectionHeader";
import { SquadRoleSelect } from "../components/ui/SquadRoleSelect";
import { fetchSquad, setSquadRole } from "../lib/api";

export const Route = createFileRoute("/squad/")({
  component: SquadList,
});

type SquadResponse = Awaited<ReturnType<typeof fetchSquad>>;
type SquadEntry = SquadResponse["entries"][number];

const MOOD_ORDER: Record<PromiseMood, number> = {
  Furious: 0,
  Disappointed: 1,
  Concerned: 2,
  Content: 3,
  Eager: 4,
};

// Form tone for the per-row chip. Paired with the tier word so the
// signal reads in grayscale too (Style Guide §2 — color is never
// load-bearing alone).
const FORM_TONE: Record<string, string> = {
  Excellent: "border-form-excellent bg-parchment-50 text-form-excellent",
  Good: "border-form-good bg-parchment-50 text-form-good",
  Average: "border-parchment-500 bg-parchment-50 text-parchment-700",
  Poor: "border-form-poor bg-parchment-50 text-form-poor",
  Dreadful: "border-form-dreadful bg-parchment-50 text-form-dreadful",
};

function SquadList() {
  const queryClient = useQueryClient();
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

  const grouped = new Map<SquadRole, SquadEntry[]>();
  for (const role of SQUAD_ROLES) grouped.set(role, []);
  for (const entry of squad.entries) {
    grouped.get(entry.role as SquadRole)?.push(entry);
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
            <span data-testid="squad-new-arrivals-count-allowlist-number" className="font-mono tabular-nums">
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
        {/* Main column */}
        <section className="space-y-6">
          {SQUAD_ROLES.map((role) => {
            const rows = grouped.get(role) ?? [];
            if (rows.length === 0) return null;
            return (
              <div key={role}>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-parchment-500">
                  {role} ({rows.length})
                </h2>
                <div className="divide-y divide-parchment-200 border border-parchment-300 bg-parchment-100">
                  {rows.map((entry) => (
                    <div
                      key={entry.playerId}
                      data-testid="squad-row"
                      className="flex items-start justify-between gap-4 p-4"
                    >
                      <PlayerAvatar playerId={entry.playerId} size={56} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs uppercase tracking-wide text-parchment-500">
                          {entry.positionLabel}
                          {entry.archetypeLabel && <> · {entry.archetypeLabel}</>}
                          <span className="mx-2 text-parchment-300">·</span>
                          <span
                            data-testid="squad-age-allowlist-number"
                            className="font-mono tabular-nums text-parchment-700"
                          >
                            age {entry.age}
                          </span>
                          {entry.isNewArrival && (
                            <span className="ml-2 border border-moss-600 bg-parchment-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss-700">
                              New arrival
                            </span>
                          )}
                        </div>
                        <div
                          data-testid="player-facing"
                          className="mt-1 font-serif text-lg text-parchment-900"
                        >
                          {entry.playerName}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          {entry.wageTier && (
                            <span className="border border-parchment-300 bg-parchment-50 px-2 py-0.5 uppercase tracking-wide text-parchment-700">
                              Wage:{" "}
                              <span className="font-semibold text-parchment-900">
                                {entry.wageTier}
                              </span>
                            </span>
                          )}
                          {entry.seasonsRemaining !== null && (
                            <span className="border border-parchment-300 bg-parchment-50 px-2 py-0.5 uppercase tracking-wide text-parchment-700">
                              <span
                                data-testid="squad-contract-years-allowlist-number"
                                className="font-mono tabular-nums font-semibold text-parchment-900"
                              >
                                {entry.seasonsRemaining}
                              </span>
                              {" "}
                              {entry.seasonsRemaining === 1 ? "season" : "seasons"} left
                            </span>
                          )}
                          {entry.formTier && (
                            <span
                              className={`border px-2 py-0.5 uppercase tracking-wide ${FORM_TONE[entry.formTier] ?? ""}`}
                            >
                              Form:{" "}
                              <span className="font-semibold">{entry.formTier}</span>
                            </span>
                          )}
                        </div>
                        {entry.promiseMood && entry.promiseMoodLabel && (
                          <div className="mt-3">
                            <PromiseMoodChip
                              mood={entry.promiseMood as PromiseMood}
                              label={entry.promiseMoodLabel}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex-none">
                        <SquadRoleSelect
                          value={entry.role as SquadRole}
                          disabled={roleMutation.isPending}
                          testId={`squad-role-select-${entry.playerId}`}
                          onChange={(nextRole) =>
                            roleMutation.mutate({
                              playerId: entry.playerId,
                              role: nextRole,
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
