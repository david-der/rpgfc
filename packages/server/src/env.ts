import { z } from "zod";

// Env parsing is load-bearing: the server refuses to start if DATABASE_URL is
// missing or unrecognized. Story 00 AC-13 asserts this.
//
// We recognize two URL prefixes: `sqlite:` and `postgres:` / `postgresql:`.
// Everything else fails Zod validation with a clear error naming the variable.

const databaseUrlSchema = z
  .string({ required_error: "DATABASE_URL is required" })
  .min(1, "DATABASE_URL is required")
  .refine(
    (v) => v.startsWith("sqlite:") || v.startsWith("postgres:") || v.startsWith("postgresql:"),
    {
      message: "DATABASE_URL must start with sqlite: or postgres:// (or postgresql://)",
    },
  );

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: databaseUrlSchema,
  PORT: z.coerce.number().int().positive().default(8787),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  SIM_ENGINE: z.enum(["stub", "python"]).default("stub"),
  AUTH_MODE: z.enum(["dev", "cognito"]).default("dev"),
  GIT_SHA: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

// Parse a record (defaults to process.env) and throw EnvError on failure.
// Kept pure so tests can inject synthetic env maps (see env.test.ts).
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new EnvError(`Invalid environment configuration — ${issues}`);
  }
  return result.data;
}
