// AC-08: migration files contain no banned types.
//
// JSONB, ARRAY, and native ENUM (CREATE TYPE) would lock us to Postgres. This
// check scans both migration directories and asserts they contain none of
// those patterns. If you need one of them, add a normalized join table
// instead (see TDD v2 §5.2).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationsRoot = join(__dirname, "..", "db", "migrations");

const BANNED = /jsonb|\bARRAY\b|CREATE\s+TYPE/i;

// Strip SQL line comments (-- ...) before scanning, otherwise a comment that
// legitimately says "no JSONB" would fail the portability check. Story 00's
// initial migrations intentionally document the rule in their headers.
function stripLineComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

describe("migrations portability scan — Story 00 AC-08", () => {
  for (const dialect of ["sqlite", "postgres"] as const) {
    it(`contains no JSONB / ARRAY / CREATE TYPE in ${dialect} migrations`, () => {
      const dir = join(migrationsRoot, dialect);
      const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const sql = stripLineComments(readFileSync(join(dir, file), "utf8"));
        expect(sql).not.toMatch(BANNED);
      }
    });
  }

  it("both dialects define the _meta table", () => {
    for (const dialect of ["sqlite", "postgres"] as const) {
      const dir = join(migrationsRoot, dialect);
      const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
      const combined = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
      expect(combined).toMatch(/CREATE TABLE[^(]*_meta/i);
    }
  });
});
