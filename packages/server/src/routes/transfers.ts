// Transfers routes — Story 04.
//
// Layering: routes → rendering layer → application layer. Routes cannot
// import anything under `../application/**` — the rendering-layer
// orchestrators in `transfer-response.ts` are the only bridge.
//
// Endpoints:
//   GET  /api/transfers                       listings + pending bids for the user's club
//   POST /api/transfers/:playerId/bid         submit a bid + role promise + fee/wage tiers
//   POST /api/transfers/bids/:bidId/force-accept  dev-only shortcut to drive a bid to Signed
//   GET  /api/players/:id/contract            rendered contract (wired from players route)

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
  CURRENCY_TIERS,
  FEE_TIER_MIDPOINT_CENTS,
  PLAYING_TIME_ROLES,
  WAGE_TIER_MIDPOINT_CENTS,
} from "@rpgfc/shared";

import {
  forceAcceptBidRendered,
  renderTransfersPage,
  submitBidRendered,
} from "../rendering/index.js";
import { loadSeasonState } from "../application/season/state.js";
import type { DbClient } from "../db/client.js";

export interface TransfersRouteDeps {
  db: DbClient;
  now: () => Date;
  devEndpointsEnabled: boolean;
  /** Hardcoded in Story 04 until real user auth lands in Story 09. */
  userClubId: number;
}

const playerIdParam = z.object({ playerId: z.coerce.number().int().positive() });
const bidIdParam = z.object({ bidId: z.coerce.number().int().positive() });

// Bid composer accepts tier WORDS — not cents — from the UI. Server
// translates via FEE_TIER_MIDPOINT_CENTS / WAGE_TIER_MIDPOINT_CENTS.
const submitBidBody = z.object({
  feeTier: z.enum(CURRENCY_TIERS),
  wageTier: z.enum(CURRENCY_TIERS),
  signingBonusTier: z.enum(CURRENCY_TIERS).default("Minimal"),
  rolePromise: z.enum(PLAYING_TIME_ROLES),
  isLoan: z.boolean().default(false),
});

export function createTransfersRoute(deps: TransfersRouteDeps) {
  const app = new Hono()
    .get("/", async (c) => {
      const page = await renderTransfersPage(deps.db, {
        now: deps.now,
        userClubId: deps.userClubId,
      });
      return c.json(page);
    })
    .post(
      "/:playerId/bid",
      zValidator("param", playerIdParam),
      zValidator("json", submitBidBody),
      async (c) => {
        const { playerId } = c.req.valid("param");
        const body = c.req.valid("json");

        // Story 07: transfer window guard. Bids are only accepted
        // during open windows (match weeks 1–4 and 19–22).
        const seasonState = await loadSeasonState(deps.db);
        if (!seasonState.transferWindowOpen) {
          return c.json(
            {
              error: {
                code: "transfer_window_closed",
                message: "The transfer window is closed.",
              },
            },
            403,
          );
        }

        const rendered = await submitBidRendered(deps.db, {
          playerId,
          fromClubId: deps.userClubId,
          feeCents: FEE_TIER_MIDPOINT_CENTS[body.feeTier],
          wageCents: WAGE_TIER_MIDPOINT_CENTS[body.wageTier],
          signingBonusCents: FEE_TIER_MIDPOINT_CENTS[body.signingBonusTier],
          rolePromise: body.rolePromise,
          loanOffer: body.isLoan
            ? {
                wageCoveragePct: 0.5,
                playingTimeGuarantee: 10,
                obligationToBuy: false,
                endsAt: new Date(deps.now().getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              }
            : null,
          now: deps.now(),
        });
        return c.json(rendered);
      },
    )
    .post("/bids/:bidId/force-accept", zValidator("param", bidIdParam), async (c) => {
      if (!deps.devEndpointsEnabled) {
        return c.json({ error: { code: "not_found", message: "Not found" } }, 404);
      }
      const { bidId } = c.req.valid("param");
      const rendered = await forceAcceptBidRendered(deps.db, bidId);
      if (!rendered) {
        return c.json({ error: { code: "not_found", message: "Bid not found" } }, 404);
      }
      return c.json(rendered);
    });
  return app;
}
