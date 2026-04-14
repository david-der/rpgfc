// Club detail route — any-club view for the League drill-down.
//
// Returns a rich shape matching what the user sees for their own club:
// roster, contracts, recent form, finances. The endpoint is the same
// for every club so the client can browse the league freely.

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
  ARCHETYPE_BY_ID,
  FORM_TIER_LABELS,
  feeTierFor,
  wageTierFor,
} from "@rpgfc/shared";
import type { CurrencyTier, FormTier } from "@rpgfc/shared";

import type { DbClient } from "../db/client.js";

export interface ClubsRouteDeps {
  db: DbClient;
}

const clubIdParam = z.object({ id: z.coerce.number().int().positive() });

interface RosterPlayer {
  playerId: number;
  playerName: string;
  positionLabel: string;
  age: number;
  nationality: string;
  squadRole: string | null;
  rolePromise: string | null;
  weeklyWageCents: number;
  wageTier: CurrencyTier;
  seasonsRemaining: number | null;
  formTier: FormTier | null;
  formTierLabel: string | null;
}

interface RecentMatch {
  matchId: number;
  matchday: number;
  homeClubId: number;
  awayClubId: number;
  homeClubName: string;
  awayClubName: string;
  homeGoals: number;
  awayGoals: number;
  result: "W" | "D" | "L";
}

interface ClubDetailResponse {
  clubId: number;
  clubName: string;
  reputationTier: string;
  cashTier: CurrencyTier;
  wageBillTier: CurrencyTier;
  cashCents: number;
  wageBillCents: number;
  roster: RosterPlayer[];
  recentMatches: RecentMatch[];
}

async function loadClubDetail(
  client: DbClient,
  clubId: number,
): Promise<ClubDetailResponse | null> {
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
      `SELECT c.id, c.name,
              ie.reputation_tier,
              COALESCE(ie.cash_reserve_cents, 0) AS cash_reserve_cents,
              COALESCE(ie.wage_budget_cents_per_week, 0) AS wage_budget_cents_per_week
       FROM clubs c
       LEFT JOIN club_identity_ext ie ON ie.club_id = c.id
       WHERE c.id = ?`,
    )
    .get(clubId);
  if (!club) return null;

  // Roster: players currently at this club, joined against form +
  // squad entries + contracts. Limit to 40 (a safe cap).
  const rosterRows = client.sqlite
    .prepare<
      [number],
      {
        player_id: number;
        player_name: string;
        archetype_id: string;
        age: number;
        nationality: string;
        squad_role: string | null;
        role_promise: string | null;
        weekly_wage_cents: number | null;
        seasons_remaining: number | null;
      }
    >(
      `SELECT p.id AS player_id, p.name AS player_name, p.archetype_id,
              p.age, p.nationality,
              s.role AS squad_role,
              c.role_promise,
              c.weekly_wage_cents,
              c.seasons_remaining
       FROM players p
       LEFT JOIN squad_entries s ON s.player_id = p.id
       LEFT JOIN contracts c ON c.player_id = p.id
       WHERE p.club_id = ?
       ORDER BY p.id
       LIMIT 40`,
    )
    .all(clubId);

  // Build form tier per player from the last 5 performances.
  const roster: RosterPlayer[] = rosterRows.map((row) => {
    const archetype = ARCHETYPE_BY_ID[row.archetype_id];
    const positionLabel = archetype?.positionLabel ?? "??";
    const formRow = client.sqlite
      .prepare<[number], { tier: string }>(
        `SELECT pmp.tier
         FROM player_match_performance pmp
         JOIN matches m ON m.id = pmp.match_id
         WHERE pmp.player_id = ? AND m.state = 'Played'
         ORDER BY m.matchday DESC
         LIMIT 5`,
      )
      .all(row.player_id);
    // Average the last 5 tier weights.
    const weightOf: Record<string, number> = {
      Excellent: 4, Good: 3, Average: 2, Poor: 1, Dreadful: 0,
    };
    const weights = formRow.map((r) => weightOf[r.tier] ?? 2);
    let formTier: FormTier | null = null;
    if (weights.length > 0) {
      const avg = Math.round(weights.reduce((a, b) => a + b, 0) / weights.length);
      const tierByBucket: FormTier[] = ["Dreadful", "Poor", "Average", "Good", "Excellent"];
      formTier = tierByBucket[Math.max(0, Math.min(4, avg))]!;
    }

    const wage = row.weekly_wage_cents ?? 0;
    return {
      playerId: row.player_id,
      playerName: row.player_name,
      positionLabel,
      age: row.age,
      nationality: row.nationality,
      squadRole: row.squad_role,
      rolePromise: row.role_promise,
      weeklyWageCents: wage,
      wageTier: wageTierFor(wage),
      seasonsRemaining: row.seasons_remaining,
      formTier,
      formTierLabel: formTier ? FORM_TIER_LABELS[formTier] : null,
    };
  });

  // Recent matches — last 10 played matches involving this club.
  const matchRows = client.sqlite
    .prepare<
      [number, number],
      {
        id: number;
        matchday: number;
        home_club_id: number;
        away_club_id: number;
        home_name: string;
        away_name: string;
        home_goals: number;
        away_goals: number;
      }
    >(
      `SELECT m.id, m.matchday, m.home_club_id, m.away_club_id,
              hc.name AS home_name, ac.name AS away_name,
              m.home_goals, m.away_goals
       FROM matches m
       JOIN clubs hc ON hc.id = m.home_club_id
       JOIN clubs ac ON ac.id = m.away_club_id
       WHERE m.state = 'Played'
         AND (m.home_club_id = ? OR m.away_club_id = ?)
       ORDER BY m.matchday DESC, m.id DESC
       LIMIT 10`,
    )
    .all(clubId, clubId);

  const recentMatches: RecentMatch[] = matchRows.map((row) => {
    const isHome = row.home_club_id === clubId;
    const us = isHome ? row.home_goals : row.away_goals;
    const them = isHome ? row.away_goals : row.home_goals;
    const result: "W" | "D" | "L" = us > them ? "W" : us < them ? "L" : "D";
    return {
      matchId: row.id,
      matchday: row.matchday,
      homeClubId: row.home_club_id,
      awayClubId: row.away_club_id,
      homeClubName: row.home_name,
      awayClubName: row.away_name,
      homeGoals: row.home_goals,
      awayGoals: row.away_goals,
      result,
    };
  });

  const wageBillRow = client.sqlite
    .prepare<[number], { total: number | null }>(
      `SELECT SUM(weekly_wage_cents) AS total FROM contracts WHERE club_id = ?`,
    )
    .get(clubId);
  const wageBillCents = Number(wageBillRow?.total ?? 0);

  return {
    clubId: club.id,
    clubName: club.name,
    reputationTier: club.reputation_tier,
    cashTier: feeTierFor(club.cash_reserve_cents),
    wageBillTier: wageTierFor(wageBillCents),
    cashCents: club.cash_reserve_cents,
    wageBillCents,
    roster,
    recentMatches,
  };
}

export function createClubsRoute(deps: ClubsRouteDeps) {
  const app = new Hono().get("/:id", zValidator("param", clubIdParam), async (c) => {
    const { id } = c.req.valid("param");
    const detail = await loadClubDetail(deps.db, id);
    if (!detail) {
      return c.json({ error: { code: "not_found", message: "Club not found" } }, 404);
    }
    return c.json(detail);
  });
  return app;
}
