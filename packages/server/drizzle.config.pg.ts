import type { Config } from "drizzle-kit";

// Postgres dialect config — mirrors drizzle.config.sqlite.ts.
export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations/postgres",
  dialect: "postgresql",
} satisfies Config;
