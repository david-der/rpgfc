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

export async function fetchPlayers(params: { limit?: number; cursor?: number } = {}) {
  const qs: Record<string, string> = {};
  if (params.limit !== undefined) qs.limit = String(params.limit);
  if (params.cursor !== undefined) qs.cursor = String(params.cursor);
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
  if (!res.ok) throw new Error(`bid submit failed: ${res.status}`);
  return res.json();
}

export async function forceAcceptBid(bidId: number) {
  const res = await api.api.transfers.bids[":bidId"]["force-accept"].$post({
    param: { bidId: String(bidId) },
  });
  if (!res.ok) throw new Error(`force-accept failed: ${res.status}`);
  return res.json();
}

export async function fetchPlayerContract(id: string) {
  const res = await api.api.players[":id"].contract.$get({ param: { id } });
  if (!res.ok) throw new Error(`contract fetch failed: ${res.status}`);
  return res.json();
}
