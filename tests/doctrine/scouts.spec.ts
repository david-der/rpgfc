import { expect, test } from "@playwright/test";

// Scouting rework — /scouts is now a search/filter page, not a
// scout-card list.

const NUMBER_RE = /\b\d+(\.\d+)?\b/;

test.describe("scouting search — rework", () => {
  test("Scouting entry in primary nav navigates to /scouts and shows a search bar", async ({
    page,
  }) => {
    await page.goto("/");
    const scoutsLink = page.getByRole("link", { name: "Scouting" });
    await expect(scoutsLink).toBeVisible();
    await scoutsLink.click();
    await expect(page).toHaveURL(/\/scouts$/);

    const nav = page.getByRole("navigation", { name: "Primary" });
    const active = nav.locator('a[aria-current="page"]');
    await expect(active).toHaveText("Scouting");

    // Search input is visible.
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
  });

  test("/scouts search results show player names with no digit leaks", async ({ page }) => {
    await page.goto("/scouts");
    // Wait for results to load.
    const results = page.locator('[data-testid="player-facing"]');
    await expect(results.first()).toBeVisible();
    const count = await results.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = (await results.nth(i).textContent()) ?? "";
      expect(NUMBER_RE.test(text), `digit leak: "${text}"`).toBe(false);
    }
  });

  test("position filter narrows the result set", async ({ page }) => {
    await page.goto("/scouts");
    await page.locator('[data-testid="player-facing"]').first().waitFor();
    const allCount = await page.locator('[data-testid="player-facing"]').count();

    // Filter to ST only.
    await page.locator("select").first().selectOption("ST");
    await page.waitForTimeout(300);
    const filteredCount = await page.locator('[data-testid="player-facing"]').count();
    expect(filteredCount).toBeLessThan(allCount);
    expect(filteredCount).toBeGreaterThan(0);
  });
});
