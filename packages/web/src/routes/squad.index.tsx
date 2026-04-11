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

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <SectionHeader eyebrow="Story 05" title="Squad" />

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
                      <div className="min-w-0 flex-1">
                        <div className="text-xs uppercase tracking-wide text-parchment-500">
                          {entry.positionLabel}
                          {entry.archetypeLabel && <> · {entry.archetypeLabel}</>}
                        </div>
                        <div
                          data-testid="player-facing"
                          className="mt-1 font-serif text-lg text-parchment-900"
                        >
                          {entry.playerName}
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
