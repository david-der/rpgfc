// Snap the new home dashboard — viewport-only, both at season start and
// mid-season (the playtest db is in S3 so mid-season-ish).

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
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(OUT, "90-home-dashboard.png"), fullPage: false });
  console.log("📸 90-home-dashboard");

  // Also take a fullPage for reference.
  await page.screenshot({ path: resolve(OUT, "91-home-fullpage.png"), fullPage: true });
  console.log("📸 91-home-fullpage");

  await b.close();
}
main().catch(console.error);
