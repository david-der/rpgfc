// Playtest helper — screenshot + text-capture specific match reports and
// one player modal, by direct navigation. Companion to
// multi-season-critique.ts for when the results-tab link locator misses.
//
//   PLAYTEST_MATCHES=41:s0,131:s1,221:s2 PLAYTEST_RUN=critique-0712 \
//     pnpm --filter @rpgfc/server exec tsx tests/playtest/capture-reports.ts

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const RUN = process.env["PLAYTEST_RUN"] ?? "run";
const MATCHES = (process.env["PLAYTEST_MATCHES"] ?? "").split(",").filter(Boolean);
const OUT = resolve(import.meta.dirname ?? process.cwd(), `results/${RUN}`);
mkdirSync(OUT, { recursive: true });

async function main() {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  for (const spec of MATCHES) {
    const [id, label] = spec.split(":") as [string, string];
    await page.goto(`${BASE}/matches/${id}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.screenshot({
      path: resolve(OUT, `${label}-match-${id}.png`),
      fullPage: true,
    });
    const text = await page
      .locator("main")
      .innerText()
      .catch(() => "");
    writeFileSync(resolve(OUT, `${label}-match-${id}.txt`), text);
    console.log(`📸 ${label}-match-${id}`);
  }

  // One player modal from the squad page for the card/history surface.
  await page.goto(`${BASE}/squad`, { waitUntil: "networkidle" });
  const row = page.locator("main button, main [role=button]").first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: resolve(OUT, "player-modal.png"), fullPage: false });
    console.log("📸 player-modal");
  }

  await b.close();
  console.log(`Done → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
