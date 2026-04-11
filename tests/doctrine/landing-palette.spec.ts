import { expect, test } from "@playwright/test";

// AC-14: the landing page renders with the correct palette tokens.
//   - body background = parchment-50 = rgb(250, 247, 240)
//   - heading color = parchment-900 = rgb(26, 24, 18)
//   - heading font-family includes "Newsreader"

test("landing page palette — Story 00 AC-14", async ({ page }) => {
  await page.goto("/");

  const body = page.locator("body");
  await expect(body).toHaveCSS("background-color", "rgb(250, 247, 240)");
  // Parchment-900 text color (body default) — some browsers report color on
  // children, so we check the root element's computed color.
  await expect(body).toHaveCSS("color", "rgb(26, 24, 18)");

  const heading = page.locator("h1");
  await expect(heading).toHaveCSS("color", "rgb(26, 24, 18)");

  const fontFamily = await heading.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(fontFamily).toMatch(/Newsreader/i);
});
