-- Story 00 walking skeleton — Postgres initial migration.
-- Portability rules (TDD v2 §5.2): no JSONB, no ARRAY, no ENUM, ISO-8601 strings.
CREATE TABLE IF NOT EXISTS "_meta" (
  "id" SERIAL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "value" TEXT NOT NULL,
  "created_at" TEXT NOT NULL
);
