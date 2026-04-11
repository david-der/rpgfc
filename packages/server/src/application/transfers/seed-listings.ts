// Listings + preferences seed — Story 04.
//
// Both seeders run on world generation, after players exist. Deterministic:
// the same world seed always produces the same listing set and preference
// rows. Idempotent: re-running is a no-op.

import type { DbClient } from "../../db/client.js";
import { mulberry32 } from "../generation/rng.js";
import { estimateValueCents } from "./valuations.js";

export interface ListingsSeedResult {
  listingsCreated: number;
  skipped: boolean;
}

export interface PreferencesSeedResult {
  preferencesCreated: number;
  skipped: boolean;
}

const REASONS = ["rebuild", "wage_trim", "squad_overhaul"] as const;

interface PlayerRow {
  id: number;
  name: string;
  club_id: number | null;
  nationality: string;
  archetype_id: string;
  experience_years: number;
  hidden_attrs_json: string;
}

// ── listings ───────────────────────────────────────────────────────────────

export async function seedListingsIfEmpty(client: DbClient): Promise<ListingsSeedResult> {
  // Idempotent: if any listings exist, do nothing.
  if (client.dialect === "sqlite") {
    const existing = client.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM listing`)
      .get();
    if ((existing?.n ?? 0) > 0) {
      return { listingsCreated: 0, skipped: true };
    }
  } else {
    const { rows } = await client.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM listing`,
    );
    if (Number(rows[0]?.n ?? 0) > 0) {
      return { listingsCreated: 0, skipped: true };
    }
  }

  // Pull every (club, players) pair. Story 04 lists the oldest 3 players
  // per club (simple heuristic — see §3.2 of the story doc). That keeps
  // listings stable across runs without the full "moneyball vs star" AI
  // machinery.
  const clubs = await loadClubs(client);
  const now = new Date().toISOString();
  let created = 0;

  for (const club of clubs) {
    const players = await loadPlayersForClub(client, club.id);
    if (players.length === 0) continue;
    // Sort by descending experienceYears so the oldest show up first.
    players.sort((a, b) => b.experience_years - a.experience_years);

    // RNG seeded per club so listing counts vary 1..3 deterministically.
    const rng = mulberry32((club.id * 97 + 7) >>> 0);
    const count = 1 + Math.floor(rng.next() * 3); // 1..3 inclusive
    const chosen = players.slice(0, Math.min(count, players.length));

    for (let i = 0; i < chosen.length; i++) {
      const player = chosen[i]!;
      const askingCents = estimateValueCents({
        archetypeId: player.archetype_id,
        experienceYears: player.experience_years,
        badgeKeys: [], // listings predate any observation, so badge count = 0
        name: player.name,
      });
      const reason = REASONS[i % REASONS.length]!;
      await insertListing(client, player.id, askingCents, reason, now);
      created++;
    }
  }

  return { listingsCreated: created, skipped: false };
}

// ── preferences ────────────────────────────────────────────────────────────

export async function seedPreferencesIfEmpty(client: DbClient): Promise<PreferencesSeedResult> {
  if (client.dialect === "sqlite") {
    const existing = client.sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM player_preferences`)
      .get();
    if ((existing?.n ?? 0) > 0) {
      return { preferencesCreated: 0, skipped: true };
    }
  } else {
    const { rows } = await client.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM player_preferences`,
    );
    if (Number(rows[0]?.n ?? 0) > 0) {
      return { preferencesCreated: 0, skipped: true };
    }
  }

  const players = await loadAllPlayers(client);
  const clubs = await loadClubs(client);
  const clubIds = clubs.map((c) => c.id);
  let created = 0;

  for (const player of players) {
    const prefs = derivePreferences(player, clubIds);
    await insertPreferences(
      client,
      player.id,
      prefs.wageFloorCents,
      prefs.minPlayingTime,
      prefs.preferredRegions,
      prefs.forbiddenClubIds,
    );
    created++;
  }

  return { preferencesCreated: created, skipped: false };
}

interface DerivedPreferences {
  wageFloorCents: number;
  minPlayingTime: string;
  preferredRegions: string[];
  forbiddenClubIds: number[];
}

const MIN_PLAYING_TIME_RAMP = [
  "Youth/Development",
  "Backup",
  "Rotation",
  "Important Player",
  "Star Player",
] as const;

function derivePreferences(player: PlayerRow, clubIds: number[]): DerivedPreferences {
  // Deterministic per player name + id.
  const rng = mulberry32((player.id * 131 + 53) >>> 0);

  // Wage floor scales with experienceYears. A newcomer accepts very
  // little; a seasoned player wants real money.
  const expRamp = [
    500_000, // $5k/week at 0 years
    1_500_000, // $15k/week at 5 years
    3_000_000, // $30k/week at 10 years
    5_000_000, // $50k/week at 15 years
    8_000_000, // $80k/week at 20+ years
  ];
  const expSlot = Math.min(Math.floor(player.experience_years / 5), expRamp.length - 1);
  const wageFloorCents = Math.floor(expRamp[expSlot]! * (0.8 + rng.next() * 0.5));

  // Min playing time scales with experienceYears too — star players
  // want star roles. Range 0..4.
  const timeIdx = Math.min(
    MIN_PLAYING_TIME_RAMP.length - 1,
    Math.max(0, Math.floor(player.experience_years / 6)),
  );
  const minPlayingTime = MIN_PLAYING_TIME_RAMP[timeIdx]!;

  // Preferred regions: always include the player's own nationality.
  // Sometimes add a second preferred region for variety.
  const preferredRegions: string[] = [player.nationality];
  const secondChoice = rng.chance(0.3);
  if (secondChoice) {
    const others = ["ES", "NL", "BR"].filter((r) => r !== player.nationality);
    preferredRegions.push(others[Math.floor(rng.next() * others.length)]!);
  }

  // Forbidden clubs: 0..2 random clubs the player refuses. 40% chance of
  // any forbidden clubs at all.
  const forbiddenClubIds: number[] = [];
  if (rng.chance(0.4) && clubIds.length > 1) {
    const howMany = 1 + Math.floor(rng.next() * 2);
    const shuffled = [...clubIds].sort(() => rng.next() - 0.5);
    for (let i = 0; i < Math.min(howMany, shuffled.length); i++) {
      // Don't forbid the player's current club.
      const candidate = shuffled[i]!;
      if (candidate !== player.club_id) forbiddenClubIds.push(candidate);
    }
  }

  return {
    wageFloorCents,
    minPlayingTime,
    preferredRegions,
    forbiddenClubIds,
  };
}

// ── DB helpers ─────────────────────────────────────────────────────────────

async function loadClubs(
  client: DbClient,
): Promise<Array<{ id: number; name: string; nationality: string }>> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<
        [],
        { id: number; name: string; nationality: string }
      >(`SELECT id, name, nationality FROM clubs`)
      .all();
  }
  const res = await client.pool.query<{
    id: number;
    name: string;
    nationality: string;
  }>(`SELECT id, name, nationality FROM clubs`);
  return res.rows;
}

async function loadPlayersForClub(client: DbClient, clubId: number): Promise<PlayerRow[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[number], PlayerRow>(
        `SELECT id, name, club_id, nationality, archetype_id,
                experience_years, hidden_attrs_json
         FROM players WHERE club_id = ?
         ORDER BY id`,
      )
      .all(clubId);
  }
  const res = await client.pool.query<PlayerRow>(
    `SELECT id, name, club_id, nationality, archetype_id,
            experience_years, hidden_attrs_json
     FROM players WHERE club_id = $1 ORDER BY id`,
    [clubId],
  );
  return res.rows;
}

async function loadAllPlayers(client: DbClient): Promise<PlayerRow[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[], PlayerRow>(
        `SELECT id, name, club_id, nationality, archetype_id,
                experience_years, hidden_attrs_json
         FROM players ORDER BY id`,
      )
      .all();
  }
  const res = await client.pool.query<PlayerRow>(
    `SELECT id, name, club_id, nationality, archetype_id,
            experience_years, hidden_attrs_json
     FROM players ORDER BY id`,
  );
  return res.rows;
}

async function insertListing(
  client: DbClient,
  playerId: number,
  askingCents: number,
  reason: string,
  now: string,
): Promise<void> {
  if (client.dialect === "sqlite") {
    client.sqlite
      .prepare(
        `INSERT INTO listing (player_id, asking_price_cents, reason, listed_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(playerId, askingCents, reason, now);
    return;
  }
  await client.pool.query(
    `INSERT INTO listing (player_id, asking_price_cents, reason, listed_at)
     VALUES ($1, $2, $3, $4)`,
    [playerId, askingCents, reason, now],
  );
}

async function insertPreferences(
  client: DbClient,
  playerId: number,
  wageFloorCents: number,
  minPlayingTime: string,
  preferredRegions: string[],
  forbiddenClubIds: number[],
): Promise<void> {
  const regionsJson = JSON.stringify(preferredRegions);
  const forbiddenJson = JSON.stringify(forbiddenClubIds);

  if (client.dialect === "sqlite") {
    client.sqlite
      .prepare(
        `INSERT INTO player_preferences
           (player_id, wage_floor_cents, min_playing_time,
            preferred_regions_json, forbidden_club_ids_json)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(playerId, wageFloorCents, minPlayingTime, regionsJson, forbiddenJson);
    return;
  }
  await client.pool.query(
    `INSERT INTO player_preferences
       (player_id, wage_floor_cents, min_playing_time,
        preferred_regions_json, forbidden_club_ids_json)
     VALUES ($1, $2, $3, $4, $5)`,
    [playerId, wageFloorCents, minPlayingTime, regionsJson, forbiddenJson],
  );
}
