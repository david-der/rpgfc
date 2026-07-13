// AI bidding — Story 08 follow-up.
//
// On each advanceMatchday, AI clubs scan the listings and submit bids
// based on positional need and cash. Simple first pass:
//
// 1. For each non-user club with cash:
//    - Count their current squad by position family.
//    - If they have < 2 players at a forward or midfield position,
//      they're a candidate buyer.
//    - Deterministic per (matchWeek, clubId) — so the same match week
//      always produces the same AI bids.
// 2. For each candidate buyer, pick one listed player that:
//    - Fits their needed position.
//    - Is on a different club.
//    - They can afford (cash >= asking price).
//    - Doesn't already have a pending bid from this buyer.
// 3. Bid at the asking tier (no lowball from AI — it feels more alive
//    when competing bids are at market value).
//
// Keeps the rate low: at most 1 bid per AI club per match week, and
// overall capped at 5 new AI bids per tick.

import type { DbClient } from "../../db/client.js";
import { mulberry32 } from "../generation/rng.js";
import { submitBid } from "./bids.js";

const MAX_BIDS_PER_TICK = 5;
const USER_CLUB_ID = 1;

interface ClubInfo {
  id: number;
  cash_reserve_cents: number;
  wage_budget_cents_per_week: number;
}

interface ListingInfo {
  player_id: number;
  player_club_id: number;
  archetype_id: string;
  asking_price_cents: number;
  position_label: string;
}

interface SquadInfo {
  club_id: number;
  position_label: string;
  count: number;
}

async function loadClubs(client: DbClient): Promise<ClubInfo[]> {
  if (client.dialect !== "sqlite") return [];
  return client.sqlite
    .prepare<[number], ClubInfo>(
      `SELECT c.id, ie.cash_reserve_cents, ie.wage_budget_cents_per_week
       FROM clubs c
       JOIN club_identity_ext ie ON ie.club_id = c.id
       WHERE c.id != ?`,
    )
    .all(USER_CLUB_ID);
}

async function loadListings(client: DbClient): Promise<ListingInfo[]> {
  if (client.dialect !== "sqlite") return [];
  return client.sqlite
    .prepare<[], ListingInfo>(
      `SELECT l.player_id, p.club_id AS player_club_id, p.archetype_id,
              l.asking_price_cents,
              p.archetype_id AS position_label
       FROM listing l
       JOIN players p ON p.id = l.player_id`,
    )
    .all();
}

async function loadSquadCounts(client: DbClient): Promise<Map<string, number>> {
  // Count players per (club_id, archetype-derived position family).
  if (client.dialect !== "sqlite") return new Map();
  const rows = client.sqlite
    .prepare<[], SquadInfo>(
      `SELECT club_id, archetype_id AS position_label, COUNT(*) AS count
       FROM players
       WHERE club_id IS NOT NULL
       GROUP BY club_id, archetype_id`,
    )
    .all();
  const out = new Map<string, number>();
  for (const r of rows) {
    out.set(`${r.club_id}:${r.position_label}`, r.count);
  }
  return out;
}

async function loadExistingBidKeys(client: DbClient): Promise<Set<string>> {
  // Bids that are still active — block duplicates from the same buyer.
  if (client.dialect !== "sqlite") return new Set();
  const rows = client.sqlite
    .prepare<[], { from_club_id: number; player_id: number }>(
      `SELECT from_club_id, player_id FROM bids
       WHERE state IN ('Submitted', 'SellerReviewing', 'SellerAccepted', 'PlayerReviewing', 'SellerCountered')`,
    )
    .all();
  return new Set(rows.map((r) => `${r.from_club_id}:${r.player_id}`));
}

/** Map archetype_id → rough position family used for need counting. */
function familyOf(archetypeId: string): string {
  // The archetype_id strings are things like "clinical_striker",
  // "ball_playing_cb", etc. Reduce to a coarse family:
  const id = archetypeId.toLowerCase();
  if (id.includes("striker") || id.includes("forward")) return "forward";
  if (id.includes("winger") || id.includes("wing")) return "wing";
  if (id.includes("cm") || id.includes("midfielder") || id.includes("mid")) return "mid";
  if (id.includes("cb") || id.includes("back") || id.includes("defender")) return "defense";
  if (id.includes("gk") || id.includes("keeper")) return "gk";
  return "other";
}

export async function generateAiBids(client: DbClient, matchWeek: number): Promise<number> {
  if (client.dialect !== "sqlite") return 0;

  const clubs = await loadClubs(client);
  const listings = await loadListings(client);
  const squadCounts = await loadSquadCounts(client);
  const existingBids = await loadExistingBidKeys(client);

  // Sort listings and clubs for deterministic iteration.
  listings.sort((a, b) => a.player_id - b.player_id);
  clubs.sort((a, b) => a.id - b.id);

  const rng = mulberry32((matchWeek * 101 + 13) >>> 0);
  let bidsPlaced = 0;

  for (const club of clubs) {
    if (bidsPlaced >= MAX_BIDS_PER_TICK) break;
    // 50% chance this club bids at all this match week.
    if (!rng.chance(0.5)) continue;

    // Figure out what positions this club needs (< 3 players in family).
    const needed = new Set<string>();
    const familyCounts = new Map<string, number>();
    for (const [key, count] of squadCounts) {
      if (!key.startsWith(`${club.id}:`)) continue;
      const arch = key.slice(key.indexOf(":") + 1);
      const fam = familyOf(arch);
      familyCounts.set(fam, (familyCounts.get(fam) ?? 0) + count);
    }
    for (const fam of ["forward", "wing", "mid", "defense", "gk"]) {
      if ((familyCounts.get(fam) ?? 0) < 3) needed.add(fam);
    }
    if (needed.size === 0) continue;

    // Find listings matching a needed family, not on this club, affordable,
    // and not already bid on by this club.
    const candidates = listings.filter((l) => {
      if (l.player_club_id === club.id) return false;
      if (!needed.has(familyOf(l.archetype_id))) return false;
      if (l.asking_price_cents > club.cash_reserve_cents) return false;
      if (existingBids.has(`${club.id}:${l.player_id}`)) return false;
      return true;
    });
    if (candidates.length === 0) continue;

    // Pick one deterministically.
    const target = candidates[Math.floor(rng.next() * candidates.length)]!;

    try {
      await submitBid(client, {
        playerId: target.player_id,
        fromClubId: club.id,
        feeCents: target.asking_price_cents, // AI bids at asking
        wageCents: Math.floor(club.wage_budget_cents_per_week * 0.15),
        signingBonusCents: 0,
        rolePromise: "Important Player",
        matchWeek,
      });
      existingBids.add(`${club.id}:${target.player_id}`);
      bidsPlaced++;
    } catch {
      // Silently skip — e.g. self-bid guard, race condition. Deterministic
      // retries next week.
    }
  }

  return bidsPlaced;
}
