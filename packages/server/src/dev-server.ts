// Node entry point. Builds the Hono app, runs migrations, binds to PORT.
// Used by both `pnpm dev` (via tsx watch) and the Docker entrypoint script.

import { serve } from "@hono/node-server";
import pino from "pino";

import { createDbClient } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { parseEnv } from "./env.js";
import { createApp } from "./index.js";
import { seedContentIfMissing } from "./application/content-seed.js";
import { seedWorldIfEmpty } from "./application/players/index.js";

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
    clubCount: 10,
    playersPerClub: 20,
    referenceDate: new Date("2026-06-01T00:00:00Z"),
  });
  if (!seedResult.skipped) {
    logger.info(
      { clubs: seedResult.clubsCreated, players: seedResult.playersCreated },
      "Seeded initial world",
    );
  }

  // WEB_DIST points at a built Vite bundle. In local dev Vite runs on :5173
  // and proxies /api to this server, so WEB_DIST is unset and createApp
  // returns the API-only app. In the Docker image and the doctrine suite,
  // WEB_DIST is set and Hono serves the SPA from the same process.
  const staticDir = process.env["WEB_DIST"];

  const app = createApp({
    dialect: dbClient.dialect,
    commit: env.GIT_SHA ?? "dev",
    db: dbClient,
    devEndpointsEnabled: env.AUTH_MODE === "dev",
    now: () => new Date(),
    ...(staticDir ? { staticDir } : {}),
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
