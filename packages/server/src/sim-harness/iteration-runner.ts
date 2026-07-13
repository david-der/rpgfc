// Run N independent single-season sims (fresh DB per iteration) and
// emit a cross-iteration summary so we can see how strategy tunings
// shift the headline numbers between runs.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runSeasonSim, type SeasonStats } from "./harness.js";

interface IterationRecord {
  label: string;
  notes: string;
  stats: SeasonStats;
  reportPath: string;
  strategySnapshot: Record<string, unknown>;
}

export interface IterationOptions {
  label: string;
  notes: string;
  reportDir: string;
  savesDir: string;
  seed?: number;
}

function readStrategySnapshot(): Record<string, unknown> {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = resolve(here, "strategies");
  const out: Record<string, unknown> = {};
  for (const f of readdirSync(dir)
    .filter((x) => x.endsWith(".json"))
    .sort()) {
    out[f] = JSON.parse(readFileSync(join(dir, f), "utf8"));
  }
  return out;
}

export async function runOneIteration(opts: IterationOptions): Promise<IterationRecord> {
  if (!existsSync(opts.savesDir)) mkdirSync(opts.savesDir, { recursive: true });
  const dbPath = resolve(opts.savesDir, `iter-${opts.label}.db`);
  if (existsSync(dbPath)) rmSync(dbPath);
  const result = await runSeasonSim({
    dbPath,
    reportDir: opts.reportDir,
    ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
    reportLabel: opts.label,
  });
  return {
    label: opts.label,
    notes: opts.notes,
    stats: result.stats,
    reportPath: result.reportPath,
    strategySnapshot: readStrategySnapshot(),
  };
}

export function renderCrossIterationSummary(records: IterationRecord[]): string {
  const lines: string[] = [];
  lines.push("# Cross-iteration summary");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()} — ${records.length} iterations.`);
  lines.push("");

  // Headline table.
  lines.push("## Headline metrics");
  lines.push("");
  lines.push(
    "| Iter | Notes | Signed | Clubs ≥1 | Attempts | Reject% | Ext ✓ | Ext ✗ | Champion (pts) | Spread | In red |",
  );
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of records) {
    const rejectPct =
      r.stats.totalAttempts > 0
        ? Math.round((r.stats.totalRejected / r.stats.totalAttempts) * 100)
        : 0;
    lines.push(
      `| ${r.label} | ${r.notes} | ${r.stats.totalSigned} | ${r.stats.clubsWithAtLeastOneSigning}/${r.stats.totalClubs} | ${r.stats.totalAttempts} | ${rejectPct}% | ${r.stats.extensionsAccepted} | ${r.stats.extensionsRejected} | ${r.stats.champion} (${r.stats.topPoints}) | ${r.stats.pointsSpread} | ${r.stats.clubsInNegativeCash} |`,
    );
  }
  lines.push("");

  // Trend pointers.
  if (records.length >= 2) {
    const first = records[0]!;
    const last = records[records.length - 1]!;
    lines.push("## What moved");
    lines.push("");
    const movement = (label: string, a: number, b: number) =>
      lines.push(`- ${label}: ${a} → ${b} (${b - a >= 0 ? "+" : ""}${b - a})`);
    movement("Signed", first.stats.totalSigned, last.stats.totalSigned);
    movement(
      "Clubs with ≥1 signing",
      first.stats.clubsWithAtLeastOneSigning,
      last.stats.clubsWithAtLeastOneSigning,
    );
    movement("Extensions accepted", first.stats.extensionsAccepted, last.stats.extensionsAccepted);
    movement("Points spread", first.stats.pointsSpread, last.stats.pointsSpread);
    movement("Clubs in red", first.stats.clubsInNegativeCash, last.stats.clubsInNegativeCash);
    lines.push("");
  }

  lines.push("## Iteration notes");
  lines.push("");
  for (const r of records) {
    lines.push(`### ${r.label}`);
    lines.push("");
    lines.push(r.notes);
    lines.push("");
    lines.push(`Report: \`${r.reportPath}\``);
    lines.push("");
  }
  return lines.join("\n");
}

export function writeSummary(reportDir: string, records: IterationRecord[]): string {
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const path = join(reportDir, `cross-iteration-${stamp}.md`);
  writeFileSync(path, renderCrossIterationSummary(records), "utf8");
  return path;
}
