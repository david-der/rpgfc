// /tactics — Story 05 Editor archetype.
//
// Left work area: eleven SlotRow rows for the current formation.
// Right configuration panel: formation, playing style, instruction
// toggles. Bottom persistent action bar: Save / Reset. Every slot row
// is a dropdown (no pitch-diagram drag-and-drop in Story 05).
//
// The slot dropdowns are filtered against PITCH_SLOT_POSITION_FAMILIES
// to keep the options readable — you shouldn't see your goalkeepers
// listed under a striker slot.

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type {
  Formation,
  PitchSlot,
  PlayingStyle,
  TeamInstruction,
} from "@rpgfc/shared";
import {
  FORMATIONS,
  PITCH_SLOT_POSITION_FAMILIES,
  PLAYING_STYLES,
} from "@rpgfc/shared";

import { InstructionToggleList } from "../components/ui/InstructionToggleList";
import { SectionHeader } from "../components/ui/SectionHeader";
import { SlotRow, type SlotRowPlayer } from "../components/ui/SlotRow";
import {
  fetchSquad,
  fetchTactics,
  setTacticsAssignment,
  updateTactics,
} from "../lib/api";

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

  const tacticsQuery = useQuery({
    queryKey: ["tactics"],
    queryFn: fetchTactics,
  });
  const squadQuery = useQuery({
    queryKey: ["squad"],
    queryFn: fetchSquad,
  });

  // Local editor state for the config panel. Seeded from the server
  // response on first load so refreshes don't lose the user's in-flight
  // edits — but we do seed from the latest server value whenever the
  // query key refreshes (after a save).
  const [formation, setFormation] = useState<Formation>("4-3-3");
  const [playingStyle, setPlayingStyle] = useState<PlayingStyle>("Balanced");
  const [instructions, setInstructions] = useState<TeamInstruction[]>([]);

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

  const squadPlayers: SlotRowPlayer[] = squad.entries.map((entry) => ({
    id: entry.playerId,
    name: entry.playerName,
    positionLabel: entry.positionLabel,
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <SectionHeader eyebrow="Story 05" title="Tactics" />

      <div className="mt-8 grid gap-8 md:grid-cols-[2fr_1fr]">
        {/* Left work area */}
        <section className="border border-parchment-300 bg-parchment-100 p-6">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-parchment-500">
            Starting eleven — {tactics.formationLabel}
          </h2>
          <div>
            {tactics.assignments.map((assignment) => {
              const families = PITCH_SLOT_POSITION_FAMILIES[assignment.slot as PitchSlot];
              const eligible = squadPlayers.filter((player) =>
                matchesFamily(player.positionLabel, families),
              );
              return (
                <SlotRow
                  key={assignment.slot}
                  slot={assignment.slot as PitchSlot}
                  slotLabel={assignment.slotLabel}
                  eligible={eligible}
                  pinnedPlayerId={assignment.playerId}
                  pinnedPlayerName={assignment.playerName}
                  pinnedPositionLabel={assignment.positionLabel}
                  busy={assignMutation.isPending}
                  onChange={(playerId) =>
                    assignMutation.mutate({
                      slot: assignment.slot as PitchSlot,
                      playerId,
                    })
                  }
                />
              );
            })}
          </div>
        </section>

        {/* Right config panel */}
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
          onClick={() =>
            saveMutation.mutate({ formation, playingStyle, instructions })
          }
          disabled={saveMutation.isPending}
          className="border border-moss-600 bg-moss-500 px-4 py-2 font-sans text-sm font-semibold uppercase tracking-wide text-parchment-50 outline-offset-2 transition-colors hover:bg-moss-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-600 disabled:cursor-not-allowed disabled:opacity-60"
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
