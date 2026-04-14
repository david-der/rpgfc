// Players routes.
//
// TDD v2 §2.2: the Interface layer imports only from the Rendering layer.
// The `no-hidden-in-routes` ESLint rule refuses imports under
// `packages/server/src/routes/` from any path matching `application/` or
// `*/hidden*`. That's enforced mechanically — routes go through the
// rendering layer's orchestration helpers
// (`renderPlayerById`, `renderPlayersPage`, `runPlayersSeed`), which are
// the only functions allowed to reach into application + domain.

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import type { DbClient } from "../db/client.js";
import {
  getContractForPlayer,
  getPlayerReports,
  renderFormSeriesFor,
  renderPlayerById,
  renderPlayersPage,
  runPlayersSeed,
} from "../rendering/index.js";
import type { RenderContext } from "../rendering/index.js";

export interface PlayersRouteDeps {
  db: DbClient;
  /** Whether dev-only endpoints are mounted. Reads env.AUTH_MODE === "dev". */
  devEndpointsEnabled: boolean;
  /** Clock for age math. Injected so tests can pin it. */
  now: () => Date;
}

const listQuery = z.object({
  clubId: z.coerce.number().int().positive().optional(),
  cursor: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  onMarket: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  position: z.string().optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

interface HistorySeasonRow {
  season: number;
  clubId: number;
  clubName: string;
  appearances: number;
  goals: number;
  assists: number;
  minutes: number;
  yellowCards: number;
  redCards: number;
}

async function loadPlayerHistory(
  client: DbClient,
  playerId: number,
): Promise<HistorySeasonRow[]> {
  // Aggregates every played match this player appeared in, grouped by
  // (season, club_id) so a transferred player's seasons split across
  // clubs read correctly. No hidden-attr reads — just match facts.
  if (client.dialect === "sqlite") {
    return client.sqlite
      .prepare<
        [number],
        {
          season: number;
          club_id: number;
          club_name: string;
          appearances: number;
          goals: number;
          assists: number;
          minutes: number;
          yellow_cards: number;
          red_cards: number;
        }
      >(
        `SELECT m.season,
                pmp.club_id,
                c.name AS club_name,
                COUNT(*) AS appearances,
                SUM(pmp.goals) AS goals,
                SUM(pmp.assists) AS assists,
                SUM(pmp.minutes_played) AS minutes,
                SUM(pmp.yellow_cards) AS yellow_cards,
                SUM(pmp.red_cards) AS red_cards
         FROM player_match_performance pmp
         JOIN matches m ON m.id = pmp.match_id
         JOIN clubs c ON c.id = pmp.club_id
         WHERE pmp.player_id = ? AND m.state = 'Played'
         GROUP BY m.season, pmp.club_id, c.name
         ORDER BY m.season DESC, pmp.club_id`,
      )
      .all(playerId)
      .map((r) => ({
        season: r.season,
        clubId: r.club_id,
        clubName: r.club_name,
        appearances: r.appearances,
        goals: r.goals,
        assists: r.assists,
        minutes: r.minutes,
        yellowCards: r.yellow_cards,
        redCards: r.red_cards,
      }));
  }
  const res = await client.pool.query<{
    season: number;
    club_id: number;
    club_name: string;
    appearances: string;
    goals: string;
    assists: string;
    minutes: string;
    yellow_cards: string;
    red_cards: string;
  }>(
    `SELECT m.season,
            pmp.club_id,
            c.name AS club_name,
            COUNT(*)::text AS appearances,
            SUM(pmp.goals)::text AS goals,
            SUM(pmp.assists)::text AS assists,
            SUM(pmp.minutes_played)::text AS minutes,
            SUM(pmp.yellow_cards)::text AS yellow_cards,
            SUM(pmp.red_cards)::text AS red_cards
     FROM player_match_performance pmp
     JOIN matches m ON m.id = pmp.match_id
     JOIN clubs c ON c.id = pmp.club_id
     WHERE pmp.player_id = $1 AND m.state = 'Played'
     GROUP BY m.season, pmp.club_id, c.name
     ORDER BY m.season DESC, pmp.club_id`,
    [playerId],
  );
  return res.rows.map((r) => ({
    season: r.season,
    clubId: r.club_id,
    clubName: r.club_name,
    appearances: Number(r.appearances),
    goals: Number(r.goals),
    assists: Number(r.assists),
    minutes: Number(r.minutes),
    yellowCards: Number(r.yellow_cards),
    redCards: Number(r.red_cards),
  }));
}

const generateBody = z.object({
  seed: z.number().int().default(42),
  clubCount: z.number().int().min(1).max(30).default(10),
  playersPerClub: z.number().int().min(1).max(50).default(20),
});

export function createPlayersRoute(deps: PlayersRouteDeps) {
  const app = new Hono()
    .get("/", zValidator("query", listQuery), async (c) => {
      const q = c.req.valid("query");
      const ctx: RenderContext = { now: deps.now() };
      const page = await renderPlayersPage(deps.db, q, ctx);
      return c.json(page);
    })
    .get("/:id", zValidator("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      const ctx: RenderContext = { now: deps.now() };
      const rendered = await renderPlayerById(deps.db, id, ctx);
      if (!rendered) {
        return c.json({ error: { code: "not_found", message: "Player not found" } }, 404);
      }
      return c.json(rendered);
    })
    // Story 03 — scout reports for a specific player. Lives under
    // /api/players/:id/reports per the story doc; the rendering layer's
    // `getPlayerReports` does the join.
    .get("/:id/reports", zValidator("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      const items = await getPlayerReports(deps.db, id);
      return c.json({ items });
    })
    // Story 04 — rendered contract for a specific player. Returns null
    // if the player has no contract yet (newly generated, not signed).
    .get("/:id/contract", zValidator("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      const contract = await getContractForPlayer(deps.db, id);
      if (!contract) {
        return c.json({ contract: null });
      }
      return c.json({ contract });
    })
    // Story 06 — form series for the profile sparkline.
    .get("/:id/form", zValidator("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      const series = await renderFormSeriesFor(deps.db, id);
      return c.json(series);
    })
    // Per-season aggregate stats — drives the Profile → History tab.
    // Pure query against player_match_performance grouped by season.
    .get("/:id/history", zValidator("param", idParam), async (c) => {
      const { id } = c.req.valid("param");
      const seasons = await loadPlayerHistory(deps.db, id);
      return c.json({ seasons });
    });

  if (deps.devEndpointsEnabled) {
    app.post("/generate", zValidator("json", generateBody), async (c) => {
      const body = c.req.valid("json");
      const result = await runPlayersSeed(deps.db, {
        seed: body.seed,
        clubCount: body.clubCount,
        playersPerClub: body.playersPerClub,
        referenceDate: deps.now(),
      });
      return c.json(result);
    });
  }

  return app;
}
