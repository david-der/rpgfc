// Typed Hono RPC client for the @rpgfc/server API.
//
// The `import type` on the next line is NON-NEGOTIABLE. Without `type`, Vite
// pulls the server's runtime modules (better-sqlite3, pg, pino, Node built-
// ins) into the browser bundle and the build fails with "cannot resolve
// 'node:fs'" or similar. See CLAUDE.md §16 and Story 00 §9.5.
import type { AppType } from "@rpgfc/server";
import { hc } from "hono/client";

// Base URL: in dev the Vite proxy forwards /api to :8787. In prod the static
// assets are served from the same origin as the API, so a relative base is
// also correct. Passing "/" lets hc() build full paths like "/api/health".
export const api = hc<AppType>("/");

/** Read a friendly error message out of a failed Hono response.
 *  Falls back to a human-sensible sentence if the server didn't send
 *  our `{ error: { message } }` envelope. Never surfaces the HTTP
 *  status code — that belongs in the network tab, not in the UI. */
export async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.clone().json()) as { error?: { message?: string } } | undefined;
    const msg = body?.error?.message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  } catch {
    // JSON parse failure — server returned plain text or nothing.
  }
  return fallback;
}

/** Throw a typed error whose `.message` is safe to show to the manager. */
export async function throwFriendlyError(res: Response, fallback: string): Promise<never> {
  throw new Error(await readErrorMessage(res, fallback));
}

// Convenience wrapper that unwraps the health response into a typed object.
// Story 00 exposes only /api/health; more endpoints arrive in Story 01+.
export async function fetchHealth() {
  const res = await api.api.health.$get();
  if (!res.ok) {
    throw new Error(`health check failed: ${res.status}`);
  }
  return res.json();
}

// ── Story 01 — players ─────────────────────────────────────────────────────
// Thin wrappers around the Hono RPC client. Return types flow through the
// typed AppType import so the UI never accidentally consumes a hidden field.

export async function fetchPlayers(
  params: {
    limit?: number;
    cursor?: number;
    search?: string;
    onMarket?: boolean;
    position?: string;
    clubId?: number;
  } = {},
) {
  const qs: Record<string, string> = {};
  if (params.limit !== undefined) qs.limit = String(params.limit);
  if (params.cursor !== undefined) qs.cursor = String(params.cursor);
  if (params.search) qs.search = params.search;
  if (params.onMarket !== undefined) qs.onMarket = String(params.onMarket);
  if (params.position) qs.position = params.position;
  if (params.clubId !== undefined) qs.clubId = String(params.clubId);
  const res = await api.api.players.$get({ query: qs });
  if (!res.ok) throw new Error(`players list failed: ${res.status}`);
  return res.json();
}

export async function fetchPlayer(id: string) {
  const res = await api.api.players[":id"].$get({ param: { id } });
  if (res.status === 404) {
    throw new Error("Player not found");
  }
  if (!res.ok) {
    throw new Error(`player fetch failed: ${res.status}`);
  }
  return res.json();
}

// ── Story 03 — scouts + knowledge graph ────────────────────────────────────

export async function fetchScouts() {
  const res = await api.api.scouts.$get();
  if (!res.ok) throw new Error(`scouts fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchScout(id: string) {
  const res = await api.api.scouts[":id"].$get({ param: { id } });
  if (res.status === 404) throw new Error("Scout not found");
  if (!res.ok) throw new Error(`scout fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchPlayerReports(id: string) {
  const res = await api.api.players[":id"].reports.$get({ param: { id } });
  if (!res.ok) throw new Error(`player reports failed: ${res.status}`);
  return res.json();
}

export async function startScoutAssignment(
  scoutId: string,
  body: {
    kind: "region" | "player";
    targetRegion?: "Iberia" | "BeneluxFrance" | "SouthAmerica" | "Global";
    targetPlayerId?: number;
  },
) {
  const res = await api.api.scouts[":id"].assignments.$post({
    param: { id: scoutId },
    json: body,
  });
  if (!res.ok) throw new Error(`start assignment failed: ${res.status}`);
  return res.json();
}

export async function tickWorldObservations() {
  const res = await api.api.world["observation-tick"].$post();
  if (!res.ok) throw new Error(`observation tick failed: ${res.status}`);
  return res.json();
}

// ── Story 04 — transfers + contracts ──────────────────────────────────────

export async function fetchTransfers() {
  const res = await api.api.transfers.$get();
  if (!res.ok) throw new Error(`transfers fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchMyBids() {
  const res = await api.api.transfers["my-bids"].$get();
  if (!res.ok) throw new Error(`my-bids fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchOffers() {
  const res = await api.api.transfers.offers.$get();
  if (!res.ok) throw new Error(`offers fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchWatchlist() {
  const res = await api.api.transfers.watchlist.$get();
  if (!res.ok) throw new Error(`watchlist fetch failed: ${res.status}`);
  return res.json();
}

export async function addToWatchlist(playerId: number) {
  const res = await api.api.transfers.watchlist[":playerId"].$post({
    param: { playerId: String(playerId) },
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Could not add this player to your watchlist."));
  }
  return res.json();
}

export async function removeFromWatchlist(playerId: number) {
  const res = await api.api.transfers.watchlist[":playerId"].$delete({
    param: { playerId: String(playerId) },
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Could not remove this player from your watchlist."));
  }
  return res.json();
}

export async function fetchCompletedDeals() {
  const res = await api.api.transfers.completed.$get();
  if (!res.ok) throw new Error(`completed deals failed: ${res.status}`);
  return res.json();
}

export async function fetchClubFinances() {
  const res = await api.api.club.finances.$get();
  if (!res.ok) throw new Error(`club finances failed: ${res.status}`);
  return res.json();
}

export async function fetchClubDetail(id: string) {
  const res = await api.api.clubs[":id"].$get({ param: { id } });
  if (res.status === 404) throw new Error("Club not found");
  if (!res.ok) throw new Error(`club detail failed: ${res.status}`);
  return res.json();
}

export async function fetchClubLedger() {
  const res = await api.api.club.ledger.$get();
  if (!res.ok) throw new Error(`ledger failed: ${res.status}`);
  return res.json();
}

export async function extendContract(body: {
  playerId: number;
  wageTier: CurrencyTier;
  signingBonusTier?: CurrencyTier;
  seasons?: number;
  rolePromise: PlayingTimeRole;
}) {
  const res = await api.api.club["extend-contract"].$post({ json: body });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "The extension offer could not be submitted."));
  }
  return res.json();
}

type CurrencyTier = "Minimal" | "Modest" | "Notable" | "Significant" | "Elite";
type PlayingTimeRole =
  | "Star Player"
  | "Important Player"
  | "Rotation"
  | "Backup"
  | "Youth/Development";

export async function submitBid(
  playerId: string,
  body: {
    feeTier: CurrencyTier;
    wageTier: CurrencyTier;
    signingBonusTier?: CurrencyTier;
    rolePromise: PlayingTimeRole;
    isLoan?: boolean;
  },
) {
  const res = await api.api.transfers[":playerId"].bid.$post({
    param: { playerId },
    json: body,
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Your bid could not be submitted."));
  }
  return res.json();
}

export async function forceAcceptBid(bidId: number) {
  const res = await api.api.transfers.bids[":bidId"]["force-accept"].$post({
    param: { bidId: String(bidId) },
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Force-accept failed."));
  }
  return res.json();
}

export async function fetchPlayerContract(id: string) {
  const res = await api.api.players[":id"].contract.$get({ param: { id } });
  if (!res.ok) throw new Error(`contract fetch failed: ${res.status}`);
  return res.json();
}

// ── Story 05 — tactics + squad ─────────────────────────────────────────────

type Formation = "4-4-2" | "4-3-3" | "4-2-3-1" | "3-5-2" | "3-4-3" | "5-3-2";
type PlayingStyle = "Possession" | "Counter-Attack" | "High Press" | "Direct" | "Balanced";
type TeamInstruction =
  | "PlayOutFromTheBack"
  | "HighLine"
  | "HighTempo"
  | "WorkBallIntoBox"
  | "PressHigh"
  | "StayCompact";
type PitchSlot =
  | "GK"
  | "DC1"
  | "DC2"
  | "DC3"
  | "LB"
  | "RB"
  | "LWB"
  | "RWB"
  | "DMC"
  | "MCL"
  | "MCC"
  | "MCR"
  | "AMC"
  | "LW"
  | "RW"
  | "ST1"
  | "ST2";
type SquadRole = "Starter" | "Rotation" | "Backup" | "Youth";

export async function fetchTactics() {
  const res = await api.api.tactics.$get();
  if (!res.ok) throw new Error(`tactics fetch failed: ${res.status}`);
  return res.json();
}

export async function updateTactics(body: {
  formation: Formation;
  playingStyle: PlayingStyle;
  instructions: TeamInstruction[];
}) {
  const res = await api.api.tactics.$put({ json: body });
  if (!res.ok) throw new Error(`tactics update failed: ${res.status}`);
  return res.json();
}

export async function setTacticsAssignment(body: {
  slot: PitchSlot;
  playerId: number | null;
}) {
  const res = await api.api.tactics.assignments.$post({ json: body });
  if (!res.ok) {
    throw new Error(`tactics assignment failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchSquad() {
  const res = await api.api.squad.$get();
  if (!res.ok) throw new Error(`squad fetch failed: ${res.status}`);
  return res.json();
}

export async function setSquadRole(playerId: number, role: SquadRole) {
  const res = await api.api.squad[":playerId"].role.$put({
    param: { playerId: String(playerId) },
    json: { role },
  });
  if (!res.ok) throw new Error(`squad role update failed: ${res.status}`);
  return res.json();
}

// ── Story 06 — fixtures, matches, form ─────────────────────────────────────

export async function fetchFixtures() {
  const res = await api.api.season.fixtures.$get();
  if (!res.ok) throw new Error(`fixtures fetch failed: ${res.status}`);
  return res.json();
}

export async function advanceMatchday() {
  const res = await api.api.season.advance.$post();
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Could not advance the match week."));
  }
  return res.json();
}

export async function fetchMatch(id: string) {
  const res = await api.api.matches[":id"].$get({ param: { id } });
  if (res.status === 404) throw new Error("Match not found");
  if (!res.ok) throw new Error(`match fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchPlayerHistory(id: string) {
  const res = await api.api.players[":id"].history.$get({ param: { id } });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Could not load the player's history."));
  }
  return res.json();
}

export async function fetchPlayerRecentMatches(id: string) {
  const res = await api.api.players[":id"]["recent-matches"].$get({ param: { id } });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Could not load recent matches."));
  }
  return res.json();
}

export async function fetchPlayerForm(id: string) {
  const res = await api.api.players[":id"].form.$get({ param: { id } });
  if (!res.ok) throw new Error(`player form fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchSeasonState() {
  const res = await api.api.season.state.$get();
  if (!res.ok) throw new Error(`season state failed: ${res.status}`);
  return res.json();
}

export async function fetchLeagueTable() {
  const res = await api.api.season.table.$get();
  if (!res.ok) throw new Error(`league table failed: ${res.status}`);
  return res.json();
}

export async function endSeason() {
  const res = await api.api.season.end.$post();
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "The season could not be ended — make sure every fixture is played."));
  }
  return res.json();
}

/** Ceremony data for a completed season — powers /season/summary. Pass
 *  a specific season number to inspect any prior run; omit to get the
 *  most-recently-completed one. */
export async function fetchSeasonSummary(season?: number) {
  const res = await api.api.season.summary.$get({
    query: season !== undefined ? { season: String(season) } : {},
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Could not load the season summary."));
  }
  return res.json();
}

/** Archive list of completed seasons. */
export async function fetchSeasonsArchive() {
  const res = await api.api.seasons.$get();
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Could not load the seasons archive."));
  }
  return res.json();
}

// ── Story 07 — save slots ──────────────────────────────────────────────────

export async function fetchSaves() {
  const res = await api.api.saves.$get();
  if (!res.ok) throw new Error(`saves fetch failed: ${res.status}`);
  return res.json();
}

export async function createSave(name: string) {
  const res = await api.api.saves.$post({ json: { name } });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Could not create a new save slot."));
  }
  return res.json();
}
