// Observation tick — Story 03.
//
// Given the current world state, produce one round of observations from
// every active assignment. Player Focus assignments climb the certainty
// ladder for their target player by exactly one tier per tick. Region
// Watch assignments produce 2-6 lower-certainty observations across the
// region.
//
// Both kinds also produce a `scout_reports` row written in the scout's
// voice template.
//
// Determinism: every random call routes through a mulberry32 RNG seeded
// from `(runId, assignmentId, tickIndex)`. The same world replayed
// produces the same observations.

import type { CertaintyTier, ScoutVoiceId } from "@rpgfc/shared";
import { ARCHETYPE_BY_ID } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";
import { mulberry32 } from "../generation/rng.js";
import { tierWordFor } from "../../rendering/thesaurus.js";
import type { NaturalGiftKey } from "@rpgfc/shared";

import { VOICE_SHAPES } from "./voices.js";

const CERTAINTY_LADDER: readonly CertaintyTier[] = [
  "Unknown",
  "Speculation",
  "Likely",
  "Confident",
  "Certain",
];

function nextRung(current: CertaintyTier): CertaintyTier {
  const idx = CERTAINTY_LADDER.indexOf(current);
  if (idx < 0) return "Speculation";
  return CERTAINTY_LADDER[Math.min(idx + 1, CERTAINTY_LADDER.length - 1)]!;
}

interface PlayerCore {
  id: number;
  name: string;
  nationality: string;
  archetypeId: string;
  hidden_attrs_json: string;
  badge_keys: string[];
}

interface ScoutFull {
  id: number;
  name: string;
  region: string;
  voice_id: ScoutVoiceId;
}

interface ActiveAssignmentRow {
  id: number;
  scout_id: number;
  kind: string;
  target_region: string | null;
  target_player_id: number | null;
}

const REGION_TO_NATIONALITY: Record<string, readonly string[]> = {
  Iberia: ["ES"],
  BeneluxFrance: ["NL"],
  SouthAmerica: ["BR"],
  Global: ["ES", "NL", "BR"],
};

// ── helpers: SQLite + Postgres-agnostic loaders ────────────────────────────

async function loadScout(client: DbClient, scoutId: number): Promise<ScoutFull | null> {
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<[number], ScoutFull>(`SELECT id, name, region, voice_id FROM scouts WHERE id = ?`)
      .get(scoutId);
    return row ?? null;
  }
  const res = await client.pool.query<ScoutFull>(
    `SELECT id, name, region, voice_id FROM scouts WHERE id = $1`,
    [scoutId],
  );
  return res.rows[0] ?? null;
}

async function loadActiveAssignmentsForRun(
  client: DbClient,
  runId: number,
): Promise<ActiveAssignmentRow[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[number], ActiveAssignmentRow>(
        `SELECT a.id, a.scout_id, a.kind, a.target_region, a.target_player_id
         FROM scout_assignments a
         JOIN scouts s ON s.id = a.scout_id
         WHERE s.run_id = ? AND a.ended_at IS NULL`,
      )
      .all(runId);
  }
  const res = await client.pool.query<ActiveAssignmentRow>(
    `SELECT a.id, a.scout_id, a.kind, a.target_region, a.target_player_id
     FROM scout_assignments a
     JOIN scouts s ON s.id = a.scout_id
     WHERE s.run_id = $1 AND a.ended_at IS NULL`,
    [runId],
  );
  return res.rows;
}

async function loadPlayerCore(client: DbClient, playerId: number): Promise<PlayerCore | null> {
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<
        [number],
        {
          id: number;
          name: string;
          nationality: string;
          archetype_id: string;
          hidden_attrs_json: string;
        }
      >(
        `SELECT id, name, nationality, archetype_id, hidden_attrs_json
         FROM players WHERE id = ?`,
      )
      .get(playerId);
    if (!row) return null;
    const badges = client.sqlite
      .prepare<[number], { badge_key: string }>(
        `SELECT badge_key FROM player_badges WHERE player_id = ?`,
      )
      .all(playerId)
      .map((r) => r.badge_key);
    return { ...row, archetypeId: row.archetype_id, badge_keys: badges };
  }
  const res = await client.pool.query<{
    id: number;
    name: string;
    nationality: string;
    archetype_id: string;
    hidden_attrs_json: string;
  }>(
    `SELECT id, name, nationality, archetype_id, hidden_attrs_json
     FROM players WHERE id = $1`,
    [playerId],
  );
  const row = res.rows[0];
  if (!row) return null;
  const badges = await client.pool.query<{ badge_key: string }>(
    `SELECT badge_key FROM player_badges WHERE player_id = $1`,
    [playerId],
  );
  return {
    ...row,
    archetypeId: row.archetype_id,
    badge_keys: badges.rows.map((r) => r.badge_key),
  };
}

async function loadPlayersInRegion(
  client: DbClient,
  region: string,
  limit: number,
): Promise<PlayerCore[]> {
  const nationalities = REGION_TO_NATIONALITY[region] ?? ["ES", "NL", "BR"];

  if (client.dialect === "sqlite") {
    const placeholders = nationalities.map(() => "?").join(",");
    const rows = client.sqlite
      .prepare<
        unknown[],
        {
          id: number;
          name: string;
          nationality: string;
          archetype_id: string;
          hidden_attrs_json: string;
        }
      >(
        `SELECT id, name, nationality, archetype_id, hidden_attrs_json
         FROM players
         WHERE nationality IN (${placeholders})
         ORDER BY id
         LIMIT ?`,
      )
      .all(...nationalities, limit);
    return Promise.all(
      rows.map(async (r) => {
        const badges = client.sqlite
          .prepare<[number], { badge_key: string }>(
            `SELECT badge_key FROM player_badges WHERE player_id = ?`,
          )
          .all(r.id)
          .map((b) => b.badge_key);
        return { ...r, archetypeId: r.archetype_id, badge_keys: badges };
      }),
    );
  }

  const res = await client.pool.query<{
    id: number;
    name: string;
    nationality: string;
    archetype_id: string;
    hidden_attrs_json: string;
  }>(
    `SELECT id, name, nationality, archetype_id, hidden_attrs_json
     FROM players
     WHERE nationality = ANY($1::text[])
     ORDER BY id
     LIMIT $2`,
    [nationalities, limit],
  );
  return Promise.all(
    res.rows.map(async (r) => {
      const badges = await client.pool.query<{ badge_key: string }>(
        `SELECT badge_key FROM player_badges WHERE player_id = $1`,
        [r.id],
      );
      return {
        ...r,
        archetypeId: r.archetype_id,
        badge_keys: badges.rows.map((b) => b.badge_key),
      };
    }),
  );
}

// ── helpers: pure ──────────────────────────────────────────────────────────

interface GiftRanking {
  topKey: NaturalGiftKey;
  topValue: number;
  weakKey: NaturalGiftKey;
  weakValue: number;
}

function rankGifts(hiddenAttrs: Record<string, number>): GiftRanking {
  const entries = Object.entries(hiddenAttrs) as Array<[NaturalGiftKey, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  return {
    topKey: entries[0]![0],
    topValue: entries[0]![1],
    weakKey: entries[entries.length - 1]![0],
    weakValue: entries[entries.length - 1]![1],
  };
}

const GIFT_LABEL: Record<NaturalGiftKey, string> = {
  pace: "pace",
  finishing: "finishing",
  composure: "composure",
  aerial: "aerial work",
  tackling: "tackling",
  passing: "distribution",
  vision: "vision",
  stamina: "engine",
  strength: "physical presence",
  reflexes: "reflexes",
};

function pickShape(voiceId: ScoutVoiceId, seed: number): string {
  const shapes = VOICE_SHAPES[voiceId];
  return shapes[seed % shapes.length] ?? shapes[0]!;
}

function fillShape(
  shape: string,
  player: PlayerCore,
  ranking: GiftRanking,
  precision: "fine" | "coarse",
): string {
  const archetype = ARCHETYPE_BY_ID[player.archetypeId];
  const positional = archetype?.primaryRole?.toLowerCase() ?? "player";
  return shape
    .replace(/\{player\}/g, player.name)
    .replace(/\{positional\}/g, positional)
    .replace(/\{label_top\}/g, GIFT_LABEL[ranking.topKey])
    .replace(/\{label_weak\}/g, GIFT_LABEL[ranking.weakKey])
    .replace(/\{gift_top\}/g, tierWordFor(ranking.topKey, ranking.topValue, precision))
    .replace(/\{gift_weak\}/g, tierWordFor(ranking.weakKey, ranking.weakValue, precision));
}

// ── observation tick ───────────────────────────────────────────────────────

export interface ObservationTickResult {
  observationsWritten: number;
  reportsWritten: number;
}

export async function runObservationTick(
  client: DbClient,
  opts: { runId: number; tickIndex?: number; now?: Date } = { runId: 1 },
): Promise<ObservationTickResult> {
  const runId = opts.runId;
  const tickIndex = opts.tickIndex ?? Math.floor(Date.now() / 1000);
  const now = (opts.now ?? new Date()).toISOString();

  const assignments = await loadActiveAssignmentsForRun(client, runId);
  if (assignments.length === 0) {
    return { observationsWritten: 0, reportsWritten: 0 };
  }

  let observationsWritten = 0;
  let reportsWritten = 0;

  for (const assignment of assignments) {
    const scout = await loadScout(client, assignment.scout_id);
    if (!scout) continue;

    if (assignment.kind === "player" && assignment.target_player_id) {
      const player = await loadPlayerCore(client, assignment.target_player_id);
      if (!player) continue;
      const written = await writeFocusObservation(
        client,
        runId,
        scout,
        assignment.id,
        player,
        tickIndex,
        now,
      );
      observationsWritten += written.observations;
      reportsWritten += written.reports;
      continue;
    }

    if (assignment.kind === "region" && assignment.target_region) {
      const players = await loadPlayersInRegion(client, assignment.target_region, 6);
      // Pick 2-6 players via the deterministic RNG to vary tick output.
      const rng = mulberry32((runId * 1_000_000 + assignment.id * 1_000 + tickIndex) >>> 0);
      const target = 2 + Math.floor(rng.next() * 5);
      const sliced = players.slice(0, Math.min(target, players.length));
      for (const player of sliced) {
        const written = await writeRegionObservation(
          client,
          runId,
          scout,
          assignment.id,
          player,
          tickIndex,
          now,
        );
        observationsWritten += written.observations;
        reportsWritten += written.reports;
      }
    }
  }

  return { observationsWritten, reportsWritten };
}

interface WriteResult {
  observations: number;
  reports: number;
}

// Player Focus: bump every fact one rung up the ladder. Once everything
// is at Certain, the assignment auto-ends.
async function writeFocusObservation(
  client: DbClient,
  runId: number,
  scout: ScoutFull,
  assignmentId: number,
  player: PlayerCore,
  tickIndex: number,
  now: string,
): Promise<WriteResult> {
  const hiddenAttrs = JSON.parse(player.hidden_attrs_json) as Record<string, number>;
  const ranking = rankGifts(hiddenAttrs);

  // Determine the next rung from the highest-currently-known certainty
  // for any natural-gift fact about this player.
  const currentTier = await loadHighestKnownCertainty(client, player.id);
  const nextTier = nextRung(currentTier);

  // Write three new observation rows: top gift, weakest gift, and one
  // randomly-chosen badge presence (if the player has any).
  const facts: Array<{
    factType: string;
    factKey: string;
    factValueTier: string;
  }> = [
    {
      factType: "natural_gift_tier",
      factKey: ranking.topKey,
      factValueTier: tierWordFor(ranking.topKey, ranking.topValue, "fine"),
    },
    {
      factType: "natural_gift_tier",
      factKey: ranking.weakKey,
      factValueTier: tierWordFor(ranking.weakKey, ranking.weakValue, "fine"),
    },
  ];
  if (player.badge_keys.length > 0) {
    const rng = mulberry32((scout.id * 100000 + tickIndex) >>> 0);
    const badge = player.badge_keys[Math.floor(rng.next() * player.badge_keys.length)]!;
    facts.push({ factType: "badge_presence", factKey: badge, factValueTier: "present" });
  }

  for (const fact of facts) {
    await insertKnowledgeNode(client, {
      runId,
      subjectKind: "player",
      subjectId: player.id,
      factType: fact.factType,
      factKey: fact.factKey,
      factValueTier: fact.factValueTier,
      certainty: nextTier,
      observedAt: now,
      sourceScoutId: scout.id,
    });
  }

  // Write the prose report.
  const precision = nextTier === "Certain" || nextTier === "Confident" ? "fine" : "coarse";
  const shape = pickShape(scout.voice_id, scout.id + tickIndex);
  const prose = fillShape(shape, player, ranking, precision);
  await insertScoutReport(client, {
    scoutId: scout.id,
    assignmentId,
    playerId: player.id,
    proseBody: prose,
    createdAt: now,
  });

  // Auto-end the assignment if certainty has reached the top of the ladder.
  if (nextTier === "Certain") {
    await endAssignmentRow(client, assignmentId, now);
  }

  return { observations: facts.length, reports: 1 };
}

async function writeRegionObservation(
  client: DbClient,
  runId: number,
  scout: ScoutFull,
  assignmentId: number,
  player: PlayerCore,
  tickIndex: number,
  now: string,
): Promise<WriteResult> {
  const hiddenAttrs = JSON.parse(player.hidden_attrs_json) as Record<string, number>;
  const ranking = rankGifts(hiddenAttrs);

  // Region Watch never gets above Likely — those are background observations.
  const tier: CertaintyTier = "Speculation";

  await insertKnowledgeNode(client, {
    runId,
    subjectKind: "player",
    subjectId: player.id,
    factType: "natural_gift_tier",
    factKey: ranking.topKey,
    factValueTier: tierWordFor(ranking.topKey, ranking.topValue, "coarse"),
    certainty: tier,
    observedAt: now,
    sourceScoutId: scout.id,
  });

  const shape = pickShape(scout.voice_id, scout.id * 7 + tickIndex);
  const prose = fillShape(shape, player, ranking, "coarse");
  await insertScoutReport(client, {
    scoutId: scout.id,
    assignmentId,
    playerId: player.id,
    proseBody: prose,
    createdAt: now,
  });

  return { observations: 1, reports: 1 };
}

// ── DB writers ─────────────────────────────────────────────────────────────

interface KnowledgeNodeInsert {
  runId: number;
  subjectKind: "player" | "club";
  subjectId: number;
  factType: string;
  factKey: string;
  factValueTier: string;
  certainty: CertaintyTier;
  observedAt: string;
  sourceScoutId: number | null;
}

async function insertKnowledgeNode(client: DbClient, node: KnowledgeNodeInsert): Promise<void> {
  if (client.dialect === "sqlite") {
    client.sqlite
      .prepare(
        `INSERT INTO knowledge_nodes
           (run_id, subject_kind, subject_id, fact_type, fact_key,
            fact_value_tier, certainty, observed_at, source_scout_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        node.runId,
        node.subjectKind,
        node.subjectId,
        node.factType,
        node.factKey,
        node.factValueTier,
        node.certainty,
        node.observedAt,
        node.sourceScoutId,
      );
    return;
  }
  await client.pool.query(
    `INSERT INTO knowledge_nodes
       (run_id, subject_kind, subject_id, fact_type, fact_key,
        fact_value_tier, certainty, observed_at, source_scout_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      node.runId,
      node.subjectKind,
      node.subjectId,
      node.factType,
      node.factKey,
      node.factValueTier,
      node.certainty,
      node.observedAt,
      node.sourceScoutId,
    ],
  );
}

interface ReportInsert {
  scoutId: number;
  assignmentId: number;
  playerId: number;
  proseBody: string;
  createdAt: string;
}

async function insertScoutReport(client: DbClient, report: ReportInsert): Promise<void> {
  if (client.dialect === "sqlite") {
    client.sqlite
      .prepare(
        `INSERT INTO scout_reports
           (scout_id, assignment_id, player_id, prose_body, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        report.scoutId,
        report.assignmentId,
        report.playerId,
        report.proseBody,
        report.createdAt,
      );
    return;
  }
  await client.pool.query(
    `INSERT INTO scout_reports
       (scout_id, assignment_id, player_id, prose_body, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [report.scoutId, report.assignmentId, report.playerId, report.proseBody, report.createdAt],
  );
}

async function endAssignmentRow(
  client: DbClient,
  assignmentId: number,
  now: string,
): Promise<void> {
  if (client.dialect === "sqlite") {
    client.sqlite
      .prepare(`UPDATE scout_assignments SET ended_at = ? WHERE id = ?`)
      .run(now, assignmentId);
    return;
  }
  await client.pool.query(`UPDATE scout_assignments SET ended_at = $1 WHERE id = $2`, [
    now,
    assignmentId,
  ]);
}

// Walk this player's existing observations to find the highest certainty
// any (factType, factKey) currently sits at. Used by writeFocusObservation
// to know which rung to write next.
async function loadHighestKnownCertainty(
  client: DbClient,
  playerId: number,
): Promise<CertaintyTier> {
  let rows: Array<{ certainty: string }>;
  if (client.dialect === "sqlite") {
    rows = client.sqlite
      .prepare<[number], { certainty: string }>(
        `SELECT certainty FROM knowledge_nodes
         WHERE subject_kind = 'player' AND subject_id = ?`,
      )
      .all(playerId);
  } else {
    const res = await client.pool.query<{ certainty: string }>(
      `SELECT certainty FROM knowledge_nodes
       WHERE subject_kind = 'player' AND subject_id = $1`,
      [playerId],
    );
    rows = res.rows;
  }
  let highest: CertaintyTier = "Unknown";
  for (const row of rows) {
    const tier = row.certainty as CertaintyTier;
    if (CERTAINTY_LADDER.indexOf(tier) > CERTAINTY_LADDER.indexOf(highest)) {
      highest = tier;
    }
  }
  return highest;
}

// ── reports query helper used by routes ───────────────────────────────────

export interface ScoutReportRow {
  id: number;
  scout_id: number;
  scout_name: string;
  voice_id: ScoutVoiceId;
  player_id: number;
  player_name: string;
  assignment_kind: "region" | "player";
  prose_body: string;
  created_at: string;
}

export async function listReportsForPlayer(
  client: DbClient,
  playerId: number,
  limit = 10,
): Promise<ScoutReportRow[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[number, number], ScoutReportRow>(
        `SELECT r.id, r.scout_id, s.name AS scout_name, s.voice_id,
                r.player_id, p.name AS player_name, a.kind AS assignment_kind,
                r.prose_body, r.created_at
         FROM scout_reports r
         JOIN scouts s ON s.id = r.scout_id
         JOIN scout_assignments a ON a.id = r.assignment_id
         JOIN players p ON p.id = r.player_id
         WHERE r.player_id = ?
         ORDER BY r.id DESC
         LIMIT ?`,
      )
      .all(playerId, limit);
  }
  const res = await client.pool.query<ScoutReportRow>(
    `SELECT r.id, r.scout_id, s.name AS scout_name, s.voice_id,
            r.player_id, p.name AS player_name, a.kind AS assignment_kind,
            r.prose_body, r.created_at
     FROM scout_reports r
     JOIN scouts s ON s.id = r.scout_id
     JOIN scout_assignments a ON a.id = r.assignment_id
     JOIN players p ON p.id = r.player_id
     WHERE r.player_id = $1
     ORDER BY r.id DESC
     LIMIT $2`,
    [playerId, limit],
  );
  return res.rows;
}

export async function listReportsForScout(
  client: DbClient,
  scoutId: number,
  limit = 10,
): Promise<ScoutReportRow[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[number, number], ScoutReportRow>(
        `SELECT r.id, r.scout_id, s.name AS scout_name, s.voice_id,
                r.player_id, p.name AS player_name, a.kind AS assignment_kind,
                r.prose_body, r.created_at
         FROM scout_reports r
         JOIN scouts s ON s.id = r.scout_id
         JOIN scout_assignments a ON a.id = r.assignment_id
         JOIN players p ON p.id = r.player_id
         WHERE r.scout_id = ?
         ORDER BY r.id DESC
         LIMIT ?`,
      )
      .all(scoutId, limit);
  }
  const res = await client.pool.query<ScoutReportRow>(
    `SELECT r.id, r.scout_id, s.name AS scout_name, s.voice_id,
            r.player_id, p.name AS player_name, a.kind AS assignment_kind,
            r.prose_body, r.created_at
     FROM scout_reports r
     JOIN scouts s ON s.id = r.scout_id
     JOIN scout_assignments a ON a.id = r.assignment_id
     JOIN players p ON p.id = r.player_id
     WHERE r.scout_id = $1
     ORDER BY r.id DESC
     LIMIT $2`,
    [scoutId, limit],
  );
  return res.rows;
}
