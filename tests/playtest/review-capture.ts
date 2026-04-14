// Review capture — snapshot archive, two completed seasons, squad, modal.
// Uses /api/seasons to pick seasons that are actually completed so we
// don't land on the "season incomplete" error page.

import { chromium, type Page } from "@playwright/test";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const API = process.env["PLAYTEST_API"] ?? "http://localhost:8787";
const OUT = "/tmp/rpgfc-playtest";
const TAG = new Date().toISOString().slice(11, 19).replaceAll(":", "");

async function snap(page: Page, label: string) {
  await page.screenshot({ path: resolve(OUT, `${TAG}-${label}.png`), fullPage: true });
  console.log(`📸 ${TAG}-${label}`);
}

async function main() {
  // Pick two completed seasons via the archive endpoint.
  const archive = (await (await fetch(`${API}/api/seasons`)).json()) as {
    seasons: Array<{ season: number }>;
  };
  const completed = archive.seasons.map((s) => s.season).sort((a, b) => a - b);
  const oldest = completed[0];
  const newest = completed[completed.length - 1];

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));

  await page.goto(`${BASE}/seasons`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await snap(page, "01-archive");

  if (oldest !== undefined) {
    await page.goto(`${BASE}/seasons/${oldest}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await snap(page, `02-season${oldest}-bestxi`);
  }

  if (newest !== undefined && newest !== oldest) {
    await page.goto(`${BASE}/seasons/${newest}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await snap(page, `03-season${newest}-bestxi`);
  }

  await page.goto(`${BASE}/squad`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await snap(page, "04-squad");

  const firstPlayer = page.locator('button[class*="font-serif"]').first();
  if (await firstPlayer.isVisible().catch(() => false)) {
    await firstPlayer.click();
    await page.waitForTimeout(700);
    await snap(page, "05-modal-front");
    const flip = page.getByTestId("player-modal-flip");
    if (await flip.isVisible().catch(() => false)) {
      await flip.click();
      await page.waitForTimeout(400);
      await snap(page, "06-modal-back");
    }
  }

  await b.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
