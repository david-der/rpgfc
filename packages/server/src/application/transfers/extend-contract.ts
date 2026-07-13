// Contract extension — Finance v2.
//
// Negotiate new terms with a player already on your club. The player
// evaluates the offer against their preferences (same evaluator as
// initial signings — wage floor, role promise, etc). On accept:
// replace the contract with a fresh schedule + reset seasonsRemaining.
//
// Signing bonus is deducted from the club's cash immediately.

import type { PlayingTimeRole } from "@rpgfc/shared";

import type { DbClient } from "../../db/client.js";
import { evaluatePlayerProposal } from "./evaluators.js";

export interface ExtendContractInput {
  playerId: number;
  clubId: number;
  wageCents: number;
  signingBonusCents: number;
  seasons: number;
  rolePromise: PlayingTimeRole;
}

export type ExtendResult =
  | { kind: "accept" }
  | { kind: "reject"; reason: string }
  | { kind: "error"; message: string };

function buildSchedule(start: number, seasons: number): number[] {
  const schedule: number[] = [];
  for (let i = 0; i < seasons; i++) {
    schedule.push(Math.round(start * Math.pow(1.1, i)));
  }
  return schedule;
}

export async function extendContract(
  client: DbClient,
  input: ExtendContractInput,
): Promise<ExtendResult> {
  if (client.dialect !== "sqlite") {
    return { kind: "error", message: "Postgres extension path not yet implemented" };
  }

  // Verify the player is at the club.
  const player = client.sqlite
    .prepare<
      [number],
      { id: number; club_id: number | null }
    >(`SELECT id, club_id FROM players WHERE id = ?`)
    .get(input.playerId);
  if (!player) return { kind: "error", message: "Player not found" };
  if (player.club_id !== input.clubId) {
    return { kind: "error", message: "Player is not at this club" };
  }

  // Evaluate against player preferences.
  const prefs = client.sqlite
    .prepare<
      [number],
      {
        wage_floor_cents: number;
        min_playing_time: string;
        preferred_regions_json: string;
        forbidden_club_ids_json: string;
      }
    >(
      `SELECT wage_floor_cents, min_playing_time, preferred_regions_json, forbidden_club_ids_json
       FROM player_preferences WHERE player_id = ?`,
    )
    .get(input.playerId);

  // Extensions are more forgiving than initial signings. The player
  // is already at the club, so:
  //
  //  - Wage: compared to their CURRENT weekly wage (or floor if no
  //    contract exists), not just the static wage floor. A 10% pay cut
  //    is the max they'll tolerate — anything above current wage is
  //    always accepted.
  //  - Role promise: must meet their minimum playing time preference.
  //  - Region / forbidden clubs: skipped (they're already here).
  const currentContract = client.sqlite
    .prepare<
      [number],
      { weekly_wage_cents: number }
    >(`SELECT weekly_wage_cents FROM contracts WHERE player_id = ?`)
    .get(input.playerId);
  const currentWage = currentContract?.weekly_wage_cents ?? 0;
  const wageFloor = prefs?.wage_floor_cents ?? 0;
  // Acceptance threshold: 90% of max(current, floor). So you can lowball
  // a veteran by up to 10% and they'll still renew, but you can't slash
  // them from $5M/wk to $1M/wk.
  const threshold = Math.floor(Math.max(currentWage, wageFloor) * 0.9);
  if (input.wageCents < threshold) {
    return { kind: "reject", reason: "PLAYER_WAGE_FLOOR" };
  }

  if (prefs) {
    // Role promise: evaluate against minPlayingTime only.
    const result = evaluatePlayerProposal({
      wageCents: input.wageCents,
      rolePromise: input.rolePromise,
      toClubId: input.clubId,
      toClubNationality: "",
      preferences: {
        wageFloorCents: 0, // skip wage floor — we just checked it
        minPlayingTime: prefs.min_playing_time as PlayingTimeRole,
        preferredRegions: [], // skip region check
        forbiddenClubIds: [], // skip forbidden check
      },
    });
    if (result.kind === "reject") {
      return { kind: "reject", reason: result.reason };
    }
  }

  // Check club can afford the signing bonus.
  const budget = client.sqlite
    .prepare<
      [number],
      { cash_reserve_cents: number }
    >(`SELECT cash_reserve_cents FROM club_identity_ext WHERE club_id = ?`)
    .get(input.clubId);
  if (!budget || budget.cash_reserve_cents < input.signingBonusCents) {
    return { kind: "reject", reason: "CLUB_CANNOT_AFFORD_BONUS" };
  }

  // Replace the contract.
  const now = new Date().toISOString();
  const schedule = buildSchedule(input.wageCents, input.seasons);
  const scheduleJson = JSON.stringify(schedule);

  client.sqlite.prepare(`DELETE FROM contracts WHERE player_id = ?`).run(input.playerId);
  client.sqlite
    .prepare(
      `INSERT INTO contracts
         (player_id, club_id, weekly_wage_cents, signing_bonus_cents,
          seasons_remaining, role_promise, release_clause_cents, is_loan,
          loan_details_json, wages_by_season_json, signed_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?)`,
    )
    .run(
      input.playerId,
      input.clubId,
      input.wageCents,
      input.signingBonusCents,
      input.seasons,
      input.rolePromise,
      scheduleJson,
      now,
    );

  // Deduct signing bonus, log the event.
  if (input.signingBonusCents > 0) {
    client.sqlite
      .prepare(
        `UPDATE club_identity_ext SET cash_reserve_cents = cash_reserve_cents - ? WHERE club_id = ?`,
      )
      .run(input.signingBonusCents, input.clubId);

    const state = client.sqlite
      .prepare<
        [],
        { season: number; next_match_week: number }
      >(`SELECT season, next_match_week FROM save_state WHERE id = 1`)
      .get();
    client.sqlite
      .prepare(
        `INSERT INTO finance_events
           (club_id, season, match_week, kind, amount_cents, note, recorded_at)
         VALUES (?, ?, ?, 'signing_bonus', ?, 'Contract extension', ?)`,
      )
      .run(
        input.clubId,
        state?.season ?? 0,
        state?.next_match_week ?? 1,
        -input.signingBonusCents,
        now,
      );
  }

  return { kind: "accept" };
}
