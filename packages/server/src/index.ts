// Hono application factory. Kept separate from the Node process entry point
// (dev-server.ts) so tests can construct an app bound to an arbitrary
// DbClient via Hono's test client without touching the network.
//
// Two entry points live here:
//   createApiApp(deps)  — returns the API-only app; its type is exported as
//                         AppType for Hono RPC inference. This is what tests
//                         exercise and what the web client sees.
//   createApp(deps)     — wraps the API app with static-file serving of the
//                         built Vite bundle when deps.staticDir is set. Used
//                         by dev-server.ts at container boot. Its richer
//                         return type is NOT exported because conditional
//                         type unions break RPC inference.

import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { DbClient, Dialect } from "./db/client.js";
import type { HealthSnapshot } from "./routes/health.js";

export interface ApiDeps {
  dialect: Dialect;
  commit: string;
  db: DbClient;
}

export interface AppDeps extends ApiDeps {
  // Optional absolute path to a built Vite bundle. When set, non-/api routes
  // serve files from this directory (index.html as the SPA fallback). Leave
  // unset in dev — Vite handles the SPA on :5173 with its own proxy.
  staticDir?: string;
}

// API-only factory. Inlines the /api/health handler rather than `.route()`-
// mounting a sub-app so that Hono's RPC type inference surfaces the concrete
// response shape on the web client. A `.route()` call with a generic `Hono`
// return type loses the json shape and the web client falls back to `any`.
export function createApiApp(deps: ApiDeps) {
  return new Hono().get("/api/health", (c) => {
    const body: HealthSnapshot = {
      ok: true,
      dialect: deps.dialect,
      commit: deps.commit,
    };
    return c.json(body);
  });
}

// AppType is derived from the API-only factory. The web package's RPC client
// sees exactly this shape — no static-file middleware leaks into the type.
export type AppType = ReturnType<typeof createApiApp>;

export function createApp(deps: AppDeps) {
  const api = createApiApp(deps);
  if (!deps.staticDir || !existsSync(deps.staticDir)) {
    return new Hono().use("*", honoLogger()).route("/", api);
  }

  const dir = deps.staticDir;
  const indexHtml = (() => {
    try {
      return readFileSync(join(dir, "index.html"), "utf8");
    } catch {
      return null;
    }
  })();

  const app = new Hono().use("*", honoLogger());
  app.route("/", api);
  app.use("/*", serveStatic({ root: dir }));
  app.get("*", (c) => {
    if (indexHtml === null) {
      return c.text("Web bundle not found", 500);
    }
    return c.html(indexHtml);
  });
  return app;
}
