// Full-turn: fresh-save 5-season playthrough with rich per-season captures.
// Keeps every screenshot (timestamp-prefixed so concurrent runs never
// clobber each other, no directory wipe).

import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";
mkdirSync(OUT, { recursive: true });
const TAG = new Date().toISOString().slice(11, 19).replaceAll(":", "");

async function snap(page: Page, label: string) {
  await page.screenshot({ path: resolve(OUT, `${TAG}-${label}.png`), fullPage: true });
  console.log(`📸 ${TAG}-${label}`);
}

async function advanceOnce(page: Page): Promise<"advanced" | "season-end" | "nothing"> {
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  const fxTab = page.getByText(/^\s*Fixtures\s*$/i).first();
  if (await fxTab.isVisible().catch(() => false)) {
    await fxTab.click();
    await page.waitForTimeout(120);
  }
  const advance = page.getByRole("button", { name: /advance to next match week/i });
  if (await advance.isVisible().catch(() => false)) {
    await advance.click();
    await page.waitForTimeout(500);
    return "advanced";
  }
  const endSeason = page.getByRole("button", { name: /end season/i });
  if (await endSeason.isVisible().catch(() => false)) return "season-end";
  return "nothing";
}

async function capturePlayerModal(page: Page, label: string) {
  await page.goto(`${BASE}/squad`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const first = page.locator('button[class*="font-serif"]').first();
  if (!(await first.isVisible().catch(() => false))) return;
  await first.click();
  await page.waitForTimeout(500);
  await snap(page, `${label}-modal-front`);
  const flip = page.getByTestId("player-modal-flip");
  if (await flip.isVisible().catch(() => false)) {
    await flip.click();
    await page.waitForTimeout(300);
    await snap(page, `${label}-modal-back`);
  }
  const close = page.getByTestId("player-modal-close");
  if (await close.isVisible().catch(() => false)) await close.click();
}

async function playSeason(page: Page, n: number) {
  console.log(`\n▶ Season ${n}`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = await advanceOnce(page);
    if (r === "season-end") break;
    if (r === "nothing") {
      console.log("  no button");
      break;
    }
  }

  // Final-week league table before ending
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await snap(page, `s${n}-pre-end-table`);

  // End season
  const fxTab = page.getByText(/^\s*Fixtures\s*$/i).first();
  if (await fxTab.isVisible().catch(() => false)) {
    await fxTab.click();
    await page.waitForTimeout(200);
  }
  const endBtn = page.getByRole("button", { name: /end season/i });
  if (await endBtn.isVisible().catch(() => false)) {
    await endBtn.click();
    await page.waitForTimeout(1500);
  }
  await snap(page, `s${n}-ceremony`);

  // Scroll and capture Best XI tightly if present
  const bestXI = page.getByText(/best xi of the season/i).first();
  if (await bestXI.isVisible().catch(() => false)) {
    await bestXI.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await snap(page, `s${n}-bestxi`);
  }

  // Post-rollover tour — archive, squad, home, club
  await page.goto(`${BASE}/seasons`, { waitUntil: "networkidle" });
  await snap(page, `s${n}-archive`);
  await page.goto(`${BASE}/squad`, { waitUntil: "networkidle" });
  await snap(page, `s${n}-squad`);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await snap(page, `s${n}-home`);

  // Modal every second season
  if (n === 1 || n === 3 || n === 5) await capturePlayerModal(page, `s${n}`);

  // Start the next season via summary CTA if we're still on it, otherwise skip.
  // (If the ceremony CTA isn't visible, we've already navigated away.)
  const start = page.getByRole("link", { name: /start the next season/i }).first();
  if (await start.isVisible().catch(() => false)) {
    await start.click();
    await page.waitForTimeout(1500);
  } else {
    // Otherwise the next advance will already be in the new season.
  }
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));

  // Pre-sim baseline
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await snap(page, "00-home");
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await snap(page, "00-league");
  await page.goto(`${BASE}/squad`, { waitUntil: "networkidle" });
  await snap(page, "00-squad");
  await page.goto(`${BASE}/transfers`, { waitUntil: "networkidle" });
  await snap(page, "00-transfers");
  await page.goto(`${BASE}/scouts`, { waitUntil: "networkidle" });
  await snap(page, "00-scouts");
  await page.goto(`${BASE}/club`, { waitUntil: "networkidle" });
  await snap(page, "00-club");
  await page.goto(`${BASE}/tactics`, { waitUntil: "networkidle" });
  await snap(page, "00-tactics");
  await page.goto(`${BASE}/seasons`, { waitUntil: "networkidle" });
  await snap(page, "00-archive-empty");
  await capturePlayerModal(page, "00");

  for (let i = 1; i <= 5; i += 1) await playSeason(page, i);

  await b.close();
  console.log(`\nDone → ${OUT} (tag ${TAG})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
