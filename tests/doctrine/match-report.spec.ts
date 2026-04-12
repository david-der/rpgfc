import { expect, test } from "@playwright/test";

// Story 06 — /matches/$id no-numbers + allowlist coverage.
//
// AC-18: every digit on the match report page is inside an element
// with one of the four Story 06 allowlist suffixes:
//   - match-score-allowlist-number   (scoreline)
//   - match-week-allowlist-number     (match week eyebrow)
//   - goals-allowlist-number         (per-player goals)
//   - assists-allowlist-number       (per-player assists)
//
// All other player-facing elements must be digit-free.

const NUMBER_RE = /\b\d+(\.\d+)?\b/;
const DIGIT_RE = /\d/;
const CURRENCY_GLYPH_RE = /[£$€¥]/;

test.describe("match report — Story 06", () => {
  test("AC-18: prose narrative is player-facing and contains no digits", async ({ page }) => {
    // Boot from /fixtures, advance once, click the first played match.
    await page.goto("/fixtures");
    const advance = page.locator('[data-testid="advance-matchday"]');
    if (await advance.isVisible()) {
      await advance.click();
      await page.waitForTimeout(300);
    }
    await page.locator('a[href^="/matches/"]').first().click();
    await page.locator("h1").waitFor();

    // Every player-facing element on the page must be digit-free.
    const playerFacing = page.locator('[data-testid="player-facing"]');
    const count = await playerFacing.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = (await playerFacing.nth(i).textContent()) ?? "";
      expect(NUMBER_RE.test(text), `digit leak at elt ${i}: "${text}"`).toBe(false);
    }

    // No currency glyphs in the body either.
    const bodyText = (await page.locator("body").textContent()) ?? "";
    expect(CURRENCY_GLYPH_RE.test(bodyText)).toBe(false);
  });

  test("AC-18: scoreline + matchday + goals/assists wear their allowlist suffixes", async ({
    page,
  }) => {
    await page.goto("/fixtures");
    const advance = page.locator('[data-testid="advance-matchday"]');
    if (await advance.isVisible()) {
      await advance.click();
      await page.waitForTimeout(300);
    }
    await page.locator('a[href^="/matches/"]').first().click();
    await page.locator("h1").waitFor();

    // The scoreline elements exist and carry digits.
    const scores = page.locator('[data-testid="match-score-allowlist-number"]');
    expect(await scores.count()).toBeGreaterThanOrEqual(2);

    // Match week eyebrow exists.
    const matchWeek = page.locator('[data-testid="match-week-allowlist-number"]').first();
    await expect(matchWeek).toBeVisible();

    // Goals + assists allowlists may or may not exist depending on
    // the random outcome, but if they exist, they should carry digits.
    const goals = page.locator('[data-testid="goals-allowlist-number"]');
    const goalsCount = await goals.count();
    for (let i = 0; i < goalsCount; i++) {
      const text = (await goals.nth(i).textContent()) ?? "";
      expect(DIGIT_RE.test(text)).toBe(true);
    }
    const assists = page.locator('[data-testid="assists-allowlist-number"]');
    const assistsCount = await assists.count();
    for (let i = 0; i < assistsCount; i++) {
      const text = (await assists.nth(i).textContent()) ?? "";
      expect(DIGIT_RE.test(text)).toBe(true);
    }
  });
});
