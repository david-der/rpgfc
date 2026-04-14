// Session 4: finish S1, catch the end-season narrative, enter S2, probe
// un-visited UX (Watchlist add, Offers tab, club drill-down, match link).

import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";
mkdirSync(OUT, { recursive: true });

async function snap(page: Page, label: string, full = false) {
  await page.screenshot({ path: resolve(OUT, `${label}.png`), fullPage: full });
  console.log(`📸 ${label}`);
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));

  // Fast-forward S1: advance until End Season button shows.
  console.log("▶ Finishing S1");
  let week = 0;
  while (week < 20) {
    await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
    const fx = page.getByText(/^\s*Fixtures\s*$/i).first();
    if (await fx.isVisible().catch(() => false)) {
      await fx.click();
      await page.waitForTimeout(200);
    }
    const adv = page.getByRole("button", { name: /advance to next match week/i });
    if (await adv.isVisible().catch(() => false)) {
      await adv.click();
      await page.waitForTimeout(800);
      week++;
      continue;
    }
    const end = page.getByRole("button", { name: /end season/i });
    if (await end.isVisible().catch(() => false)) break;
    console.log("  ✗ neither advance nor end visible");
    break;
  }
  console.log(`  finished S1 after ${week} advances`);

  // S1 final table before we roll over.
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await snap(page, "50-s1-final-table");

  // End season — snap BEFORE clicking and AFTER clicking to catch the
  // narrative card.
  console.log("▶ End season (catch narrative)");
  await page.getByText(/^\s*Fixtures\s*$/i).first().click();
  await page.waitForTimeout(300);
  await snap(page, "51-s1-end-season-before-click");
  const endBtn = page.getByRole("button", { name: /end season/i });
  if (await endBtn.isVisible().catch(() => false)) {
    await endBtn.click();
    await page.waitForTimeout(800);
    await snap(page, "52-s1-end-season-after-click");
    // Stay on the same page and re-snap after 2s — the narrative box
    // may take a beat to render.
    await page.waitForTimeout(1500);
    await snap(page, "53-s1-end-season-settled");
  }

  // Season 2 home — does anything change?
  console.log("▶ S2 opening");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await snap(page, "54-s2-home");

  // S2 league table after rollover.
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await snap(page, "55-s2-league");

  // Probe Offers tab (bids coming IN to my club).
  console.log("▶ Offers tab");
  await page.goto(`${BASE}/transfers`, { waitUntil: "networkidle" });
  const offersTab = page.getByText(/^\s*Offers\s*$/i).first();
  if (await offersTab.isVisible().catch(() => false)) {
    await offersTab.click();
    await page.waitForTimeout(400);
    await snap(page, "56-offers-tab");
  }

  // Probe Watchlist tab and try to add a player via the Scouts page.
  console.log("▶ Watchlist flow");
  await page.goto(`${BASE}/transfers`, { waitUntil: "networkidle" });
  const watchTab = page.getByText(/^\s*Watchlist\s*$/i).first();
  if (await watchTab.isVisible().catch(() => false)) {
    await watchTab.click();
    await page.waitForTimeout(300);
    await snap(page, "57-watchlist-empty");
  }
  // Now try to Watch a player from /scouts — look for a Watch button.
  await page.goto(`${BASE}/scouts`, { waitUntil: "networkidle" });
  const watchBtns = page.getByRole("button", { name: /watch/i });
  const watchCount = await watchBtns.count().catch(() => 0);
  console.log(`  watch buttons found: ${watchCount}`);
  if (watchCount > 0) {
    await watchBtns.first().click();
    await page.waitForTimeout(500);
    await snap(page, "58-scouts-after-watch");
    // Back to Watchlist tab
    await page.goto(`${BASE}/transfers`, { waitUntil: "networkidle" });
    await page.getByText(/^\s*Watchlist\s*$/i).first().click();
    await page.waitForTimeout(400);
    await snap(page, "59-watchlist-after-add");
  }

  // Drill into an opposition club (Real Oviedo is club 7).
  console.log("▶ Opposition club detail");
  await page.goto(`${BASE}/league/clubs/7`, { waitUntil: "networkidle" });
  await snap(page, "60-club-real-oviedo");
  // Click a player on their roster — does it navigate?
  const rosterPlayerLinks = page.locator('a[href^="/players/"]');
  const linkCount = await rosterPlayerLinks.count().catch(() => 0);
  console.log(`  roster player-links: ${linkCount}`);
  if (linkCount > 0) {
    const firstHref = await rosterPlayerLinks.first().getAttribute("href");
    console.log(`  clicking into: ${firstHref}`);
    await rosterPlayerLinks.first().click();
    await page.waitForLoadState("networkidle");
    await snap(page, "61-rival-player-profile");
  }

  // Finally: check if fixtures now link into matches.
  console.log("▶ Fixture → match link check");
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await page.getByText(/^\s*Fixtures\s*$/i).first().click();
  await page.waitForTimeout(300);
  const matchLinks = page.locator('a[href*="/matches/"]');
  const mlCount = await matchLinks.count().catch(() => 0);
  console.log(`  match links on fixtures: ${mlCount}`);

  // Play 3 more MW in S2 to see standings shift.
  console.log("▶ Play 3 MW in S2");
  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
    await page.getByText(/^\s*Fixtures\s*$/i).first().click();
    await page.waitForTimeout(300);
    const a = page.getByRole("button", { name: /advance to next match week/i });
    if (!(await a.isVisible().catch(() => false))) break;
    await a.click();
    await page.waitForTimeout(900);
  }
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await snap(page, "62-s2-mw3-table");

  await b.close();
  console.log(`\nDone → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
