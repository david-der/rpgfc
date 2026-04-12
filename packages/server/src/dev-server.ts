// Node entry point. Builds the Hono app, runs migrations, binds to PORT.
// Used by both `pnpm dev` (via tsx watch) and the Docker entrypoint script.

import { serve } from "@hono/node-server";
import pino from "pino";

import { createDbClient } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { parseEnv } from "./env.js";
import { createApp } from "./index.js";
import { seedContentIfMissing } from "./application/content-seed.js";
import { seedClubIdentityIfMissing } from "./application/clubs/seed-identity.js";
import { seedWorldIfEmpty } from "./application/players/index.js";
import { seedScoutsIfMissing } from "./application/scouting/seed-scouts.js";
import {
  seedListingsIfEmpty,
  seedPreferencesIfEmpty,
} from "./application/transfers/seed-listings.js";
import { seedTacticsIfEmpty } from "./application/tactics/seed.js";
import { seedSquadIfEmpty } from "./application/squad/seed.js";
import { ensureSaveState, seedFixturesIfEmpty } from "./application/season/seed.js";

const env = parseEnv();

const logger = pino(
  env.NODE_ENV === "development"
    ? {
        level: env.LOG_LEVEL,
        // pino-pretty is optional; fall back to JSON if not installed.
        // Story 00 does not install pino-pretty so this branch is a no-op in
        // the walking skeleton; kept here for when Story 01+ adds it.
      }
    : { level: env.LOG_LEVEL },
);

async function main() {
  const dbClient = createDbClient(env.DATABASE_URL);
  logger.info({ dialect: dbClient.dialect }, "Running migrations");
  const result = await runMigrations(dbClient);
  logger.info(
    { applied: result.applied.length, skipped: result.skipped.length },
    "Migrations applied",
  );

  // Story 01: content first (archetypes, badges, thesaurus — versioned with
  // the code), then a one-shot world generation if the players table is empty.
  // Both calls are idempotent.
  const contentSeed = await seedContentIfMissing(dbClient);
  if (contentSeed.archetypesInserted + contentSeed.badgesInserted > 0) {
    logger.info(contentSeed, "Seeded content tables");
  }
  const seedResult = await seedWorldIfEmpty(dbClient, {
    seed: 42,
    clubCount: 20,
    playersPerClub: 20,
    referenceDate: new Date("2026-06-01T00:00:00Z"),
  });
  if (!seedResult.skipped) {
    logger.info(
      { clubs: seedResult.clubsCreated, players: seedResult.playersCreated },
      "Seeded initial world",
    );
  }

  // Story 03: every seeded club gets a color + reputation + wage-budget
  // row; every run gets 4 named scouts. Both idempotent — re-running
  // dev after the first boot is a no-op.
  const identityResult = await seedClubIdentityIfMissing(dbClient);
  if (identityResult.clubsUpdated > 0) {
    logger.info(identityResult, "Seeded club identity");
  }
  const scoutSeed = await seedScoutsIfMissing(dbClient, 1);
  if (!scoutSeed.skipped) {
    logger.info({ scouts: scoutSeed.scoutsInserted }, "Seeded scouts");
  }

  // Story 04: every club lists 1-3 players; every player gets a
  // preferences row. Both idempotent.
  const listingSeed = await seedListingsIfEmpty(dbClient);
  if (!listingSeed.skipped) {
    logger.info({ listings: listingSeed.listingsCreated }, "Seeded listings");
  }
  const prefSeed = await seedPreferencesIfEmpty(dbClient);
  if (!prefSeed.skipped) {
    logger.info({ preferences: prefSeed.preferencesCreated }, "Seeded player preferences");
  }

  // Story 05: one Default tactics row per club, one squad_entries row
  // per contracted player. Both idempotent.
  const tacticsSeed = await seedTacticsIfEmpty(dbClient);
  if (!tacticsSeed.skipped) {
    logger.info({ tactics: tacticsSeed.rowsCreated }, "Seeded tactics");
  }
  const squadSeed = await seedSquadIfEmpty(dbClient);
  if (!squadSeed.skipped) {
    logger.info({ squad: squadSeed.entriesCreated }, "Seeded squad entries");
  }

  // Story 06/07: full-season fixtures (38 match weeks for 20 clubs).
  const fixturesSeed = await seedFixturesIfEmpty(dbClient);
  if (!fixturesSeed.skipped) {
    logger.info(
      { matches: fixturesSeed.matchesCreated, matchdays: fixturesSeed.matchdays },
      "Seeded fixtures",
    );
  }

  // Story 07: ensure the save_state singleton row exists.
  await ensureSaveState(dbClient);

  // WEB_DIST points at a built Vite bundle. In local dev Vite runs on :5173
  // and proxies /api to this server, so WEB_DIST is unset and createApp
  // returns the API-only app. In the Docker image and the doctrine suite,
  // WEB_DIST is set and Hono serves the SPA from the same process.
  const staticDir = process.env["WEB_DIST"];

  // Story 07: resolve the saves directory and current DB file path for
  // the save-slot management endpoints.
  const dbUrl = env.DATABASE_URL;
  const savesDir = dbUrl.startsWith("sqlite:") && !dbUrl.includes(":memory:")
    ? (() => {
        const { dirname, resolve } = require("node:path") as typeof import("node:path");
        return dirname(resolve(dbUrl.replace(/^sqlite:/, "")));
      })()
    : undefined;
  const currentDbPath = dbUrl.startsWith("sqlite:") && !dbUrl.includes(":memory:")
    ? (() => {
        const { resolve } = require("node:path") as typeof import("node:path");
        return resolve(dbUrl.replace(/^sqlite:/, ""));
      })()
    : undefined;

  const app = createApp({
    dialect: dbClient.dialect,
    commit: env.GIT_SHA ?? "dev",
    db: dbClient,
    devEndpointsEnabled: env.AUTH_MODE === "dev",
    now: () => new Date(),
    ...(staticDir ? { staticDir } : {}),
    ...(savesDir ? { savesDir } : {}),
    ...(currentDbPath ? { currentDbPath } : {}),
  });

  const port = env.PORT;
  serve({ fetch: app.fetch, port }, (info) => {
    logger.info({ port: info.port }, `Starting Hono server on :${info.port}`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    if (dbClient.dialect === "sqlite") dbClient.close();
    else await dbClient.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
