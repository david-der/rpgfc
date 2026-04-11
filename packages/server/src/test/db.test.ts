// AC-06, AC-07: createDbClient against both dialects.
//
// SQLite runs unconditionally — it is the default local driver. Postgres runs
// only when TEST_POSTGRES_URL is set (CI test-postgres job sets it).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";

describe("createDbClient — SQLite variant (AC-06)", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "rpgfc-sqlite-"));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("opens a file DB, runs migrations, and the _meta table is queryable", async () => {
    const dbPath = join(tmpDir, "test.db");
    const client = createDbClient(`sqlite:${dbPath}`);
    try {
      expect(client.dialect).toBe("sqlite");
      const result = await runMigrations(client);
      expect(result.applied).toContain("0000_initial.sql");

      // Pragmas from TDD v2 §5.3 must be set.
      if (client.dialect === "sqlite") {
        const journal = client.sqlite.pragma("journal_mode", { simple: true });
        expect(String(journal).toLowerCase()).toBe("wal");
        const fk = client.sqlite.pragma("foreign_keys", { simple: true });
        expect(Number(fk)).toBe(1);
      }

      // The trivial select returns an empty row set.
      if (client.dialect === "sqlite") {
        const rows = client.sqlite.prepare(`SELECT id, key, value, created_at FROM "_meta"`).all();
        expect(rows).toEqual([]);
      }
    } finally {
      if (client.dialect === "sqlite") client.close();
    }
  });

  it("runMigrations is idempotent on a second call", async () => {
    const dbPath = join(tmpDir, "idempotent.db");
    const client = createDbClient(`sqlite:${dbPath}`);
    try {
      const first = await runMigrations(client);
      expect(first.applied.length).toBeGreaterThan(0);
      const second = await runMigrations(client);
      expect(second.applied).toEqual([]);
      expect(second.skipped.length).toBeGreaterThan(0);
    } finally {
      if (client.dialect === "sqlite") client.close();
    }
  });

  it("supports :memory: for in-process tests", async () => {
    const client = createDbClient("sqlite::memory:");
    try {
      expect(client.dialect).toBe("sqlite");
      await runMigrations(client);
      if (client.dialect === "sqlite") {
        const rows = client.sqlite.prepare(`SELECT * FROM "_meta"`).all();
        expect(rows).toEqual([]);
      }
    } finally {
      if (client.dialect === "sqlite") client.close();
    }
  });
});

// AC-07 runs only if a reachable Postgres is configured.
const PG_URL = process.env["TEST_POSTGRES_URL"] ?? process.env["DATABASE_URL"];
const pgConfigured = PG_URL?.startsWith("postgres:") || PG_URL?.startsWith("postgresql:");

describe.runIf(pgConfigured)("createDbClient — Postgres variant (AC-07)", () => {
  it("opens a pool, runs migrations, and _meta is queryable", async () => {
    const client = createDbClient(PG_URL as string);
    try {
      expect(client.dialect).toBe("postgres");
      // Clean slate: drop tables if they exist from a previous run.
      if (client.dialect === "postgres") {
        await client.pool.query(`DROP TABLE IF EXISTS "_meta"`);
        await client.pool.query(`DROP TABLE IF EXISTS "_migrations"`);
      }
      const result = await runMigrations(client);
      expect(result.applied).toContain("0000_initial.sql");
      if (client.dialect === "postgres") {
        const { rows } = await client.pool.query(`SELECT * FROM "_meta"`);
        expect(rows).toEqual([]);
      }
    } finally {
      if (client.dialect === "postgres") await client.close();
    }
  });
});
