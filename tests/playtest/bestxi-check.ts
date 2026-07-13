import { chromium } from "@playwright/test";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173/seasons/0", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/rpgfc-playtest/new-bestxi-season0.png", fullPage: true });
  await page.goto("http://localhost:5173/seasons/5", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/rpgfc-playtest/new-bestxi-season5.png", fullPage: true });
  await b.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
