// AC-13: env parsing rejects missing or invalid DATABASE_URL.
import { describe, expect, it } from "vitest";

import { EnvError, parseEnv } from "../env.js";

describe("parseEnv — Story 00 AC-13", () => {
  it("rejects missing DATABASE_URL with an EnvError naming the field", () => {
    expect(() => parseEnv({})).toThrowError(EnvError);
    try {
      parseEnv({});
    } catch (e) {
      expect((e as Error).message).toMatch(/DATABASE_URL/);
    }
  });

  it("rejects an invalid DATABASE_URL scheme", () => {
    expect(() => parseEnv({ DATABASE_URL: "redis://whatever" })).toThrowError(EnvError);
    try {
      parseEnv({ DATABASE_URL: "redis://whatever" });
    } catch (e) {
      expect((e as Error).message).toMatch(/DATABASE_URL/);
    }
  });

  it("accepts a sqlite:// URL and yields defaults", () => {
    const env = parseEnv({ DATABASE_URL: "sqlite:./saves/dev.db" });
    expect(env.DATABASE_URL).toBe("sqlite:./saves/dev.db");
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(8787);
    expect(env.SIM_ENGINE).toBe("stub");
  });

  it("accepts a postgres:// URL", () => {
    const env = parseEnv({ DATABASE_URL: "postgres://u:p@localhost:5432/db" });
    expect(env.DATABASE_URL.startsWith("postgres:")).toBe(true);
  });
});
