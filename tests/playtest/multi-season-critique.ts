// Playtest — drive N full seasons through the real UI turn system and
// capture evidence for a product critique.
//
// Boots against whatever world the dev server at PLAYTEST_BASE is
// serving (use a fresh DATABASE_URL for a clean world). Each season:
// advance all 18 weeks via the League page button, screenshot the
// table/squad/match-report surfaces at checkpoints, snapshot the API
// league table every week (tables.ndjson), extract one full match
// report's text, then End Season and screenshot the rollover.
//
// Output: tests/playtest/results/<run-label>/  (gitignored)
//
//   PLAYTEST_SEASONS=3 pnpm exec tsx tests/playtest/multi-season-critique.ts

import { chromium, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const API = process.env["PLAYTEST_API"] ?? "http://localhost:8787";
const SEASONS = Number(process.env["PLAYTEST_SEASONS"] ?? 3);
const RUN = process.env["PLAYTEST_RUN"] ?? "run";
const OUT = resolve(import.meta.dirname ?? process.cwd(), `results/${RUN}`);
mkdirSync(OUT, { recursive: true });

const errors: string[] = [];

async function snap(page: Page, label: string) {
  await page.screenshot({ path: resolve(OUT, `${label}.png`), fullPage: true });
  console.log(`📸 ${label}`);
}

async function apiJson(path: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

async function seasonState(): Promise<{ season: number; matchWeek: number }> {
  return (await apiJson("/api/season/state")) as { season: number; matchWeek: number };
}

async function recordTable(season: number, week: number) {
  const table = await apiJson("/api/season/table");
  appendFileSync(resolve(OUT, "tables.ndjson"), JSON.stringify({ season, week, table }) + "\n");
}

/** Drive the turn loop through the masthead Continue button (Style
 *  Guide v1.1 §15) — available on every page. Confirms progress by
 *  polling season state instead of fixed sleeps, so query refetch
 *  storms can't race the check. */
async function advanceOnce(page: Page): Promise<"advanced" | "season-end" | "nothing"> {
  const before = await seasonState().catch(() => null);
  if (!before) return "nothing";
  const button = page.getByRole("button", { name: /advance · week|end season/i }).first();
  try {
    await button.waitFor({ state: "visible", timeout: 10_000 });
  } catch {
    return "nothing";
  }
  const label = (await button.textContent().catch(() => "")) ?? "";
  await button.click();
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const now = await seasonState().catch(() => null);
    if (now && (now.matchWeek !== before.matchWeek || now.season !== before.season)) {
      return /end season/i.test(label) ? "season-end" : "advanced";
    }
    await page.waitForTimeout(300);
  }
  return "nothing";
}

/** Open the most recent match report from the League results tab and
 *  capture both a screenshot and its prose (for the engagement read). */
async function captureMatchReport(page: Page, label: string) {
  try {
    await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
    const resultsTab = page.getByText(/^\s*Results\s*$/i).first();
    if (await resultsTab.isVisible().catch(() => false)) {
      await resultsTab.click();
      await page.waitForTimeout(400);
    }
    const reportLink = page.locator('a[href*="/matches/"], [data-testid*="result"] a').first();
    if (!(await reportLink.isVisible().catch(() => false))) {
      console.log(`  (no report link found for ${label})`);
      return;
    }
    await reportLink.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    await snap(page, label);
    const text = await page
      .locator("main")
      .innerText()
      .catch(() => "");
    writeFileSync(resolve(OUT, `${label}.txt`), text);
  } catch (e) {
    console.log(`  (match report capture failed for ${label}: ${(e as Error).message})`);
  }
}

async function playSeason(page: Page, seasonIndex: number) {
  const s = `s${seasonIndex}`;
  console.log(`\n▶ Season ${seasonIndex} — start`);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await snap(page, `${s}-w00-home`);
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await snap(page, `${s}-w00-league`);

  let week = 0;
  for (let i = 0; i < 24; i++) {
    const result = await advanceOnce(page);
    if (result === "advanced") {
      week++;
      const state = await seasonState().catch(() => null);
      const playedWeek = state ? state.matchWeek - 1 : week;
      await recordTable(seasonIndex, playedWeek).catch((e) =>
        console.log(`  (table snapshot failed: ${(e as Error).message})`),
      );
      console.log(`  ✓ week ${playedWeek} played`);
      if (playedWeek === 1 || playedWeek === 6 || playedWeek === 12 || playedWeek === 18) {
        await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
        await snap(page, `${s}-w${String(playedWeek).padStart(2, "0")}-table`);
      }
      if (playedWeek === 6 || playedWeek === 12) {
        await page.goto(`${BASE}/squad`, { waitUntil: "networkidle" });
        await snap(page, `${s}-w${String(playedWeek).padStart(2, "0")}-squad`);
      }
      if (playedWeek === 9) {
        await captureMatchReport(page, `${s}-w09-match-report`);
      }
    } else if (result === "season-end") {
      console.log(`  🏁 season ${seasonIndex} ended via masthead after ${week} advances`);
      break;
    } else {
      errors.push(`season ${seasonIndex}: no advance/end button after week ${week}`);
      console.log("  ✗ no advance or end button — stopping");
      break;
    }
  }

  await captureMatchReport(page, `${s}-w18-match-report`);
  await page.goto(`${BASE}/squad`, { waitUntil: "networkidle" });
  await snap(page, `${s}-w18-squad`);

  // The masthead Continue already rolled the season inside the loop —
  // capture the ceremony and the archive it left behind.
  await page.goto(`${BASE}/season/summary`, { waitUntil: "networkidle" });
  await snap(page, `${s}-end-ceremony`);
  await page.goto(`${BASE}/seasons`, { waitUntil: "networkidle" });
  await snap(page, `${s}-end-archive`);
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => {
    errors.push(`pageerror: ${e.message}`);
    console.log(`  [pageerror] ${e.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  const start = await seasonState();
  console.log(`Starting at season ${start.season}, match week ${start.matchWeek}`);

  for (let i = 0; i < SEASONS; i++) {
    const state = await seasonState();
    await playSeason(page, state.season);
  }

  writeFileSync(resolve(OUT, "errors.log"), errors.join("\n"));
  await b.close();
  console.log(`\nDone. Evidence → ${OUT} (${errors.length} page errors logged)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
