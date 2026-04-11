// Players routes.
//
// TDD v2 §2.2: the Interface layer imports only from the Rendering layer.
// The `no-hidden-in-routes` ESLint rule refuses imports under
// `packages/server/src/routes/` from any path matching `application/` or
// `*/hidden*`. That's enforced mechanically — routes go through the
// rendering layer's orchestration helpers
// (`renderPlayerById`, `renderPlayersPage`, `runPlayersSeed`), which are
// the only functions allowed to reach into application + domain.

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import type { DbClient } from "../db/client.js";
import {
  renderPlayerById,
  renderPlayersPage,
  runPlayersSeed,
} from "../rendering/index.js";
import type { RenderContext } from "../rendering/index.js";

export interface PlayersRouteDeps {
  db: DbClient;
  /** Whether dev-only endpoints are mounted. Reads env.AUTH_MODE === "dev". */
  devEndpointsEnabled: boolean;
  /** Clock for age math. Injected so tests can pin it. */
  now: () => Date;
}

const listQuery = z.object({
  clubId: z.coerce.number().int().positive().optional(),
  cursor: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

const generateBody = z.object({
  seed: z.number().int().default(42),
  clubCount: z.number().int().min(1).max(30).default(10),
  playersPerClub: z.number().int().min(1).max(50).default(20),
});

export function createPlayersRoute(deps: PlayersRouteDeps) {
  const app = new Hono()
    .get("/", zValidator("query", listQuery), async (c) => {
      const q = c.req.valid("query");
      const ctx: RenderContext = { viewerScoutLevel: 3, now: deps.now() };
      const page = await renderPlayersPage(deps.db, q, ctx);
      return c.json(page);
    })
    .get("/:id", zValidator("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      const ctx: RenderContext = { viewerScoutLevel: 3, now: deps.now() };
      const rendered = await renderPlayerById(deps.db, id, ctx);
      if (!rendered) {
        return c.json(
          { error: { code: "not_found", message: "Player not found" } },
          404,
        );
      }
      return c.json(rendered);
    });

  if (deps.devEndpointsEnabled) {
    app.post("/generate", zValidator("json", generateBody), async (c) => {
      const body = c.req.valid("json");
      const result = await runPlayersSeed(deps.db, {
        seed: body.seed,
        clubCount: body.clubCount,
        playersPerClub: body.playersPerClub,
        referenceDate: deps.now(),
      });
      return c.json(result);
    });
  }

  return app;
}
