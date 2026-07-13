import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();

  // Deep-link a non-default tab per page.
  for (const [label, path] of [
    ["t2-c-league-fixtures", "/league?tab=fixtures"],
    ["t2-c-club-ledger", "/club?tab=ledger"],
    ["t2-c-transfers-offers", "/transfers?tab=offers"],
    ["t2-c-transfers-watchlist", "/transfers?tab=watchlist"],
    ["t2-c-player-contract", "/players/1?tab=contract"],
  ] as const) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    // Capture the active tab by reading aria-selected.
    const activeLabels = await page.locator('[role="tab"][aria-selected="true"]').allTextContents();
    console.log(`  ${path} → active: ${activeLabels.join(",")}`);
    await page.screenshot({ path: resolve(OUT, `${label}.png`), fullPage: false });
    console.log(`📸 ${label}`);
  }

  // Back-button test: go league → fixtures tab via click, then browser back.
  await page.goto(`${BASE}/league`, { waitUntil: "networkidle" });
  await page
    .getByText(/^\s*Fixtures\s*$/i)
    .first()
    .click();
  await page.waitForTimeout(400);
  const urlAfterClick = page.url();
  console.log(`  url after Fixtures click: ${urlAfterClick}`);
  await page.goBack();
  await page.waitForTimeout(400);
  const urlAfterBack = page.url();
  console.log(`  url after goBack:        ${urlAfterBack}`);

  await b.close();
}
main().catch(console.error);
