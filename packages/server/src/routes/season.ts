// Season routes — Story 06.
//
// Endpoints:
//   GET  /api/season/fixtures           — RenderedFixturesPage for the user's club
//   POST /api/season/advance            — simulate the next matchday

import { Hono } from "hono";

import {
  advanceMatchdayRendered,
  renderFixturesForUser,
} from "../rendering/index.js";
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
    .post("/advance", async (c) => {
      const result = await advanceMatchdayRendered(deps.db, { now: deps.now() });
      return c.json(result);
    });
  return app;
}
