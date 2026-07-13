// /tactics — Formation editor with pitch diagram.
//
// Left: a pitch diagram showing the formation with player markers.
// Clicking a marker opens a player picker below the pitch.
// Right: formation, playing style, and instruction controls.
// Bottom: Save / Reset action bar.

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { Formation, PitchSlot, PlayingStyle, TeamInstruction } from "@rpgfc/shared";
import {
  FORMATIONS,
  FORMATION_SLOTS,
  PITCH_SLOT_POSITION_FAMILIES,
  PLAYING_STYLES,
  slotLabelFor,
} from "@rpgfc/shared";

import { InstructionToggleList } from "../components/ui/InstructionToggleList";
import { PitchDiagram, type PitchSlotData } from "../components/ui/PitchDiagram";
import { SectionHeader } from "../components/ui/SectionHeader";
import { fetchSquad, fetchTactics, setTacticsAssignment, updateTactics } from "../lib/api";

export const Route = createFileRoute("/tactics/")({
  component: TacticsEditor,
});

type TacticsResponse = Awaited<ReturnType<typeof fetchTactics>>;
type SquadResponse = Awaited<ReturnType<typeof fetchSquad>>;

function matchesFamily(positionLabel: string, families: readonly string[]): boolean {
  const upper = positionLabel.toUpperCase();
  return families.some((family) => upper.includes(family.toUpperCase()));
}

function TacticsEditor() {
  const queryClient = useQueryClient();

  const tacticsQuery = useQuery({ queryKey: ["tactics"], queryFn: fetchTactics });
  const squadQuery = useQuery({ queryKey: ["squad"], queryFn: fetchSquad });

  const [formation, setFormation] = useState<Formation>("4-3-3");
  const [playingStyle, setPlayingStyle] = useState<PlayingStyle>("Balanced");
  const [instructions, setInstructions] = useState<TeamInstruction[]>([]);
  const [activeSlot, setActiveSlot] = useState<PitchSlot | null>(null);

  useEffect(() => {
    if (!tacticsQuery.data) return;
    setFormation(tacticsQuery.data.formation as Formation);
    setPlayingStyle(tacticsQuery.data.playingStyle as PlayingStyle);
    setInstructions(tacticsQuery.data.instructions as TeamInstruction[]);
  }, [tacticsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: updateTactics,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tactics"] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: setTacticsAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tactics"] });
      setActiveSlot(null);
    },
  });

  if (tacticsQuery.isPending || squadQuery.isPending) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-parchment-600">Loading tactics…</p>
      </div>
    );
  }
  if (tacticsQuery.isError || !tacticsQuery.data || squadQuery.isError || !squadQuery.data) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-semantic-error">Could not load tactics.</p>
      </div>
    );
  }

  const tactics: TacticsResponse = tacticsQuery.data;
  const squad: SquadResponse = squadQuery.data;

  // Build pitch slots from the LOCAL formation (not server state) so
  // the diagram updates immediately when the user changes formation in
  // the dropdown — before saving. Look up any existing assignment by
  // slot key from the server data.
  const assignmentMap = new Map(tactics.assignments.map((a) => [a.slot, a]));
  const pitchSlots: PitchSlotData[] = FORMATION_SLOTS[formation].map((slot) => {
    const existing = assignmentMap.get(slot);
    return {
      slot,
      slotLabel: slotLabelFor(formation, slot),
      playerId: existing?.playerId ?? null,
      playerName: existing?.playerName ?? null,
    };
  });

  const slotFamilies = activeSlot ? PITCH_SLOT_POSITION_FAMILIES[activeSlot] : [];
  const eligiblePlayers = squad.entries
    .filter((e) => matchesFamily(e.positionLabel, slotFamilies))
    .sort((a, b) => a.playerName.localeCompare(b.playerName));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <SectionHeader eyebrow={formation} title="Tactics" />

      <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-wide text-parchment-500">
        Familiarity
        <span
          data-testid="player-facing"
          className="border border-parchment-400 bg-parchment-100 px-2 py-0.5 font-medium text-parchment-800"
        >
          {tactics.familiarity}
        </span>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_280px]">
        {/* Left: pitch diagram */}
        <section>
          <PitchDiagram
            formation={formation}
            assignments={pitchSlots}
            onSlotClick={(slot) => setActiveSlot(activeSlot === slot ? null : slot)}
          />

          {activeSlot && (
            <div className="mt-4 border border-parchment-300 bg-parchment-100 p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-parchment-500">
                Assign to {activeSlot}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => assignMutation.mutate({ slot: activeSlot, playerId: null })}
                  className="border border-parchment-400 bg-parchment-50 px-3 py-1 font-sans text-xs text-parchment-700 hover:border-parchment-700"
                >
                  Clear
                </button>
                {eligiblePlayers.map((player) => (
                  <button
                    key={player.playerId}
                    type="button"
                    onClick={() =>
                      assignMutation.mutate({
                        slot: activeSlot,
                        playerId: player.playerId,
                      })
                    }
                    disabled={assignMutation.isPending}
                    className="border border-moss-500 bg-parchment-50 px-3 py-1 font-sans text-xs text-parchment-900 hover:bg-moss-50"
                  >
                    {player.playerName} · {player.positionLabel}
                  </button>
                ))}
                {eligiblePlayers.length === 0 && (
                  <span className="text-xs italic text-parchment-500">
                    No eligible players for this slot.
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right: config panel */}
        <aside className="border border-parchment-300 bg-parchment-100 p-6">
          <h2 className="text-xs font-medium uppercase tracking-wide text-parchment-500">
            Configuration
          </h2>

          <label className="mt-4 block">
            <div className="text-xs uppercase tracking-wide text-parchment-500">Formation</div>
            <select
              data-testid="tactics-formation-select"
              className="mt-1 w-full border border-parchment-400 bg-parchment-50 px-2 py-1 font-sans text-sm text-parchment-900"
              value={formation}
              onChange={(e) => setFormation(e.target.value as Formation)}
            >
              {FORMATIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block">
            <div className="text-xs uppercase tracking-wide text-parchment-500">Playing style</div>
            <select
              data-testid="tactics-style-select"
              className="mt-1 w-full border border-parchment-400 bg-parchment-50 px-2 py-1 font-sans text-sm text-parchment-900"
              value={playingStyle}
              onChange={(e) => setPlayingStyle(e.target.value as PlayingStyle)}
            >
              {PLAYING_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4">
            <div className="mb-2 text-xs uppercase tracking-wide text-parchment-500">
              Team instructions
            </div>
            <InstructionToggleList
              value={instructions}
              onChange={setInstructions}
              disabled={saveMutation.isPending}
            />
          </div>
        </aside>
      </div>

      {/* Persistent action bar */}
      <div className="mt-8 flex items-center gap-3 border-t border-parchment-300 bg-parchment-50 py-4">
        <button
          type="button"
          onClick={() => saveMutation.mutate({ formation, playingStyle, instructions })}
          disabled={saveMutation.isPending}
          className="border border-moss-600 bg-moss-500 px-4 py-2 font-sans text-sm font-semibold uppercase tracking-wide text-parchment-50 hover:bg-moss-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveMutation.isPending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => {
            setFormation(tactics.formation as Formation);
            setPlayingStyle(tactics.playingStyle as PlayingStyle);
            setInstructions(tactics.instructions as TeamInstruction[]);
          }}
          className="border border-parchment-400 bg-parchment-50 px-4 py-2 font-sans text-sm font-medium uppercase tracking-wide text-parchment-700 hover:border-parchment-700"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
