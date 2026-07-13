// Squad routes — Story 05.
//
// Endpoints:
//   GET  /api/squad                   — RenderedSquad for the user's club
//   PUT  /api/squad/:playerId/role    — update a player's SquadRole

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { SQUAD_ROLES } from "@rpgfc/shared";

import { renderSquadForClub, setSquadRoleRendered } from "../rendering/index.js";
import type { DbClient } from "../db/client.js";

export interface SquadRouteDeps {
  db: DbClient;
  userClubId: number;
}

const playerIdParam = z.object({ playerId: z.coerce.number().int().positive() });
const roleBody = z.object({ role: z.enum(SQUAD_ROLES) });

export function createSquadRoute(deps: SquadRouteDeps) {
  const app = new Hono()
    .get("/", async (c) => {
      const squad = await renderSquadForClub(deps.db, deps.userClubId);
      if (!squad) {
        return c.json({ error: { code: "not_found", message: "Club not found" } }, 404);
      }
      return c.json(squad);
    })
    .put(
      "/:playerId/role",
      zValidator("param", playerIdParam),
      zValidator("json", roleBody),
      async (c) => {
        const { playerId } = c.req.valid("param");
        const { role } = c.req.valid("json");
        const squad = await setSquadRoleRendered(deps.db, { playerId, role });
        if (!squad) {
          return c.json({ error: { code: "not_found", message: "Squad entry not found" } }, 404);
        }
        return c.json(squad);
      },
    );
  return app;
}
