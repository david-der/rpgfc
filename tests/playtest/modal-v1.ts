import { chromium, type Page } from "@playwright/test";
import { resolve } from "node:path";

const BASE = process.env["PLAYTEST_BASE"] ?? "http://localhost:5173";
const OUT = "/tmp/rpgfc-playtest";

async function snap(page: Page, label: string, full = false) {
  await page.screenshot({ path: resolve(OUT, `${label}.png`), fullPage: full });
  console.log(`📸 ${label}`);
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") console.log(`[console.error] ${m.text()}`);
  });

  // Open modal from Squad (Felipe Pereira, id 2, has art).
  await page.goto(`${BASE}/squad`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await snap(page, "modal-01-squad");
  await page.getByText("Felipe Pereira").first().click();
  await page.waitForTimeout(500);
  await snap(page, "modal-02-front");
  // Flip
  await page.getByTestId("player-modal-flip").click();
  await page.waitForTimeout(400);
  await snap(page, "modal-03-back");
  // Close + reopen a different one via Scouts
  await page.getByTestId("player-modal-close").click();
  await page.waitForTimeout(300);
  await page.goto(`${BASE}/scouts`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  // Click first player name — should open modal
  const firstScoutName = page.locator('button[class*="font-serif"]').first();
  await firstScoutName.click();
  await page.waitForTimeout(500);
  await snap(page, "modal-04-scouts-open");
  await b.close();
}
main().catch(console.error);
