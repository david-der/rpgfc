// Dialect-aware Drizzle client factory (TDD v2 §5.3).
//
// Services and routes receive a `DbClient` via dependency injection. They
// never import better-sqlite3 or pg directly; the factory is the single place
// where driver choice lives.
//
// Supported URL prefixes:
//   sqlite:./saves/dev.db
//   sqlite::memory:
//   postgres://user:pass@host:5432/db
//   postgresql://user:pass@host:5432/db

import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import pg from "pg";

import { pgSchema, sqliteSchema } from "./schema.js";

export type Dialect = "sqlite" | "postgres";

export type SqliteDb = BetterSQLite3Database<typeof sqliteSchema>;
export type PostgresDb = NodePgDatabase<typeof pgSchema>;

export type DbClient =
  | {
      dialect: "sqlite";
      db: SqliteDb;
      sqlite: Database.Database;
      close: () => void;
    }
  | {
      dialect: "postgres";
      db: PostgresDb;
      pool: pg.Pool;
      close: () => Promise<void>;
    };

function resolveSqlitePath(url: string): string {
  // `sqlite::memory:` is the canonical in-memory DSN (two colons).
  if (url === "sqlite::memory:") return ":memory:";
  return url.replace(/^sqlite:/, "");
}

export function createDbClient(databaseUrl: string): DbClient {
  if (databaseUrl.startsWith("sqlite:")) {
    const filePath = resolveSqlitePath(databaseUrl);
    // Auto-create the parent directory for file-backed SQLite. :memory: stays
    // as-is. This makes `pnpm dev` work on a clean checkout without a
    // separate mkdir step, which is AC-01 in practice.
    if (filePath !== ":memory:") {
      mkdirSync(dirname(filePath), { recursive: true });
    }
    const sqlite = new Database(filePath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("synchronous = NORMAL");
    const db = drizzleSqlite(sqlite, { schema: sqliteSchema });
    return {
      dialect: "sqlite",
      db,
      sqlite,
      close: () => sqlite.close(),
    };
  }

  if (databaseUrl.startsWith("postgres:") || databaseUrl.startsWith("postgresql:")) {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const db = drizzlePg(pool, { schema: pgSchema });
    return {
      dialect: "postgres",
      db,
      pool,
      close: async () => {
        await pool.end();
      },
    };
  }

  throw new Error(`Unsupported DATABASE_URL dialect: ${databaseUrl}`);
}
