// Transfers routes — Story 04 + 08.
//
// The transfer dashboard serves five tabs:
//   GET  /api/transfers              — market listings
//   GET  /api/transfers/my-bids      — outgoing bids (buying)
//   GET  /api/transfers/offers       — incoming bids (selling)
//   GET  /api/transfers/watchlist    — tracked players
//   GET  /api/transfers/completed    — recent signed deals
//   POST /api/transfers/:playerId/bid
//   POST /api/transfers/bids/:bidId/force-accept
//   POST /api/transfers/watchlist/:playerId    — add to watchlist
//   DELETE /api/transfers/watchlist/:playerId  — remove from watchlist

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
  userClubId: number;
}

const playerIdParam = z.object({ playerId: z.coerce.number().int().positive() });
const bidIdParam = z.object({ bidId: z.coerce.number().int().positive() });

const submitBidBody = z.object({
  feeTier: z.enum(CURRENCY_TIERS),
  wageTier: z.enum(CURRENCY_TIERS),
  signingBonusTier: z.enum(CURRENCY_TIERS).default("Minimal"),
  rolePromise: z.enum(PLAYING_TIME_ROLES),
  isLoan: z.boolean().default(false),
});

// ── tab data loaders (inline SQL for simplicity) ──────────────────────────

interface BidRow {
  id: number;
  player_id: number;
  player_name: string;
  player_position: string;
  from_club_name: string;
  to_club_name: string;
  state: string;
  stance: string;
  fee_tier: string;
  wage_tier: string;
  role_promise: string;
  submitted_match_week: number | null;
  deadline_match_week: number | null;
  rejection_reason: string | null;
}

async function loadMyBids(client: DbClient, userClubId: number): Promise<BidRow[]> {
  if (client.dialect !== "sqlite") return [];
  return client.sqlite
    .prepare<[number], BidRow>(
      `SELECT b.id, b.player_id, p.name AS player_name, p.archetype_id AS player_position,
              fc.name AS from_club_name, tc.name AS to_club_name,
              b.state, b.stance,
              bp.role_promise,
              b.submitted_match_week, b.deadline_match_week,
              b.rejection_reason,
              bp.fee_cents AS fee_tier, bp.wage_cents AS wage_tier
       FROM bids b
       JOIN players p ON p.id = b.player_id
       JOIN clubs fc ON fc.id = b.from_club_id
       JOIN clubs tc ON tc.id = b.to_club_id
       LEFT JOIN bid_proposals bp ON bp.id = b.current_proposal_id
       WHERE b.from_club_id = ? AND b.from_club_id != b.to_club_id
       ORDER BY b.id DESC`,
    )
    .all(userClubId);
}

async function loadOffersReceived(client: DbClient, userClubId: number): Promise<BidRow[]> {
  if (client.dialect !== "sqlite") return [];
  return client.sqlite
    .prepare<[number], BidRow>(
      `SELECT b.id, b.player_id, p.name AS player_name, p.archetype_id AS player_position,
              fc.name AS from_club_name, tc.name AS to_club_name,
              b.state, b.stance,
              bp.role_promise,
              b.submitted_match_week, b.deadline_match_week,
              b.rejection_reason,
              bp.fee_cents AS fee_tier, bp.wage_cents AS wage_tier
       FROM bids b
       JOIN players p ON p.id = b.player_id
       JOIN clubs fc ON fc.id = b.from_club_id
       JOIN clubs tc ON tc.id = b.to_club_id
       LEFT JOIN bid_proposals bp ON bp.id = b.current_proposal_id
       WHERE b.to_club_id = ? AND b.from_club_id != b.to_club_id
       ORDER BY b.id DESC`,
    )
    .all(userClubId);
}

interface WatchlistRow {
  player_id: number;
  player_name: string;
  position_label: string;
  nationality: string;
  club_name: string | null;
  added_at: string;
}

async function loadWatchlist(client: DbClient, userClubId: number): Promise<WatchlistRow[]> {
  if (client.dialect !== "sqlite") return [];
  return client.sqlite
    .prepare<[number], WatchlistRow>(
      `SELECT w.player_id, p.name AS player_name, p.archetype_id AS position_label,
              p.nationality, c.name AS club_name, w.added_at
       FROM watchlist w
       JOIN players p ON p.id = w.player_id
       LEFT JOIN clubs c ON c.id = p.club_id
       WHERE w.club_id = ?
       ORDER BY w.added_at DESC`,
    )
    .all(userClubId);
}

interface CompletedDealRow {
  bid_id: number;
  player_id: number;
  player_name: string;
  from_club_name: string;
  to_club_name: string;
  role_promise: string;
}

async function loadCompletedDeals(client: DbClient, userClubId: number): Promise<CompletedDealRow[]> {
  if (client.dialect !== "sqlite") return [];
  return client.sqlite
    .prepare<[number, number], CompletedDealRow>(
      `SELECT b.id AS bid_id, b.player_id, p.name AS player_name,
              fc.name AS from_club_name, tc.name AS to_club_name,
              bp.role_promise
       FROM bids b
       JOIN players p ON p.id = b.player_id
       JOIN clubs fc ON fc.id = b.from_club_id
       JOIN clubs tc ON tc.id = b.to_club_id
       LEFT JOIN bid_proposals bp ON bp.id = b.current_proposal_id
       WHERE b.state = 'Signed'
         AND b.from_club_id != b.to_club_id
         AND (b.from_club_id = ? OR b.to_club_id = ?)
       ORDER BY b.id DESC
       LIMIT 20`,
    )
    .all(userClubId, userClubId);
}

export function createTransfersRoute(deps: TransfersRouteDeps) {
  const app = new Hono()
    // Market listings (existing).
    .get("/", async (c) => {
      const page = await renderTransfersPage(deps.db, {
        now: deps.now,
        userClubId: deps.userClubId,
      });
      return c.json(page);
    })
    // My outgoing bids.
    .get("/my-bids", async (c) => {
      const bids = await loadMyBids(deps.db, deps.userClubId);
      const state = await loadSeasonState(deps.db);
      return c.json({ bids, currentMatchWeek: state.matchWeek });
    })
    // Incoming offers on my players.
    .get("/offers", async (c) => {
      const offers = await loadOffersReceived(deps.db, deps.userClubId);
      return c.json({ offers });
    })
    // Watchlist.
    .get("/watchlist", async (c) => {
      const items = await loadWatchlist(deps.db, deps.userClubId);
      return c.json({ items });
    })
    .post(
      "/watchlist/:playerId",
      zValidator("param", playerIdParam),
      async (c) => {
        const { playerId } = c.req.valid("param");
        const now = deps.now().toISOString();
        if (deps.db.dialect === "sqlite") {
          deps.db.sqlite
            .prepare(
              `INSERT OR IGNORE INTO watchlist (club_id, player_id, added_at)
               VALUES (?, ?, ?)`,
            )
            .run(deps.userClubId, playerId, now);
        }
        return c.json({ added: true });
      },
    )
    .delete(
      "/watchlist/:playerId",
      zValidator("param", playerIdParam),
      async (c) => {
        const { playerId } = c.req.valid("param");
        if (deps.db.dialect === "sqlite") {
          deps.db.sqlite
            .prepare(`DELETE FROM watchlist WHERE club_id = ? AND player_id = ?`)
            .run(deps.userClubId, playerId);
        }
        return c.json({ removed: true });
      },
    )
    // Completed deals.
    .get("/completed", async (c) => {
      const deals = await loadCompletedDeals(deps.db, deps.userClubId);
      return c.json({ deals });
    })
    // Submit a bid.
    .post(
      "/:playerId/bid",
      zValidator("param", playerIdParam),
      zValidator("json", submitBidBody),
      async (c) => {
        const { playerId } = c.req.valid("param");
        const body = c.req.valid("json");
        const state = await loadSeasonState(deps.db);
        const rendered = await submitBidRendered(deps.db, {
          playerId,
          fromClubId: deps.userClubId,
          feeCents: FEE_TIER_MIDPOINT_CENTS[body.feeTier],
          wageCents: WAGE_TIER_MIDPOINT_CENTS[body.wageTier],
          signingBonusCents: FEE_TIER_MIDPOINT_CENTS[body.signingBonusTier],
          rolePromise: body.rolePromise,
          matchWeek: state.matchWeek,
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
