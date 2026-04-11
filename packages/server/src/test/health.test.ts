// AC-11: /api/health returns { ok, dialect, commit }. Uses Hono's fetch
// handler directly — no network involved.
import { describe, expect, it } from "vitest";

import type { DbClient } from "../db/client.js";
import { createApiApp } from "../index.js";

function fakeDb(): DbClient {
  return {
    dialect: "sqlite",
    // @ts-expect-error — Story 00 tests don't exercise the db field
    db: {},
    // @ts-expect-error — same
    sqlite: {},
    close: () => {},
  };
}

describe("GET /api/health — Story 00 AC-11", () => {
  it("returns ok=true, the server dialect, and a commit string", async () => {
    const app = createApiApp({ dialect: "sqlite", commit: "abc1234", db: fakeDb() });
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = (await res.json()) as {
      ok: boolean;
      dialect: string;
      commit: string;
    };
    expect(body.ok).toBe(true);
    expect(body.dialect).toBe("sqlite");
    expect(body.commit).toBe("abc1234");
  });

  it("advertises postgres dialect when configured that way", async () => {
    const app = createApiApp({
      dialect: "postgres",
      commit: "deadbeef",
      db: { ...fakeDb(), dialect: "postgres" } as DbClient,
    });
    const res = await app.request("/api/health");
    const body = (await res.json()) as { dialect: string };
    expect(body.dialect).toBe("postgres");
  });

  it("reports the commit as a 7–40 char hex or literal 'dev'", async () => {
    for (const commit of ["dev", "abc1234", "0123456789abcdef0123456789abcdef01234567"]) {
      const app = createApiApp({ dialect: "sqlite", commit, db: fakeDb() });
      const res = await app.request("/api/health");
      const body = (await res.json()) as { commit: string };
      expect(body.commit).toMatch(/^(dev|[a-f0-9]{7,40})$/);
      expect(body.commit).toBe(commit);
    }
  });
});
