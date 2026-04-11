// Tactics repository — Story 05.
//
// A single row per (club_id, name='Default') captures the full tactics
// shape. Instructions are a JSON array of TeamInstruction ids.
// Assignments are a JSON object mapping PitchSlot → playerId. Both are
// read/written as whole blobs; no per-slot rows.
//
// `setAssignment` is transactional-by-construction: it reads the current
// assignments, mutates in memory, and writes them back in a single DB
// operation. Because a player may only appear in one slot at a time,
// `setAssignment` also clears any prior slot the same player occupied.

import type {
  Formation,
  PitchSlot,
  PlayingStyle,
  Tactics,
  TeamInstruction,
} from "@rpgfc/shared";
import { FORMATION_SLOTS, FORMATIONS, PLAYING_STYLES, TEAM_INSTRUCTIONS } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";

interface TacticsRow {
  id: number;
  club_id: number;
  name: string;
  formation: string;
  playing_style: string;
  instructions_json: string;
  assignments_json: string;
  updated_at: string;
}

const DEFAULT_NAME = "Default";
const DEFAULT_FORMATION: Formation = "4-3-3";
const DEFAULT_PLAYING_STYLE: PlayingStyle = "Balanced";
const DEFAULT_INSTRUCTIONS: TeamInstruction[] = ["PressHigh", "StayCompact"];

function parseFormation(raw: string): Formation {
  return (FORMATIONS as readonly string[]).includes(raw)
    ? (raw as Formation)
    : DEFAULT_FORMATION;
}

function parsePlayingStyle(raw: string): PlayingStyle {
  return (PLAYING_STYLES as readonly string[]).includes(raw)
    ? (raw as PlayingStyle)
    : DEFAULT_PLAYING_STYLE;
}

function parseInstructions(raw: string): TeamInstruction[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is TeamInstruction =>
        typeof x === "string" && (TEAM_INSTRUCTIONS as readonly string[]).includes(x),
    );
  } catch {
    return [];
  }
}

function parseAssignments(raw: string): Partial<Record<PitchSlot, number>> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Partial<Record<PitchSlot, number>> = {};
    for (const [slot, playerId] of Object.entries(parsed)) {
      if (typeof playerId === "number") {
        out[slot as PitchSlot] = playerId;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function rowToTactics(row: TacticsRow): Tactics {
  return {
    id: row.id,
    clubId: row.club_id,
    name: row.name,
    formation: parseFormation(row.formation),
    playingStyle: parsePlayingStyle(row.playing_style),
    instructions: parseInstructions(row.instructions_json),
    assignments: parseAssignments(row.assignments_json),
    updatedAt: row.updated_at,
  };
}

async function loadTacticsRow(
  client: DbClient,
  clubId: number,
): Promise<TacticsRow | null> {
  if (client.dialect === "sqlite") {
    return (
      client.sqlite
        .prepare<[number, string], TacticsRow>(
          `SELECT id, club_id, name, formation, playing_style,
                  instructions_json, assignments_json, updated_at
           FROM tactics WHERE club_id = ? AND name = ?`,
        )
        .get(clubId, DEFAULT_NAME) ?? null
    );
  }
  const res = await client.pool.query<TacticsRow>(
    `SELECT id, club_id, name, formation, playing_style,
            instructions_json, assignments_json, updated_at
     FROM tactics WHERE club_id = $1 AND name = $2`,
    [clubId, DEFAULT_NAME],
  );
  return res.rows[0] ?? null;
}

async function insertTacticsRow(
  client: DbClient,
  clubId: number,
  now: string,
): Promise<TacticsRow> {
  const instructionsJson = JSON.stringify(DEFAULT_INSTRUCTIONS);
  const assignmentsJson = JSON.stringify({});
  if (client.dialect === "sqlite") {
    const result = client.sqlite
      .prepare(
        `INSERT INTO tactics
           (club_id, name, formation, playing_style,
            instructions_json, assignments_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        clubId,
        DEFAULT_NAME,
        DEFAULT_FORMATION,
        DEFAULT_PLAYING_STYLE,
        instructionsJson,
        assignmentsJson,
        now,
      );
    return {
      id: Number(result.lastInsertRowid),
      club_id: clubId,
      name: DEFAULT_NAME,
      formation: DEFAULT_FORMATION,
      playing_style: DEFAULT_PLAYING_STYLE,
      instructions_json: instructionsJson,
      assignments_json: assignmentsJson,
      updated_at: now,
    };
  }
  const res = await client.pool.query<{ id: number }>(
    `INSERT INTO tactics
       (club_id, name, formation, playing_style,
        instructions_json, assignments_json, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      clubId,
      DEFAULT_NAME,
      DEFAULT_FORMATION,
      DEFAULT_PLAYING_STYLE,
      instructionsJson,
      assignmentsJson,
      now,
    ],
  );
  return {
    id: res.rows[0]!.id,
    club_id: clubId,
    name: DEFAULT_NAME,
    formation: DEFAULT_FORMATION,
    playing_style: DEFAULT_PLAYING_STYLE,
    instructions_json: instructionsJson,
    assignments_json: assignmentsJson,
    updated_at: now,
  };
}

// Lazy-create: the first read for a club materializes a default row.
// Story 05's seed runs `seedTacticsForClub` for every seeded club so
// this branch is mostly a safety net, but it keeps the API ergonomics
// clean for test setups that skip seeding.
export async function getTactics(client: DbClient, clubId: number): Promise<Tactics> {
  let row = await loadTacticsRow(client, clubId);
  if (!row) {
    row = await insertTacticsRow(client, clubId, new Date().toISOString());
  }
  return rowToTactics(row);
}

export interface UpsertTacticsInput {
  clubId: number;
  formation: Formation;
  playingStyle: PlayingStyle;
  instructions: TeamInstruction[];
  now?: Date;
}

// Updates the top-level tactic fields (formation/style/instructions). If
// the formation change drops some slots from the allowed set, the
// corresponding assignments are dropped too — Story 05 §9.3 mitigation.
export async function upsertTactics(
  client: DbClient,
  input: UpsertTacticsInput,
): Promise<Tactics> {
  const current = await getTactics(client, input.clubId);
  const nowIso = (input.now ?? new Date()).toISOString();
  const allowed = new Set(FORMATION_SLOTS[input.formation]);
  const nextAssignments: Partial<Record<PitchSlot, number>> = {};
  for (const [slot, playerId] of Object.entries(current.assignments)) {
    if (allowed.has(slot as PitchSlot) && typeof playerId === "number") {
      nextAssignments[slot as PitchSlot] = playerId;
    }
  }

  const instructionsJson = JSON.stringify(input.instructions);
  const assignmentsJson = JSON.stringify(nextAssignments);

  if (client.dialect === "sqlite") {
    client.sqlite
      .prepare(
        `UPDATE tactics
           SET formation = ?, playing_style = ?,
               instructions_json = ?, assignments_json = ?,
               updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.formation,
        input.playingStyle,
        instructionsJson,
        assignmentsJson,
        nowIso,
        current.id,
      );
  } else {
    await client.pool.query(
      `UPDATE tactics
         SET formation = $1, playing_style = $2,
             instructions_json = $3, assignments_json = $4,
             updated_at = $5
       WHERE id = $6`,
      [
        input.formation,
        input.playingStyle,
        instructionsJson,
        assignmentsJson,
        nowIso,
        current.id,
      ],
    );
  }

  return {
    ...current,
    formation: input.formation,
    playingStyle: input.playingStyle,
    instructions: [...input.instructions],
    assignments: nextAssignments,
    updatedAt: nowIso,
  };
}

export type SetAssignmentResult =
  | { ok: true; tactics: Tactics }
  | { ok: false; reason: "slot_not_in_formation" };

// Pinning a player to a slot clears any other slot they previously
// occupied in the same write — one player, one pin. Passing
// `playerId = null` clears the slot without reassigning.
export async function setAssignment(
  client: DbClient,
  input: {
    clubId: number;
    slot: PitchSlot;
    playerId: number | null;
    now?: Date;
  },
): Promise<SetAssignmentResult> {
  const current = await getTactics(client, input.clubId);
  const allowed = FORMATION_SLOTS[current.formation];
  if (!allowed.includes(input.slot)) {
    return { ok: false, reason: "slot_not_in_formation" };
  }

  const nextAssignments: Partial<Record<PitchSlot, number>> = { ...current.assignments };
  if (input.playerId !== null) {
    for (const [slot, pid] of Object.entries(nextAssignments)) {
      if (pid === input.playerId) {
        delete nextAssignments[slot as PitchSlot];
      }
    }
    nextAssignments[input.slot] = input.playerId;
  } else {
    delete nextAssignments[input.slot];
  }

  const nowIso = (input.now ?? new Date()).toISOString();
  const assignmentsJson = JSON.stringify(nextAssignments);

  if (client.dialect === "sqlite") {
    client.sqlite
      .prepare(
        `UPDATE tactics SET assignments_json = ?, updated_at = ? WHERE id = ?`,
      )
      .run(assignmentsJson, nowIso, current.id);
  } else {
    await client.pool.query(
      `UPDATE tactics SET assignments_json = $1, updated_at = $2 WHERE id = $3`,
      [assignmentsJson, nowIso, current.id],
    );
  }

  return {
    ok: true,
    tactics: {
      ...current,
      assignments: nextAssignments,
      updatedAt: nowIso,
    },
  };
}
