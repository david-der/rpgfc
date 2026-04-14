import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") console.log(`  [console.error] ${m.text()}`);
  });

  // Render the ceremony for the most-recent completed season (no param).
  await page.goto(`${BASE}/season/summary`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(OUT, "t1-ceremony-recent.png"), fullPage: false });
  console.log("📸 t1-ceremony-recent");

  // Full-page for context.
  await page.screenshot({ path: resolve(OUT, "t1-ceremony-full.png"), fullPage: true });
  console.log("📸 t1-ceremony-full");

  await b.close();
}
main().catch(console.error);
