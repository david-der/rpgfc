// Playtest — continue from match week 6, push to end of season, roll
// into season 1, probe UI at each transition.

import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";
mkdirSync(OUT, { recursive: true });

async function snap(page: Page, label: string) {
  await page.screenshot({ path: resolve(OUT, `${label}.png`), fullPage: true });
  console.log(`📸 ${label}`);
}

/** Click the Advance button once; return true if it clicked, false if the
 *  button is gone (= season over, show "End season" instead). */
async function advanceOnce(page: Page): Promise<"advanced" | "season-end" | "nothing"> {
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  // Ensure we're on Fixtures tab (click the tab text).
  const fxTab = page.getByText(/^\s*Fixtures\s*$/i).first();
  if (await fxTab.isVisible().catch(() => false)) {
    await fxTab.click();
    await page.waitForTimeout(250);
  }
  const advance = page.getByRole("button", { name: /advance to next match week/i });
  if (await advance.isVisible().catch(() => false)) {
    await advance.click();
    await page.waitForTimeout(1000);
    return "advanced";
  }
  const endSeason = page.getByRole("button", { name: /end season/i });
  if (await endSeason.isVisible().catch(() => false)) {
    return "season-end";
  }
  return "nothing";
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));

  // 1. Current standings before the push.
  console.log("▶ Snapshot before advancing");
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await snap(page, "30-preadvance-table");

  // 2. Push through the rest of the regular season.
  console.log("\n▶ Advancing to end-of-season");
  let weekCount = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await advanceOnce(page);
    if (result === "advanced") {
      weekCount++;
      console.log(`  ✓ advanced (total ${weekCount})`);
      if (weekCount % 3 === 0) {
        await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
        await snap(page, `31-after-week-${weekCount}-midseason`);
      }
      if (weekCount > 25) {
        console.log("  ✗ too many iterations — aborting");
        break;
      }
    } else if (result === "season-end") {
      console.log("  🏁 season-end button reached");
      break;
    } else {
      console.log("  ✗ no advance or end button — stopping");
      break;
    }
  }

  // 3. Final standings before rollover.
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await snap(page, "32-final-table-s0");

  // 4. Click End Season.
  console.log("\n▶ Ending the season");
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  const fxTab = page.getByText(/^\s*Fixtures\s*$/i).first();
  if (await fxTab.isVisible().catch(() => false)) {
    await fxTab.click();
    await page.waitForTimeout(300);
  }
  const endBtn = page.getByRole("button", { name: /end season/i });
  if (await endBtn.isVisible().catch(() => false)) {
    await endBtn.click();
    await page.waitForTimeout(1500);
    await snap(page, "33-season-end-transition");
  } else {
    console.log("  ✗ no end-season button");
  }

  // 5. Post-rollover tour — does the UI reflect season 1?
  console.log("\n▶ Post-rollover checks");
  for (const [label, path] of [
    ["34-s1-home", "/"],
    ["35-s1-league", "/league"],
    ["36-s1-squad", "/squad"],
    ["37-s1-club", "/club"],
    ["38-s1-players", "/players"],
    ["39-s1-scouts", "/scouts"],
  ] as const) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await snap(page, label);
  }

  // 6. Do the youth intake players actually show up? Check any player
  //    profile and look for age 17/18.
  console.log("\n▶ Finding a youth player");
  await page.goto(`${BASE}/scouts`, { waitUntil: "networkidle" });
  await snap(page, "40-scouts-s1");

  await b.close();
  console.log(`\nDone. Screenshots → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
