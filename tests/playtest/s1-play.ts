// Season 1 play: submit multiple bids at Notable/Significant fees,
// extend one of my 1-season-left players, advance to end of S1.

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

  // Submit 3 bids at higher fees this time.
  const targets = [1, 2, 3]; // first 3 listings
  for (const idx of targets) {
    console.log(`\n▶ Bid ${idx}`);
    await page.goto(`${BASE}/transfers`, { waitUntil: "networkidle" });
    const links = page.locator('a[href^="/transfers/"]');
    const count = await links.count();
    // find the nth bid-worthy link
    let bidsSeen = 0;
    let href: string | null = null;
    for (let i = 0; i < count; i++) {
      const h = await links.nth(i).getAttribute("href");
      if (h && h !== "/transfers" && !h.includes("?")) {
        bidsSeen += 1;
        if (bidsSeen === idx) { href = h; break; }
      }
    }
    if (!href) {
      console.log(`  ✗ no listing at index ${idx}`);
      continue;
    }
    console.log(`  target: ${href}`);
    await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
    // Bump fee tier to Notable / Significant via the Fee select.
    const feeSelect = page.locator('select').first();
    if (await feeSelect.isVisible().catch(() => false)) {
      const opts = await feeSelect.locator("option").allTextContents();
      console.log(`  fee options: ${opts.join(", ")}`);
      await feeSelect.selectOption({ label: opts.includes("Notable") ? "Notable" : opts[opts.length - 2] ?? opts[0]! });
    }
    // Wage select is 2nd
    const wageSelect = page.locator('select').nth(1);
    if (await wageSelect.isVisible().catch(() => false)) {
      const opts = await wageSelect.locator("option").allTextContents();
      await wageSelect.selectOption({ label: opts.includes("Notable") ? "Notable" : opts[0]! });
    }
    const submit = page.getByRole("button", { name: /submit offer/i });
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
      await page.waitForTimeout(700);
    }
    await snap(page, `41-bid-${idx}`);
  }

  // Try an extension on one of my players who has 1 season left.
  console.log(`\n▶ Contract extension`);
  // Walk /squad → click first starter → go to Contract tab
  await page.goto(`${BASE}/squad`, { waitUntil: "networkidle" });
  // Try to find a player link — squad cards might not link directly.
  // Use /players/1 directly — hopefully one of my roster.
  // Actually just iterate a few players.
  for (const pid of [1, 2, 3, 4, 5]) {
    await page.goto(`${BASE}/players/${pid}`, { waitUntil: "networkidle" });
    // Click Contract tab
    const contractTab = page.getByText(/^\s*Contract\s*$/i).first();
    if (await contractTab.isVisible().catch(() => false)) {
      await contractTab.click();
      await page.waitForTimeout(250);
      const submitExt = page.getByRole("button", { name: /offer extension/i });
      if (await submitExt.isVisible().catch(() => false)) {
        console.log(`  ext-form visible on player ${pid}`);
        await submitExt.click();
        await page.waitForTimeout(600);
        await snap(page, `42-extension-${pid}`);
        break;
      }
    }
  }

  // Advance 6 match weeks in season 1.
  console.log(`\n▶ Advancing S1 match weeks`);
  for (let i = 1; i <= 6; i++) {
    await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
    const fxTab = page.getByText(/^\s*Fixtures\s*$/i).first();
    if (await fxTab.isVisible().catch(() => false)) await fxTab.click();
    await page.waitForTimeout(300);
    const adv = page.getByRole("button", { name: /advance to next match week/i });
    if (!(await adv.isVisible().catch(() => false))) {
      console.log(`  MW${i}: no advance button`); break;
    }
    await adv.click();
    await page.waitForTimeout(900);
    console.log(`  ✓ advanced MW${i}`);
  }
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await snap(page, "43-s1-table-midseason");

  // Check transfer resolution.
  await page.goto(`${BASE}/transfers`, { waitUntil: "networkidle" });
  await snap(page, "44-transfers-s1-midseason");
  const myBidsTab = page.getByText(/^\s*My Bids\s*$/i).first();
  if (await myBidsTab.isVisible().catch(() => false)) {
    await myBidsTab.click();
    await page.waitForTimeout(400);
    await snap(page, "45-my-bids-s1");
  }

  // Club page — did my cash move?
  await page.goto(`${BASE}/club`, { waitUntil: "networkidle" });
  await snap(page, "46-club-s1-midseason");

  await b.close();
  console.log(`\nDone → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
