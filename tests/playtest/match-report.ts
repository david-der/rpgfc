import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/matches/1`, { waitUntil: "networkidle" });
  await page.screenshot({ path: resolve(OUT, "28-match-report.png"), fullPage: true });
  // Tabs: Report / Stats / Players
  const statsTab = page.getByText(/^\s*stats\s*$/i).first();
  if (await statsTab.isVisible().catch(() => false)) {
    await statsTab.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(OUT, "29-match-stats.png"), fullPage: true });
  }
  await b.close();
  console.log("done");
}
main().catch(console.error);
