import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();

  // Find a listed player to compose a bid for.
  await page.goto(`${BASE}/transfers`, { waitUntil: "networkidle" });
  const firstListing = page
    .locator('a[href^="/transfers/"]')
    .filter({ hasNotText: "Transfers" })
    .first();
  const href = await firstListing.getAttribute("href");
  await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(OUT, "t2-d-composer-default.png"), fullPage: false });
  console.log("📸 t2-d-composer-default (default fee = asking)");

  // Drop fee to Minimal — should show "Below asking" + "Unlikely" + tiny %.
  const feeSelect = page.locator('[data-testid="bid-fee-select"]');
  await feeSelect.selectOption({ label: "Minimal" });
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(OUT, "t2-d-composer-lowball.png"), fullPage: false });
  console.log("📸 t2-d-composer-lowball (Minimal fee)");

  // Bump fee to Elite — "Above asking" + "Likely".
  await feeSelect.selectOption({ label: "Elite" });
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(OUT, "t2-d-composer-blowout.png"), fullPage: false });
  console.log("📸 t2-d-composer-blowout (Elite fee)");

  await b.close();
}
main().catch(console.error);
