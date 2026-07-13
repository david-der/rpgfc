// Tactics routes — Story 05.
//
// Layering: routes → rendering layer → application layer. Routes only
// import from rendering/*, never from application/*. The tactics-
// response module is the single bridge.
//
// Endpoints:
//   GET  /api/tactics                       — current tactics for the user's club
//   PUT  /api/tactics                       — upsert formation + style + instructions
//   POST /api/tactics/assignments           — pin or clear a slot

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { FORMATIONS, PITCH_SLOTS, PLAYING_STYLES, TEAM_INSTRUCTIONS } from "@rpgfc/shared";

import {
  renderTacticsForClub,
  setAssignmentRendered,
  upsertTacticsRendered,
} from "../rendering/index.js";
import type { DbClient } from "../db/client.js";

export interface TacticsRouteDeps {
  db: DbClient;
  userClubId: number;
}

const upsertBody = z.object({
  formation: z.enum(FORMATIONS),
  playingStyle: z.enum(PLAYING_STYLES),
  instructions: z.array(z.enum(TEAM_INSTRUCTIONS)).max(6),
});

// `playerId: null` clears the slot. The .nullable() on the Zod schema
// makes the JSON `{slot:"LW",playerId:null}` explicit.
const assignmentBody = z.object({
  slot: z.enum(PITCH_SLOTS),
  playerId: z.number().int().positive().nullable(),
});

export function createTacticsRoute(deps: TacticsRouteDeps) {
  const app = new Hono()
    .get("/", async (c) => {
      const rendered = await renderTacticsForClub(deps.db, deps.userClubId);
      return c.json(rendered);
    })
    .put("/", zValidator("json", upsertBody), async (c) => {
      const body = c.req.valid("json");
      const rendered = await upsertTacticsRendered(deps.db, {
        clubId: deps.userClubId,
        formation: body.formation,
        playingStyle: body.playingStyle,
        instructions: body.instructions,
      });
      return c.json(rendered);
    })
    .post("/assignments", zValidator("json", assignmentBody), async (c) => {
      const body = c.req.valid("json");
      const result = await setAssignmentRendered(deps.db, {
        clubId: deps.userClubId,
        slot: body.slot,
        playerId: body.playerId,
      });
      if (!result.ok) {
        return c.json(
          { error: { code: result.reason, message: "Slot is not part of the current formation." } },
          400,
        );
      }
      return c.json(result.tactics);
    });
  return app;
}
