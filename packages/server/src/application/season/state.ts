// Season state reader — Story 07.
//
// Loads the singleton save_state row and derives the SeasonState
// shape for the rendering + route layers.

import type { SeasonState } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";

interface SaveStateRow {
  season: number;
  next_match_week: number;
}

export async function loadSeasonState(client: DbClient): Promise<SeasonState> {
  let row: SaveStateRow | null = null;
  if (client.dialect === "sqlite") {
    row =
      client.sqlite
        .prepare<[], SaveStateRow>(
          `SELECT season, next_match_week FROM save_state WHERE id = 1`,
        )
        .get() ?? null;
  } else {
    const res = await client.pool.query<SaveStateRow>(
      `SELECT season, next_match_week FROM save_state WHERE id = 1`,
    );
    row = res.rows[0] ?? null;
  }

  return {
    season: row?.season ?? 0,
    matchWeek: row?.next_match_week ?? 1,
  };
}
