// Scouts routes — Story 03.
//
// Same layering rules as Story 01's players routes:
//   - Validate with Zod.
//   - Call rendering-layer orchestrators (`listScouts`, `getScout`,
//     `startScoutAssignment`, `tickWorldObservations`, `getPlayerReports`).
//   - Return the orchestrator output as JSON.
//
// The route layer never reaches into ../application/** — the rendering
// layer wraps that boundary. The `no-hidden-in-routes` ESLint rule
// enforces it mechanically.

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { getScout, listScouts, startScoutAssignment } from "../rendering/index.js";
import type { DbClient } from "../db/client.js";

export interface ScoutsRouteDeps {
  db: DbClient;
  /** Story 01's pattern: dev-only endpoints behind env.AUTH_MODE === "dev". */
  devEndpointsEnabled: boolean;
  /** Hardcoded for Story 03 — Story 08's run lifecycle wires the real run id. */
  currentRunId: number;
}

const idParam = z.object({ id: z.coerce.number().int().positive() });

const startBody = z.object({
  kind: z.enum(["region", "player"]),
  targetRegion: z.enum(["Iberia", "BeneluxFrance", "SouthAmerica", "Global"]).optional(),
  targetPlayerId: z.number().int().positive().optional(),
});

export function createScoutsRoute(deps: ScoutsRouteDeps) {
  const app = new Hono()
    .get("/", async (c) => {
      const items = await listScouts(deps.db, deps.currentRunId);
      return c.json({ items });
    })
    .get("/:id", zValidator("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      const result = await getScout(deps.db, id);
      if (!result) {
        return c.json({ error: { code: "not_found", message: "Scout not found" } }, 404);
      }
      return c.json(result);
    })
    .post(
      "/:id/assignments",
      zValidator("param", idParam),
      zValidator("json", startBody),
      async (c) => {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const assignment = await startScoutAssignment(deps.db, {
          scoutId: id,
          kind: body.kind,
          targetRegion: body.targetRegion ?? null,
          targetPlayerId: body.targetPlayerId ?? null,
        });
        return c.json(assignment);
      },
    );

  return app;
}
