import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The doctrine suite runs against the production build, not the dev server,
// because dev mode can inject elements (HMR banners, devtools) that aren't
// in the real output. We use a single Hono process that:
//   - binds an in-memory SQLite DB
//   - serves /api/*
//   - serves the built Vite bundle from packages/web/dist
// This is the same shape the Docker container uses at runtime (TDD v2 §2.1).
//
// Pre-step: `pnpm doctrine` builds both packages before Playwright starts.

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDist = resolve(__dirname, "..", "..", "packages", "web", "dist");

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env["DOCTRINE_BASE_URL"] ?? "http://localhost:8787",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // tsx runs the TS entry directly so we don't need a prebuilt server bundle.
    command: "pnpm --filter @rpgfc/server exec tsx src/dev-server.ts",
    env: {
      DATABASE_URL: "sqlite::memory:",
      PORT: "8787",
      NODE_ENV: "production",
      WEB_DIST: webDist,
      LOG_LEVEL: "warn",
    },
    url: "http://localhost:8787/api/health",
    timeout: 60_000,
    reuseExistingServer: !process.env["CI"],
  },
});
