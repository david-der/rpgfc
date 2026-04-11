// Squad rendering orchestration — Story 05.
//
// Loads the club's squad_entries, joins them against players +
// contracts, and returns a RenderedSquad with per-entry promise moods
// + a squad-level harmony tier. The mood computation lives in
// application/squad/harmony.ts and is imported here.

import type {
  Harmony,
  PlayingTimeRole,
  PromiseMood,
  RenderedSquad,
  RenderedSquadEntry,
  SquadRole,
} from "@rpgfc/shared";
import {
  ARCHETYPE_BY_ID,
  HARMONY_LABELS,
  SQUAD_ROLE_LABELS,
  SQUAD_ROLES,
  PLAYING_TIME_ROLES,
} from "@rpgfc/shared";

import { harmonyFor, moodFor, moodLabel } from "../application/squad/harmony.js";
import { setSquadRole as setSquadRoleRepo } from "../application/squad/repository.js";
import type { DbClient } from "../db/client.js";

interface PlayerJoinRow {
  id: number;
  name: string;
  archetype_id: string;
  role: string;
  role_promise: string | null;
}

interface ClubRow {
  id: number;
  name: string;
}

function parseSquadRole(raw: string): SquadRole {
  return (SQUAD_ROLES as readonly string[]).includes(raw) ? (raw as SquadRole) : "Rotation";
}

function parseRolePromise(raw: string | null): PlayingTimeRole | null {
  if (!raw) return null;
  return (PLAYING_TIME_ROLES as readonly string[]).includes(raw)
    ? (raw as PlayingTimeRole)
    : null;
}

async function loadSquadJoin(
  client: DbClient,
  clubId: number,
): Promise<PlayerJoinRow[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[number], PlayerJoinRow>(
        `SELECT p.id, p.name, p.archetype_id, s.role, c.role_promise
         FROM squad_entries s
         JOIN players p ON p.id = s.player_id
         LEFT JOIN contracts c ON c.player_id = s.player_id
         WHERE s.club_id = ?
         ORDER BY p.id`,
      )
      .all(clubId);
  }
  const res = await client.pool.query<PlayerJoinRow>(
    `SELECT p.id, p.name, p.archetype_id, s.role, c.role_promise
     FROM squad_entries s
     JOIN players p ON p.id = s.player_id
     LEFT JOIN contracts c ON c.player_id = s.player_id
     WHERE s.club_id = $1
     ORDER BY p.id`,
    [clubId],
  );
  return res.rows;
}

async function loadClubRow(client: DbClient, clubId: number): Promise<ClubRow | null> {
  if (client.dialect === "sqlite") {
    return (
      client.sqlite
        .prepare<
          [number],
          ClubRow
        >(`SELECT id, name FROM clubs WHERE id = ?`)
        .get(clubId) ?? null
    );
  }
  const res = await client.pool.query<ClubRow>(
    `SELECT id, name FROM clubs WHERE id = $1`,
    [clubId],
  );
  return res.rows[0] ?? null;
}

function buildEntry(row: PlayerJoinRow): RenderedSquadEntry {
  const squadRole = parseSquadRole(row.role);
  const rolePromise = parseRolePromise(row.role_promise);
  const mood: PromiseMood = moodFor(rolePromise, squadRole);
  const label = moodLabel(mood);
  const archetype = ARCHETYPE_BY_ID[row.archetype_id];
  return {
    playerId: row.id,
    playerName: row.name,
    positionLabel: archetype?.positionLabel ?? "??",
    archetypeLabel: archetype?.displayName ?? null,
    role: squadRole,
    roleLabel: SQUAD_ROLE_LABELS[squadRole],
    rolePromise,
    promiseMood: mood,
    promiseMoodLabel: label,
  };
}

export async function renderSquadForClub(
  client: DbClient,
  clubId: number,
): Promise<RenderedSquad | null> {
  const club = await loadClubRow(client, clubId);
  if (!club) return null;
  const rows = await loadSquadJoin(client, clubId);
  const entries = rows.map(buildEntry);
  const moods: PromiseMood[] = entries
    .map((e) => e.promiseMood)
    .filter((m): m is PromiseMood => m !== null);
  const harmony: Harmony = harmonyFor(moods);
  return {
    clubId: club.id,
    clubName: club.name,
    harmony,
    harmonyLabel: HARMONY_LABELS[harmony],
    entries,
  };
}

// Thin wrapper for the route layer — returns the updated rendered
// squad so the route can echo it back to the client and the UI can
// refresh without a second round-trip.
export async function setSquadRoleRendered(
  client: DbClient,
  input: { playerId: number; role: SquadRole },
): Promise<RenderedSquad | null> {
  const entry = await setSquadRoleRepo(client, input);
  if (!entry) return null;
  return renderSquadForClub(client, entry.clubId);
}

// ── per-player promise mood lookup for the player profile route ──────────

export interface PromiseMoodForPlayer {
  squadRole: SquadRole | null;
  rolePromise: PlayingTimeRole | null;
  promiseMood: PromiseMood | null;
  promiseMoodLabel: string | null;
}

interface PlayerMoodRow {
  role: string | null;
  role_promise: string | null;
}

export async function loadPromiseMoodForPlayer(
  client: DbClient,
  playerId: number,
): Promise<PromiseMoodForPlayer> {
  let row: PlayerMoodRow | null = null;
  if (client.dialect === "sqlite") {
    row =
      client.sqlite
        .prepare<[number], PlayerMoodRow>(
          `SELECT s.role, c.role_promise
           FROM players p
           LEFT JOIN squad_entries s ON s.player_id = p.id
           LEFT JOIN contracts c ON c.player_id = p.id
           WHERE p.id = ?`,
        )
        .get(playerId) ?? null;
  } else {
    const res = await client.pool.query<PlayerMoodRow>(
      `SELECT s.role, c.role_promise
       FROM players p
       LEFT JOIN squad_entries s ON s.player_id = p.id
       LEFT JOIN contracts c ON c.player_id = p.id
       WHERE p.id = $1`,
      [playerId],
    );
    row = res.rows[0] ?? null;
  }

  if (!row) {
    return {
      squadRole: null,
      rolePromise: null,
      promiseMood: null,
      promiseMoodLabel: null,
    };
  }

  const squadRole = row.role ? parseSquadRole(row.role) : null;
  const rolePromise = parseRolePromise(row.role_promise);
  if (!squadRole) {
    return {
      squadRole: null,
      rolePromise,
      promiseMood: null,
      promiseMoodLabel: null,
    };
  }
  const mood = moodFor(rolePromise, squadRole);
  return {
    squadRole,
    rolePromise,
    promiseMood: mood,
    promiseMoodLabel: moodLabel(mood),
  };
}
