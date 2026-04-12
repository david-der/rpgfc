// Weekly finance tick — Finance v2.
//
// Called inside advanceMatchday for every club. Credits TV money,
// sponsorship, and matchday income (home matches only this week).
// Debits weekly wages. Writes finance_events rows for the ledger.
//
// Amounts scale with reputation tier — Elite clubs earn (and spend)
// an order of magnitude more than Local clubs.

import type { DbClient } from "../../db/client.js";

interface RevenueRates {
  tvCents: number;
  sponsorCents: number;
  matchdayCents: number; // per home match
}

// Weekly rates by reputation tier. Picked so a mid-table club roughly
// breaks even on a typical week, while an Elite club makes a surplus
// that can fund transfers.
const RATES_BY_REP: Record<string, RevenueRates> = {
  Elite: {
    tvCents: 50_000_000_00,
    sponsorCents: 30_000_000_00,
    matchdayCents: 20_000_000_00,
  },
  Continental: {
    tvCents: 18_000_000_00,
    sponsorCents: 12_000_000_00,
    matchdayCents: 8_000_000_00,
  },
  National: {
    tvCents: 5_000_000_00,
    sponsorCents: 3_000_000_00,
    matchdayCents: 2_000_000_00,
  },
  Regional: {
    tvCents: 500_000_00,
    sponsorCents: 300_000_00,
    matchdayCents: 200_000_00,
  },
  Local: {
    tvCents: 100_000_00,
    sponsorCents: 50_000_00,
    matchdayCents: 50_000_00,
  },
};

const DEFAULT_RATES = RATES_BY_REP.National;

export interface WeeklyTickResult {
  clubsProcessed: number;
  totalRevenueCents: number;
  totalExpenseCents: number;
}

interface ClubBudgetRow {
  id: number;
  reputation_tier: string;
}

interface HomeMatchRow {
  home_club_id: number;
}

export async function tickWeeklyFinance(
  client: DbClient,
  season: number,
  matchWeek: number,
): Promise<WeeklyTickResult> {
  if (client.dialect !== "sqlite") {
    return { clubsProcessed: 0, totalRevenueCents: 0, totalExpenseCents: 0 };
  }
  const now = new Date().toISOString();

  const clubs = client.sqlite
    .prepare<[], ClubBudgetRow>(
      `SELECT c.id, COALESCE(ie.reputation_tier, 'National') AS reputation_tier
       FROM clubs c
       LEFT JOIN club_identity_ext ie ON ie.club_id = c.id`,
    )
    .all();

  // Home matches this week drive matchday income — a club only earns
  // matchday revenue when they host. Loaded once for the week.
  const homeMatches = client.sqlite
    .prepare<[number, number], HomeMatchRow>(
      `SELECT home_club_id FROM matches
       WHERE matchday = ? AND season = ? AND state = 'Played'`,
    )
    .all(matchWeek, season);
  const hostedByClub = new Set(homeMatches.map((m) => m.home_club_id));

  const insertEvent = client.sqlite.prepare(
    `INSERT INTO finance_events
       (club_id, season, match_week, kind, amount_cents, note, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const bumpCash = client.sqlite.prepare(
    `UPDATE club_identity_ext SET cash_reserve_cents = cash_reserve_cents + ? WHERE club_id = ?`,
  );
  const getWageBill = client.sqlite.prepare<[number], { total: number | null }>(
    `SELECT SUM(weekly_wage_cents) AS total FROM contracts WHERE club_id = ?`,
  );

  let totalRevenue = 0;
  let totalExpense = 0;

  for (const club of clubs) {
    const rates = RATES_BY_REP[club.reputation_tier] ?? DEFAULT_RATES!;

    // Credits.
    insertEvent.run(club.id, season, matchWeek, "revenue_tv", rates.tvCents, null, now);
    insertEvent.run(club.id, season, matchWeek, "revenue_sponsor", rates.sponsorCents, null, now);
    bumpCash.run(rates.tvCents + rates.sponsorCents, club.id);
    totalRevenue += rates.tvCents + rates.sponsorCents;

    if (hostedByClub.has(club.id)) {
      insertEvent.run(
        club.id, season, matchWeek, "revenue_matchday", rates.matchdayCents,
        "Home match attendance", now,
      );
      bumpCash.run(rates.matchdayCents, club.id);
      totalRevenue += rates.matchdayCents;
    }

    // Debit weekly wages.
    const wageRow = getWageBill.get(club.id);
    const wageBill = Number(wageRow?.total ?? 0);
    if (wageBill > 0) {
      insertEvent.run(
        club.id, season, matchWeek, "expense_wages", -wageBill,
        null, now,
      );
      bumpCash.run(-wageBill, club.id);
      totalExpense += wageBill;
    }
  }

  return {
    clubsProcessed: clubs.length,
    totalRevenueCents: totalRevenue,
    totalExpenseCents: totalExpense,
  };
}
