// Rendering-layer orchestration for the scouting API endpoints.
//
// Routes import from this module — they cannot reach into the application
// layer directly thanks to the `no-hidden-in-routes` ESLint rule. Same
// pattern as player-response.ts: this seam is the only place rendering
// touches application.

import type {
  AssignmentRef,
  ScoutRef,
  ScoutReportRef,
  ScoutTrustTier,
  ScoutVoiceId,
  ScoutRegion,
} from "@rpgfc/shared";

import {
  getActiveAssignment,
  startAssignment,
  type StartAssignmentParams,
} from "../application/scouting/assignments.js";
import {
  listReportsForPlayer,
  listReportsForScout,
  runObservationTick,
  type ObservationTickResult,
} from "../application/scouting/observations.js";
import { VOICE_CATALOGUE } from "../application/scouting/voices.js";
import type { DbClient } from "../db/client.js";

interface ScoutRow {
  id: number;
  run_id: number;
  name: string;
  region: string;
  voice_id: string;
  trust_tier: string;
}

function rowToScoutRef(row: ScoutRow): ScoutRef {
  const voiceId = row.voice_id as ScoutVoiceId;
  return {
    id: row.id,
    runId: row.run_id,
    name: row.name,
    region: row.region as ScoutRegion,
    voice: VOICE_CATALOGUE[voiceId],
    trust: row.trust_tier as ScoutTrustTier,
  };
}

export interface ScoutWithAssignment {
  scout: ScoutRef;
  activeAssignment: AssignmentRef | null;
  recentReports: ScoutReportRef[];
}

export async function listScouts(db: DbClient, runId: number): Promise<ScoutRef[]> {
  if (db.dialect === "sqlite") {
    return db.sqlite
      .prepare<[number], ScoutRow>(
        `SELECT id, run_id, name, region, voice_id, trust_tier
         FROM scouts WHERE run_id = ? ORDER BY id`,
      )
      .all(runId)
      .map(rowToScoutRef);
  }
  const res = await db.pool.query<ScoutRow>(
    `SELECT id, run_id, name, region, voice_id, trust_tier
     FROM scouts WHERE run_id = $1 ORDER BY id`,
    [runId],
  );
  return res.rows.map(rowToScoutRef);
}

async function loadScoutById(db: DbClient, id: number): Promise<ScoutRef | null> {
  if (db.dialect === "sqlite") {
    const row = db.sqlite
      .prepare<
        [number],
        ScoutRow
      >(`SELECT id, run_id, name, region, voice_id, trust_tier FROM scouts WHERE id = ?`)
      .get(id);
    return row ? rowToScoutRef(row) : null;
  }
  const res = await db.pool.query<ScoutRow>(
    `SELECT id, run_id, name, region, voice_id, trust_tier FROM scouts WHERE id = $1`,
    [id],
  );
  return res.rows[0] ? rowToScoutRef(res.rows[0]) : null;
}

export async function getScout(db: DbClient, id: number): Promise<ScoutWithAssignment | null> {
  const scout = await loadScoutById(db, id);
  if (!scout) return null;
  const activeAssignment = await getActiveAssignment(db, id);
  const reportRows = await listReportsForScout(db, id, 10);
  const recentReports: ScoutReportRef[] = reportRows.map((r) => ({
    id: r.id,
    scoutId: r.scout_id,
    scoutName: r.scout_name,
    voiceId: r.voice_id,
    playerId: r.player_id,
    playerName: r.player_name,
    assignmentKind: r.assignment_kind,
    prose: r.prose_body,
    createdAt: r.created_at,
  }));
  return { scout, activeAssignment, recentReports };
}

export async function getPlayerReports(db: DbClient, playerId: number): Promise<ScoutReportRef[]> {
  const rows = await listReportsForPlayer(db, playerId, 10);
  return rows.map((r) => ({
    id: r.id,
    scoutId: r.scout_id,
    scoutName: r.scout_name,
    voiceId: r.voice_id,
    playerId: r.player_id,
    playerName: r.player_name,
    assignmentKind: r.assignment_kind,
    prose: r.prose_body,
    createdAt: r.created_at,
  }));
}

export async function startScoutAssignment(
  db: DbClient,
  params: StartAssignmentParams,
): Promise<AssignmentRef> {
  return startAssignment(db, params);
}

export async function tickWorldObservations(
  db: DbClient,
  runId: number,
): Promise<ObservationTickResult> {
  return runObservationTick(db, { runId });
}
