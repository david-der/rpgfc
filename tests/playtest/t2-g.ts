import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/players/78?tab=history`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(OUT, "t2-g-history.png"), fullPage: false });
  console.log("📸 t2-g-history");

  await page.goto(`${BASE}/players/78?tab=badges`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(OUT, "t2-h-badges.png"), fullPage: false });
  console.log("📸 t2-h-badges");

  await b.close();
}
main().catch(console.error);
