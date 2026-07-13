// Season routes — Story 06 + 07.
//
// Endpoints:
//   GET  /api/season/fixtures    — RenderedFixturesPage for the user's club
//   GET  /api/season/state       — SeasonState (current season + match week + window status)
//   GET  /api/season/table       — LeagueTableRow[] sorted by points DESC
//   POST /api/season/advance     — simulate the next match week
//   POST /api/season/end         — roll into the next season (if fully played)

import { Hono } from "hono";

import {
  advanceMatchdayRendered,
  computeBestXI,
  computeLeagueTable,
  endSeason,
  loadSeasonState,
  renderFixturesForUser,
} from "../rendering/index.js";
import type { BestXI } from "../rendering/index.js";
import type { DbClient } from "../db/client.js";

export interface SeasonRouteDeps {
  db: DbClient;
  now: () => Date;
  userClubId: number;
}

export function createSeasonRoute(deps: SeasonRouteDeps) {
  const app = new Hono()
    .get("/fixtures", async (c) => {
      const page = await renderFixturesForUser(deps.db, deps.userClubId);
      return c.json(page);
    })
    .get("/state", async (c) => {
      const state = await loadSeasonState(deps.db);
      return c.json(state);
    })
    .get("/table", async (c) => {
      const state = await loadSeasonState(deps.db);
      const table = await computeLeagueTable(deps.db, state.season);
      return c.json({ table });
    })
    .post("/advance", async (c) => {
      const result = await advanceMatchdayRendered(deps.db, { now: deps.now() });
      return c.json(result);
    })
    .post("/end", async (c) => {
      const summary = await endSeason(deps.db, deps.userClubId);
      if (!summary) {
        return c.json(
          {
            error: {
              code: "season_not_complete",
              message: "The season still has unplayed fixtures.",
            },
          },
          400,
        );
      }
      return c.json(summary);
    })
    // Ceremony data for a past season — the /season/summary page reads
    // this to render the champion hero, your finish, top scorer etc.
    // Passes "?season=N" to inspect any prior season; otherwise returns
    // the most-recently completed one.
    .get("/summary", async (c) => {
      const state = await loadSeasonState(deps.db);
      const seasonParam = c.req.query("season");
      const requested = seasonParam !== undefined ? Number(seasonParam) : state.season - 1;
      if (!Number.isFinite(requested) || requested < 0) {
        return c.json(
          { error: { code: "no_prior_season", message: "No prior season to summarize yet." } },
          404,
        );
      }
      // Current season isn't done — don't synthesise a champion from an
      // empty table. The archive list already excludes it.
      if (requested >= state.season) {
        return c.json(
          {
            error: {
              code: "season_incomplete",
              message: "That season hasn't finished yet.",
            },
          },
          404,
        );
      }
      const summary = await renderSeasonSummary(deps.db, requested, deps.userClubId);
      if (!summary) {
        return c.json(
          { error: { code: "season_not_found", message: "That season has no data." } },
          404,
        );
      }
      return c.json(summary);
    });
  return app;
}

// ── summary rendering ────────────────────────────────────────────────────

interface TopScorerRow {
  player_id: number;
  player_name: string;
  club_id: number;
  club_name: string;
  goals: number;
  assists: number;
}

async function renderSeasonSummary(
  db: DbClient,
  season: number,
  userClubId: number,
): Promise<null | {
  season: number;
  champion: { clubId: number; clubName: string; points: number };
  woodenSpoon: { clubId: number; clubName: string; points: number };
  userFinish: { position: number; points: number; clubName: string } | null;
  topScorer: TopScorerRow | null;
  topAssister: TopScorerRow | null;
  table: Awaited<ReturnType<typeof computeLeagueTable>>;
  bestXI: BestXI;
  narrative: string;
}> {
  const table = await computeLeagueTable(db, season);
  if (table.length === 0) return null;
  const champion = table[0]!;
  const woodenSpoon = table[table.length - 1]!;
  const userRow = table.find((r) => r.clubId === userClubId) ?? null;
  const userIndex = table.findIndex((r) => r.clubId === userClubId);
  const topScorer = await loadTopScorer(db, season);
  const topAssister = await loadTopAssister(db, season);
  const bestXI = await computeBestXI(db, season);

  const narrative = buildNarrative({
    season,
    championName: champion.clubName,
    userPosition: userIndex >= 0 ? userIndex + 1 : null,
    topScorerName: topScorer?.player_name ?? null,
    topScorerGoals: topScorer?.goals ?? 0,
  });

  return {
    season,
    champion: { clubId: champion.clubId, clubName: champion.clubName, points: champion.points },
    woodenSpoon: {
      clubId: woodenSpoon.clubId,
      clubName: woodenSpoon.clubName,
      points: woodenSpoon.points,
    },
    userFinish: userRow
      ? { position: userIndex + 1, points: userRow.points, clubName: userRow.clubName }
      : null,
    topScorer,
    topAssister,
    table,
    bestXI,
    narrative,
  };
}

async function loadTopAssister(db: DbClient, season: number): Promise<TopScorerRow | null> {
  if (db.dialect === "sqlite") {
    const row = db.sqlite
      .prepare<[number], TopScorerRow>(
        `SELECT pmp.player_id, p.name AS player_name, pmp.club_id, c.name AS club_name,
                SUM(pmp.goals) AS goals,
                SUM(pmp.assists) AS assists
         FROM player_match_performance pmp
         JOIN matches m ON m.id = pmp.match_id
         JOIN players p ON p.id = pmp.player_id
         JOIN clubs c ON c.id = pmp.club_id
         WHERE m.season = ? AND m.state = 'Played'
         GROUP BY pmp.player_id
         HAVING SUM(pmp.assists) > 0
         ORDER BY assists DESC, goals DESC
         LIMIT 1`,
      )
      .get(season);
    return row ?? null;
  }
  const res = await db.pool.query<TopScorerRow>(
    `SELECT pmp.player_id, p.name AS player_name, pmp.club_id, c.name AS club_name,
            SUM(pmp.goals)::int AS goals,
            SUM(pmp.assists)::int AS assists
     FROM player_match_performance pmp
     JOIN matches m ON m.id = pmp.match_id
     JOIN players p ON p.id = pmp.player_id
     JOIN clubs c ON c.id = pmp.club_id
     WHERE m.season = $1 AND m.state = 'Played'
     GROUP BY pmp.player_id, p.name, pmp.club_id, c.name
     HAVING SUM(pmp.assists) > 0
     ORDER BY assists DESC, goals DESC
     LIMIT 1`,
    [season],
  );
  return res.rows[0] ?? null;
}

async function loadTopScorer(db: DbClient, season: number): Promise<TopScorerRow | null> {
  if (db.dialect === "sqlite") {
    const row = db.sqlite
      .prepare<[number], TopScorerRow>(
        `SELECT pmp.player_id, p.name AS player_name, pmp.club_id, c.name AS club_name,
                SUM(pmp.goals) AS goals,
                SUM(pmp.assists) AS assists
         FROM player_match_performance pmp
         JOIN matches m ON m.id = pmp.match_id
         JOIN players p ON p.id = pmp.player_id
         JOIN clubs c ON c.id = pmp.club_id
         WHERE m.season = ? AND m.state = 'Played'
         GROUP BY pmp.player_id
         HAVING SUM(pmp.goals) > 0
         ORDER BY goals DESC, assists DESC
         LIMIT 1`,
      )
      .get(season);
    return row ?? null;
  }
  const res = await db.pool.query<TopScorerRow>(
    `SELECT pmp.player_id, p.name AS player_name, pmp.club_id, c.name AS club_name,
            SUM(pmp.goals)::int AS goals,
            SUM(pmp.assists)::int AS assists
     FROM player_match_performance pmp
     JOIN matches m ON m.id = pmp.match_id
     JOIN players p ON p.id = pmp.player_id
     JOIN clubs c ON c.id = pmp.club_id
     WHERE m.season = $1 AND m.state = 'Played'
     GROUP BY pmp.player_id, p.name, pmp.club_id, c.name
     HAVING SUM(pmp.goals) > 0
     ORDER BY goals DESC, assists DESC
     LIMIT 1`,
    [season],
  );
  return res.rows[0] ?? null;
}

function buildNarrative(input: {
  season: number;
  championName: string;
  userPosition: number | null;
  topScorerName: string | null;
  topScorerGoals: number;
}): string {
  const parts: string[] = [];
  if (input.userPosition === 1) {
    parts.push(`You are champions of Season ${input.season + 1}.`);
  } else if (input.userPosition !== null) {
    parts.push(
      `${input.championName} lifted the Season ${input.season + 1} trophy. You finished in position ${input.userPosition}.`,
    );
  } else {
    parts.push(`${input.championName} lifted the Season ${input.season + 1} trophy.`);
  }
  if (input.topScorerName && input.topScorerGoals > 0) {
    parts.push(`${input.topScorerName} led the scoring charts with ${input.topScorerGoals} goals.`);
  }
  return parts.join(" ");
}
