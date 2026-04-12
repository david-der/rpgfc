// Match routes — Story 06.
//
// Endpoints:
//   GET  /api/matches/:id    — RenderedMatch (prose narrative + per-player rows)

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { renderMatchById } from "../rendering/index.js";
import type { DbClient } from "../db/client.js";

export interface MatchesRouteDeps {
  db: DbClient;
}

const matchIdParam = z.object({ id: z.coerce.number().int().positive() });

export function createMatchesRoute(deps: MatchesRouteDeps) {
  const app = new Hono().get("/:id", zValidator("param", matchIdParam), async (c) => {
    const { id } = c.req.valid("param");
    const match = await renderMatchById(deps.db, id);
    if (!match) {
      return c.json({ error: { code: "not_found", message: "Match not found" } }, 404);
    }
    return c.json(match);
  });
  return app;
}
