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
          primary_ink, secondary_ink, reputation_tier, wage_budget_tier)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
        insert.run(
          club.id,
          palette.primary,
          palette.secondary,
          palette.stripe,
          palette.primaryInk,
          palette.secondaryInk,
          reputation,
          wageBudget,
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
      await pg.query(
        `INSERT INTO club_identity_ext
           (club_id, primary_color, secondary_color, stripe_color,
            primary_ink, secondary_ink, reputation_tier, wage_budget_tier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          club.id,
          palette.primary,
          palette.secondary,
          palette.stripe,
          palette.primaryInk,
          palette.secondaryInk,
          reputation,
          wageBudget,
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
