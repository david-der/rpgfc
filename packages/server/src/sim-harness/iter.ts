// Single-iteration runner. `pnpm season-iter -- <label> "<notes>"`
// Usage: tsx src/sim-harness/iter.ts <label> "<notes>"
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runOneIteration } from "./iteration-runner.js";

async function main() {
  const label = process.argv[2] ?? "1";
  const notes = process.argv[3] ?? "(no notes)";
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "../../../..");
  const r = await runOneIteration({
    label,
    notes,
    reportDir: resolve(repoRoot, "tests/season-sim/reports"),
    savesDir: resolve(repoRoot, "saves"),
  });
  console.log(JSON.stringify({ label, ...r.stats, reportPath: r.reportPath }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
