import { expect, test } from "@playwright/test";

// Story 06/07 — /fixtures + Advance + match navigation. AC-16, AC-17.

test.describe("fixtures — Story 06/07", () => {
  test("AC-16: /fixtures renders match-week-grouped cards + an Advance button", async ({
    page,
  }) => {
    await page.goto("/fixtures");
    await page.locator("h1").waitFor();

    // 38 match weeks for a 20-club full season.
    const headers = page.locator('[data-testid="match-week-allowlist-number"]');
    await expect(headers.first()).toBeVisible();
    expect(await headers.count()).toBeGreaterThanOrEqual(38);

    // Each match week has ten fixture cards (20 clubs / 2 per match).
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(380);

    // Active match week header carries the Advance button.
    const advance = page.locator('[data-testid="advance-matchday"]');
    await expect(advance).toBeVisible();
  });

  test("AC-17: clicking Advance plays the next match week and surfaces W/D/L", async ({
    page,
  }) => {
    await page.goto("/fixtures");
    await page.locator('[data-testid="advance-matchday"]').click();

    await page.waitForTimeout(300);
    const pills = page.locator('span:has(span.sr-only)');
    expect(await pills.count()).toBeGreaterThan(0);
  });

  test("AC-18: clicking a played fixture lands on /matches/$id with a prose narrative", async ({
    page,
  }) => {
    await page.goto("/fixtures");
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
    const paragraphs = narrative.locator("p");
    expect(await paragraphs.count()).toBeGreaterThanOrEqual(1);
  });
});
