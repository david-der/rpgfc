import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));

  await page.goto(`${BASE}/season/summary`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(OUT, "t2-j-ceremony.png"), fullPage: false });
  console.log("📸 t2-j-ceremony");

  await page.goto(`${BASE}/matches/1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(OUT, "t2-j-match.png"), fullPage: false });
  console.log("📸 t2-j-match");

  await b.close();
}
main().catch(console.error);
