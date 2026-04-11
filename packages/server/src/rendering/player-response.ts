// Rendering-layer orchestration for the player API endpoints.
//
// The `no-hidden-in-routes` ESLint rule blocks route files from importing
// `../application/**` at all. Routes therefore need a rendering-layer shim
// that fetches HiddenPlayer rows, threads them through renderPlayer, and
// returns the RenderedPlayer shape the route can hand straight to Hono.
//
// Story 03 changes:
//   - Club lookup goes through `loadFullClubMap` so the rendered output
//     carries colors + reputation + nationality, not just (id, name).
//   - Knowledge-graph snapshots are loaded per request and threaded
//     onto each player's render context. Routes do not see the graph;
//     they call us, we call the graph reader, computeCertainty walks
//     it inside the rendering layer.

import type { RenderedPlayer } from "@rpgfc/shared";

import {
  getPlayerById,
  listPlayers,
  seedWorldIfEmpty,
  type ListQuery,
  type SeedConfig,
  type SeedResult,
} from "../application/players/index.js";
import type { DbClient } from "../db/client.js";

import { loadFullClubMap } from "./club.js";
import type { RenderContext } from "./context.js";
import { knowPlayer, knowPlayers } from "./knowledge.js";
import { renderPlayer } from "./player.js";
import { loadPromiseMoodForPlayer } from "./squad-response.js";

// Story 05: attach the promise-mood fields to a base rendered player.
// The mood chip on /players/$id needs squadRole, rolePromise, and the
// qualitative mood/label. Written as a helper so both the byId and the
// page paths can share the merge — the mood fields are optional on
// WirePlayer, so callers that don't need them can skip the lookup.
async function withPromiseMood(
  db: DbClient,
  player: RenderedPlayer,
): Promise<RenderedPlayer> {
  const mood = await loadPromiseMoodForPlayer(db, player.id);
  return {
    ...player,
    ...(mood.squadRole ? { squadRole: mood.squadRole } : {}),
    ...(mood.rolePromise ? { rolePromise: mood.rolePromise } : {}),
    ...(mood.promiseMood ? { promiseMood: mood.promiseMood } : {}),
    ...(mood.promiseMoodLabel ? { promiseMoodLabel: mood.promiseMoodLabel } : {}),
  };
}

export async function renderPlayerById(
  db: DbClient,
  id: number,
  baseCtx: Omit<RenderContext, "knowledge">,
): Promise<RenderedPlayer | null> {
  const hidden = await getPlayerById(db, id);
  if (!hidden) return null;

  const clubs = await loadFullClubMap(db);
  const knowledge = await knowPlayer(db, id);

  const rendered = renderPlayer(
    hidden,
    { ...baseCtx, knowledge },
    { findClub: (cid) => clubs.get(cid) ?? null },
  );
  return withPromiseMood(db, rendered);
}

export interface RenderedPlayerPage {
  items: RenderedPlayer[];
  nextCursor: number | null;
}

export async function renderPlayersPage(
  db: DbClient,
  query: ListQuery,
  baseCtx: Omit<RenderContext, "knowledge">,
): Promise<RenderedPlayerPage> {
  const result = await listPlayers(db, query);
  const clubs = await loadFullClubMap(db);

  // Bulk-load knowledge for every player on the page in one query so the
  // list endpoint stays under the 100ms p95 read budget from TDD v2 §19.
  const playerIds = result.items.map((p) => p.id);
  const knowledgeMap = await knowPlayers(db, playerIds);

  const items = result.items.map((hidden) => {
    const knowledge = knowledgeMap.get(hidden.id);
    const ctx: RenderContext = knowledge ? { ...baseCtx, knowledge } : { ...baseCtx };
    return renderPlayer(hidden, ctx, {
      findClub: (cid) => clubs.get(cid) ?? null,
    });
  });
  return { items, nextCursor: result.nextCursor };
}

// Re-exported application-side helper that the dev-only generation endpoint
// needs. Routes import through this rendering module to keep the ESLint
// boundary intact — the data this returns is not hidden state.
export async function runPlayersSeed(db: DbClient, config: SeedConfig): Promise<SeedResult> {
  return seedWorldIfEmpty(db, config);
}
