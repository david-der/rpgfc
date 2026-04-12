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
    .prepare<[number], { id: number; club_id: number | null }>(
      `SELECT id, club_id FROM players WHERE id = ?`,
    )
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

  if (prefs) {
    // Extensions skip the forbidden-club and region checks — the player
    // is already at this club, so those don't apply. Only wage floor and
    // role promise matter for a renewal.
    const result = evaluatePlayerProposal({
      wageCents: input.wageCents,
      rolePromise: input.rolePromise,
      toClubId: input.clubId,
      toClubNationality: "",
      preferences: {
        wageFloorCents: prefs.wage_floor_cents,
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
    .prepare<[number], { cash_reserve_cents: number }>(
      `SELECT cash_reserve_cents FROM club_identity_ext WHERE club_id = ?`,
    )
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
      input.playerId, input.clubId, input.wageCents, input.signingBonusCents,
      input.seasons, input.rolePromise, scheduleJson, now,
    );

  // Deduct signing bonus, log the event.
  if (input.signingBonusCents > 0) {
    client.sqlite
      .prepare(
        `UPDATE club_identity_ext SET cash_reserve_cents = cash_reserve_cents - ? WHERE club_id = ?`,
      )
      .run(input.signingBonusCents, input.clubId);

    const state = client.sqlite
      .prepare<[], { season: number; next_match_week: number }>(
        `SELECT season, next_match_week FROM save_state WHERE id = 1`,
      )
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
