import { expect, test } from "@playwright/test";

// Story 06 — AC-19: the FormSparkline on /players/$id renders no digits.
//
// We boot from /fixtures, advance once so a player has form data,
// then navigate to a player who featured in matchday 1, and assert
// the sparkline SVG contains no digit anywhere.

const DIGIT_RE = /\d/;

test.describe("form sparkline — Story 06", () => {
  test("AC-19: /players/$id sparkline contains no digits in its rendered DOM", async ({ page }) => {
    // Advance the matchday so player 1 has form data to read.
    await page.goto("/league");
    await page.getByRole("tab", { name: "Fixtures" }).click();
    const advance = page.locator('[data-testid="advance-matchday"]');
    if (await advance.isVisible()) {
      await advance.click();
      await page.waitForTimeout(400);
    }

    // Player 1 belongs to club 1 (the user's club) so they're
    // guaranteed to have featured.
    await page.goto("/players/1");
    await page.locator("h1").waitFor();

    // The sparkline either renders or shows the empty placeholder.
    // Either way, the rendered DOM under the sparkline must be digit-free.
    const sparkline = page.locator('[data-testid="form-sparkline"]');
    const empty = page.locator('[data-testid="form-sparkline-empty"]');
    const sparklineVisible = await sparkline.isVisible().catch(() => false);
    const emptyVisible = await empty.isVisible().catch(() => false);
    expect(sparklineVisible || emptyVisible).toBe(true);

    if (sparklineVisible) {
      const text = (await sparkline.textContent()) ?? "";
      expect(DIGIT_RE.test(text), `digit in sparkline DOM: "${text}"`).toBe(false);
    }
  });
});
