// Form derivation — Story 06.
//
// Pure function over a player's recent player_match_performance rows.
// Maps each tier to a numeric weight, averages the last n weights,
// and re-buckets back to a FormTier. The numeric average is internal —
// it never crosses the rendering boundary.
//
// Story 05 shipped a placeholder "currentForm" prose generator that
// drew tier words from a fixed vocabulary; Story 06's `formTier`
// becomes the authoritative read for that prose. The replacement
// happens in rendering/player.ts when Story 06's form sparkline lands.

import type { FormTier } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";

const WEIGHT: Record<FormTier, number> = {
  Excellent: 4,
  Good: 3,
  Average: 2,
  Poor: 1,
  Dreadful: 0,
};

const TIER_BY_BUCKET: FormTier[] = ["Dreadful", "Poor", "Average", "Good", "Excellent"];

export function bucketForm(weights: readonly number[]): FormTier {
  if (weights.length === 0) return "Average";
  const avg = weights.reduce((acc, w) => acc + w, 0) / weights.length;
  // Round to nearest integer in [0, 4] then clamp.
  const idx = Math.max(0, Math.min(TIER_BY_BUCKET.length - 1, Math.round(avg)));
  return TIER_BY_BUCKET[idx]!;
}

interface PerformanceTierRow {
  tier: string;
}

export async function recentFormFor(
  client: DbClient,
  playerId: number,
  n = 5,
): Promise<FormTier> {
  let rows: PerformanceTierRow[];
  if (client.dialect === "sqlite") {
    rows = client.sqlite
      .prepare<[number, number], PerformanceTierRow>(
        `SELECT pmp.tier
         FROM player_match_performance pmp
         JOIN matches m ON m.id = pmp.match_id
         WHERE pmp.player_id = ? AND m.state = 'Played'
         ORDER BY m.matchday DESC, m.id DESC
         LIMIT ?`,
      )
      .all(playerId, n);
  } else {
    const res = await client.pool.query<PerformanceTierRow>(
      `SELECT pmp.tier
       FROM player_match_performance pmp
       JOIN matches m ON m.id = pmp.match_id
       WHERE pmp.player_id = $1 AND m.state = 'Played'
       ORDER BY m.matchday DESC, m.id DESC
       LIMIT $2`,
      [playerId, n],
    );
    rows = res.rows;
  }

  const weights = rows
    .map((r) => WEIGHT[r.tier as FormTier])
    .filter((w): w is number => typeof w === "number");
  return bucketForm(weights);
}
