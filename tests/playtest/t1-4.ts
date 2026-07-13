import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  // My Bids tab.
  await page.goto(`${BASE}/transfers`, { waitUntil: "networkidle" });
  await page
    .getByText(/^\s*My Bids\s*$/i)
    .first()
    .click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(OUT, "t1-4-my-bids.png"), fullPage: false });
  console.log("📸 t1-4-my-bids");
  // Offers tab.
  await page.goto(`${BASE}/transfers`, { waitUntil: "networkidle" });
  await page
    .getByText(/^\s*Offers\s*$/i)
    .first()
    .click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(OUT, "t1-4-offers.png"), fullPage: false });
  console.log("📸 t1-4-offers");
  await b.close();
}
main().catch(console.error);
