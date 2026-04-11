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
