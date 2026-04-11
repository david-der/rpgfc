import type { Config } from "drizzle-kit";

// SQLite dialect config. Drizzle Kit requires a dedicated config per dialect
// (Story 00 §9.2 known risk). Output lands in src/db/migrations/sqlite.
export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations/sqlite",
  dialect: "sqlite",
  // Story 00 checks in hand-written initial migrations under src/db/migrations.
  // From Story 01 onward, `pnpm db:generate` regenerates diffs.
} satisfies Config;
