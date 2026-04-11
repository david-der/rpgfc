// Tactics rendering orchestration — Story 05.
//
// Route files import from here (not from application/tactics/*). This
// module resolves player names + positions via the same full-club map
// the rest of rendering/ uses, so the rendered output stays consistent
// with the player profile surface.

import type {
  Formation,
  PitchSlot,
  PlayingStyle,
  RenderedSlotAssignment,
  RenderedTactics,
  Tactics,
  TeamInstruction,
} from "@rpgfc/shared";
import {
  FORMATION_SLOTS,
  PITCH_SLOT_LABELS,
  TEAM_INSTRUCTION_LABELS,
  ARCHETYPE_BY_ID,
} from "@rpgfc/shared";

import {
  getTactics,
  setAssignment,
  upsertTactics,
  type SetAssignmentResult,
  type UpsertTacticsInput,
} from "../application/tactics/repository.js";
import type { DbClient } from "../db/client.js";

interface PlayerNameRow {
  id: number;
  name: string;
  archetype_id: string;
}

async function loadPlayerMap(
  client: DbClient,
  ids: number[],
): Promise<Map<number, PlayerNameRow>> {
  const out = new Map<number, PlayerNameRow>();
  if (ids.length === 0) return out;
  if (client.dialect === "sqlite") {
    const placeholders = ids.map(() => "?").join(",");
    const rows = client.sqlite
      .prepare<number[], PlayerNameRow>(
        `SELECT id, name, archetype_id FROM players WHERE id IN (${placeholders})`,
      )
      .all(...ids);
    for (const row of rows) out.set(row.id, row);
    return out;
  }
  const res = await client.pool.query<PlayerNameRow>(
    `SELECT id, name, archetype_id FROM players WHERE id = ANY($1::int[])`,
    [ids],
  );
  for (const row of res.rows) out.set(row.id, row);
  return out;
}

function buildAssignments(
  tactics: Tactics,
  players: Map<number, PlayerNameRow>,
): RenderedSlotAssignment[] {
  const slots = FORMATION_SLOTS[tactics.formation];
  return slots.map((slot) => {
    const playerId = tactics.assignments[slot] ?? null;
    const player = playerId !== null ? players.get(playerId) ?? null : null;
    const archetype = player ? ARCHETYPE_BY_ID[player.archetype_id] : undefined;
    return {
      slot,
      slotLabel: PITCH_SLOT_LABELS[slot],
      playerId,
      playerName: player?.name ?? null,
      positionLabel: archetype?.positionLabel ?? null,
    };
  });
}

function formatInstructions(instructions: TeamInstruction[]): string[] {
  return instructions.map((i) => TEAM_INSTRUCTION_LABELS[i]);
}

function renderTactics(
  tactics: Tactics,
  players: Map<number, PlayerNameRow>,
): RenderedTactics {
  return {
    id: tactics.id,
    clubId: tactics.clubId,
    name: tactics.name,
    formation: tactics.formation,
    formationLabel: tactics.formation,
    playingStyle: tactics.playingStyle,
    playingStyleLabel: tactics.playingStyle,
    instructions: [...tactics.instructions],
    instructionLabels: formatInstructions(tactics.instructions),
    assignments: buildAssignments(tactics, players),
    updatedAt: tactics.updatedAt,
  };
}

function pinnedPlayerIds(tactics: Tactics): number[] {
  const ids: number[] = [];
  for (const pid of Object.values(tactics.assignments)) {
    if (typeof pid === "number") ids.push(pid);
  }
  return ids;
}

export async function renderTacticsForClub(
  client: DbClient,
  clubId: number,
): Promise<RenderedTactics> {
  const tactics = await getTactics(client, clubId);
  const players = await loadPlayerMap(client, pinnedPlayerIds(tactics));
  return renderTactics(tactics, players);
}

export async function upsertTacticsRendered(
  client: DbClient,
  input: {
    clubId: number;
    formation: Formation;
    playingStyle: PlayingStyle;
    instructions: TeamInstruction[];
  },
): Promise<RenderedTactics> {
  const upsertInput: UpsertTacticsInput = {
    clubId: input.clubId,
    formation: input.formation,
    playingStyle: input.playingStyle,
    instructions: input.instructions,
  };
  const tactics = await upsertTactics(client, upsertInput);
  const players = await loadPlayerMap(client, pinnedPlayerIds(tactics));
  return renderTactics(tactics, players);
}

export type SetAssignmentRenderedResult =
  | { ok: true; tactics: RenderedTactics }
  | { ok: false; reason: "slot_not_in_formation" };

export async function setAssignmentRendered(
  client: DbClient,
  input: { clubId: number; slot: PitchSlot; playerId: number | null },
): Promise<SetAssignmentRenderedResult> {
  const result: SetAssignmentResult = await setAssignment(client, input);
  if (!result.ok) return { ok: false, reason: result.reason };
  const players = await loadPlayerMap(client, pinnedPlayerIds(result.tactics));
  return { ok: true, tactics: renderTactics(result.tactics, players) };
}
