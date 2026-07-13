// Tactics shapes — Story 05.
//
// A single tactics row per club captures the formation, playing style,
// team-wide instructions, and a slot→playerId assignment map. The
// assignment map is JSON-serialized in the DB (one JSON blob per row,
// small enough to read/write whole) — the application layer treats it
// as the authoritative starting-XI picker source.

export const FORMATIONS = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2"] as const;
export type Formation = (typeof FORMATIONS)[number];

export const PLAYING_STYLES = [
  "Possession",
  "Counter-Attack",
  "High Press",
  "Direct",
  "Balanced",
] as const;
export type PlayingStyle = (typeof PLAYING_STYLES)[number];

export const TEAM_INSTRUCTIONS = [
  "PlayOutFromTheBack",
  "HighLine",
  "HighTempo",
  "WorkBallIntoBox",
  "PressHigh",
  "StayCompact",
] as const;
export type TeamInstruction = (typeof TEAM_INSTRUCTIONS)[number];

export const TACTICAL_FAMILIARITY_TIERS = ["Learning", "Settling", "Familiar"] as const;
export type TacticalFamiliarityTier = (typeof TACTICAL_FAMILIARITY_TIERS)[number];

export const TEAM_INSTRUCTION_LABELS: Record<TeamInstruction, string> = {
  PlayOutFromTheBack: "Play out from the back",
  HighLine: "High defensive line",
  HighTempo: "High tempo",
  WorkBallIntoBox: "Work ball into box",
  PressHigh: "Press high",
  StayCompact: "Stay compact",
};

// Superset of slot ids across every supported formation. A specific
// formation uses only a subset — see FORMATION_SLOTS below.
export const PITCH_SLOTS = [
  "GK",
  "DC1",
  "DC2",
  "DC3",
  "LB",
  "RB",
  "LWB",
  "RWB",
  "DMC",
  "MCL",
  "MCC",
  "MCR",
  "AMC",
  "LW",
  "RW",
  "ST1",
  "ST2",
] as const;
export type PitchSlot = (typeof PITCH_SLOTS)[number];

// Default display labels for each slot. These are the standard
// abbreviations unless overridden by a formation-specific label.
export const PITCH_SLOT_LABELS: Record<PitchSlot, string> = {
  GK: "GK",
  DC1: "CB",
  DC2: "CB",
  DC3: "CB",
  LB: "LB",
  RB: "RB",
  LWB: "LWB",
  RWB: "RWB",
  DMC: "CDM",
  MCL: "CM",
  MCC: "CM",
  MCR: "CM",
  AMC: "CAM",
  LW: "LW",
  RW: "RW",
  ST1: "ST",
  ST2: "ST",
};

// Some formations use the same slot IDs but display differently.
// E.g., 4-4-2's wide positions are midfielders (LM/RM), not wingers.
export const FORMATION_LABEL_OVERRIDES: Partial<
  Record<Formation, Partial<Record<PitchSlot, string>>>
> = {
  "4-4-2": { LW: "LM", RW: "RM" },
  "4-2-3-1": { MCC: "CDM" },
};

export function slotLabelFor(formation: Formation, slot: PitchSlot): string {
  return FORMATION_LABEL_OVERRIDES[formation]?.[slot] ?? PITCH_SLOT_LABELS[slot];
}

// Compatible position families per slot. Used by the SlotRow dropdown
// to filter the squad-player options. Position labels come from Story
// 01's archetype library and include role synonyms — the filter matches
// a substring test in the UI, not a strict equality check.
export const PITCH_SLOT_POSITION_FAMILIES: Record<PitchSlot, readonly string[]> = {
  GK: ["GK"],
  DC1: ["CB", "DC"],
  DC2: ["CB", "DC"],
  DC3: ["CB", "DC"],
  LB: ["LB", "FB"],
  RB: ["RB", "FB"],
  LWB: ["LB", "LWB", "FB"],
  RWB: ["RB", "RWB", "FB"],
  DMC: ["DM", "CM"],
  MCL: ["CM", "MC"],
  MCC: ["CM", "MC"],
  MCR: ["CM", "MC"],
  AMC: ["AM", "CAM", "CM"],
  LW: ["LW", "LM", "WG"],
  RW: ["RW", "RM", "WG"],
  ST1: ["ST", "CF", "FW"],
  ST2: ["ST", "CF", "FW"],
};

// Which pitch slots a given formation uses. Order is the left-to-right,
// back-to-front reading order the UI renders. Assignments for slots
// outside this set are ignored and cleared when the formation changes.
export const FORMATION_SLOTS: Record<Formation, readonly PitchSlot[]> = {
  "4-4-2": ["GK", "LB", "DC1", "DC2", "RB", "LW", "MCL", "MCR", "RW", "ST1", "ST2"],
  "4-3-3": ["GK", "LB", "DC1", "DC2", "RB", "DMC", "MCL", "MCR", "LW", "RW", "ST1"],
  "4-2-3-1": ["GK", "LB", "DC1", "DC2", "RB", "DMC", "MCC", "LW", "AMC", "RW", "ST1"],
  "3-5-2": ["GK", "DC1", "DC2", "DC3", "LWB", "MCL", "MCC", "MCR", "RWB", "ST1", "ST2"],
  "3-4-3": ["GK", "DC1", "DC2", "DC3", "LWB", "MCL", "MCR", "RWB", "LW", "ST1", "RW"],
  "5-3-2": ["GK", "LWB", "DC1", "DC2", "DC3", "RWB", "MCL", "MCC", "MCR", "ST1", "ST2"],
};

export interface Tactics {
  id: number;
  clubId: number;
  name: string;
  formation: Formation;
  playingStyle: PlayingStyle;
  instructions: TeamInstruction[];
  /** Sparse map of slot → playerId. Only slots in the current
   *  formation's slot set carry values. */
  assignments: Partial<Record<PitchSlot, number>>;
  updatedAt: string;
}

// ── wire shapes ───────────────────────────────────────────────────────────

export interface RenderedSlotAssignment {
  slot: PitchSlot;
  slotLabel: string;
  playerId: number | null;
  playerName: string | null;
  positionLabel: string | null;
}

export interface RenderedTactics {
  id: number;
  clubId: number;
  name: string;
  formation: Formation;
  formationLabel: string;
  playingStyle: PlayingStyle;
  playingStyleLabel: string;
  instructions: TeamInstruction[];
  instructionLabels: string[];
  familiarity: TacticalFamiliarityTier;
  assignments: RenderedSlotAssignment[];
  updatedAt: string;
}
