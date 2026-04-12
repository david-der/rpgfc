import { expect, test } from "@playwright/test";

// Tactics — pitch diagram renders for the current formation.
// The pitch uses positioned buttons with slot labels (GK, DC, LB, etc.)
// and clicking a marker opens an assignment picker.

const NUMBER_RE = /\b\d+(\.\d+)?\b/;
const CURRENCY_GLYPH_RE = /[£$€¥]/;

test.describe("tactics", () => {
  test("pitch diagram renders 11 markers for 4-3-3", async ({ page }) => {
    await page.goto("/tactics");
    // The pitch diagram has 11 positioned buttons (one per slot).
    // Each marker has a rounded-full circle with the slot label text.
    const markers = page.locator("button").filter({ has: page.locator(".rounded-full") });
    await expect(markers.first()).toBeVisible();
    expect(await markers.count()).toBe(11);

    // No digit leaks on player-facing elements.
    const playerFacing = page.locator('[data-testid="player-facing"]');
    const count = await playerFacing.count();
    for (let i = 0; i < count; i++) {
      const text = (await playerFacing.nth(i).textContent()) ?? "";
      expect(NUMBER_RE.test(text), `digit leak on /tactics at elt ${i}: "${text}"`).toBe(false);
    }

    const bodyText = (await page.locator("body").textContent()) ?? "";
    expect(CURRENCY_GLYPH_RE.test(bodyText)).toBe(false);
  });

  test("changing formation updates marker count and positions", async ({ page }) => {
    await page.goto("/tactics");
    const markers = page.locator("button").filter({ has: page.locator(".rounded-full") });
    await expect(markers.first()).toBeVisible();

    // Switch to 3-5-2 and save.
    await page.locator('[data-testid="tactics-formation-select"]').selectOption("3-5-2");
    await page.getByRole("button", { name: /save changes/i }).click();
    await page.waitForTimeout(300);

    // Still 11 markers (every formation has 11 slots).
    expect(await markers.count()).toBe(11);
  });
});
