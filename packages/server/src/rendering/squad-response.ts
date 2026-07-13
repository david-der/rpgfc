// Squad rendering orchestration — Story 05.
//
// Loads the club's squad_entries, joins them against players +
// contracts, and returns a RenderedSquad with per-entry promise moods
// + a squad-level harmony tier. The mood computation lives in
// application/squad/harmony.ts and is imported here.

import type {
  Harmony,
  PlayingTimeRole,
  PromiseMood,
  RenderedAvailability,
  RenderedSquad,
  RenderedSquadEntry,
  SquadRole,
} from "@rpgfc/shared";
import {
  ARCHETYPE_BY_ID,
  FORM_TIERS,
  HARMONY_LABELS,
  SQUAD_ROLE_LABELS,
  SQUAD_ROLES,
  PLAYING_TIME_ROLES,
  wageTierFor,
} from "@rpgfc/shared";
import type { FormTier } from "@rpgfc/shared";

import { harmonyFor, moodFor, moodLabel } from "../application/squad/harmony.js";
import { setSquadRole as setSquadRoleRepo } from "../application/squad/repository.js";
import type { DbClient } from "../db/client.js";

interface PlayerJoinRow {
  id: number;
  name: string;
  archetype_id: string;
  age: number;
  role: string;
  role_promise: string | null;
  weekly_wage_cents: number | null;
  seasons_remaining: number | null;
  form_tier: string | null;
  fatigue_load: number;
  injury_matches_remaining: number;
  suspension_matches_remaining: number;
  promise_event_mood: string | null;
}

interface RecentFormRow {
  tier: string;
  matchday: number;
}

interface ClubRow {
  id: number;
  name: string;
}

function parseSquadRole(raw: string): SquadRole {
  return (SQUAD_ROLES as readonly string[]).includes(raw) ? (raw as SquadRole) : "Rotation";
}

function parseRolePromise(raw: string | null): PlayingTimeRole | null {
  if (!raw) return null;
  return (PLAYING_TIME_ROLES as readonly string[]).includes(raw) ? (raw as PlayingTimeRole) : null;
}

async function loadSquadJoin(client: DbClient, clubId: number): Promise<PlayerJoinRow[]> {
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<[number], PlayerJoinRow>(
        `SELECT p.id, p.name, p.archetype_id, p.age, s.role, c.role_promise,
                c.weekly_wage_cents, c.seasons_remaining,
                COALESCE(pc.fatigue_load, 0) AS fatigue_load,
                COALESCE(pc.injury_matches_remaining, 0) AS injury_matches_remaining,
                COALESCE(pd.suspension_matches_remaining, 0) AS suspension_matches_remaining,
                (SELECT pre.mood FROM player_relationship_events pre
                 WHERE pre.player_id = p.id
                   AND pre.club_id = s.club_id
                   AND pre.season = COALESCE((SELECT season FROM save_state WHERE id = 1), 0)
                   AND pre.event_type = 'playing_time_promise_broken'
                 ORDER BY pre.match_week DESC, pre.id DESC LIMIT 1) AS promise_event_mood,
                (SELECT pmp.tier FROM player_match_performance pmp
                 JOIN matches m ON m.id = pmp.match_id
                 WHERE pmp.player_id = p.id AND m.state = 'Played'
                 ORDER BY m.matchday DESC LIMIT 1) AS form_tier
         FROM squad_entries s
         JOIN players p ON p.id = s.player_id
         LEFT JOIN contracts c ON c.player_id = s.player_id
         LEFT JOIN player_condition pc ON pc.player_id = s.player_id
         LEFT JOIN player_discipline pd
           ON pd.player_id = s.player_id
          AND pd.competition_key = 'league'
          AND pd.season = COALESCE((SELECT season FROM save_state WHERE id = 1), 0)
         WHERE s.club_id = ?
         ORDER BY p.id`,
      )
      .all(clubId);
  }
  const res = await client.pool.query<PlayerJoinRow>(
    `SELECT p.id, p.name, p.archetype_id, p.age, s.role, c.role_promise,
            c.weekly_wage_cents, c.seasons_remaining,
            COALESCE(pc.fatigue_load, 0) AS fatigue_load,
            COALESCE(pc.injury_matches_remaining, 0) AS injury_matches_remaining,
            COALESCE(pd.suspension_matches_remaining, 0) AS suspension_matches_remaining,
            (SELECT pre.mood FROM player_relationship_events pre
             WHERE pre.player_id = p.id
               AND pre.club_id = s.club_id
               AND pre.season = COALESCE((SELECT season FROM save_state WHERE id = 1), 0)
               AND pre.event_type = 'playing_time_promise_broken'
             ORDER BY pre.match_week DESC, pre.id DESC LIMIT 1) AS promise_event_mood,
            (SELECT pmp.tier FROM player_match_performance pmp
             JOIN matches m ON m.id = pmp.match_id
             WHERE pmp.player_id = p.id AND m.state = 'Played'
             ORDER BY m.matchday DESC LIMIT 1) AS form_tier
     FROM squad_entries s
     JOIN players p ON p.id = s.player_id
     LEFT JOIN contracts c ON c.player_id = s.player_id
     LEFT JOIN player_condition pc ON pc.player_id = s.player_id
     LEFT JOIN player_discipline pd
       ON pd.player_id = s.player_id
      AND pd.competition_key = 'league'
      AND pd.season = COALESCE((SELECT season FROM save_state WHERE id = 1), 0)
     WHERE s.club_id = $1
     ORDER BY p.id`,
    [clubId],
  );
  return res.rows;
}

async function loadClubRow(client: DbClient, clubId: number): Promise<ClubRow | null> {
  if (client.dialect === "sqlite") {
    return (
      client.sqlite
        .prepare<[number], ClubRow>(`SELECT id, name FROM clubs WHERE id = ?`)
        .get(clubId) ?? null
    );
  }
  const res = await client.pool.query<ClubRow>(`SELECT id, name FROM clubs WHERE id = $1`, [
    clubId,
  ]);
  return res.rows[0] ?? null;
}

async function loadRecentForm(client: DbClient, playerId: number): Promise<FormTier[]> {
  let rows: RecentFormRow[];
  if (client.dialect === "sqlite") {
    rows = client.sqlite
      .prepare<[number], RecentFormRow>(
        `SELECT pmp.tier AS tier, m.matchday AS matchday
         FROM player_match_performance pmp
         JOIN matches m ON m.id = pmp.match_id
         WHERE pmp.player_id = ? AND m.state = 'Played'
         ORDER BY m.season DESC, m.matchday DESC, m.id DESC
         LIMIT 5`,
      )
      .all(playerId);
  } else {
    const res = await client.pool.query<RecentFormRow>(
      `SELECT pmp.tier AS tier, m.matchday AS matchday
       FROM player_match_performance pmp
       JOIN matches m ON m.id = pmp.match_id
       WHERE pmp.player_id = $1 AND m.state = 'Played'
       ORDER BY m.season DESC, m.matchday DESC, m.id DESC
       LIMIT 5`,
      [playerId],
    );
    rows = res.rows;
  }
  return rows
    .map((row) => row.tier)
    .filter((tier): tier is FormTier => (FORM_TIERS as readonly string[]).includes(tier));
}

async function loadMatchesSinceLastStart(
  client: DbClient,
  playerId: number,
  currentSeason: number,
): Promise<number | null> {
  // Count played matchweeks since the player's most recent actual start.
  let lastMatchday: number | null = null;
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<[number, number], { matchday: number }>(
        `SELECT m.matchday AS matchday
         FROM player_match_performance pmp
         JOIN matches m ON m.id = pmp.match_id
         WHERE pmp.player_id = ? AND pmp.started = 1
           AND m.state = 'Played' AND m.season = ?
         ORDER BY m.matchday DESC, m.id DESC
         LIMIT 1`,
      )
      .get(playerId, currentSeason);
    if (row) lastMatchday = row.matchday;
  } else {
    const res = await client.pool.query<{ matchday: number }>(
      `SELECT m.matchday AS matchday
       FROM player_match_performance pmp
       JOIN matches m ON m.id = pmp.match_id
       WHERE pmp.player_id = $1 AND pmp.started = 1
         AND m.state = 'Played' AND m.season = $2
       ORDER BY m.matchday DESC, m.id DESC
       LIMIT 1`,
      [playerId, currentSeason],
    );
    if (res.rows[0]) lastMatchday = res.rows[0].matchday;
  }
  if (lastMatchday === null) return null;

  let mostRecentPlayed: number | null = null;
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<[number], { matchday: number }>(
        `SELECT matchday FROM matches
         WHERE state = 'Played' AND season = ?
         ORDER BY matchday DESC, id DESC LIMIT 1`,
      )
      .get(currentSeason);
    if (row) mostRecentPlayed = row.matchday;
  } else {
    const res = await client.pool.query<{ matchday: number }>(
      `SELECT matchday FROM matches
       WHERE state = 'Played' AND season = $1
       ORDER BY matchday DESC, id DESC LIMIT 1`,
      [currentSeason],
    );
    if (res.rows[0]) mostRecentPlayed = res.rows[0].matchday;
  }
  if (mostRecentPlayed === null) return null;
  return Math.max(0, mostRecentPlayed - lastMatchday);
}

function buildEntry(row: PlayerJoinRow): RenderedSquadEntry {
  const squadRole = parseSquadRole(row.role);
  const rolePromise = parseRolePromise(row.role_promise);
  const hasPlayingTimeEvent = row.promise_event_mood === "Disappointed";
  const mood: PromiseMood = hasPlayingTimeEvent ? "Disappointed" : moodFor(rolePromise, squadRole);
  const label = hasPlayingTimeEvent
    ? "A promised place has gone unfulfilled. He remembers."
    : moodLabel(mood, row.id);
  const archetype = ARCHETYPE_BY_ID[row.archetype_id];
  // Age 17 = this season's youth intake. endSeason only mints new
  // players at that age, so any 17-year-old on the roster is by
  // definition a fresh arrival.
  const isNewArrival = row.age === 17;
  const wageTier = row.weekly_wage_cents !== null ? wageTierFor(row.weekly_wage_cents) : null;
  const formTier =
    row.form_tier && (FORM_TIERS as readonly string[]).includes(row.form_tier)
      ? (row.form_tier as FormTier)
      : null;
  const availability = renderAvailability(row);
  return {
    playerId: row.id,
    playerName: row.name,
    positionLabel: archetype?.positionLabel ?? "??",
    archetypeLabel: archetype?.displayName ?? null,
    age: row.age,
    isNewArrival,
    role: squadRole,
    roleLabel: SQUAD_ROLE_LABELS[squadRole],
    rolePromise,
    promiseMood: mood,
    promiseMoodLabel: label,
    wageTier,
    seasonsRemaining: row.seasons_remaining,
    formTier,
    recentForm: [],
    availability,
    matchesSinceLastStart: null,
  };
}

function renderAvailability(row: PlayerJoinRow): RenderedAvailability {
  const condition =
    row.fatigue_load <= 20
      ? "Fresh"
      : row.fatigue_load <= 55
        ? "Ready"
        : row.fatigue_load <= 80
          ? "Heavy"
          : "Spent";
  if (row.injury_matches_remaining > 0) {
    return { state: "Injured", condition, explanation: "Unavailable through injury." };
  }
  if (row.suspension_matches_remaining > 0) {
    return { state: "Suspended", condition, explanation: "Serving a league suspension." };
  }
  const explanation =
    condition === "Fresh"
      ? "Fresh and available."
      : condition === "Ready"
        ? "Ready for selection."
        : condition === "Heavy"
          ? "Available, with a heavy workload."
          : "Available, but badly in need of rest.";
  return { state: "Available", condition, explanation };
}

export async function renderSquadForClub(
  client: DbClient,
  clubId: number,
): Promise<RenderedSquad | null> {
  const club = await loadClubRow(client, clubId);
  if (!club) return null;
  const rows = await loadSquadJoin(client, clubId);
  const entries = rows.map(buildEntry);

  // Current season for the matches-since-last-start lookup. Falls back
  // to 0 if the save_state row isn't there yet (tests use fresh DBs).
  let currentSeason = 0;
  if (client.dialect === "sqlite") {
    const row = client.sqlite
      .prepare<[], { season: number }>(`SELECT season FROM save_state WHERE id = 1`)
      .get();
    if (row) currentSeason = row.season;
  } else {
    const res = await client.pool.query<{ season: number }>(
      `SELECT season FROM save_state WHERE id = 1`,
    );
    if (res.rows[0]) currentSeason = res.rows[0].season;
  }

  // Enrich each entry with recent qualitative form + matches-since-last-start.
  // Separate per-player queries are simple + dual-dialect portable;
  // the squad is capped at ~25 players so this is well under budget.
  await Promise.all(
    entries.map(async (entry) => {
      const [recentForm, since] = await Promise.all([
        loadRecentForm(client, entry.playerId),
        loadMatchesSinceLastStart(client, entry.playerId, currentSeason),
      ]);
      entry.recentForm = recentForm;
      entry.matchesSinceLastStart = since;
    }),
  );

  const moods: PromiseMood[] = entries
    .map((e) => e.promiseMood)
    .filter((m): m is PromiseMood => m !== null);
  const harmony: Harmony = harmonyFor(moods);
  return {
    clubId: club.id,
    clubName: club.name,
    harmony,
    harmonyLabel: HARMONY_LABELS[harmony],
    entries,
  };
}

// Thin wrapper for the route layer — returns the updated rendered
// squad so the route can echo it back to the client and the UI can
// refresh without a second round-trip.
export async function setSquadRoleRendered(
  client: DbClient,
  input: { playerId: number; role: SquadRole },
): Promise<RenderedSquad | null> {
  const entry = await setSquadRoleRepo(client, input);
  if (!entry) return null;
  return renderSquadForClub(client, entry.clubId);
}

// ── per-player promise mood lookup for the player profile route ──────────

export interface PromiseMoodForPlayer {
  squadRole: SquadRole | null;
  rolePromise: PlayingTimeRole | null;
  promiseMood: PromiseMood | null;
  promiseMoodLabel: string | null;
}

interface PlayerMoodRow {
  role: string | null;
  role_promise: string | null;
  promise_event_mood: string | null;
}

export async function loadPromiseMoodForPlayer(
  client: DbClient,
  playerId: number,
): Promise<PromiseMoodForPlayer> {
  let row: PlayerMoodRow | null = null;
  if (client.dialect === "sqlite") {
    row =
      client.sqlite
        .prepare<[number], PlayerMoodRow>(
          `SELECT s.role, c.role_promise,
                  (SELECT pre.mood FROM player_relationship_events pre
                   WHERE pre.player_id = p.id
                     AND pre.club_id = s.club_id
                     AND pre.season = COALESCE((SELECT season FROM save_state WHERE id = 1), 0)
                     AND pre.event_type = 'playing_time_promise_broken'
                   ORDER BY pre.match_week DESC, pre.id DESC LIMIT 1) AS promise_event_mood
           FROM players p
           LEFT JOIN squad_entries s ON s.player_id = p.id
           LEFT JOIN contracts c ON c.player_id = p.id
           WHERE p.id = ?`,
        )
        .get(playerId) ?? null;
  } else {
    const res = await client.pool.query<PlayerMoodRow>(
      `SELECT s.role, c.role_promise,
              (SELECT pre.mood FROM player_relationship_events pre
               WHERE pre.player_id = p.id
                 AND pre.club_id = s.club_id
                 AND pre.season = COALESCE((SELECT season FROM save_state WHERE id = 1), 0)
                 AND pre.event_type = 'playing_time_promise_broken'
               ORDER BY pre.match_week DESC, pre.id DESC LIMIT 1) AS promise_event_mood
       FROM players p
       LEFT JOIN squad_entries s ON s.player_id = p.id
       LEFT JOIN contracts c ON c.player_id = p.id
       WHERE p.id = $1`,
      [playerId],
    );
    row = res.rows[0] ?? null;
  }

  if (!row) {
    return {
      squadRole: null,
      rolePromise: null,
      promiseMood: null,
      promiseMoodLabel: null,
    };
  }

  const squadRole = row.role ? parseSquadRole(row.role) : null;
  const rolePromise = parseRolePromise(row.role_promise);
  if (!squadRole) {
    return {
      squadRole: null,
      rolePromise,
      promiseMood: null,
      promiseMoodLabel: null,
    };
  }
  const hasPlayingTimeEvent = row.promise_event_mood === "Disappointed";
  const mood = hasPlayingTimeEvent ? "Disappointed" : moodFor(rolePromise, squadRole);
  return {
    squadRole,
    rolePromise,
    promiseMood: mood,
    promiseMoodLabel: hasPlayingTimeEvent
      ? "A promised place has gone unfulfilled. He remembers."
      : moodLabel(mood, playerId),
  };
}
