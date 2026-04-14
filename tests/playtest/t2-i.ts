import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));

  // Two profiles side-by-side: own club vs rival, to show the card
  // framing with different club colors. Player 1 = Club Madrid (own),
  // player 78 = Real Oviedo (rival).
  await page.goto(`${BASE}/players/1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(OUT, "t2-i-own-card.png"), fullPage: false });
  console.log("📸 t2-i-own-card");

  await page.goto(`${BASE}/players/78`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(OUT, "t2-i-rival-card.png"), fullPage: false });
  console.log("📸 t2-i-rival-card");

  await b.close();
}
main().catch(console.error);
