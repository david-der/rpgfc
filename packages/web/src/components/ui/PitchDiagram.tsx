// PitchDiagram — Story 07+ tactics visualization.
//
// A CSS-based soccer field with positioned markers for each slot in
// the active formation. Each marker shows the slot label, the assigned
// player's name (if any), and is clickable to open a player picker.
//
// The field is a 4:3 aspect ratio div with green styling that stays
// within the parchment palette — darker parchment tones for the grass
// lines, lighter for the field body. No actual green — the field reads
// as a schematic, not a photo.

import type { Formation, PitchSlot } from "@rpgfc/shared";

export interface PitchSlotData {
  slot: PitchSlot;
  slotLabel: string;
  playerId: number | null;
  playerName: string | null;
}

interface PitchDiagramProps {
  formation: Formation;
  assignments: PitchSlotData[];
  onSlotClick: (slot: PitchSlot) => void;
}

// Slot positions as percentages of the field (0,0 = top-left).
// Y: 0% = top (attack), 100% = bottom (defense/GK).
// X: 0% = left, 100% = right.
// The field reads bottom-up: GK at bottom, strikers at top.
const SLOT_POSITIONS: Record<Formation, Record<string, { x: number; y: number }>> = {
  "4-4-2": {
    GK: { x: 50, y: 92 },
    LB: { x: 15, y: 72 },
    DC1: { x: 37, y: 75 },
    DC2: { x: 63, y: 75 },
    RB: { x: 85, y: 72 },
    LW: { x: 12, y: 48 },
    MCL: { x: 37, y: 50 },
    MCR: { x: 63, y: 50 },
    RW: { x: 88, y: 48 },
    ST1: { x: 35, y: 18 },
    ST2: { x: 65, y: 18 },
  },
  "4-3-3": {
    GK: { x: 50, y: 92 },
    LB: { x: 15, y: 72 },
    DC1: { x: 37, y: 75 },
    DC2: { x: 63, y: 75 },
    RB: { x: 85, y: 72 },
    DMC: { x: 50, y: 55 },
    MCL: { x: 30, y: 48 },
    MCR: { x: 70, y: 48 },
    LW: { x: 15, y: 22 },
    ST1: { x: 50, y: 15 },
    RW: { x: 85, y: 22 },
  },
  "4-2-3-1": {
    GK: { x: 50, y: 92 },
    LB: { x: 15, y: 72 },
    DC1: { x: 37, y: 75 },
    DC2: { x: 63, y: 75 },
    RB: { x: 85, y: 72 },
    DMC: { x: 35, y: 55 },
    MCC: { x: 65, y: 55 },
    LW: { x: 15, y: 35 },
    AMC: { x: 50, y: 32 },
    RW: { x: 85, y: 35 },
    ST1: { x: 50, y: 15 },
  },
  "3-5-2": {
    GK: { x: 50, y: 92 },
    DC1: { x: 30, y: 75 },
    DC2: { x: 50, y: 78 },
    DC3: { x: 70, y: 75 },
    LWB: { x: 10, y: 52 },
    MCL: { x: 30, y: 48 },
    MCC: { x: 50, y: 50 },
    MCR: { x: 70, y: 48 },
    RWB: { x: 90, y: 52 },
    ST1: { x: 35, y: 18 },
    ST2: { x: 65, y: 18 },
  },
  "3-4-3": {
    GK: { x: 50, y: 92 },
    DC1: { x: 30, y: 75 },
    DC2: { x: 50, y: 78 },
    DC3: { x: 70, y: 75 },
    LWB: { x: 10, y: 52 },
    MCL: { x: 37, y: 50 },
    MCR: { x: 63, y: 50 },
    RWB: { x: 90, y: 52 },
    LW: { x: 15, y: 22 },
    ST1: { x: 50, y: 15 },
    RW: { x: 85, y: 22 },
  },
  "5-3-2": {
    GK: { x: 50, y: 92 },
    LWB: { x: 10, y: 68 },
    DC1: { x: 30, y: 75 },
    DC2: { x: 50, y: 78 },
    DC3: { x: 70, y: 75 },
    RWB: { x: 90, y: 68 },
    MCL: { x: 30, y: 48 },
    MCC: { x: 50, y: 50 },
    MCR: { x: 70, y: 48 },
    ST1: { x: 35, y: 18 },
    ST2: { x: 65, y: 18 },
  },
};

export function PitchDiagram({ formation, assignments, onSlotClick }: PitchDiagramProps) {
  const positions = SLOT_POSITIONS[formation] ?? SLOT_POSITIONS["4-3-3"];

  return (
    <div className="relative mx-auto w-full" style={{ aspectRatio: "3 / 4", maxWidth: 480 }}>
      {/* Field background */}
      <div className="absolute inset-0 border-2 border-moss-600 bg-moss-500/10">
        {/* Center line */}
        <div className="absolute left-0 right-0 top-1/2 border-t border-moss-600/40" />
        {/* Center circle */}
        <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-moss-600/40" />
        {/* Penalty areas */}
        <div className="absolute bottom-0 left-1/2 h-[18%] w-[44%] -translate-x-1/2 border-l border-r border-t border-moss-600/40" />
        <div className="absolute left-1/2 top-0 h-[18%] w-[44%] -translate-x-1/2 border-b border-l border-r border-moss-600/40" />
        {/* Goal areas */}
        <div className="absolute bottom-0 left-1/2 h-[8%] w-[20%] -translate-x-1/2 border-l border-r border-t border-moss-600/40" />
        <div className="absolute left-1/2 top-0 h-[8%] w-[20%] -translate-x-1/2 border-b border-l border-r border-moss-600/40" />
      </div>

      {/* Player markers */}
      {assignments.map((slot) => {
        const pos = positions[slot.slot];
        if (!pos) return null;
        const filled = slot.playerId !== null;
        return (
          <button
            key={slot.slot}
            type="button"
            onClick={() => onSlotClick(slot.slot)}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-[10px] font-bold transition-colors ${
                filled
                  ? "border-moss-600 bg-moss-500 text-parchment-50"
                  : "border-parchment-500 bg-parchment-100 text-parchment-700 hover:border-moss-600"
              }`}
            >
              {slot.slotLabel}
            </div>
            <div className="max-w-[80px] truncate text-center font-sans text-[10px] font-medium text-parchment-900">
              {slot.playerName ?? ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}
