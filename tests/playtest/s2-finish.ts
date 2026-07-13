// Session 5: finish S2, catch the end-season narrative by scrolling
// to top after click, enter S3, spot-check what broke across rollovers.

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
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));

  // Advance S2 until End Season is visible.
  console.log("▶ Finishing S2");
  let w = 0;
  while (w < 25) {
    await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
    const fx = page.getByText(/^\s*Fixtures\s*$/i).first();
    if (await fx.isVisible().catch(() => false)) {
      await fx.click();
      await page.waitForTimeout(200);
    }
    const adv = page.getByRole("button", { name: /advance to next match week/i });
    if (await adv.isVisible().catch(() => false)) {
      await adv.click();
      await page.waitForTimeout(750);
      w++;
      continue;
    }
    const end = page.getByRole("button", { name: /end season/i });
    if (await end.isVisible().catch(() => false)) break;
    break;
  }
  console.log(`  ${w} advances to end`);

  // Final S2 table.
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await snap(page, "70-s2-final-table");

  // End season — click, then SCROLL TO TOP to catch the narrative.
  console.log("▶ End season — scroll to top after");
  await page
    .getByText(/^\s*Fixtures\s*$/i)
    .first()
    .click();
  await page.waitForTimeout(400);
  const endBtn = page.getByRole("button", { name: /end season/i });
  if (await endBtn.isVisible().catch(() => false)) {
    await endBtn.click();
    // Wait for mutation, then scroll to top and re-snap.
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await snap(page, "71-s2-end-season-scrolled-top");
    // Also try scrolling to where the narrative would be rendered —
    // search for text containing "season" or "champion" via locator.
    const narrative = page.getByText(/season\s+2/i).first();
    if (await narrative.isVisible().catch(() => false)) {
      await narrative.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await snap(page, "72-s2-end-season-narrative-centered");
    }
  }

  // S3 opening checks.
  console.log("▶ S3 opening");
  for (const [label, path] of [
    ["73-s3-home", "/"],
    ["74-s3-league", "/league"],
    ["75-s3-squad", "/squad"],
    ["76-s3-club", "/club"],
    ["77-s3-transfers", "/transfers"],
  ] as const) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await snap(page, label);
  }

  // Check the Fixtures tab — is the S0/S1/S2/S3 mixing bug still there?
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await page
    .getByText(/^\s*Fixtures\s*$/i)
    .first()
    .click();
  await page.waitForTimeout(400);
  await snap(page, "78-s3-fixtures-check");

  // Play 3 MW of S3.
  console.log("▶ S3 play");
  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
    await page
      .getByText(/^\s*Fixtures\s*$/i)
      .first()
      .click();
    await page.waitForTimeout(300);
    const a = page.getByRole("button", { name: /advance to next match week/i });
    if (!(await a.isVisible().catch(() => false))) break;
    await a.click();
    await page.waitForTimeout(800);
  }
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await snap(page, "79-s3-mw3-table");

  await b.close();
  console.log(`\nDone → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
