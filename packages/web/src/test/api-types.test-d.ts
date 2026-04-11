// AC-12 (type-only): Hono RPC inference compiles end-to-end.
//
// This is a type-level test. `tsc --noEmit` runs it as part of `pnpm
// typecheck`. The goal is to prove that the web-side typed client knows the
// response shape of /api/health without any runtime dependency on the server.

import { expectTypeOf } from "vitest";
import type { AppType } from "@rpgfc/server";
import { hc } from "hono/client";

const client = hc<AppType>("/");

// The route is /api/health. Hono RPC exposes it as client.api.health.$get.
// Story 00 asserts: awaiting $get().json() yields { ok, dialect, commit }.
async function roundtrip() {
  const res = await client.api.health.$get();
  const body = await res.json();
  expectTypeOf(body.ok).toBeBoolean();
  expectTypeOf(body.dialect).toEqualTypeOf<"sqlite" | "postgres">();
  expectTypeOf(body.commit).toBeString();
}

// Reference the function so TS doesn't prune the whole module as unused.
export const _ac12 = roundtrip;
