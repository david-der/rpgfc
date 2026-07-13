import { expect, test } from "@playwright/test";

// /league → Fixtures tab flow. The nav now routes to /league; the
// Fixtures view is a sub-tab within it.

test.describe("fixtures tab — Story 06/07/08", () => {
  test("match-week-grouped cards appear under the Fixtures tab", async ({ page }) => {
    await page.goto("/league");
    await page.getByRole("tab", { name: "Fixtures" }).click();
    await page.locator("h1").waitFor();

    const headers = page.locator('[data-testid="match-week-allowlist-number"]');
    await expect(headers.first()).toBeVisible();
    // 10 clubs × 18 match weeks (2 × (n-1)) for a full season.
    expect(await headers.count()).toBeGreaterThanOrEqual(18);

    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();
    // 5 fixtures per match week × 18 weeks = 90 fixtures.
    expect(await cards.count()).toBeGreaterThanOrEqual(50);

    const advance = page.locator('[data-testid="advance-matchday"]');
    await expect(advance).toBeVisible();
  });

  test("clicking Advance surfaces W/D/L pills", async ({ page }) => {
    await page.goto("/league");
    await page.getByRole("tab", { name: "Fixtures" }).click();
    await page.locator('[data-testid="advance-matchday"]').click();

    await page.waitForTimeout(300);
    const pills = page.locator("span:has(span.sr-only)");
    expect(await pills.count()).toBeGreaterThan(0);
  });

  test("clicking a played fixture lands on /matches/$id", async ({ page }) => {
    await page.goto("/league");
    await page.getByRole("tab", { name: "Fixtures" }).click();
    const advance = page.locator('[data-testid="advance-matchday"]');
    if (await advance.isVisible()) {
      await advance.click();
      await page.waitForTimeout(300);
    }

    const playedLink = page.locator('a[href^="/matches/"]').first();
    await expect(playedLink).toBeVisible();
    await playedLink.click();

    const narrative = page.locator('[data-testid="match-narrative"]');
    await expect(narrative).toBeVisible();
  });
});
