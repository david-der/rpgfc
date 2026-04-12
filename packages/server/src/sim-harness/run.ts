// Entry point for `pnpm season-sim`.
// Runs a full season simulation against a fresh in-memory DB and
// writes a markdown report to tests/season-sim/reports/.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runSeasonSim } from "./harness.js";

async function main() {
  // Walk up from packages/server/src/sim-harness/ to the repo root,
  // which is where we want /tests/season-sim/reports/ to land.
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(__dirname, "../../../..");
  const reportDir = resolve(repoRoot, "tests/season-sim/reports");
  const dbPath = ":memory:";

  console.log("▶️  Running season simulation (10 clubs, 18 match weeks)…");
  const t0 = Date.now();
  const result = await runSeasonSim({ dbPath, reportDir });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`✅ Done in ${elapsed}s`);
  console.log(`📄 Report written to: ${result.reportPath}`);
}

main().catch((err) => {
  console.error("❌ Season sim failed:", err);
  process.exit(1);
});
