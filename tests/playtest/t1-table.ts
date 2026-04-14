import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: resolve(OUT, "t1-2-league-table.png"), fullPage: false });
  console.log("📸 t1-2-league-table");
  await b.close();
}
main().catch(console.error);
