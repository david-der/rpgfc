// Dual-dialect schema (TDD v2 §5.1).
//
// The _meta table is the minimal schema Story 00 ships. It exists solely to
// prove the migration pipeline runs end-to-end on both dialects.
//
// Portability discipline (TDD v2 §5.2):
//   - No JSONB. JSON → TEXT.
//   - No ARRAY. Join tables instead.
//   - No native ENUM. Text + Zod enum on writes.
//   - Timestamps → ISO-8601 strings, parsed to Date at the app boundary.
//   - Auto-increment → SQLite integer PK autoIncrement / Postgres serial.
//
// Every schema change MUST produce migrations for both dialects in the same
// PR. CI's test-postgres job blocks drift.

import { sqliteTable, integer as sqInt, text as sqText } from "drizzle-orm/sqlite-core";
import { pgTable, serial as pgSerial, text as pgText } from "drizzle-orm/pg-core";

// ── SQLite ──────────────────────────────────────────────────────────────────
export const metaSqlite = sqliteTable("_meta", {
  id: sqInt("id").primaryKey({ autoIncrement: true }),
  key: sqText("key").notNull().unique(),
  value: sqText("value").notNull(),
  createdAt: sqText("created_at").notNull(),
});

// ── Postgres ────────────────────────────────────────────────────────────────
export const metaPg = pgTable("_meta", {
  id: pgSerial("id").primaryKey(),
  key: pgText("key").notNull().unique(),
  value: pgText("value").notNull(),
  createdAt: pgText("created_at").notNull(),
});

// Grouped schema objects for each dialect — imported by the Drizzle client
// factory at query time.
export const sqliteSchema = {
  meta: metaSqlite,
};

export const pgSchema = {
  meta: metaPg,
};
