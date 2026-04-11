import { Hono } from "hono";

import type { Dialect } from "../db/client.js";

// GET /api/health → { ok, dialect, commit }.
// Story 00 AC-11: this is the Fargate liveness probe target in a later story.
//
// `commit` is baked in at build time from the GIT_SHA env var (7+ hex chars).
// In local dev or when GIT_SHA is unset, "dev" is returned — AC-11 regex
// accepts any value matching /^(dev|[a-f0-9]{7,40})$/ at the test level.

export interface HealthSnapshot {
  ok: true;
  dialect: Dialect;
  commit: string;
}

export interface HealthDeps {
  dialect: Dialect;
  commit: string;
}

export function createHealthRoute(deps: HealthDeps): Hono {
  return new Hono().get("/", (c) => {
    const body: HealthSnapshot = {
      ok: true,
      dialect: deps.dialect,
      commit: deps.commit,
    };
    return c.json(body);
  });
}
