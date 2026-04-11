// Knowledge-graph reader — Story 03.
//
// `knowPlayer(db, playerId)` walks the knowledge_nodes table for a player
// and returns the highest certainty observed for each (factType, factKey)
// pair, with the source scout id when present. Used by both:
//   - computeCertainty (overall + per-badge)
//   - the Reports tab (per-fact disagreement surfacing)

import type { CertaintyTier } from "@rpgfc/shared";

import type { DbClient } from "../db/client.js";

export interface FactObservation {
  factType: string;
  factKey: string;
  factValueTier: string;
  certainty: CertaintyTier;
  observedAt: string;
  sourceScoutId: number | null;
}

export interface PlayerKnowledge {
  playerId: number;
  /** All observations against this player, most recent first. */
  all: FactObservation[];
  /** The single highest-certainty observation per (factType, factKey) pair. */
  best: Map<string, FactObservation>;
}

const CERTAINTY_RANK: Record<CertaintyTier, number> = {
  Unknown: 0,
  Speculation: 1,
  Likely: 2,
  Confident: 3,
  Certain: 4,
};

function isHigher(a: CertaintyTier, b: CertaintyTier): boolean {
  return CERTAINTY_RANK[a] > CERTAINTY_RANK[b];
}

interface RawRow {
  fact_type: string;
  fact_key: string;
  fact_value_tier: string;
  certainty: string;
  observed_at: string;
  source_scout_id: number | null;
}

function rowToFact(r: RawRow): FactObservation {
  return {
    factType: r.fact_type,
    factKey: r.fact_key,
    factValueTier: r.fact_value_tier,
    certainty: r.certainty as CertaintyTier,
    observedAt: r.observed_at,
    sourceScoutId: r.source_scout_id,
  };
}

export async function knowPlayer(
  client: DbClient,
  playerId: number,
): Promise<PlayerKnowledge> {
  const all: FactObservation[] = [];

  if (client.dialect === "sqlite") {
    const rows = client.sqlite
      .prepare<[number], RawRow>(
        `SELECT fact_type, fact_key, fact_value_tier, certainty,
                observed_at, source_scout_id
         FROM knowledge_nodes
         WHERE subject_kind = 'player' AND subject_id = ?
         ORDER BY observed_at DESC`,
      )
      .all(playerId);
    for (const r of rows) all.push(rowToFact(r));
  } else {
    const res = await client.pool.query<RawRow>(
      `SELECT fact_type, fact_key, fact_value_tier, certainty,
              observed_at, source_scout_id
       FROM knowledge_nodes
       WHERE subject_kind = 'player' AND subject_id = $1
       ORDER BY observed_at DESC`,
      [playerId],
    );
    for (const r of res.rows) all.push(rowToFact(r));
  }

  const best = new Map<string, FactObservation>();
  for (const obs of all) {
    const key = `${obs.factType}:${obs.factKey}`;
    const prev = best.get(key);
    if (!prev || isHigher(obs.certainty, prev.certainty)) {
      best.set(key, obs);
    }
  }
  return { playerId, all, best };
}

// Bulk variant for the players-list endpoint. Loads all observations for
// the given player ids in a single query and returns a Map keyed by playerId.
export async function knowPlayers(
  client: DbClient,
  playerIds: number[],
): Promise<Map<number, PlayerKnowledge>> {
  const out = new Map<number, PlayerKnowledge>();
  if (playerIds.length === 0) return out;

  // Pre-seed empty knowledge entries so callers always find something.
  for (const id of playerIds) {
    out.set(id, { playerId: id, all: [], best: new Map() });
  }

  if (client.dialect === "sqlite") {
    const placeholders = playerIds.map(() => "?").join(",");
    const rows = client.sqlite
      .prepare<number[], RawRow & { subject_id: number }>(
        `SELECT subject_id, fact_type, fact_key, fact_value_tier, certainty,
                observed_at, source_scout_id
         FROM knowledge_nodes
         WHERE subject_kind = 'player' AND subject_id IN (${placeholders})
         ORDER BY observed_at DESC`,
      )
      .all(...playerIds);
    for (const row of rows) {
      const knowledge = out.get(row.subject_id);
      if (!knowledge) continue;
      const fact = rowToFact(row);
      knowledge.all.push(fact);
      const key = `${fact.factType}:${fact.factKey}`;
      const prev = knowledge.best.get(key);
      if (!prev || isHigher(fact.certainty, prev.certainty)) {
        knowledge.best.set(key, fact);
      }
    }
    return out;
  }

  // Postgres
  const res = await client.pool.query<RawRow & { subject_id: number }>(
    `SELECT subject_id, fact_type, fact_key, fact_value_tier, certainty,
            observed_at, source_scout_id
     FROM knowledge_nodes
     WHERE subject_kind = 'player' AND subject_id = ANY($1::int[])
     ORDER BY observed_at DESC`,
    [playerIds],
  );
  for (const row of res.rows) {
    const knowledge = out.get(row.subject_id);
    if (!knowledge) continue;
    const fact = rowToFact(row);
    knowledge.all.push(fact);
    const key = `${fact.factType}:${fact.factKey}`;
    const prev = knowledge.best.get(key);
    if (!prev || isHigher(fact.certainty, prev.certainty)) {
      knowledge.best.set(key, fact);
    }
  }
  return out;
}

// Aggregate a player's overall certainty as the MIN of the MAX certainty
// per fact type. Conservative on purpose — a player is only as known as
// his worst-known dimension.
export function aggregateOverallCertainty(knowledge: PlayerKnowledge): CertaintyTier {
  if (knowledge.best.size === 0) return "Unknown";

  // Group "best" facts by factType, then take the max within each group,
  // then return the min of those max values.
  const maxPerType = new Map<string, CertaintyTier>();
  for (const fact of knowledge.best.values()) {
    const cur = maxPerType.get(fact.factType);
    if (!cur || isHigher(fact.certainty, cur)) {
      maxPerType.set(fact.factType, fact.certainty);
    }
  }

  let lowest: CertaintyTier = "Certain";
  for (const tier of maxPerType.values()) {
    if (CERTAINTY_RANK[tier] < CERTAINTY_RANK[lowest]) {
      lowest = tier;
    }
  }
  return lowest;
}
