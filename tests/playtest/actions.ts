// Playtest — exercise manager actions: submit a bid, adjust a squad
// role, advance a match week, review a match report, end the season.

import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = process.env["PLAYTEST_OUT"] ?? "/tmp/rpgfc-playtest";
mkdirSync(OUT, { recursive: true });

async function snap(page: Page, label: string) {
  await page.screenshot({ path: resolve(OUT, `${label}.png`), fullPage: true });
  console.log(`📸 ${label}`);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") console.log(`  [console.error] ${m.text()}`);
  });

  // 1. Bid attempt — go to market, click first listing, compose & submit.
  console.log("\n▶ Submitting a bid…");
  await page.goto(`${BASE}/transfers`, { waitUntil: "networkidle" });
  const firstBid = page.locator('a[href^="/transfers/"]').filter({ hasNotText: "Transfers" }).first();
  const href = await firstBid.getAttribute("href");
  console.log(`  target: ${href}`);
  if (href && href !== "/transfers") {
    await firstBid.click();
    await page.waitForLoadState("networkidle");
    await snap(page, "20-bid-before");

    // Submit — the form lives in a composer with a submit button.
    const submit = page.getByRole("button", { name: /submit offer/i });
    const submitVisible = await submit.isVisible().catch(() => false);
    if (submitVisible) {
      await submit.click();
      await page.waitForTimeout(800);
      await snap(page, "21-bid-after");
    } else {
      console.log("  ✗ Submit button not found");
    }
  }

  // 2. Squad role change — open squad, change one dropdown.
  console.log("\n▶ Adjusting a squad role…");
  await page.goto(`${BASE}/squad`, { waitUntil: "networkidle" });
  await snap(page, "22-squad-before");
  const roleSelect = page.locator("select").first();
  const selectVisible = await roleSelect.isVisible().catch(() => false);
  if (selectVisible) {
    await roleSelect.selectOption({ index: 1 });
    await page.waitForTimeout(600);
    await snap(page, "23-squad-after-role-change");
  } else {
    console.log("  ✗ Role select not found");
  }

  // 3. Tactics — change formation.
  console.log("\n▶ Changing formation…");
  await page.goto(`${BASE}/tactics`, { waitUntil: "networkidle" });
  const formationSelect = page.locator("select").first();
  if (await formationSelect.isVisible().catch(() => false)) {
    const currentOptions = await formationSelect.locator("option").allTextContents();
    console.log(`  formations: ${currentOptions.join(", ")}`);
    // Pick a different formation.
    const next = currentOptions.find((o) => !o.toLowerCase().includes("4-3-3")) ?? currentOptions[1];
    if (next) {
      await formationSelect.selectOption({ label: next });
      await page.waitForTimeout(400);
    }
    const save = page.getByRole("button", { name: /save/i });
    if (await save.isVisible().catch(() => false)) {
      await save.click();
      await page.waitForTimeout(600);
    }
    await snap(page, "24-tactics-after-change");
  }

  // 4. Advance a match week (multiple times).
  console.log("\n▶ Advancing match weeks…");
  for (let i = 1; i <= 5; i++) {
    await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
    // The Advance button is on the Fixtures tab.
    const fixturesTab = page.getByRole("tab", { name: /fixtures/i }).or(page.getByText(/fixtures/i, { exact: false }));
    if (await fixturesTab.first().isVisible().catch(() => false)) {
      await fixturesTab.first().click();
      await page.waitForTimeout(400);
    }
    const advance = page.getByRole("button", { name: /advance/i });
    const advanceVisible = await advance.isVisible().catch(() => false);
    if (!advanceVisible) {
      console.log(`  week ${i}: no advance button (may have ended)`);
      break;
    }
    await advance.click();
    await page.waitForTimeout(1200);
    await snap(page, `25-advance-week-${i}`);
    console.log(`  ✓ advanced week ${i}`);
  }

  // 5. League standings after advancing.
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await snap(page, "26-league-table-after");

  // 6. A match report — click a "Played" result.
  console.log("\n▶ Opening a match report…");
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  const matchLink = page.locator('a[href*="/matches/"]').first();
  if (await matchLink.isVisible().catch(() => false)) {
    await matchLink.click();
    await page.waitForLoadState("networkidle");
    await snap(page, "27-match-report");
  } else {
    console.log("  ✗ no match link found");
  }

  await browser.close();
  console.log(`\nScreenshots → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
