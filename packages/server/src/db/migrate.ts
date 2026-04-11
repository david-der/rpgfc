// Migration runner. Idempotent — safe to call on every container boot.
//
// Strategy: each dialect has its own `migrations/{sqlite|postgres}` directory
// containing numerically-ordered `NNNN_*.sql` files. A `_migrations` ledger
// table records which files have already been applied. On every run, any file
// not in the ledger is executed and recorded.
//
// This hand-rolled runner is chosen over drizzle-orm's migrate helpers so the
// same code path works on both dialects, our files are plain `.sql`, and we
// avoid dragging drizzle-kit into the runtime container.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { DbClient } from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// During `tsx` or `node dist/...`, __dirname resolves differently relative to
// the migrations/ folder. We try a couple of candidates and pick the first one
// that exists on disk.
function resolveMigrationsDir(dialect: "sqlite" | "postgres"): string {
  const candidates = [
    join(__dirname, "migrations", dialect),
    join(__dirname, "..", "..", "src", "db", "migrations", dialect),
    join(process.cwd(), "packages", "server", "src", "db", "migrations", dialect),
    join(process.cwd(), "migrations", dialect),
  ];
  for (const c of candidates) {
    try {
      readdirSync(c);
      return c;
    } catch {
      /* try next */
    }
  }
  throw new Error(`Could not locate migrations directory for dialect=${dialect}`);
}

function listMigrationFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function ensureLedgerSqlite(client: Extract<DbClient, { dialect: "sqlite" }>): void {
  client.sqlite.exec(
    `CREATE TABLE IF NOT EXISTS "_migrations" (
      "name" TEXT PRIMARY KEY NOT NULL,
      "applied_at" TEXT NOT NULL
    )`,
  );
}

async function ensureLedgerPg(client: Extract<DbClient, { dialect: "postgres" }>): Promise<void> {
  await client.pool.query(
    `CREATE TABLE IF NOT EXISTS "_migrations" (
      "name" TEXT PRIMARY KEY NOT NULL,
      "applied_at" TEXT NOT NULL
    )`,
  );
}

export interface MigrateResult {
  applied: string[];
  skipped: string[];
}

export async function runMigrations(client: DbClient): Promise<MigrateResult> {
  const dir = resolveMigrationsDir(client.dialect);
  const files = listMigrationFiles(dir);
  const applied: string[] = [];
  const skipped: string[] = [];

  if (client.dialect === "sqlite") {
    ensureLedgerSqlite(client);
    const already = new Set(
      client.sqlite
        .prepare<[], { name: string }>(`SELECT name FROM "_migrations"`)
        .all()
        .map((r) => r.name),
    );
    const insert = client.sqlite.prepare(
      `INSERT INTO "_migrations" (name, applied_at) VALUES (?, ?)`,
    );
    for (const file of files) {
      if (already.has(file)) {
        skipped.push(file);
        continue;
      }
      const sql = readFileSync(join(dir, file), "utf8");
      client.sqlite.exec("BEGIN");
      try {
        client.sqlite.exec(sql);
        insert.run(file, new Date().toISOString());
        client.sqlite.exec("COMMIT");
        applied.push(file);
      } catch (err) {
        client.sqlite.exec("ROLLBACK");
        throw err;
      }
    }
    return { applied, skipped };
  }

  await ensureLedgerPg(client);
  const { rows } = await client.pool.query<{ name: string }>(`SELECT name FROM "_migrations"`);
  const already = new Set(rows.map((r) => r.name));
  for (const file of files) {
    if (already.has(file)) {
      skipped.push(file);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    const pgClient = await client.pool.connect();
    try {
      await pgClient.query("BEGIN");
      await pgClient.query(sql);
      await pgClient.query(`INSERT INTO "_migrations" (name, applied_at) VALUES ($1, $2)`, [
        file,
        new Date().toISOString(),
      ]);
      await pgClient.query("COMMIT");
      applied.push(file);
    } catch (err) {
      await pgClient.query("ROLLBACK");
      throw err;
    } finally {
      pgClient.release();
    }
  }
  return { applied, skipped };
}

// Allow `node dist/db/migrate.js` (used by docker/entrypoint.sh in Story F).
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("migrate.js") ||
  process.argv[1]?.endsWith("migrate.ts");

if (isMainModule) {
  const { parseEnv } = await import("../env.js");
  const { createDbClient } = await import("./client.js");
  const env = parseEnv();
  const client = createDbClient(env.DATABASE_URL);
  try {
    const result = await runMigrations(client);
    // Log shape matches the entrypoint.sh grep in tests/docker/*-boot.sh.
    console.log(`Running migrations for dialect ${client.dialect}`);
    if (result.applied.length > 0) {
      console.log(`Applied: ${result.applied.join(", ")}`);
    } else {
      console.log("No new migrations to apply");
    }
    console.log("Migrations applied");
  } finally {
    if (client.dialect === "sqlite") client.close();
    else await client.close();
  }
}
