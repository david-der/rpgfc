// Season simulator — drives a full season with each of 10 clubs
// under the control of a distinct persona, then writes a rich
// markdown evidence report.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PlayingTimeRole } from "@rpgfc/shared";
import {
  FEE_TIER_MIDPOINT_CENTS,
  WAGE_TIER_MIDPOINT_CENTS,
} from "@rpgfc/shared";

import { createDbClient, type DbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedContentIfMissing } from "../application/content-seed.js";
import { seedClubIdentityIfMissing } from "../application/clubs/seed-identity.js";
import { seedWorldIfEmpty } from "../application/players/index.js";
import { seedContractsIfEmpty } from "../application/players/seed-contracts.js";
import {
  seedListingsIfEmpty,
  seedPreferencesIfEmpty,
} from "../application/transfers/seed-listings.js";
import { seedTacticsIfEmpty } from "../application/tactics/seed.js";
import { seedSquadIfEmpty } from "../application/squad/seed.js";
import {
  ensureSaveState,
  seedFixturesIfEmpty,
} from "../application/season/seed.js";
import { advanceMatchday } from "../application/season/advance.js";
import { submitBid } from "../application/transfers/bids.js";
import { extendContract } from "../application/transfers/extend-contract.js";
import { computeLeagueTable } from "../rendering/league-table.js";

import {
  PERSONA_ROSTER,
  type ClubSnapshot,
  type ListingSnapshot,
  type OwnedPlayerSnapshot,
  type Persona,
  type PersonaContext,
} from "./personas.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");
const TOTAL_MATCH_WEEKS = 18; // 10 clubs → 2 × 9 = 18 full-season weeks.

// ── event log shapes ─────────────────────────────────────────────────────

interface MatchLog {
  matchday: number;
  homeClubName: string;
  awayClubName: string;
  homeGoals: number;
  awayGoals: number;
}

interface TransferAttempt {
  matchweek: number;
  byClub: string;
  byPersona: string;
  playerName: string;
  feeTier: string;
  wageTier: string;
  rolePromise: string;
  outcome: string; // final state after season
}

interface ExtensionAttempt {
  matchweek: number;
  byClub: string;
  byPersona: string;
  playerName: string;
  wageTier: string;
  seasons: number;
  outcome: "accepted" | "rejected" | "error";
  note?: string;
}

interface WeekSnapshot {
  matchweek: number;
  matches: MatchLog[];
  tableTop3: Array<{ pos: number; club: string; pts: number; gd: number }>;
  bidsPlaced: number;
  extensionsAttempted: number;
}

// ── snapshot loaders ─────────────────────────────────────────────────────

function loadClubSnapshot(
  db: DbClient,
  clubId: number,
  _season: number,
  lastResult: Map<number, "W" | "D" | "L" | null>,
): ClubSnapshot {
  if (db.dialect !== "sqlite") throw new Error("sqlite only");
  const row = db.sqlite
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
              COALESCE(ie.cash_reserve_cents, 0) AS cash_reserve_cents,
              COALESCE(ie.wage_budget_cents_per_week, 0) AS wage_budget_cents_per_week
       FROM clubs c
       LEFT JOIN club_identity_ext ie ON ie.club_id = c.id
       WHERE c.id = ?`,
    )
    .get(clubId)!;

  const wage = db.sqlite
    .prepare<[number], { total: number | null }>(
      `SELECT SUM(weekly_wage_cents) AS total FROM contracts WHERE club_id = ?`,
    )
    .get(clubId);
  const squad = db.sqlite
    .prepare<[number], { n: number }>(
      `SELECT COUNT(*) AS n FROM squad_entries WHERE club_id = ?`,
    )
    .get(clubId);

  const table = /* cached */ undefined;
  const _cached = table; // unused, kept for clarity
  void _cached;
  return {
    clubId: row.id,
    clubName: row.name,
    reputationTier: row.reputation_tier,
    cashCents: row.cash_reserve_cents,
    wageBillCents: Number(wage?.total ?? 0),
    wageBudgetCents: row.wage_budget_cents_per_week,
    squadSize: squad?.n ?? 0,
    leaguePosition: 0, // filled in after computing table
    lastResult: lastResult.get(clubId) ?? null,
  };
}

function loadListings(db: DbClient, excludeClubId: number): ListingSnapshot[] {
  if (db.dialect !== "sqlite") return [];
  return db.sqlite
    .prepare<
      [number],
      {
        player_id: number;
        player_name: string;
        club_id: number;
        archetype_id: string;
        asking_price_cents: number;
        dob: string;
        badge_count: number;
        tier: string | null;
      }
    >(
      `SELECT l.player_id, p.name AS player_name, p.club_id,
              p.archetype_id, l.asking_price_cents, p.dob,
              (SELECT COUNT(*) FROM player_badges b WHERE b.player_id = p.id) AS badge_count,
              (SELECT pmp.tier FROM player_match_performance pmp
               JOIN matches m ON m.id = pmp.match_id
               WHERE pmp.player_id = p.id AND m.state = 'Played'
               ORDER BY m.matchday DESC LIMIT 1) AS tier
       FROM listing l
       JOIN players p ON p.id = l.player_id
       WHERE p.club_id != ?`,
    )
    .all(excludeClubId)
    .map((r) => ({
      playerId: r.player_id,
      playerName: r.player_name,
      clubId: r.club_id,
      positionFamily: positionFamilyFromArchetype(r.archetype_id),
      askingPriceCents: r.asking_price_cents,
      age: ageFromDob(r.dob),
      badgeCount: Number(r.badge_count),
      formTier: r.tier,
    }));
}

function loadOwnedPlayers(db: DbClient, clubId: number): OwnedPlayerSnapshot[] {
  if (db.dialect !== "sqlite") return [];
  return db.sqlite
    .prepare<
      [number],
      {
        player_id: number;
        player_name: string;
        dob: string;
        seasons_remaining: number | null;
        weekly_wage_cents: number | null;
        role_promise: string | null;
        squad_role: string | null;
        tier: string | null;
      }
    >(
      `SELECT p.id AS player_id, p.name AS player_name, p.dob,
              c.seasons_remaining, c.weekly_wage_cents, c.role_promise,
              s.role AS squad_role,
              (SELECT pmp.tier FROM player_match_performance pmp
               JOIN matches m ON m.id = pmp.match_id
               WHERE pmp.player_id = p.id AND m.state = 'Played'
               ORDER BY m.matchday DESC LIMIT 1) AS tier
       FROM players p
       LEFT JOIN contracts c ON c.player_id = p.id
       LEFT JOIN squad_entries s ON s.player_id = p.id
       WHERE p.club_id = ?`,
    )
    .all(clubId)
    .map((r) => ({
      playerId: r.player_id,
      playerName: r.player_name,
      age: ageFromDob(r.dob),
      seasonsRemaining: r.seasons_remaining ?? 0,
      weeklyWageCents: r.weekly_wage_cents ?? 0,
      rolePromise: (r.role_promise ?? "Important Player") as PlayingTimeRole,
      formTier: r.tier,
      squadRole: r.squad_role,
    }));
}

function ageFromDob(dob: string): number {
  const birth = new Date(dob + "T00:00:00Z");
  const now = REFERENCE_DATE;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function positionFamilyFromArchetype(
  archetypeId: string,
): "gk" | "defender" | "midfielder" | "forward" {
  const id = archetypeId.toLowerCase();
  if (id.includes("gk") || id.includes("keeper")) return "gk";
  if (id.includes("striker") || id.includes("forward")) return "forward";
  if (id.includes("winger") || id.includes("wing")) return "forward";
  if (id.includes("mid") || id.includes("cm")) return "midfielder";
  return "defender";
}

// ── harness ──────────────────────────────────────────────────────────────

export interface HarnessResult {
  reportMarkdown: string;
  reportPath: string;
}

export async function runSeasonSim(options: {
  dbPath: string;
  reportDir: string;
  seed?: number;
}): Promise<HarnessResult> {
  const db = createDbClient(`sqlite:${options.dbPath}`);
  try {
    return await runOnDb(db, options);
  } finally {
    if (db.dialect === "sqlite") db.close();
  }
}

async function runOnDb(
  db: DbClient,
  options: { dbPath: string; reportDir: string; seed?: number },
): Promise<HarnessResult> {
  await runMigrations(db);
  await seedContentIfMissing(db);
  await seedWorldIfEmpty(db, {
    seed: options.seed ?? 42,
    clubCount: 10,
    playersPerClub: 20,
    referenceDate: REFERENCE_DATE,
  });
  await seedClubIdentityIfMissing(db);
  await seedListingsIfEmpty(db);
  await seedPreferencesIfEmpty(db);
  await seedTacticsIfEmpty(db);
  await seedSquadIfEmpty(db);
  await seedContractsIfEmpty(db);
  await seedFixturesIfEmpty(db);
  await ensureSaveState(db);

  if (db.dialect !== "sqlite") {
    throw new Error("Harness requires sqlite for now");
  }

  // Map each club (id asc) to a persona from the roster.
  const clubRows = db.sqlite
    .prepare<[], { id: number; name: string }>(
      `SELECT id, name FROM clubs ORDER BY id`,
    )
    .all();
  const personaByClub = new Map<number, Persona>();
  const personaByClubName: Array<{ club: string; persona: Persona }> = [];
  clubRows.forEach((c, i) => {
    const p = PERSONA_ROSTER[i % PERSONA_ROSTER.length]!;
    personaByClub.set(c.id, p);
    personaByClubName.push({ club: c.name, persona: p });
  });

  const transferAttempts: TransferAttempt[] = [];
  const extensionAttempts: ExtensionAttempt[] = [];
  const weekSnapshots: WeekSnapshot[] = [];
  const lastResultByClub = new Map<number, "W" | "D" | "L" | null>();

  // Each match week: personas decide → bids/extensions applied →
  // advanceMatchday runs (which plays fixtures, ticks finance, ticks
  // bids, generates AI bids).
  for (let week = 1; week <= TOTAL_MATCH_WEEKS; week++) {
    let bidsPlaced = 0;
    let extensionsAttempted = 0;

    for (const [clubId, persona] of personaByClub) {
      const club = loadClubSnapshot(db, clubId, 0, lastResultByClub);
      const ownedPlayers = loadOwnedPlayers(db, clubId);
      const marketListings = loadListings(db, clubId);

      const ctx: PersonaContext = {
        matchWeek: week,
        season: 0,
        club,
        ownedPlayers,
        marketListings,
      };

      const actions = persona.decide(ctx);

      for (const action of actions) {
        if (action.kind === "bid") {
          try {
            await submitBid(db, {
              playerId: action.playerId,
              fromClubId: clubId,
              feeCents: FEE_TIER_MIDPOINT_CENTS[action.feeTier],
              wageCents: WAGE_TIER_MIDPOINT_CENTS[action.wageTier],
              signingBonusCents: 0,
              rolePromise: action.rolePromise,
              matchWeek: week,
            });
            bidsPlaced++;
            const playerName =
              marketListings.find((l) => l.playerId === action.playerId)
                ?.playerName ?? `#${action.playerId}`;
            transferAttempts.push({
              matchweek: week,
              byClub: club.clubName,
              byPersona: persona.name,
              playerName,
              feeTier: action.feeTier,
              wageTier: action.wageTier,
              rolePromise: action.rolePromise,
              outcome: "Submitted",
            });
          } catch {
            // Silent skip — self-bid, already-bid, etc.
          }
        } else {
          const result = await extendContract(db, {
            playerId: action.playerId,
            clubId,
            wageCents: WAGE_TIER_MIDPOINT_CENTS[action.wageTier],
            signingBonusCents: 0,
            seasons: action.seasons,
            rolePromise: action.rolePromise,
          });
          extensionsAttempted++;
          const playerName =
            ownedPlayers.find((p) => p.playerId === action.playerId)
              ?.playerName ?? `#${action.playerId}`;
          extensionAttempts.push({
            matchweek: week,
            byClub: club.clubName,
            byPersona: persona.name,
            playerName,
            wageTier: action.wageTier,
            seasons: action.seasons,
            outcome:
              result.kind === "accept"
                ? "accepted"
                : result.kind === "reject"
                  ? "rejected"
                  : "error",
            ...(result.kind !== "accept" && "reason" in result
              ? { note: result.reason }
              : result.kind === "error"
                ? { note: result.message }
                : {}),
          });
        }
      }
    }

    // Advance the match week — plays fixtures, ticks bids, finance, AI bids.
    const advance = await advanceMatchday(db, { now: REFERENCE_DATE });
    if (advance.matchday === null) break;

    // Load this week's results for the log.
    const matchRows = db.sqlite
      .prepare<[number], { home_name: string; away_name: string; home_goals: number; away_goals: number; home_id: number; away_id: number }>(
        `SELECT hc.name AS home_name, ac.name AS away_name,
                m.home_goals, m.away_goals,
                m.home_club_id AS home_id, m.away_club_id AS away_id
         FROM matches m
         JOIN clubs hc ON hc.id = m.home_club_id
         JOIN clubs ac ON ac.id = m.away_club_id
         WHERE m.matchday = ? AND m.state = 'Played'`,
      )
      .all(week);

    const matchLogs: MatchLog[] = matchRows.map((r) => ({
      matchday: week,
      homeClubName: r.home_name,
      awayClubName: r.away_name,
      homeGoals: r.home_goals,
      awayGoals: r.away_goals,
    }));

    // Update last result per club.
    for (const m of matchRows) {
      if (m.home_goals > m.away_goals) {
        lastResultByClub.set(m.home_id, "W");
        lastResultByClub.set(m.away_id, "L");
      } else if (m.home_goals < m.away_goals) {
        lastResultByClub.set(m.home_id, "L");
        lastResultByClub.set(m.away_id, "W");
      } else {
        lastResultByClub.set(m.home_id, "D");
        lastResultByClub.set(m.away_id, "D");
      }
    }

    const table = await computeLeagueTable(db, 0);
    const tableTop3 = table.slice(0, 3).map((r, i) => ({
      pos: i + 1,
      club: r.clubName,
      pts: r.points,
      gd: r.goalDifference,
    }));

    weekSnapshots.push({
      matchweek: week,
      matches: matchLogs,
      tableTop3,
      bidsPlaced,
      extensionsAttempted,
    });
  }

  // Resolve final transfer outcomes by reading current bid states.
  const bidStates = db.sqlite
    .prepare<
      [],
      { from_club: string; player: string; state: string; week: number | null }
    >(
      `SELECT fc.name AS from_club, p.name AS player, b.state,
              b.submitted_match_week AS week
       FROM bids b
       JOIN players p ON p.id = b.player_id
       JOIN clubs fc ON fc.id = b.from_club_id`,
    )
    .all();
  const stateBy = new Map<string, string>();
  for (const r of bidStates) {
    stateBy.set(`${r.from_club}:${r.player}`, r.state);
  }
  for (const t of transferAttempts) {
    const resolved = stateBy.get(`${t.byClub}:${t.playerName}`);
    if (resolved) t.outcome = resolved;
  }

  // Final stats: goals leaders, most assists, best tier count per player.
  const goalLeaders = db.sqlite
    .prepare<
      [],
      { player: string; club: string; goals: number; assists: number }
    >(
      `SELECT p.name AS player, c.name AS club,
              SUM(pmp.goals) AS goals,
              SUM(pmp.assists) AS assists
       FROM player_match_performance pmp
       JOIN players p ON p.id = pmp.player_id
       JOIN clubs c ON c.id = pmp.club_id
       GROUP BY p.id
       HAVING SUM(pmp.goals) > 0
       ORDER BY goals DESC, assists DESC
       LIMIT 10`,
    )
    .all();

  const topXg = db.sqlite
    .prepare<[], { player: string; club: string; xg: number; shots: number }>(
      `SELECT p.name AS player, c.name AS club,
              SUM(pmp.xg_x100) / 100.0 AS xg,
              SUM(pmp.shots) AS shots
       FROM player_match_performance pmp
       JOIN players p ON p.id = pmp.player_id
       JOIN clubs c ON c.id = pmp.club_id
       GROUP BY p.id
       ORDER BY xg DESC
       LIMIT 10`,
    )
    .all();

  const clubTransferSummary = db.sqlite
    .prepare<
      [],
      {
        club: string;
        signed: number;
        rejected: number;
        expired: number;
        pending: number;
      }
    >(
      `SELECT c.name AS club,
              SUM(CASE WHEN b.state = 'Signed' THEN 1 ELSE 0 END) AS signed,
              SUM(CASE WHEN b.state IN ('SellerRejected', 'PlayerRejected') THEN 1 ELSE 0 END) AS rejected,
              SUM(CASE WHEN b.state IN ('Expired', 'Cancelled') THEN 1 ELSE 0 END) AS expired,
              SUM(CASE WHEN b.state IN ('Submitted', 'SellerReviewing', 'SellerAccepted', 'SellerCountered', 'PlayerReviewing') THEN 1 ELSE 0 END) AS pending
       FROM bids b
       JOIN clubs c ON c.id = b.from_club_id
       WHERE b.from_club_id != b.to_club_id
       GROUP BY c.id
       ORDER BY signed DESC`,
    )
    .all();

  const finalTable = await computeLeagueTable(db, 0);

  // Finance snapshot per club.
  const finances = db.sqlite
    .prepare<
      [],
      {
        club: string;
        cash: number;
        wages: number;
        revenue: number;
        expense: number;
      }
    >(
      `SELECT c.name AS club,
              ie.cash_reserve_cents AS cash,
              COALESCE((SELECT SUM(weekly_wage_cents) FROM contracts WHERE club_id = c.id), 0) AS wages,
              COALESCE((SELECT SUM(amount_cents) FROM finance_events WHERE club_id = c.id AND amount_cents > 0), 0) AS revenue,
              COALESCE((SELECT SUM(amount_cents) FROM finance_events WHERE club_id = c.id AND amount_cents < 0), 0) AS expense
       FROM clubs c
       JOIN club_identity_ext ie ON ie.club_id = c.id`,
    )
    .all();

  // ── write the report ─────────────────────────────────────────────────────
  const md = renderReport({
    personaByClubName,
    weekSnapshots,
    transferAttempts,
    extensionAttempts,
    goalLeaders,
    topXg,
    clubTransferSummary,
    finalTable,
    finances,
  });

  mkdirSync(options.reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const path = join(options.reportDir, `season-0-${stamp}.md`);
  writeFileSync(path, md, "utf8");

  return { reportMarkdown: md, reportPath: path };
}

// ── report renderer ─────────────────────────────────────────────────────

function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  if (abs >= 1_000_000_000_00) return `${sign}$${(abs / 1_000_000_000_00).toFixed(1)}B`;
  if (abs >= 1_000_000_00) return `${sign}$${(abs / 1_000_000_00).toFixed(1)}M`;
  if (abs >= 1_000_00) return `${sign}$${(abs / 1_000_00).toFixed(0)}K`;
  return `${sign}$${(abs / 100).toFixed(0)}`;
}

interface ReportInput {
  personaByClubName: Array<{ club: string; persona: Persona }>;
  weekSnapshots: WeekSnapshot[];
  transferAttempts: TransferAttempt[];
  extensionAttempts: ExtensionAttempt[];
  goalLeaders: Array<{ player: string; club: string; goals: number; assists: number }>;
  topXg: Array<{ player: string; club: string; xg: number; shots: number }>;
  clubTransferSummary: Array<{
    club: string;
    signed: number;
    rejected: number;
    expired: number;
    pending: number;
  }>;
  finalTable: Array<{
    clubId: number;
    clubName: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
  }>;
  finances: Array<{
    club: string;
    cash: number;
    wages: number;
    revenue: number;
    expense: number;
  }>;
}

function renderReport(input: ReportInput): string {
  const lines: string[] = [];
  lines.push("# Season 0 Simulation Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  // Persona assignments
  lines.push("## Persona assignments");
  lines.push("");
  lines.push("| Club | Persona | Strategy |");
  lines.push("|---|---|---|");
  for (const p of input.personaByClubName) {
    lines.push(`| ${p.club} | ${p.persona.name} | ${p.persona.tagline} |`);
  }
  lines.push("");

  // Final table
  lines.push("## Final league table");
  lines.push("");
  lines.push("| # | Club | P | W | D | L | GF | GA | GD | Pts |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  input.finalTable.forEach((r, i) => {
    lines.push(
      `| ${i + 1} | ${r.clubName} | ${r.played} | ${r.won} | ${r.drawn} | ${r.lost} | ${r.goalsFor} | ${r.goalsAgainst} | ${r.goalDifference > 0 ? "+" : ""}${r.goalDifference} | **${r.points}** |`,
    );
  });
  lines.push("");

  // Week-by-week
  lines.push("## Match week log");
  lines.push("");
  for (const w of input.weekSnapshots) {
    lines.push(`### Match Week ${w.matchweek}`);
    lines.push("");
    for (const m of w.matches) {
      lines.push(`- ${m.homeClubName} **${m.homeGoals} – ${m.awayGoals}** ${m.awayClubName}`);
    }
    lines.push("");
    lines.push(
      `Bids this week: ${w.bidsPlaced} · Extensions attempted: ${w.extensionsAttempted}`,
    );
    if (w.tableTop3.length > 0) {
      lines.push(
        `Table: 1. ${w.tableTop3[0]?.club} (${w.tableTop3[0]?.pts}) · 2. ${w.tableTop3[1]?.club} (${w.tableTop3[1]?.pts}) · 3. ${w.tableTop3[2]?.club} (${w.tableTop3[2]?.pts})`,
      );
    }
    lines.push("");
  }

  // Transfer log
  lines.push("## Transfer attempts (persona-initiated)");
  lines.push("");
  lines.push("| Week | Club | Persona | Player | Fee | Wage | Role | Final state |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const t of input.transferAttempts) {
    lines.push(
      `| ${t.matchweek} | ${t.byClub} | ${t.byPersona} | ${t.playerName} | ${t.feeTier} | ${t.wageTier} | ${t.rolePromise} | ${t.outcome} |`,
    );
  }
  lines.push("");

  // Extensions
  lines.push("## Contract extension attempts");
  lines.push("");
  if (input.extensionAttempts.length === 0) {
    lines.push("_No extension attempts this season._");
  } else {
    lines.push("| Week | Club | Persona | Player | Wage | Seasons | Outcome | Note |");
    lines.push("|---|---|---|---|---|---|---|---|");
    for (const e of input.extensionAttempts) {
      lines.push(
        `| ${e.matchweek} | ${e.byClub} | ${e.byPersona} | ${e.playerName} | ${e.wageTier} | ${e.seasons} | ${e.outcome} | ${e.note ?? ""} |`,
      );
    }
  }
  lines.push("");

  // Club transfer activity summary
  lines.push("## Club transfer summary");
  lines.push("");
  lines.push("| Club | Signed | Rejected | Expired/Cancelled | Pending |");
  lines.push("|---|---|---|---|---|");
  for (const c of input.clubTransferSummary) {
    lines.push(`| ${c.club} | ${c.signed} | ${c.rejected} | ${c.expired} | ${c.pending} |`);
  }
  lines.push("");

  // Top scorers
  lines.push("## Top scorers");
  lines.push("");
  lines.push("| # | Player | Club | Goals | Assists |");
  lines.push("|---|---|---|---|---|");
  input.goalLeaders.forEach((p, i) => {
    lines.push(`| ${i + 1} | ${p.player} | ${p.club} | ${p.goals} | ${p.assists} |`);
  });
  lines.push("");

  // xG leaders
  lines.push("## xG leaders");
  lines.push("");
  lines.push("| # | Player | Club | xG | Shots |");
  lines.push("|---|---|---|---|---|");
  input.topXg.forEach((p, i) => {
    lines.push(`| ${i + 1} | ${p.player} | ${p.club} | ${p.xg.toFixed(2)} | ${p.shots} |`);
  });
  lines.push("");

  // Finances
  lines.push("## End-of-season finances");
  lines.push("");
  lines.push("| Club | Cash | Weekly wages | Season revenue | Season expense |");
  lines.push("|---|---|---|---|---|");
  for (const f of input.finances) {
    lines.push(
      `| ${f.club} | ${formatCents(f.cash)} | ${formatCents(f.wages)} | ${formatCents(f.revenue)} | ${formatCents(f.expense)} |`,
    );
  }
  lines.push("");

  // Auto-generated lessons
  lines.push("## Auto-generated observations");
  lines.push("");
  const signedTotal = input.clubTransferSummary.reduce((s, c) => s + c.signed, 0);
  const rejectedTotal = input.clubTransferSummary.reduce((s, c) => s + c.rejected, 0);
  const expiredTotal = input.clubTransferSummary.reduce((s, c) => s + c.expired, 0);
  const pendingTotal = input.clubTransferSummary.reduce((s, c) => s + c.pending, 0);
  lines.push(
    `- Total transfers: **${signedTotal} signed**, ${rejectedTotal} rejected, ${expiredTotal} expired/cancelled, ${pendingTotal} still pending.`,
  );
  const extAccepted = input.extensionAttempts.filter((e) => e.outcome === "accepted").length;
  const extRejected = input.extensionAttempts.filter((e) => e.outcome === "rejected").length;
  lines.push(
    `- Contract extensions: **${extAccepted} accepted**, ${extRejected} rejected out of ${input.extensionAttempts.length} attempts.`,
  );
  const topScorerGoals = input.goalLeaders[0]?.goals ?? 0;
  if (topScorerGoals > 0) {
    lines.push(
      `- Golden boot: **${input.goalLeaders[0]!.player}** (${input.goalLeaders[0]!.club}) with ${topScorerGoals} goals in 18 matches.`,
    );
  }
  const top = input.finalTable[0];
  const bottom = input.finalTable[input.finalTable.length - 1];
  if (top && bottom) {
    lines.push(
      `- Winner: **${top.clubName}** (${top.points} pts) · Wooden spoon: **${bottom.clubName}** (${bottom.points} pts). Spread: ${top.points - bottom.points} points.`,
    );
  }
  const cashRich = input.finances.reduce((a, b) => (b.cash > a.cash ? b : a), input.finances[0]!);
  const cashPoor = input.finances.reduce((a, b) => (b.cash < a.cash ? b : a), input.finances[0]!);
  if (cashRich && cashPoor) {
    lines.push(
      `- Richest club: **${cashRich.club}** (${formatCents(cashRich.cash)}) · Poorest: **${cashPoor.club}** (${formatCents(cashPoor.cash)}).`,
    );
  }
  // Flag if any club is in negative cash — indicates wage > revenue imbalance.
  const negCash = input.finances.filter((f) => f.cash < 0);
  if (negCash.length > 0) {
    lines.push(
      `- ⚠️  ${negCash.length} club(s) went into negative cash this season: ${negCash.map((c) => c.club).join(", ")}. Revenue/wage balance needs tuning.`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
