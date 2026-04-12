import { expect, test } from "@playwright/test";

// Story 06 — /fixtures + Advance + match navigation. AC-16, AC-17.

test.describe("fixtures — Story 06", () => {
  test("AC-16: /fixtures renders matchday-grouped cards + an Advance button", async ({
    page,
  }) => {
    await page.goto("/fixtures");
    await page.locator("h1").waitFor();

    // Nine matchdays for a 10-club half-season.
    const headers = page.locator('[data-testid="matchday-allowlist-number"]');
    await expect(headers.first()).toBeVisible();
    expect(await headers.count()).toBeGreaterThanOrEqual(9);

    // Each matchday has five fixture cards.
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(45);

    // Active matchday header carries the Advance button.
    const advance = page.locator('[data-testid="advance-matchday"]');
    await expect(advance).toBeVisible();
  });

  test("AC-17: clicking Advance plays the next matchday and surfaces W/D/L", async ({
    page,
  }) => {
    await page.goto("/fixtures");
    await page.locator('[data-testid="advance-matchday"]').click();

    // After advance the user club's row carries a ResultPill (W/D/L).
    // The pill is rendered as W/D/L glyph text in a span — find any
    // visible result pill on the page.
    await page.waitForTimeout(300);
    const pills = page.locator('span:has(span.sr-only)');
    expect(await pills.count()).toBeGreaterThan(0);
  });

  test("AC-18: clicking a played fixture lands on /matches/$id with a prose narrative", async ({
    page,
  }) => {
    await page.goto("/fixtures");
    // Make sure at least one matchday has been played.
    const advance = page.locator('[data-testid="advance-matchday"]');
    if (await advance.isVisible()) {
      await advance.click();
      await page.waitForTimeout(300);
    }

    // Click the first played fixture (an <a> wrapping a card).
    const playedLink = page
      .locator('a[href^="/matches/"]')
      .first();
    await expect(playedLink).toBeVisible();
    await playedLink.click();

    // Match report renders with prose paragraphs.
    const narrative = page.locator('[data-testid="match-narrative"]');
    await expect(narrative).toBeVisible();
    const paragraphs = narrative.locator("p");
    expect(await paragraphs.count()).toBeGreaterThanOrEqual(1);
  });
});
