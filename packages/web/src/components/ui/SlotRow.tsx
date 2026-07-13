// SlotRow — Story 05 /tactics Editor archetype atom.
//
// A single pitch-slot row: slot label + dropdown of eligible squad
// players + a preview of the currently pinned player. The dropdown
// receives a pre-filtered list of players eligible for the slot (the
// parent page applies PITCH_SLOT_POSITION_FAMILIES).
//
// Never displays a number. Role words and position labels only.

import type { PitchSlot } from "@rpgfc/shared";

export interface SlotRowPlayer {
  id: number;
  name: string;
  positionLabel: string;
}

interface SlotRowProps {
  slot: PitchSlot;
  slotLabel: string;
  eligible: SlotRowPlayer[];
  pinnedPlayerId: number | null;
  pinnedPlayerName: string | null;
  pinnedPositionLabel: string | null;
  busy?: boolean;
  onChange: (playerId: number | null) => void;
}

export function SlotRow({
  slot,
  slotLabel,
  eligible,
  pinnedPlayerId,
  pinnedPlayerName,
  pinnedPositionLabel,
  busy,
  onChange,
}: SlotRowProps) {
  return (
    <div data-slot={slot} className="flex items-center gap-4 border-b border-parchment-200 py-3">
      <div className="w-14 flex-none font-mono text-xs font-medium uppercase tracking-wide text-parchment-500">
        {slotLabel}
      </div>
      <div className="flex-1">
        <select
          aria-label={`Assignment for ${slotLabel}`}
          disabled={busy}
          className="w-full border border-parchment-400 bg-parchment-50 px-2 py-1 font-sans text-sm text-parchment-900 disabled:cursor-not-allowed disabled:opacity-60"
          value={pinnedPlayerId ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === "" ? null : Number(raw));
          }}
        >
          <option value="">— unassigned —</option>
          {eligible.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name} · {player.positionLabel}
            </option>
          ))}
        </select>
      </div>
      <div className="w-40 flex-none text-right">
        {pinnedPlayerName ? (
          <div>
            <span data-testid="player-facing" className="font-serif text-sm text-parchment-900">
              {pinnedPlayerName}
            </span>
            {pinnedPositionLabel && (
              <div className="text-xs uppercase tracking-wide text-parchment-500">
                {pinnedPositionLabel}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs italic text-parchment-500">Empty</span>
        )}
      </div>
    </div>
  );
}
