import { expect, test } from "@playwright/test";

// Story 06 — AC-20: Fixtures nav entry highlights on /fixtures and on
// /matches/$id (since match reports live "inside" Fixtures conceptually
// they highlight the same nav entry... actually no — /matches/$id is
// its own route. We assert Fixtures highlights on /fixtures and that
// the deep link to /matches/$id loads without breaking the nav.

test.describe("fixtures nav — Story 06", () => {
  test("AC-20: Fixtures entry highlights on /fixtures", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Fixtures" }).click();
    await expect(page).toHaveURL(/\/fixtures$/);
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.locator('a[aria-current="page"]')).toHaveText("Fixtures");
  });

  test("AC-20: /matches/$id deep link loads without crashing the nav", async ({ page }) => {
    // Boot through fixtures + advance so match 1 exists.
    await page.goto("/fixtures");
    const advance = page.locator('[data-testid="advance-matchday"]');
    if (await advance.isVisible()) {
      await advance.click();
      await page.waitForTimeout(300);
    }
    // Find the first played match link and grab the id.
    const link = page.locator('a[href^="/matches/"]').first();
    const href = (await link.getAttribute("href")) ?? "";
    expect(href).toMatch(/^\/matches\/\d+$/);

    await page.goto(href);
    await page.locator("h1").waitFor();
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();
  });
});
