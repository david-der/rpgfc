// Rendering-layer orchestration for the player API endpoints.
//
// The `no-hidden-in-routes` ESLint rule blocks route files from importing
// `../application/**` at all. Routes therefore need a rendering-layer shim
// that fetches HiddenPlayer rows, threads them through renderPlayer, and
// returns the RenderedPlayer shape the route can hand straight to Hono.
//
// This file is the ONLY seam where the rendering layer talks to the
// application layer. Keeping the orchestration here rather than in routes
// preserves the layering invariant from TDD v2 §2.2: routes see only the
// public rendering surface.

import type { RenderedPlayer } from "@rpgfc/shared";

import {
  getPlayerById,
  listPlayers,
  loadClubMap,
  seedWorldIfEmpty,
  type ListQuery,
  type SeedConfig,
  type SeedResult,
} from "../application/players/index.js";
import type { DbClient } from "../db/client.js";

import type { RenderContext } from "./context.js";
import { renderPlayer } from "./player.js";

export async function renderPlayerById(
  db: DbClient,
  id: number,
  ctx: RenderContext,
): Promise<RenderedPlayer | null> {
  const hidden = await getPlayerById(db, id);
  if (!hidden) return null;
  const clubs = await loadClubMap(db);
  return renderPlayer(hidden, ctx, {
    findClub: (cid) => clubs.get(cid) ?? null,
  });
}

export interface RenderedPlayerPage {
  items: RenderedPlayer[];
  nextCursor: number | null;
}

export async function renderPlayersPage(
  db: DbClient,
  query: ListQuery,
  ctx: RenderContext,
): Promise<RenderedPlayerPage> {
  const result = await listPlayers(db, query);
  const clubs = await loadClubMap(db);
  const items = result.items.map((hidden) =>
    renderPlayer(hidden, ctx, {
      findClub: (cid) => clubs.get(cid) ?? null,
    }),
  );
  return { items, nextCursor: result.nextCursor };
}

// Re-exported application-side helper that the dev-only generation endpoint
// needs. Routes import through this rendering module to keep the ESLint
// boundary intact — the data this returns is not hidden state.
export async function runPlayersSeed(db: DbClient, config: SeedConfig): Promise<SeedResult> {
  return seedWorldIfEmpty(db, config);
}
