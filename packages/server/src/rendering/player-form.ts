// Player form rendering — Story 06.
//
// Two outputs:
//   - renderFormSeriesFor(playerId): the FormSeries shape the
//     /players/:id sparkline reads.
//   - currentFormFor(playerId): the rolling FormTier (last 5
//     performances) that gets attached to WirePlayer.formTier.

import type { FormSeries, FormSeriesPoint, FormTier } from "@rpgfc/shared";
import { FORM_TIER_LABELS } from "@rpgfc/shared";

import { recentFormFor } from "../application/players/form.js";
import type { DbClient } from "../db/client.js";

interface FormRow {
  match_id: number;
  matchday: number;
  tier: string;
}

async function loadHistory(client: DbClient, playerId: number): Promise<FormRow[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[number], FormRow>(
        `SELECT pmp.match_id, m.matchday, pmp.tier
         FROM player_match_performance pmp
         JOIN matches m ON m.id = pmp.match_id
         WHERE pmp.player_id = ? AND m.state = 'Played'
         ORDER BY m.matchday ASC, m.id ASC`,
      )
      .all(playerId);
  }
  const res = await client.pool.query<FormRow>(
    `SELECT pmp.match_id, m.matchday, pmp.tier
     FROM player_match_performance pmp
     JOIN matches m ON m.id = pmp.match_id
     WHERE pmp.player_id = $1 AND m.state = 'Played'
     ORDER BY m.matchday ASC, m.id ASC`,
    [playerId],
  );
  return res.rows;
}

export async function renderFormSeriesFor(
  client: DbClient,
  playerId: number,
): Promise<FormSeries> {
  const rows = await loadHistory(client, playerId);
  const points: FormSeriesPoint[] = rows.map((r) => {
    const tier = (r.tier as FormTier) ?? "Average";
    return {
      matchday: r.matchday,
      matchId: r.match_id,
      tier,
      tierLabel: FORM_TIER_LABELS[tier],
    };
  });
  const currentTier = await recentFormFor(client, playerId);
  return {
    playerId,
    points,
    currentTier,
    currentTierLabel: FORM_TIER_LABELS[currentTier],
  };
}

export async function currentFormFor(
  client: DbClient,
  playerId: number,
): Promise<{ tier: FormTier; label: string }> {
  const tier = await recentFormFor(client, playerId);
  return { tier, label: FORM_TIER_LABELS[tier] };
}
