// Club route — per-club data for the Club dashboard.
//
// Currently returns finances only. More tabs (history, facilities,
// board) can hang off this later.

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
  CURRENCY_TIERS,
  FEE_TIER_MIDPOINT_CENTS,
  PLAYING_TIME_ROLES,
  WAGE_TIER_MIDPOINT_CENTS,
  feeTierFor,
  wageTierFor,
} from "@rpgfc/shared";
import type { CurrencyTier } from "@rpgfc/shared";

import { extendContract } from "../application/transfers/extend-contract.js";
import type { DbClient } from "../db/client.js";

export interface ClubRouteDeps {
  db: DbClient;
  userClubId: number;
}

interface FinancesResponse {
  clubId: number;
  clubName: string;
  reputationTier: string;
  // Tier words (for display consistency / future cross-club views).
  cashTier: CurrencyTier;
  wageBillTier: CurrencyTier;
  wageBudgetTier: CurrencyTier;
  wageBillVsBudget: "healthy" | "tight" | "overspent";
  recentSpendingTier: CurrencyTier;
  recentIncomeTier: CurrencyTier;
  // Real cents — you always know your own club's exact numbers.
  cashCents: number;
  wageBillCents: number;
  wageBudgetCents: number;
  recentSpendingCents: number;
  recentIncomeCents: number;
  // Projected annual wage total (52 match weeks).
  projectedAnnualWageCents: number;
}

async function loadFinances(
  client: DbClient,
  clubId: number,
): Promise<FinancesResponse | null> {
  if (client.dialect !== "sqlite") return null;

  const club = client.sqlite
    .prepare<
      [number],
      {
        id: number;
        name: string;
        reputation_tier: string;
        cash_reserve_cents: number;
        wage_budget_cents_per_week: number;
      }
    >(
      `SELECT c.id, c.name, ie.reputation_tier,
              ie.cash_reserve_cents, ie.wage_budget_cents_per_week
       FROM clubs c
       JOIN club_identity_ext ie ON ie.club_id = c.id
       WHERE c.id = ?`,
    )
    .get(clubId);
  if (!club) return null;

  const wageBill = client.sqlite
    .prepare<[number], { total: number | null }>(
      `SELECT SUM(weekly_wage_cents) AS total FROM contracts WHERE club_id = ?`,
    )
    .get(clubId);
  const weeklyWageCents = Number(wageBill?.total ?? 0);

  const spent = client.sqlite
    .prepare<[number], { total: number | null }>(
      `SELECT SUM(bp.fee_cents) AS total
       FROM bids b
       JOIN bid_proposals bp ON bp.id = b.current_proposal_id
       WHERE b.from_club_id = ? AND b.state = 'Signed'
         AND b.from_club_id != b.to_club_id`,
    )
    .get(clubId);
  const recentSpendingCents = Number(spent?.total ?? 0);

  const earned = client.sqlite
    .prepare<[number], { total: number | null }>(
      `SELECT SUM(bp.fee_cents) AS total
       FROM bids b
       JOIN bid_proposals bp ON bp.id = b.current_proposal_id
       WHERE b.to_club_id = ? AND b.state = 'Signed'
         AND b.from_club_id != b.to_club_id`,
    )
    .get(clubId);
  const recentIncomeCents = Number(earned?.total ?? 0);

  // Qualitative health check: wage bill vs budget.
  let wageBillVsBudget: "healthy" | "tight" | "overspent" = "healthy";
  if (club.wage_budget_cents_per_week > 0) {
    const ratio = weeklyWageCents / club.wage_budget_cents_per_week;
    if (ratio >= 1.0) wageBillVsBudget = "overspent";
    else if (ratio >= 0.85) wageBillVsBudget = "tight";
  }

  return {
    clubId: club.id,
    clubName: club.name,
    reputationTier: club.reputation_tier,
    cashTier: feeTierFor(club.cash_reserve_cents),
    wageBillTier: wageTierFor(weeklyWageCents),
    wageBudgetTier: wageTierFor(club.wage_budget_cents_per_week),
    wageBillVsBudget,
    recentSpendingTier: feeTierFor(recentSpendingCents),
    recentIncomeTier: feeTierFor(recentIncomeCents),
    cashCents: club.cash_reserve_cents,
    wageBillCents: weeklyWageCents,
    wageBudgetCents: club.wage_budget_cents_per_week,
    recentSpendingCents,
    recentIncomeCents,
    projectedAnnualWageCents: weeklyWageCents * 52,
  };
}

const extendBody = z.object({
  playerId: z.number().int().positive(),
  wageTier: z.enum(CURRENCY_TIERS),
  signingBonusTier: z.enum(CURRENCY_TIERS).default("Minimal"),
  seasons: z.number().int().min(1).max(5).default(3),
  rolePromise: z.enum(PLAYING_TIME_ROLES),
});

interface LedgerEvent {
  id: number;
  season: number;
  match_week: number;
  kind: string;
  amount_cents: number;
  note: string | null;
  recorded_at: string;
}

async function loadLedger(
  client: DbClient,
  clubId: number,
  limit = 40,
): Promise<LedgerEvent[]> {
  if (client.dialect !== "sqlite") return [];
  return client.sqlite
    .prepare<[number, number], LedgerEvent>(
      `SELECT id, season, match_week, kind, amount_cents, note, recorded_at
       FROM finance_events
       WHERE club_id = ?
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(clubId, limit);
}

export function createClubRoute(deps: ClubRouteDeps) {
  const app = new Hono()
    .get("/finances", async (c) => {
      const finances = await loadFinances(deps.db, deps.userClubId);
      if (!finances) {
        return c.json({ error: { code: "not_found", message: "Club not found" } }, 404);
      }
      return c.json(finances);
    })
    .get("/ledger", async (c) => {
      const events = await loadLedger(deps.db, deps.userClubId);
      return c.json({ events });
    })
    .post("/extend-contract", zValidator("json", extendBody), async (c) => {
      const body = c.req.valid("json");
      const result = await extendContract(deps.db, {
        playerId: body.playerId,
        clubId: deps.userClubId,
        wageCents: WAGE_TIER_MIDPOINT_CENTS[body.wageTier],
        signingBonusCents: FEE_TIER_MIDPOINT_CENTS[body.signingBonusTier],
        seasons: body.seasons,
        rolePromise: body.rolePromise,
      });
      if (result.kind === "error") {
        return c.json({ error: { code: "extend_error", message: result.message } }, 400);
      }
      if (result.kind === "reject") {
        return c.json({ error: { code: "player_rejected", reason: result.reason } }, 409);
      }
      return c.json({ ok: true });
    });
  return app;
}
