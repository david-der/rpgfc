// Strategy engine — interprets a club-strategy JSON document into a list
// of Actions per match week. The dialect is documented in
// strategies/README.md (and the inline ClubStrategy interface below).
//
// Why JSON: lets us tune a club's behaviour without touching TS, and
// keeps the harness's persona logic declarative + diff-friendly.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { PlayingTimeRole } from "@rpgfc/shared";
import { PLAYING_TIME_ROLES } from "@rpgfc/shared";

import type {
  Action,
  ListingSnapshot,
  OwnedPlayerSnapshot,
  Persona,
  PersonaContext,
} from "./personas.js";

export interface ClubStrategy {
  name: string;
  tagline: string;
  // ── targeting ──────────────────────────────────────────────────────────
  targetPositions?: ("gk" | "defender" | "midfielder" | "forward")[];
  targetMinBadges?: number;
  targetMaxAge?: number;
  targetMinAge?: number;
  /** Hard ceiling on asking price for fresh targets, in cents. */
  targetMaxAskingCents?: number;
  /** When true, sort by badge count desc; otherwise by asking price asc. */
  preferTopBadges?: boolean;
  preferCheapest?: boolean;
  /** Default/baseline role promise. Auto-promoted to meet player's
   *  minimum (capped by maxRolePromise). */
  rolePromise: PlayingTimeRole;
  /** Strongest role this club is willing to promise. Defaults to
   *  rolePromise (no promotion). Use to let a Hoarder reach for an
   *  Important Player when the listing demands it. */
  maxRolePromise?: PlayingTimeRole;
  // ── bidding ────────────────────────────────────────────────────────────
  openingFeePctOfAsking: number;
  /** Multiplier on max(currentWage, wageFloor). 1.10 = 10% over. */
  openingWageMultiplier: number;
  ratchetMaxAttempts: number;
  ratchetStepPct: number;
  abandonAtPctOfAsking: number;
  maxActiveBids: number;
  minCashFloorCents: number;
  /** Cap squad size — when reached, stop signing. */
  maxSquadSize?: number;
  /** Burn bids on cross-region players. Premium strategies only. */
  regionFlexible?: boolean;
  /** Fee multiplier for unsolicited inquiries on players who aren't
   *  listed. 0 (default) = only pursue listed players. A value ≥1.5 is
   *  needed to meet the seller's unlisted threshold. 1.6 = 60% over
   *  implied market value on the opening offer. */
  pursueUnlistedPremium?: number;
  /** Hard cap on successful signings per season. Default 3. */
  maxSigningsPerSeason?: number;
  /** Only bid in the week immediately following a loss. */
  bidOnlyAfterLoss?: boolean;
  // ── extensions ─────────────────────────────────────────────────────────
  extendWhenSeasonsLeftLte: number;
  extendMaxAge: number;
  extendWageMultiplier: number;
  extendSeasons: number;
  /** Only extend in the week after a win. */
  extendOnlyAfterWin?: boolean;
  // ── backfill ───────────────────────────────────────────────────────────
  backfillEnabled?: boolean;
}

// Global roster rules — football-world constraints, not per-strategy.
export const MIN_ROSTER_SIZE = 18;
export const MAX_ROSTER_SIZE = 30;
export const DEFAULT_MAX_SIGNINGS_PER_SEASON = 3;

// ── loader ────────────────────────────────────────────────────────────────

function strategiesDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "strategies");
}

export function loadAllStrategies(): ClubStrategy[] {
  const dir = strategiesDir();
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as ClubStrategy);
}

// Build a Persona facade so the existing harness loop can keep its shape.
export function strategyToPersona(strategy: ClubStrategy): Persona {
  return {
    name: strategy.name,
    tagline: strategy.tagline,
    decide: (ctx) => decideForStrategy(strategy, ctx),
  };
}

// ── decision logic ────────────────────────────────────────────────────────

function passesTargetFilter(
  strategy: ClubStrategy,
  l: ListingSnapshot,
  ctx: PersonaContext,
): boolean {
  // Unlisted players require explicit opt-in from the strategy.
  if (!l.isListed && !(strategy.pursueUnlistedPremium && strategy.pursueUnlistedPremium > 0)) {
    return false;
  }
  if (strategy.targetPositions && !strategy.targetPositions.includes(l.positionFamily)) {
    return false;
  }
  if (strategy.targetMinBadges !== undefined && l.badgeCount < strategy.targetMinBadges) {
    return false;
  }
  if (strategy.targetMaxAge !== undefined && l.age > strategy.targetMaxAge) return false;
  if (strategy.targetMinAge !== undefined && l.age < strategy.targetMinAge) return false;
  if (
    strategy.targetMaxAskingCents !== undefined &&
    l.askingPriceCents > strategy.targetMaxAskingCents
  ) {
    return false;
  }
  // Wage sanity: never chase a player whose floor would eat half our
  // cash over a season. Stops absurd wage-floor demands.
  if (l.wageFloorCents > 0 && l.wageFloorCents * 26 > ctx.club.cashCents * 0.5) {
    return false;
  }
  // (Region preference is checked separately in pickTargets so that
  // regionFlexible strategies can fall back to cross-region only when
  // the same-region pool is empty.)
  // Role promise: figure out what we'd offer this player (auto-promoted
  // to meet their minimum) and skip if even our ceiling can't reach it.
  if (offeredRole(strategy, l) === null) return false;
  return true;
}

/** What role we'd promise this listing — null if we can't reach their min. */
function offeredRole(strategy: ClubStrategy, l: ListingSnapshot): PlayingTimeRole | null {
  const baseIdx = PLAYING_TIME_ROLES.indexOf(strategy.rolePromise);
  const minIdx = PLAYING_TIME_ROLES.indexOf(l.minPlayingTime);
  const ceilIdx = PLAYING_TIME_ROLES.indexOf(strategy.maxRolePromise ?? strategy.rolePromise);
  // Smaller index = more playing time. We need to offer ≤ minIdx.
  const target = Math.min(minIdx, baseIdx);
  if (target < ceilIdx) return null; // even our ceiling is below their minimum
  return PLAYING_TIME_ROLES[target]!;
}

/**
 * Score a candidate so different clubs targeting the same player rotate
 * through the top picks rather than all converging on the single best.
 */
function diversityScore(
  strategy: ClubStrategy,
  ctx: PersonaContext,
  l: ListingSnapshot,
): number {
  // Stable per (club, listing) hash — keeps re-bid attempts on the same
  // player consistent, and spreads top picks across clubs.
  const h =
    (l.playerId * 2654435761) ^
    (ctx.club.clubId * 40503) ^
    (strategy.name.length * 7919);
  return h >>> 0;
}

function regionMatch(l: ListingSnapshot, ctx: PersonaContext): boolean {
  if (l.preferredRegions.length === 0) return true;
  if (!ctx.clubNationality) return true;
  return l.preferredRegions.includes(ctx.clubNationality);
}

function pickTargets(strategy: ClubStrategy, ctx: PersonaContext): ListingSnapshot[] {
  const baseEligible = ctx.marketListings.filter(
    (l) => passesTargetFilter(strategy, l, ctx) && !ctx.playersWithActiveBid.has(l.playerId),
  );
  // Same-region first; only fall back to cross-region if regionFlexible
  // is on AND nothing same-region is available this week.
  const sameRegion = baseEligible.filter((l) => regionMatch(l, ctx));
  const ratchetEligible =
    sameRegion.length > 0 || !strategy.regionFlexible ? sameRegion : baseEligible;
  // Ratchet candidates first: players this club has bid on before but
  // hasn't yet exhausted the ratchet limit.
  const ratchetCandidates = ratchetEligible.filter(
    (l) =>
      (ctx.playerBidAttempts.get(l.playerId) ?? 0) > 0 &&
      (ctx.playerBidAttempts.get(l.playerId) ?? 0) < strategy.ratchetMaxAttempts &&
      !ctx.playersRecentlyRejected.has(l.playerId),
  );
  // Backfill candidates: same-position as a recently-departed slot.
  const backfillPositions = strategy.backfillEnabled ? ctx.priorityBackfillPositions : new Set();
  const backfillCandidates = ratchetEligible.filter(
    (l) =>
      backfillPositions.has(l.positionFamily) &&
      (ctx.playerBidAttempts.get(l.playerId) ?? 0) === 0 &&
      !ctx.playersRecentlyRejected.has(l.playerId),
  );
  const fresh = ratchetEligible.filter(
    (l) =>
      (ctx.playerBidAttempts.get(l.playerId) ?? 0) === 0 &&
      !ctx.playersRecentlyRejected.has(l.playerId),
  );

  const sortFn = strategy.preferCheapest
    ? (a: ListingSnapshot, b: ListingSnapshot) => a.askingPriceCents - b.askingPriceCents
    : strategy.preferTopBadges
      ? (a: ListingSnapshot, b: ListingSnapshot) =>
          b.badgeCount - a.badgeCount ||
          diversityScore(strategy, ctx, a) - diversityScore(strategy, ctx, b)
      : (a: ListingSnapshot, b: ListingSnapshot) =>
          diversityScore(strategy, ctx, a) - diversityScore(strategy, ctx, b);

  const ordered = [
    ...ratchetCandidates.sort(sortFn),
    ...backfillCandidates.sort(sortFn),
    ...fresh.sort(sortFn),
  ];

  // Dedupe and clamp to active-bid budget.
  const seen = new Set<number>();
  const out: ListingSnapshot[] = [];
  const slots = Math.max(0, strategy.maxActiveBids - ctx.playersWithActiveBid.size);
  for (const c of ordered) {
    if (seen.has(c.playerId)) continue;
    seen.add(c.playerId);
    out.push(c);
    if (out.length >= slots) break;
  }
  return out;
}

function bidForTarget(
  strategy: ClubStrategy,
  ctx: PersonaContext,
  target: ListingSnapshot,
): Action | null {
  const attempts = ctx.playerBidAttempts.get(target.playerId) ?? 0;
  // Unlisted players require a premium. Opening bid starts at the
  // pursueUnlistedPremium multiplier (e.g. 1.6 = 60% over implied).
  const basePct = target.isListed
    ? strategy.openingFeePctOfAsking
    : (strategy.pursueUnlistedPremium ?? strategy.openingFeePctOfAsking);
  const feePct = basePct + attempts * strategy.ratchetStepPct;
  const abandonCap = target.isListed
    ? strategy.abandonAtPctOfAsking
    : Math.max(strategy.abandonAtPctOfAsking, 2.0);
  if (feePct > abandonCap) return null;
  const feeCents = Math.round(target.askingPriceCents * feePct);
  if (feeCents > ctx.club.cashCents - strategy.minCashFloorCents) return null;

  const wageBase = Math.max(target.currentWageCents, target.wageFloorCents, 100_000);
  const wageCents = Math.round(wageBase * strategy.openingWageMultiplier);

  const role = offeredRole(strategy, target) ?? strategy.rolePromise;
  return {
    kind: "bid",
    playerId: target.playerId,
    feeCents,
    wageCents,
    rolePromise: role,
  };
}

function extensionActions(strategy: ClubStrategy, ctx: PersonaContext): Action[] {
  if (strategy.extendOnlyAfterWin && ctx.club.lastResult !== "W") return [];
  if (strategy.extendSeasons === 0) return [];
  const out: Action[] = [];
  for (const p of ctx.ownedPlayers) {
    if (p.seasonsRemaining > strategy.extendWhenSeasonsLeftLte) continue;
    if (p.age > strategy.extendMaxAge) continue;
    const attempts = ctx.extensionRejections.get(p.playerId) ?? 0;
    if (attempts >= 2) continue;
    // Step wage up after a rejection.
    const mult = strategy.extendWageMultiplier + attempts * 0.10;
    const wageCents = Math.round(Math.max(p.weeklyWageCents, 100_000) * mult);
    out.push({
      kind: "extend",
      playerId: p.playerId,
      wageCents,
      seasons: strategy.extendSeasons,
      rolePromise: strategy.rolePromise,
    });
  }
  return out;
}

export function decideForStrategy(
  strategyIn: ClubStrategy,
  ctx: PersonaContext,
): Action[] {
  const actions: Action[] = [];

  // Emergency overlay: if the club is below the roster floor, patch
  // the strategy's risk-aversion knobs to sane defaults so even passive
  // personas bid to replenish.
  const understaffed = ctx.club.squadSize < MIN_ROSTER_SIZE;
  const strategy: ClubStrategy = understaffed
    ? {
        ...strategyIn,
        openingFeePctOfAsking: Math.max(strategyIn.openingFeePctOfAsking, 1.0),
        openingWageMultiplier: Math.max(strategyIn.openingWageMultiplier, 1.1),
        abandonAtPctOfAsking: Math.max(strategyIn.abandonAtPctOfAsking, 1.3),
        maxActiveBids: Math.max(strategyIn.maxActiveBids, 2),
        pursueUnlistedPremium: Math.max(strategyIn.pursueUnlistedPremium ?? 0, 1.5),
        regionFlexible: true,
        maxSigningsPerSeason: 10,
        ...(strategyIn.targetPositions === undefined
          ? {}
          : { targetPositions: ["gk", "defender", "midfielder", "forward"] }),
      }
    : strategyIn;

  const signingCap = strategy.maxSigningsPerSeason ?? DEFAULT_MAX_SIGNINGS_PER_SEASON;
  const canBid =
    understaffed ||
    (strategy.maxActiveBids > 0 &&
      ctx.club.cashCents > strategy.minCashFloorCents &&
      (!strategy.bidOnlyAfterLoss || ctx.club.lastResult === "L") &&
      (strategy.maxSquadSize === undefined || ctx.club.squadSize < strategy.maxSquadSize) &&
      // Include active bids — if we already have signingsThisSeason +
      // outstanding offers near the cap, stop submitting more.
      ctx.signingsThisSeason + ctx.playersWithActiveBid.size < signingCap &&
      ctx.club.squadSize < MAX_ROSTER_SIZE);

  if (canBid) {
    for (const target of pickTargets(strategy, ctx)) {
      const action = bidForTarget(strategy, ctx, target);
      if (action) actions.push(action);
    }
  }

  for (const ext of extensionActions(strategy, ctx)) actions.push(ext);

  return actions;
}

// Used only when the harness wants to replace its in-code roster.
export function loadStrategyRoster(): Persona[] {
  return loadAllStrategies().map(strategyToPersona);
}

export function _internalDescribeOwnedPlayer(p: OwnedPlayerSnapshot): string {
  // unused export retained so future tests can spot-check snapshot shape
  return `${p.playerName} (age ${p.age})`;
}
