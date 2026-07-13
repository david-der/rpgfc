import { chromium } from "@playwright/test";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));

  await page.goto("http://localhost:5173/seasons", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/rpgfc-playtest/r2-archive.png", fullPage: true });

  await page.goto("http://localhost:5173/squad", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/tmp/rpgfc-playtest/r2-squad.png", fullPage: true });

  const firstPlayer = page.locator('button[class*="font-serif"]').first();
  if (await firstPlayer.isVisible().catch(() => false)) {
    await firstPlayer.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: "/tmp/rpgfc-playtest/r2-modal-front.png", fullPage: true });
  }

  await b.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
