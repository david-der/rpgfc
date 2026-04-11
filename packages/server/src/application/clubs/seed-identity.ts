// Club identity seeder — Story 03.
//
// For every existing club in the run, populate a `club_identity_ext` row
// with colors + reputation + wage budget tier. Deterministic: a stable
// hash of the club name picks a palette entry and a reputation tier.
// Idempotent: if a club already has an identity row, skip it.

import type { ReputationTier } from "@rpgfc/shared";
import { REPUTATION_TIERS } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";
import { CLUB_PALETTES } from "./palette.js";

// Same stable hash we already use in the identity prose generator. Cheap,
// deterministic, no external deps.
function stableIndex(seed: string, mod: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % mod;
}

// Wage budget tier follows the same ramp as reputation. The pair is
// deterministic but not always identical — local clubs generally have
// smaller budgets but a lucky seed can shift the wage budget up one
// tier to add variety.
const WAGE_BUDGET_TIERS = ["Shoestring", "Modest", "Competitive", "Substantial", "Lavish"] as const;

export interface ClubIdentitySeedResult {
  clubsUpdated: number;
  clubsSkipped: number;
}

export async function seedClubIdentityIfMissing(client: DbClient): Promise<ClubIdentitySeedResult> {
  if (client.dialect === "sqlite") {
    const sqlite = client.sqlite;
    const clubs = sqlite
      .prepare<[], { id: number; name: string }>(`SELECT id, name FROM clubs`)
      .all();

    const existingRows = sqlite
      .prepare<[], { club_id: number }>(`SELECT club_id FROM club_identity_ext`)
      .all();
    const existing = new Set(existingRows.map((r) => r.club_id));

    const insert = sqlite.prepare(
      `INSERT INTO club_identity_ext
         (club_id, primary_color, secondary_color, stripe_color,
          primary_ink, secondary_ink, reputation_tier, wage_budget_tier,
          cash_reserve_cents, wage_budget_cents_per_week)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    let updated = 0;
    let skipped = 0;
    sqlite.exec("BEGIN");
    try {
      for (const club of clubs) {
        if (existing.has(club.id)) {
          skipped++;
          continue;
        }
        const palette = CLUB_PALETTES[stableIndex(club.name, CLUB_PALETTES.length)]!;
        const reputation = pickReputation(club.name);
        const wageBudget = pickWageBudget(club.name, reputation);
        const budgetCents = wageBudgetCentsFor(reputation);
        const cashReserveCents = cashReserveCentsFor(reputation, club.name);
        insert.run(
          club.id,
          palette.primary,
          palette.secondary,
          palette.stripe,
          palette.primaryInk,
          palette.secondaryInk,
          reputation,
          wageBudget,
          cashReserveCents,
          budgetCents,
        );
        updated++;
      }
      sqlite.exec("COMMIT");
    } catch (err) {
      sqlite.exec("ROLLBACK");
      throw err;
    }
    return { clubsUpdated: updated, clubsSkipped: skipped };
  }

  // Postgres path
  const pg = await client.pool.connect();
  try {
    await pg.query("BEGIN");
    const { rows: clubs } = await pg.query<{ id: number; name: string }>(
      `SELECT id, name FROM clubs`,
    );
    const { rows: existingRows } = await pg.query<{ club_id: number }>(
      `SELECT club_id FROM club_identity_ext`,
    );
    const existing = new Set(existingRows.map((r) => r.club_id));

    let updated = 0;
    let skipped = 0;
    for (const club of clubs) {
      if (existing.has(club.id)) {
        skipped++;
        continue;
      }
      const palette = CLUB_PALETTES[stableIndex(club.name, CLUB_PALETTES.length)]!;
      const reputation = pickReputation(club.name);
      const wageBudget = pickWageBudget(club.name, reputation);
      const budgetCents = wageBudgetCentsFor(reputation);
      const cashReserveCents = cashReserveCentsFor(reputation, club.name);
      await pg.query(
        `INSERT INTO club_identity_ext
           (club_id, primary_color, secondary_color, stripe_color,
            primary_ink, secondary_ink, reputation_tier, wage_budget_tier,
            cash_reserve_cents, wage_budget_cents_per_week)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          club.id,
          palette.primary,
          palette.secondary,
          palette.stripe,
          palette.primaryInk,
          palette.secondaryInk,
          reputation,
          wageBudget,
          cashReserveCents,
          budgetCents,
        ],
      );
      updated++;
    }
    await pg.query("COMMIT");
    return { clubsUpdated: updated, clubsSkipped: skipped };
  } catch (err) {
    await pg.query("ROLLBACK");
    throw err;
  } finally {
    pg.release();
  }
}

function pickReputation(clubName: string): ReputationTier {
  const idx = stableIndex(clubName + ":rep", REPUTATION_TIERS.length);
  return REPUTATION_TIERS[idx]!;
}

// Story 04 arithmetic-grade budgets. These are the cents the seller
// evaluator and bid flow actually compare against. Tier labels live
// on their own (wage_budget_tier TEXT) so the rendering layer can
// surface the label without doing arithmetic.
//
// Values are chosen so `Elite` clubs can comfortably sign a single
// `Significant`-tier wage without blowing their budget, while `Local`
// clubs top out around the `Modest` wage tier.
const WAGE_BUDGET_BY_REPUTATION: Record<ReputationTier, number> = {
  Local: 5_000_000, // $50k/week budget
  Regional: 15_000_000, // $150k/week
  National: 50_000_000, // $500k/week
  Continental: 150_000_000, // $1.5M/week
  Elite: 400_000_000, // $4M/week
};

const CASH_RESERVE_BY_REPUTATION: Record<ReputationTier, number> = {
  Local: 5_000_000_00, // $5M
  Regional: 25_000_000_00, // $25M
  National: 100_000_000_00, // $100M
  Continental: 400_000_000_00, // $400M
  Elite: 1_200_000_000_00, // $1.2B
};

function wageBudgetCentsFor(reputation: ReputationTier): number {
  return WAGE_BUDGET_BY_REPUTATION[reputation];
}

function cashReserveCentsFor(reputation: ReputationTier, clubName: string): number {
  // Add a small deterministic jitter (±25%) so two Elite clubs don't
  // have the exact same cash reserve.
  const base = CASH_RESERVE_BY_REPUTATION[reputation];
  const jitterPct = (stableIndex(clubName + ":cash", 21) - 10) / 40; // -0.25..+0.25
  return Math.floor(base * (1 + jitterPct));
}

function pickWageBudget(
  clubName: string,
  reputation: ReputationTier,
): (typeof WAGE_BUDGET_TIERS)[number] {
  // Start at the reputation's corresponding tier, then jitter ±1 so the
  // correlation is strong but not mechanical.
  const base = REPUTATION_TIERS.indexOf(reputation);
  const jitter = stableIndex(clubName + ":wage", 3) - 1; // -1 | 0 | 1
  const idx = Math.max(0, Math.min(WAGE_BUDGET_TIERS.length - 1, base + jitter));
  return WAGE_BUDGET_TIERS[idx]!;
}
