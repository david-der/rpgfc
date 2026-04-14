// Sim-harness persona contract.
//
// Persona internals used to be hand-coded in this file; the actual
// decision logic now lives in strategy-engine.ts and is loaded from
// strategies/*.json. This module just defines the shared types.

import type { PlayingTimeRole } from "@rpgfc/shared";

export interface ClubSnapshot {
  clubId: number;
  clubName: string;
  reputationTier: string;
  cashCents: number;
  wageBillCents: number;
  wageBudgetCents: number;
  squadSize: number;
  leaguePosition: number;
  lastResult: "W" | "D" | "L" | null;
}

export interface ListingSnapshot {
  playerId: number;
  playerName: string;
  clubId: number;
  positionFamily: "gk" | "defender" | "midfielder" | "forward";
  /** Asking price for listed players, implied value for unlisted. */
  askingPriceCents: number;
  /** False = unsolicited inquiry required (see strategy.pursueUnlistedPremium). */
  isListed: boolean;
  /** What the player currently earns at their selling club. 0 if unknown. */
  currentWageCents: number;
  /** Player's wage floor preference, in cents. 0 if unknown. */
  wageFloorCents: number;
  age: number;
  badgeCount: number;
  formTier: string | null;
  /** Player's preferred regions (empty = any). */
  preferredRegions: string[];
  /** Player's minimum acceptable role promise. */
  minPlayingTime: PlayingTimeRole;
}

export interface OwnedPlayerSnapshot {
  playerId: number;
  playerName: string;
  age: number;
  seasonsRemaining: number;
  weeklyWageCents: number;
  rolePromise: PlayingTimeRole;
  formTier: string | null;
  squadRole: string | null;
  positionFamily: "gk" | "defender" | "midfielder" | "forward";
}

export interface PersonaContext {
  matchWeek: number;
  season: number;
  club: ClubSnapshot;
  ownedPlayers: OwnedPlayerSnapshot[];
  marketListings: ListingSnapshot[];
  /** Players this club already has an active bid on — skip them. */
  playersWithActiveBid: Set<number>;
  /** Players this club has fully abandoned (ratchet exceeded). */
  playersRecentlyRejected: Set<number>;
  /** Per-player bid attempt counter — used to drive ratchet escalation. */
  playerBidAttempts: Map<number, number>;
  /** Per-player extension rejection count. Capped at 2 attempts. */
  extensionRejections: Map<number, number>;
  /** Position families with a recent departure — backfill priority. */
  priorityBackfillPositions: Set<"gk" | "defender" | "midfielder" | "forward">;
  /** This club's nationality — used for player region preference filtering. */
  clubNationality: string;
  /** Successful signings by this club in the current season. */
  signingsThisSeason: number;
}

export type Action =
  | {
      kind: "bid";
      playerId: number;
      feeCents: number;
      wageCents: number;
      rolePromise: PlayingTimeRole;
    }
  | {
      kind: "extend";
      playerId: number;
      wageCents: number;
      seasons: number;
      rolePromise: PlayingTimeRole;
    };

export interface Persona {
  name: string;
  tagline: string;
  decide(ctx: PersonaContext): Action[];
}
