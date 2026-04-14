// Entry point for `pnpm season-sim`.
// Runs one full season simulation, writes saves/post-season.db so the
// dev server can boot against it (`pnpm dev:post-season`).

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runSeasonSim } from "./harness.js";

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(__dirname, "../../../..");
  const reportDir = resolve(repoRoot, "tests/season-sim/reports");
  const savesDir = resolve(repoRoot, "saves");
  if (!existsSync(savesDir)) mkdirSync(savesDir, { recursive: true });
  const dbPath = resolve(savesDir, "post-season.db");
  if (existsSync(dbPath)) rmSync(dbPath);

  console.log("▶️  Running season simulation (10 clubs, 18 match weeks)…");
  const t0 = Date.now();
  const result = await runSeasonSim({ dbPath, reportDir });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`✅ Done in ${elapsed}s`);
  console.log(`📄 Report:   ${result.reportPath}`);
  console.log(`💾 Save DB:  ${dbPath}`);
  console.log(
    `🔍 Browse it: pnpm dev:post-season  (defaults to club 1; override with MANAGED_CLUB_ID=N)`,
  );
  console.log(
    `📊 Headlines: ${result.stats.totalSigned} signed across ${result.stats.clubsWithAtLeastOneSigning}/${result.stats.totalClubs} clubs · ${result.stats.extensionsAccepted} extensions · champion ${result.stats.champion} (${result.stats.topPoints} pts)`,
  );
}

main().catch((err) => {
  console.error("❌ Season sim failed:", err);
  process.exit(1);
});
