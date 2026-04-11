import { expect, test } from "@playwright/test";

// Story 05 — /tactics editor. AC-13, AC-14.
//
// AC-13: 11 SlotRow rows for the default 4-3-3 formation, each with a
//        dropdown and no digit leak on any player-facing element.
// AC-14: changing the formation re-renders the slot set. We flip to
//        3-5-2 and assert the slot row count stays 11 but the per-slot
//        labels change.

const NUMBER_RE = /\b\d+(\.\d+)?\b/;
const CURRENCY_GLYPH_RE = /[£$€¥]/;

test.describe("tactics — Story 05", () => {
  test("AC-13: /tactics renders 11 slot rows with no digit leaks", async ({ page }) => {
    await page.goto("/tactics");
    const slotRows = page.locator("[data-slot]");
    await expect(slotRows.first()).toBeVisible();
    expect(await slotRows.count()).toBe(11);

    // No digit in any player-facing element on /tactics.
    const playerFacing = page.locator('[data-testid="player-facing"]');
    const count = await playerFacing.count();
    for (let i = 0; i < count; i++) {
      const text = (await playerFacing.nth(i).textContent()) ?? "";
      expect(NUMBER_RE.test(text), `digit leak on /tactics at elt ${i}: "${text}"`).toBe(false);
    }

    // No currency glyphs anywhere on the page body.
    const bodyText = (await page.locator("body").textContent()) ?? "";
    expect(
      CURRENCY_GLYPH_RE.test(bodyText),
      `currency glyph on /tactics: ${bodyText.slice(0, 200)}`,
    ).toBe(false);
  });

  test("AC-14: changing formation re-renders the slot set", async ({ page }) => {
    await page.goto("/tactics");
    const beforeRows = page.locator("[data-slot]");
    await expect(beforeRows.first()).toBeVisible();

    // Baseline — 4-3-3 has an LW slot.
    const lwBefore = page.locator('[data-slot="LW"]');
    await expect(lwBefore).toHaveCount(1);

    // Switch formation to 3-5-2 and Save.
    await page.locator('[data-testid="tactics-formation-select"]').selectOption("3-5-2");
    await page.getByRole("button", { name: /save changes/i }).click();

    // After save, /tactics still shows 11 slots but LW is gone.
    await page.waitForTimeout(200);
    const afterRows = page.locator("[data-slot]");
    expect(await afterRows.count()).toBe(11);
    const lwAfter = page.locator('[data-slot="LW"]');
    await expect(lwAfter).toHaveCount(0);
    // 3-5-2 adds LWB/RWB.
    await expect(page.locator('[data-slot="LWB"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="RWB"]')).toHaveCount(1);
  });
});
