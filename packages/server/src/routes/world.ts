// World routes — Story 03.
//
// /api/world/observation-tick is the dev-only lever that advances every
// active scout assignment by one round of observations. Story 07 wires
// the real seasonal calendar; until then, this endpoint is the only way
// to exercise the information economy from the UI without restarting
// the server.
//
// The route is ALWAYS declared so Hono's RPC type inference picks it up
// on the web client (`api.api.world["observation-tick"].$post()`). The
// dev guard runs inside the handler — production hits return 404 with
// the standard error envelope. AC-13 covers both branches.

import { Hono } from "hono";

import { tickWorldObservations } from "../rendering/index.js";
import type { DbClient } from "../db/client.js";

export interface WorldRouteDeps {
  db: DbClient;
  devEndpointsEnabled: boolean;
  currentRunId: number;
}

export function createWorldRoute(deps: WorldRouteDeps) {
  return new Hono().post("/observation-tick", async (c) => {
    if (!deps.devEndpointsEnabled) {
      return c.json({ error: { code: "not_found", message: "Not found" } }, 404);
    }
    const result = await tickWorldObservations(deps.db, deps.currentRunId);
    return c.json(result);
  });
}
