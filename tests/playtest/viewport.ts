// Viewport-only screenshots — no fullPage flag — to see what a user
// actually sees without scrolling. Fixes the "page looks tiny" illusion
// in fullPage captures.

import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";
mkdirSync(OUT, { recursive: true });

async function snap(page: Page, label: string) {
  await page.screenshot({ path: resolve(OUT, `${label}.png`), fullPage: false });
  console.log(`📸 ${label}`);
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const stops: Array<[string, string]> = [
    ["vp-home", "/"],
    ["vp-league", "/league"],
    ["vp-squad", "/squad"],
    ["vp-club", "/club"],
    ["vp-scouts", "/scouts"],
    ["vp-transfers", "/transfers"],
    ["vp-tactics", "/tactics"],
    ["vp-saves", "/saves"],
  ];
  for (const [label, path] of stops) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await snap(page, label);
  }

  // Fixtures tab specifically — click it so we see an actual match.
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await page
    .getByText(/^\s*Fixtures\s*$/i)
    .first()
    .click();
  await page.waitForTimeout(400);
  await snap(page, "vp-league-fixtures");

  // Player profile via /players.
  await page.goto(`${BASE}/players`, { waitUntil: "networkidle" });
  const firstPlayer = await page.locator('a[href^="/players/"]').first().getAttribute("href");
  if (firstPlayer) {
    await page.goto(`${BASE}${firstPlayer}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await snap(page, "vp-player");
    // Click Contract tab — my club, so extension form should appear.
    const contractTab = page.getByText(/^\s*Contract\s*$/i).first();
    if (await contractTab.isVisible().catch(() => false)) {
      await contractTab.click();
      await page.waitForTimeout(400);
      await snap(page, "vp-player-contract");
    }
    const reportsTab = page.getByText(/^\s*Reports\s*$/i).first();
    if (await reportsTab.isVisible().catch(() => false)) {
      await reportsTab.click();
      await page.waitForTimeout(400);
      await snap(page, "vp-player-reports");
    }
  }

  // Match report viewport.
  await page.goto(`${BASE}/matches/1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await snap(page, "vp-match");

  await b.close();
  console.log(`\nViewport shots → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
