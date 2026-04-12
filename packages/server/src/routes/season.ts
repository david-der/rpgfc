// Season routes — Story 06 + 07.
//
// Endpoints:
//   GET  /api/season/fixtures    — RenderedFixturesPage for the user's club
//   GET  /api/season/state       — SeasonState (current season + match week + window status)
//   GET  /api/season/table       — LeagueTableRow[] sorted by points DESC
//   POST /api/season/advance     — simulate the next match week
//   POST /api/season/end         — roll into the next season (if fully played)

import { Hono } from "hono";

import {
  advanceMatchdayRendered,
  computeLeagueTable,
  renderFixturesForUser,
} from "../rendering/index.js";
import { loadSeasonState } from "../application/season/state.js";
import { endSeason } from "../application/season/end.js";
import type { DbClient } from "../db/client.js";

export interface SeasonRouteDeps {
  db: DbClient;
  now: () => Date;
  userClubId: number;
}

export function createSeasonRoute(deps: SeasonRouteDeps) {
  const app = new Hono()
    .get("/fixtures", async (c) => {
      const page = await renderFixturesForUser(deps.db, deps.userClubId);
      return c.json(page);
    })
    .get("/state", async (c) => {
      const state = await loadSeasonState(deps.db);
      return c.json(state);
    })
    .get("/table", async (c) => {
      const state = await loadSeasonState(deps.db);
      const table = await computeLeagueTable(deps.db, state.season);
      return c.json({ table });
    })
    .post("/advance", async (c) => {
      const result = await advanceMatchdayRendered(deps.db, { now: deps.now() });
      return c.json(result);
    })
    .post("/end", async (c) => {
      const summary = await endSeason(deps.db, deps.userClubId);
      if (!summary) {
        return c.json(
          {
            error: {
              code: "season_not_complete",
              message: "The season still has unplayed fixtures.",
            },
          },
          400,
        );
      }
      return c.json(summary);
    });
  return app;
}
