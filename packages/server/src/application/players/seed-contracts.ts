// Seed initial contracts — Finance v2 follow-up.
//
// Every contracted player needs an initial contract on world gen.
// Previously only signed-via-bid players had contracts, which left
// most of the league with $0 weekly wages (and no renewal target).
//
// Wages scale with experience, matching the wage-floor ramp in
// seed-listings.ts so renewals are plausible. Minimum $100k/year
// ($1923/week) hard floor — no free labor.
//
// Idempotent: if a player already has a contract row, skip.

import { mulberry32 } from "../generation/rng.js";
import type { DbClient } from "../../db/client.js";

export interface ContractSeedResult {
  contractsCreated: number;
  skipped: boolean;
}

const MIN_WEEKLY_WAGE_CENTS = 192_300; // $100k/year = ~$1,923/week

interface PlayerRow {
  id: number;
  club_id: number | null;
  experience_years: number;
}

function roleForExperience(experienceYears: number): string {
  if (experienceYears >= 18) return "Star Player";
  if (experienceYears >= 12) return "Important Player";
  if (experienceYears >= 6) return "Rotation";
  if (experienceYears >= 2) return "Backup";
  return "Youth/Development";
}

function wageFor(experienceYears: number, rng: { next(): number }): number {
  // Scales with experience — mirror the wage floor ramp but a bit
  // above it so the contract sits comfortably inside the player's
  // acceptance band.
  const expRamp = [
    600_000,   // $6k/week at 0 years
    2_000_000, // $20k/week at 5 years
    4_000_000, // $40k/week at 10 years
    6_500_000, // $65k/week at 15 years
    10_000_000, // $100k/week at 20+ years
  ];
  const slot = Math.min(Math.floor(experienceYears / 5), expRamp.length - 1);
  const base = expRamp[slot]!;
  const jittered = Math.floor(base * (0.85 + rng.next() * 0.4));
  return Math.max(MIN_WEEKLY_WAGE_CENTS, jittered);
}

function seasonsFor(experienceYears: number, rng: { next(): number }): number {
  // Young players get longer runway on their initial contract.
  // Veterans get shorter. Adds variety so renewal timing differs.
  if (experienceYears < 5) return 3 + (rng.next() < 0.5 ? 1 : 0); // 3-4
  if (experienceYears < 15) return 2 + (rng.next() < 0.5 ? 1 : 0); // 2-3
  return 1 + (rng.next() < 0.5 ? 1 : 0); // 1-2
}

function buildSchedule(startingWageCents: number, seasons: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < seasons; i++) {
    out.push(Math.round(startingWageCents * Math.pow(1.08, i)));
  }
  return out;
}

export async function seedContractsIfEmpty(client: DbClient): Promise<ContractSeedResult> {
  if (client.dialect === "sqlite") {
    const existing = client.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM contracts`)
      .get();
    if ((existing?.n ?? 0) > 0) return { contractsCreated: 0, skipped: true };
  } else {
    const res = await client.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM contracts`,
    );
    if (Number(res.rows[0]?.n ?? 0) > 0) return { contractsCreated: 0, skipped: true };
  }

  const players = await loadContractedPlayers(client);
  const now = new Date().toISOString();
  let created = 0;

  for (const player of players) {
    const rng = mulberry32((player.id * 211 + 17) >>> 0);
    const wage = wageFor(player.experience_years, rng);
    const seasons = seasonsFor(player.experience_years, rng);
    const schedule = buildSchedule(wage, seasons);
    const scheduleJson = JSON.stringify(schedule);
    const role = roleForExperience(player.experience_years);

    if (client.dialect === "sqlite") {
      client.sqlite
        .prepare(
          `INSERT INTO contracts
             (player_id, club_id, weekly_wage_cents, signing_bonus_cents,
              seasons_remaining, role_promise, release_clause_cents, is_loan,
              loan_details_json, wages_by_season_json, signed_at)
           VALUES (?, ?, ?, 0, ?, ?, NULL, 0, NULL, ?, ?)`,
        )
        .run(player.id, player.club_id, wage, seasons, role, scheduleJson, now);
    } else {
      await client.pool.query(
        `INSERT INTO contracts
           (player_id, club_id, weekly_wage_cents, signing_bonus_cents,
            seasons_remaining, role_promise, release_clause_cents, is_loan,
            loan_details_json, wages_by_season_json, signed_at)
         VALUES ($1, $2, $3, 0, $4, $5, NULL, 0, NULL, $6, $7)`,
        [player.id, player.club_id, wage, seasons, role, scheduleJson, now],
      );
    }
    created++;
  }

  return { contractsCreated: created, skipped: false };
}

async function loadContractedPlayers(client: DbClient): Promise<PlayerRow[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[], PlayerRow>(
        `SELECT id, club_id, experience_years FROM players WHERE club_id IS NOT NULL`,
      )
      .all();
  }
  const res = await client.pool.query<PlayerRow>(
    `SELECT id, club_id, experience_years FROM players WHERE club_id IS NOT NULL`,
  );
  return res.rows;
}
