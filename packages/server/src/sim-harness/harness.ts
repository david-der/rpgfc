// Season simulator — drives a full season with each of N clubs under
// the control of a JSON-defined strategy, then writes a markdown
// evidence report.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PlayingTimeRole } from "@rpgfc/shared";
import { feeTierFor, wageTierFor } from "@rpgfc/shared";

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
import { ensureSaveState, seedFixturesIfEmpty } from "../application/season/seed.js";
import { advanceMatchday } from "../application/season/advance.js";
import { submitBid } from "../application/transfers/bids.js";
import { extendContract } from "../application/transfers/extend-contract.js";
import { estimateValueCents } from "../application/transfers/valuations.js";
import { computeLeagueTable } from "../rendering/league-table.js";

import {
  type ClubSnapshot,
  type ListingSnapshot,
  type OwnedPlayerSnapshot,
  type Persona,
  type PersonaContext,
} from "./personas.js";
import { loadAllStrategies, strategyToPersona } from "./strategy-engine.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");
const TOTAL_MATCH_WEEKS = 18; // 10 clubs → 2 × 9 = 18 full-season weeks.

type PositionFamily = "gk" | "defender" | "midfielder" | "forward";

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
  feeCents: number;
  wageCents: number;
  feeTier: string;
  wageTier: string;
  pctOfAsking: number;
  rolePromise: string;
  outcome: string;
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

function positionFamilyFromArchetype(archetypeId: string): PositionFamily {
  const id = archetypeId.toLowerCase();
  if (id.includes("gk") || id.includes("keeper")) return "gk";
  if (id.includes("striker") || id.includes("forward")) return "forward";
  if (id.includes("winger") || id.includes("wing")) return "forward";
  if (id.includes("mid") || id.includes("cm")) return "midfielder";
  return "defender";
}

function loadClubSnapshot(
  db: DbClient,
  clubId: number,
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
    .prepare<
      [number],
      { total: number | null }
    >(`SELECT SUM(weekly_wage_cents) AS total FROM contracts WHERE club_id = ?`)
    .get(clubId);
  const squad = db.sqlite
    .prepare<[number], { n: number }>(`SELECT COUNT(*) AS n FROM squad_entries WHERE club_id = ?`)
    .get(clubId);

  return {
    clubId: row.id,
    clubName: row.name,
    reputationTier: row.reputation_tier,
    cashCents: row.cash_reserve_cents,
    wageBillCents: Number(wage?.total ?? 0),
    wageBudgetCents: row.wage_budget_cents_per_week,
    squadSize: squad?.n ?? 0,
    leaguePosition: 0,
    lastResult: lastResult.get(clubId) ?? null,
  };
}

function loadListings(db: DbClient, excludeClubId: number): ListingSnapshot[] {
  if (db.dialect !== "sqlite") return [];
  // Load ALL other-club players, not just those in the listing table.
  // Unlisted players are valid targets for unsolicited inquiries —
  // strategies that pursue them pay a premium over the implied value.
  const rows = db.sqlite
    .prepare<
      [number],
      {
        player_id: number;
        player_name: string;
        club_id: number;
        archetype_id: string;
        experience_years: number;
        listing_asking: number | null;
        age: number;
        badge_count: number;
        tier: string | null;
        current_wage: number | null;
        wage_floor: number | null;
        regions_json: string | null;
        min_playing_time: string | null;
      }
    >(
      `SELECT p.id AS player_id, p.name AS player_name, p.club_id,
              p.archetype_id, p.experience_years, p.age,
              l.asking_price_cents AS listing_asking,
              (SELECT COUNT(*) FROM player_badges b WHERE b.player_id = p.id) AS badge_count,
              (SELECT pmp.tier FROM player_match_performance pmp
               JOIN matches m ON m.id = pmp.match_id
               WHERE pmp.player_id = p.id AND m.state = 'Played'
               ORDER BY m.matchday DESC LIMIT 1) AS tier,
              (SELECT c.weekly_wage_cents FROM contracts c WHERE c.player_id = p.id) AS current_wage,
              (SELECT pp.wage_floor_cents FROM player_preferences pp WHERE pp.player_id = p.id) AS wage_floor,
              (SELECT pp.preferred_regions_json FROM player_preferences pp WHERE pp.player_id = p.id) AS regions_json,
              (SELECT pp.min_playing_time FROM player_preferences pp WHERE pp.player_id = p.id) AS min_playing_time
       FROM players p
       LEFT JOIN listing l ON l.player_id = p.id
       WHERE p.club_id IS NOT NULL AND p.club_id != ?`,
    )
    .all(excludeClubId);

  return rows.map((r) => {
    let regions: string[] = [];
    try {
      regions = r.regions_json ? (JSON.parse(r.regions_json) as string[]) : [];
    } catch {
      /* ignore */
    }
    const isListed = r.listing_asking !== null;
    const badgeKeys = db.sqlite
      .prepare<[number], { badge_key: string }>(
        `SELECT badge_key FROM player_badges WHERE player_id = ?`,
      )
      .all(r.player_id)
      .map((b) => b.badge_key);
    const askingPriceCents = isListed
      ? (r.listing_asking as number)
      : estimateValueCents({
          name: r.player_name,
          archetypeId: r.archetype_id,
          experienceYears: r.experience_years,
          badgeKeys,
        });
    return {
      playerId: r.player_id,
      playerName: r.player_name,
      clubId: r.club_id,
      positionFamily: positionFamilyFromArchetype(r.archetype_id),
      askingPriceCents,
      isListed,
      currentWageCents: r.current_wage ?? 0,
      wageFloorCents: r.wage_floor ?? 0,
      age: r.age,
      badgeCount: Number(r.badge_count),
      formTier: r.tier,
      preferredRegions: regions,
      minPlayingTime: (r.min_playing_time ?? "Important Player") as PlayingTimeRole,
    };
  });
}

function loadClubNationality(db: DbClient, clubId: number): string {
  if (db.dialect !== "sqlite") return "";
  const row = db.sqlite
    .prepare<[number], { nationality: string }>(`SELECT nationality FROM clubs WHERE id = ?`)
    .get(clubId);
  return row?.nationality ?? "";
}

function loadOwnedPlayers(db: DbClient, clubId: number): OwnedPlayerSnapshot[] {
  if (db.dialect !== "sqlite") return [];
  return db.sqlite
    .prepare<
      [number],
      {
        player_id: number;
        player_name: string;
        age: number;
        archetype_id: string;
        seasons_remaining: number | null;
        weekly_wage_cents: number | null;
        role_promise: string | null;
        squad_role: string | null;
        tier: string | null;
      }
    >(
      `SELECT p.id AS player_id, p.name AS player_name, p.age, p.archetype_id,
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
      age: r.age,
      seasonsRemaining: r.seasons_remaining ?? 0,
      weeklyWageCents: r.weekly_wage_cents ?? 0,
      rolePromise: (r.role_promise ?? "Important Player") as PlayingTimeRole,
      formTier: r.tier,
      squadRole: r.squad_role,
      positionFamily: positionFamilyFromArchetype(r.archetype_id),
    }));
}

function loadSquadByPosition(db: DbClient, clubId: number): Record<PositionFamily, number> {
  const counts: Record<PositionFamily, number> = {
    gk: 0,
    defender: 0,
    midfielder: 0,
    forward: 0,
  };
  if (db.dialect !== "sqlite") return counts;
  const rows = db.sqlite
    .prepare<
      [number],
      { archetype_id: string }
    >(`SELECT archetype_id FROM players WHERE club_id = ?`)
    .all(clubId);
  for (const r of rows) counts[positionFamilyFromArchetype(r.archetype_id)] += 1;
  return counts;
}

// ── harness ──────────────────────────────────────────────────────────────

export interface HarnessResult {
  reportMarkdown: string;
  reportPath: string;
  /** Stats available to the iteration runner for cross-iteration comparison. */
  stats: SeasonStats;
}

export interface SeasonStats {
  totalSigned: number;
  totalRejected: number;
  clubsWithAtLeastOneSigning: number;
  totalClubs: number;
  extensionsAccepted: number;
  extensionsRejected: number;
  topPoints: number;
  bottomPoints: number;
  pointsSpread: number;
  champion: string;
  goldenBoot: string;
  goldenBootGoals: number;
  clubsInNegativeCash: number;
  /** Total transfers attempted by personas (not engine AI bids). */
  totalAttempts: number;
  /** Comma-separated count of each rejection reason, e.g. "PLAYER_WAGE_FLOOR=12, ...". */
  rejectionBreakdown: string;
}

export async function runSeasonSim(options: {
  dbPath: string;
  reportDir: string;
  seed?: number;
  reportLabel?: string;
}): Promise<HarnessResult> {
  const db = createDbClient(`sqlite:${options.dbPath}`);
  try {
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
    return await runOnDb(db, options);
  } finally {
    if (db.dialect === "sqlite") db.close();
  }
}

/** Run a single season against an already-open, already-seeded DB. */
export async function runSeasonOn(
  db: DbClient,
  options: { reportDir: string; reportLabel?: string },
): Promise<SeasonStats> {
  const result = await runOnDb(db, { dbPath: "", ...options });
  return result.stats;
}

async function runOnDb(
  db: DbClient,
  options: { dbPath: string; reportDir: string; seed?: number; reportLabel?: string },
): Promise<HarnessResult> {
  if (db.dialect !== "sqlite") {
    throw new Error("Harness requires sqlite for now");
  }

  // Build a persona for every club from the strategies/ folder.
  const strategies = loadAllStrategies();
  const clubRows = db.sqlite
    .prepare<[], { id: number; name: string }>(`SELECT id, name FROM clubs ORDER BY id`)
    .all();
  const personaByClub = new Map<number, Persona>();
  const personaByClubName: Array<{ club: string; persona: Persona }> = [];
  clubRows.forEach((c, i) => {
    const strategy = strategies[i % strategies.length]!;
    const persona = strategyToPersona(strategy);
    personaByClub.set(c.id, persona);
    personaByClubName.push({ club: c.name, persona });
  });

  const transferAttempts: TransferAttempt[] = [];
  const extensionAttempts: ExtensionAttempt[] = [];
  const weekSnapshots: WeekSnapshot[] = [];
  const lastResultByClub = new Map<number, "W" | "D" | "L" | null>();

  // Per-club memory carried across match weeks.
  const rejectedBidsByClub = new Map<number, Set<number>>();
  const bidAttemptsByClub = new Map<number, Map<number, number>>();
  const extensionRejectionsByClub = new Map<number, Map<number, number>>();
  const backfillByClub = new Map<number, Set<PositionFamily>>();
  const lastSquadByPosition = new Map<number, Record<PositionFamily, number>>();
  // Per-season signing counter — incremented after a bid resolves to
  // Signed. Reset when a new season starts (this harness run = one season).
  const signingsThisSeasonByClub = new Map<number, number>();
  const seenSignedBidIds = new Set<number>(
    db.sqlite
      .prepare<[], { id: number }>(`SELECT id FROM bids WHERE state = 'Signed'`)
      .all()
      .map((r) => r.id),
  );
  for (const clubId of personaByClub.keys()) {
    lastSquadByPosition.set(clubId, loadSquadByPosition(db, clubId));
  }

  for (let week = 1; week <= TOTAL_MATCH_WEEKS; week++) {
    let bidsPlaced = 0;
    let extensionsAttempted = 0;

    for (const [clubId, persona] of personaByClub) {
      const club = loadClubSnapshot(db, clubId, lastResultByClub);
      const ownedPlayers = loadOwnedPlayers(db, clubId);
      const marketListings = loadListings(db, clubId);

      const activeBidPlayers = new Set<number>(
        db.sqlite
          .prepare<[number], { player_id: number }>(
            `SELECT player_id FROM bids
             WHERE from_club_id = ?
               AND state NOT IN ('Signed', 'SellerRejected', 'PlayerRejected', 'Expired', 'Cancelled')`,
          )
          .all(clubId)
          .map((r) => r.player_id),
      );

      const ctx: PersonaContext = {
        matchWeek: week,
        season: 0,
        club,
        ownedPlayers,
        marketListings,
        playersWithActiveBid: activeBidPlayers,
        playersRecentlyRejected: rejectedBidsByClub.get(clubId) ?? new Set<number>(),
        playerBidAttempts: bidAttemptsByClub.get(clubId) ?? new Map<number, number>(),
        extensionRejections: extensionRejectionsByClub.get(clubId) ?? new Map<number, number>(),
        priorityBackfillPositions: backfillByClub.get(clubId) ?? new Set<PositionFamily>(),
        clubNationality: loadClubNationality(db, clubId),
        signingsThisSeason: signingsThisSeasonByClub.get(clubId) ?? 0,
      };

      const actions = persona.decide(ctx);

      for (const action of actions) {
        if (action.kind === "bid") {
          try {
            await submitBid(db, {
              playerId: action.playerId,
              fromClubId: clubId,
              feeCents: action.feeCents,
              wageCents: action.wageCents,
              signingBonusCents: 0,
              rolePromise: action.rolePromise,
              matchWeek: week,
            });
            bidsPlaced++;
            const listing = marketListings.find((l) => l.playerId === action.playerId);
            const playerName = listing?.playerName ?? `#${action.playerId}`;
            const asking = listing?.askingPriceCents ?? 0;
            transferAttempts.push({
              matchweek: week,
              byClub: club.clubName,
              byPersona: persona.name,
              playerName,
              feeCents: action.feeCents,
              wageCents: action.wageCents,
              feeTier: feeTierFor(action.feeCents),
              wageTier: wageTierFor(action.wageCents),
              pctOfAsking: asking > 0 ? action.feeCents / asking : 0,
              rolePromise: action.rolePromise,
              outcome: "Submitted",
            });
            // Bump the attempts counter so the next week's strategy
            // either ratchets or abandons.
            const attempts = ctx.playerBidAttempts;
            attempts.set(action.playerId, (attempts.get(action.playerId) ?? 0) + 1);
            bidAttemptsByClub.set(clubId, attempts);
          } catch {
            // Silent skip — server-side dedup or affordability guard.
          }
        } else {
          const result = await extendContract(db, {
            playerId: action.playerId,
            clubId,
            wageCents: action.wageCents,
            signingBonusCents: 0,
            seasons: action.seasons,
            rolePromise: action.rolePromise,
          });
          extensionsAttempted++;
          const playerName =
            ownedPlayers.find((p) => p.playerId === action.playerId)?.playerName ??
            `#${action.playerId}`;
          extensionAttempts.push({
            matchweek: week,
            byClub: club.clubName,
            byPersona: persona.name,
            playerName,
            wageTier: wageTierFor(action.wageCents),
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
          if (result.kind === "reject") {
            const ext = ctx.extensionRejections;
            ext.set(action.playerId, (ext.get(action.playerId) ?? 0) + 1);
            extensionRejectionsByClub.set(clubId, ext);
          }
        }
      }
    }

    // Skip engine AI bids — strategies drive every club.
    const advance = await advanceMatchday(db, {
      now: REFERENCE_DATE,
      skipAiBids: true,
    });
    if (advance.matchday === null) break;

    // Increment per-club signing counter by looking at what was newly
    // Signed during this matchday tick.
    const allSigned = db.sqlite
      .prepare<
        [],
        { id: number; from_club_id: number }
      >(`SELECT id, from_club_id FROM bids WHERE state = 'Signed'`)
      .all();
    for (const r of allSigned) {
      if (seenSignedBidIds.has(r.id)) continue;
      seenSignedBidIds.add(r.id);
      signingsThisSeasonByClub.set(
        r.from_club_id,
        (signingsThisSeasonByClub.get(r.from_club_id) ?? 0) + 1,
      );
    }

    // ── post-tick housekeeping ─────────────────────────────────────────

    // Players we should give up on (ratchet exhausted = bid-attempts hit
    // the per-strategy max but the bid is now in a rejected state).
    const allRejected = db.sqlite
      .prepare<[], { from_club_id: number; player_id: number }>(
        `SELECT from_club_id, player_id FROM bids
         WHERE state IN ('SellerRejected', 'PlayerRejected', 'Expired', 'Cancelled')`,
      )
      .all();
    for (const r of allRejected) {
      let rs = rejectedBidsByClub.get(r.from_club_id);
      if (!rs) {
        rs = new Set();
        rejectedBidsByClub.set(r.from_club_id, rs);
      }
      // Only mark abandoned once we've hit the strategy's ratchet ceiling
      // (which the engine encodes by stopping bids once attempts == max).
      const attempts = bidAttemptsByClub.get(r.from_club_id)?.get(r.player_id) ?? 0;
      // 3 is the max ratchetMaxAttempts across strategies; the engine
      // also gates this internally. Safe to mark on first rejection if
      // the strategy chooses not to re-bid — strategy.decide() will
      // simply not pick the player again.
      if (attempts >= 3) rs.add(r.player_id);
    }

    // Backfill detection: compare squad position counts to the snapshot
    // taken at the start of the previous tick.
    for (const clubId of personaByClub.keys()) {
      const before = lastSquadByPosition.get(clubId)!;
      const after = loadSquadByPosition(db, clubId);
      const lost = new Set<PositionFamily>();
      (Object.keys(after) as PositionFamily[]).forEach((pos) => {
        if (after[pos] < before[pos]) lost.add(pos);
      });
      if (lost.size > 0) {
        const existing = backfillByClub.get(clubId) ?? new Set<PositionFamily>();
        for (const p of lost) existing.add(p);
        backfillByClub.set(clubId, existing);
      }
      // Clear backfill flags for positions that have been refilled.
      const cleared = backfillByClub.get(clubId);
      if (cleared) {
        for (const pos of [...cleared]) {
          if (after[pos] >= before[pos]) cleared.delete(pos);
        }
      }
      lastSquadByPosition.set(clubId, after);
    }

    // Match log + standings.
    const matchRows = db.sqlite
      .prepare<
        [number],
        {
          home_name: string;
          away_name: string;
          home_goals: number;
          away_goals: number;
          home_id: number;
          away_id: number;
        }
      >(
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

  // ── final outcome stats ─────────────────────────────────────────────

  const bidStates = db.sqlite
    .prepare<[], { from_club: string; player: string; state: string; reason: string | null }>(
      `SELECT fc.name AS from_club, p.name AS player, b.state,
              b.rejection_reason AS reason
       FROM bids b
       JOIN players p ON p.id = b.player_id
       JOIN clubs fc ON fc.id = b.from_club_id`,
    )
    .all();
  const stateBy = new Map<string, { state: string; reason: string | null }>();
  for (const r of bidStates) {
    stateBy.set(`${r.from_club}:${r.player}`, { state: r.state, reason: r.reason });
  }
  for (const t of transferAttempts) {
    const resolved = stateBy.get(`${t.byClub}:${t.playerName}`);
    if (resolved) {
      t.outcome = resolved.reason ? `${resolved.state} (${resolved.reason})` : resolved.state;
    }
  }

  // Aggregate rejection reasons for the headline.
  const reasonCounts = new Map<string, number>();
  for (const t of transferAttempts) {
    const m = t.outcome.match(/\(([A-Z_]+)\)/);
    if (m) reasonCounts.set(m[1]!, (reasonCounts.get(m[1]!) ?? 0) + 1);
  }
  const reasonLines = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  const goalLeaders = db.sqlite
    .prepare<[], { player: string; club: string; goals: number; assists: number }>(
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

  // Cross-iteration stats.
  const totalSigned = clubTransferSummary.reduce((s, c) => s + c.signed, 0);
  const totalRejected = clubTransferSummary.reduce((s, c) => s + c.rejected, 0);
  const clubsWithAtLeastOneSigning = clubTransferSummary.filter((c) => c.signed > 0).length;
  const extensionsAccepted = extensionAttempts.filter((e) => e.outcome === "accepted").length;
  const extensionsRejected = extensionAttempts.filter((e) => e.outcome === "rejected").length;
  const topPoints = finalTable[0]?.points ?? 0;
  const bottomPoints = finalTable[finalTable.length - 1]?.points ?? 0;
  const champion = finalTable[0]?.clubName ?? "";
  const golden = goalLeaders[0];
  const stats: SeasonStats = {
    totalSigned,
    totalRejected,
    clubsWithAtLeastOneSigning,
    totalClubs: personaByClub.size,
    extensionsAccepted,
    extensionsRejected,
    topPoints,
    bottomPoints,
    pointsSpread: topPoints - bottomPoints,
    champion,
    goldenBoot: golden?.player ?? "",
    goldenBootGoals: golden?.goals ?? 0,
    clubsInNegativeCash: finances.filter((f) => f.cash < 0).length,
    totalAttempts: transferAttempts.length,
    rejectionBreakdown: reasonLines,
  };

  const md = renderReport({
    ...(options.reportLabel ? { label: options.reportLabel } : {}),
    personaByClubName,
    weekSnapshots,
    transferAttempts,
    extensionAttempts,
    goalLeaders,
    clubTransferSummary,
    finalTable,
    finances,
    stats,
  });

  mkdirSync(options.reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fname = options.reportLabel
    ? `season-${options.reportLabel}-${stamp}.md`
    : `season-0-${stamp}.md`;
  const path = join(options.reportDir, fname);
  writeFileSync(path, md, "utf8");

  return { reportMarkdown: md, reportPath: path, stats };
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
  label?: string;
  personaByClubName: Array<{ club: string; persona: Persona }>;
  weekSnapshots: WeekSnapshot[];
  transferAttempts: TransferAttempt[];
  extensionAttempts: ExtensionAttempt[];
  goalLeaders: Array<{ player: string; club: string; goals: number; assists: number }>;
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
  stats: SeasonStats;
}

function renderReport(input: ReportInput): string {
  const lines: string[] = [];
  lines.push(`# Season Simulation Report${input.label ? ` — ${input.label}` : ""}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Headline stats");
  lines.push("");
  lines.push(
    `- Signed: **${input.stats.totalSigned}** across ${input.stats.totalClubs} clubs (${input.stats.clubsWithAtLeastOneSigning} clubs signed at least one)`,
  );
  lines.push(`- Rejected: ${input.stats.totalRejected} of ${input.stats.totalAttempts} attempts`);
  lines.push(
    `- Extensions: **${input.stats.extensionsAccepted} accepted**, ${input.stats.extensionsRejected} rejected`,
  );
  lines.push(
    `- Champion: **${input.stats.champion}** (${input.stats.topPoints} pts), spread ${input.stats.pointsSpread} pts`,
  );
  lines.push(`- Golden boot: **${input.stats.goldenBoot}** (${input.stats.goldenBootGoals})`);
  lines.push(`- Clubs in the red: ${input.stats.clubsInNegativeCash}`);
  if (input.stats.rejectionBreakdown) {
    lines.push(`- Rejection reasons: ${input.stats.rejectionBreakdown}`);
  }
  lines.push("");

  lines.push("## Persona assignments");
  lines.push("");
  lines.push("| Club | Strategy | Tagline |");
  lines.push("|---|---|---|");
  for (const p of input.personaByClubName) {
    lines.push(`| ${p.club} | ${p.persona.name} | ${p.persona.tagline} |`);
  }
  lines.push("");

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

  lines.push("## Club transfer summary");
  lines.push("");
  lines.push("| Club | Signed | Rejected | Expired | Pending |");
  lines.push("|---|---|---|---|---|");
  for (const c of input.clubTransferSummary) {
    lines.push(`| ${c.club} | ${c.signed} | ${c.rejected} | ${c.expired} | ${c.pending} |`);
  }
  lines.push("");

  lines.push("## Transfer attempts (persona-initiated)");
  lines.push("");
  lines.push("| Wk | Club | Player | Fee | %Asking | Wage | Role | Outcome |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const t of input.transferAttempts) {
    lines.push(
      `| ${t.matchweek} | ${t.byClub} | ${t.playerName} | ${formatCents(t.feeCents)} (${t.feeTier}) | ${(t.pctOfAsking * 100).toFixed(0)}% | ${formatCents(t.wageCents)} (${t.wageTier}) | ${t.rolePromise} | ${t.outcome} |`,
    );
  }
  lines.push("");

  lines.push("## Contract extension attempts");
  lines.push("");
  if (input.extensionAttempts.length === 0) {
    lines.push("_No extension attempts this season._");
  } else {
    lines.push("| Wk | Club | Player | Wage | Seasons | Outcome | Note |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const e of input.extensionAttempts) {
      lines.push(
        `| ${e.matchweek} | ${e.byClub} | ${e.playerName} | ${e.wageTier} | ${e.seasons} | ${e.outcome} | ${e.note ?? ""} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Top scorers");
  lines.push("");
  lines.push("| # | Player | Club | Goals | Assists |");
  lines.push("|---|---|---|---|---|");
  input.goalLeaders.forEach((p, i) => {
    lines.push(`| ${i + 1} | ${p.player} | ${p.club} | ${p.goals} | ${p.assists} |`);
  });
  lines.push("");

  lines.push("## End-of-season finances");
  lines.push("");
  lines.push("| Club | Cash | Weekly wages | Revenue | Expense |");
  lines.push("|---|---|---|---|---|");
  for (const f of input.finances) {
    lines.push(
      `| ${f.club} | ${formatCents(f.cash)} | ${formatCents(f.wages)} | ${formatCents(f.revenue)} | ${formatCents(f.expense)} |`,
    );
  }
  lines.push("");

  lines.push("## Match week log");
  lines.push("");
  for (const w of input.weekSnapshots) {
    lines.push(`### Match Week ${w.matchweek}`);
    lines.push("");
    for (const m of w.matches) {
      lines.push(`- ${m.homeClubName} **${m.homeGoals} – ${m.awayGoals}** ${m.awayClubName}`);
    }
    lines.push("");
    lines.push(`Bids: ${w.bidsPlaced} · Extensions: ${w.extensionsAttempted}`);
    lines.push("");
  }
  return lines.join("\n");
}
