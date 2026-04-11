// World routes — Story 03.
//
// /api/world/observation-tick is the dev-only lever that advances every
// active scout assignment by one round of observations. Story 07 wires
// the real seasonal calendar; until then, this endpoint is the only way
// to exercise the information economy from the UI without restarting
// the server.
//
// Gated on devEndpointsEnabled (env.AUTH_MODE === "dev") exactly like
// `/api/players/generate`.

import { Hono } from "hono";

import { tickWorldObservations } from "../rendering/index.js";
import type { DbClient } from "../db/client.js";

export interface WorldRouteDeps {
  db: DbClient;
  devEndpointsEnabled: boolean;
  currentRunId: number;
}

export function createWorldRoute(deps: WorldRouteDeps) {
  const app = new Hono();
  if (deps.devEndpointsEnabled) {
    app.post("/observation-tick", async (c) => {
      const result = await tickWorldObservations(deps.db, deps.currentRunId);
      return c.json(result);
    });
  }
  return app;
}
