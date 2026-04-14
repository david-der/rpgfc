import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  // Rival profile — player 22 (Iker Gómez at Sporting Recife).
  await page.goto(`${BASE}/players/22`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(OUT, "t1-5-rival-profile.png"), fullPage: false });
  console.log("📸 t1-5-rival-profile");
  // My own player — player 2 (Club Madrid).
  await page.goto(`${BASE}/players/2`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(OUT, "t1-5-own-profile.png"), fullPage: false });
  console.log("📸 t1-5-own-profile");
  await b.close();
}
main().catch(console.error);
