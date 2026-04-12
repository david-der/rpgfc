import { expect, test } from "@playwright/test";

// League nav entry highlights on /league and the /league/clubs/$id
// drilldown pages, and /matches/$id deep-links still load cleanly.

test.describe("league nav", () => {
  test("League entry highlights on /league", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "League" }).click();
    await expect(page).toHaveURL(/\/league$/);
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.locator('a[aria-current="page"]')).toHaveText("League");
  });

  test("/matches/$id deep link loads without crashing the nav", async ({ page }) => {
    await page.goto("/league");
    await page.getByRole("tab", { name: "Fixtures" }).click();
    const advance = page.locator('[data-testid="advance-matchday"]');
    if (await advance.isVisible()) {
      await advance.click();
      await page.waitForTimeout(300);
    }
    const link = page.locator('a[href^="/matches/"]').first();
    const href = (await link.getAttribute("href")) ?? "";
    expect(href).toMatch(/^\/matches\/\d+$/);

    await page.goto(href);
    await page.locator("h1").waitFor();
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();
  });
});
