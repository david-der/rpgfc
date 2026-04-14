// Five-season playtest after the match-rating / Best XI / archive landing.
// Advances through matches, captures season summaries incl. Best XI, visits
// the archive, and snapshots the player modal (front + back).

import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";
mkdirSync(OUT, { recursive: true });

async function snap(page: Page, label: string) {
  await page.screenshot({ path: resolve(OUT, `${label}.png`), fullPage: true });
  console.log(`📸 ${label}`);
}

async function advanceOnce(page: Page): Promise<"advanced" | "season-end" | "nothing"> {
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  const fxTab = page.getByText(/^\s*Fixtures\s*$/i).first();
  if (await fxTab.isVisible().catch(() => false)) {
    await fxTab.click();
    await page.waitForTimeout(150);
  }
  const advance = page.getByRole("button", { name: /advance to next match week/i });
  if (await advance.isVisible().catch(() => false)) {
    await advance.click();
    await page.waitForTimeout(600);
    return "advanced";
  }
  const endSeason = page.getByRole("button", { name: /end season/i });
  if (await endSeason.isVisible().catch(() => false)) return "season-end";
  return "nothing";
}

async function playOneSeason(page: Page, label: string) {
  console.log(`\n▶ ${label} — advancing`);
  let weeks = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = await advanceOnce(page);
    if (r === "advanced") {
      weeks += 1;
      if (weeks > 42) { console.log("  ✗ runaway"); break; }
    } else if (r === "season-end") {
      console.log(`  🏁 end after ${weeks} advances`);
      break;
    } else {
      console.log("  ✗ no button");
      break;
    }
  }

  // End the season
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  const fxTab = page.getByText(/^\s*Fixtures\s*$/i).first();
  if (await fxTab.isVisible().catch(() => false)) { await fxTab.click(); await page.waitForTimeout(200); }
  const endBtn = page.getByRole("button", { name: /end season/i });
  if (await endBtn.isVisible().catch(() => false)) {
    await endBtn.click();
    await page.waitForTimeout(1500);
  }

  // Summary page
  await page.waitForTimeout(500);
  await snap(page, `${label}-summary`);

  // Best XI section should be present — try to scroll it into view and snap it tightly
  const bestXI = page.getByText(/best xi/i).first();
  if (await bestXI.isVisible().catch(() => false)) {
    await bestXI.scrollIntoViewIfNeeded();
    await snap(page, `${label}-bestxi`);
  }
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") console.log(`  [console.error] ${m.text()}`); });

  // 0. Baseline: archive before any new rollovers
  await page.goto(`${BASE}/seasons`, { waitUntil: "networkidle" });
  await snap(page, "00-archive-before");

  // 1. Current season summary of a past season (if archive has any)
  await page.goto(`${BASE}/seasons/0`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await snap(page, "01-archive-season0-bestxi");

  await page.goto(`${BASE}/seasons/2`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await snap(page, "02-archive-season2-bestxi");

  // 2. Player modal from Squad — front + back
  await page.goto(`${BASE}/squad`, { waitUntil: "networkidle" });
  await snap(page, "03-squad");
  const firstPlayer = page.locator('button[class*="font-serif"]').first();
  if (await firstPlayer.isVisible().catch(() => false)) {
    await firstPlayer.click();
    await page.waitForTimeout(500);
    await snap(page, "04-modal-front");
    const flip = page.getByTestId("player-modal-flip");
    if (await flip.isVisible().catch(() => false)) {
      await flip.click();
      await page.waitForTimeout(400);
      await snap(page, "05-modal-back");
    }
    const close = page.getByTestId("player-modal-close");
    if (await close.isVisible().catch(() => false)) await close.click();
  }

  // 3. Run five seasons. Each rollover adds one to the archive.
  for (let i = 1; i <= 5; i += 1) {
    await playOneSeason(page, `s${i}`);
    // Start next season via CTA
    const start = page.getByRole("link", { name: /start the next season/i });
    if (await start.isVisible().catch(() => false)) {
      await start.click();
      await page.waitForTimeout(1500);
    }
    // Archive grows
    await page.goto(`${BASE}/seasons`, { waitUntil: "networkidle" });
    await snap(page, `s${i}-archive`);
    // Player modal mid-run
    if (i === 3) {
      await page.goto(`${BASE}/squad`, { waitUntil: "networkidle" });
      const p = page.locator('button[class*="font-serif"]').first();
      if (await p.isVisible().catch(() => false)) {
        await p.click();
        await page.waitForTimeout(500);
        await snap(page, `s${i}-modal-front`);
        const flip = page.getByTestId("player-modal-flip");
        if (await flip.isVisible().catch(() => false)) {
          await flip.click();
          await page.waitForTimeout(400);
          await snap(page, `s${i}-modal-back`);
        }
        await page.getByTestId("player-modal-close").click().catch(() => {});
      }
    }
  }

  // 4. Final archive
  await page.goto(`${BASE}/seasons`, { waitUntil: "networkidle" });
  await snap(page, "zz-archive-final");

  await b.close();
  console.log(`\nDone → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
