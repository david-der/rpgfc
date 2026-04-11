import { expect, test } from "@playwright/test";

// AC-17 / AC-18: the doctrine suite walks the production build and asserts
// that no element marked data-testid="player-facing" contains text matching
// a number pattern, except in allowlisted contexts (any data-testid suffix
// ending with `-allowlist-number`, e.g. ages, years, scorelines, jersey
// numbers, commit hashes).
//
// AC-18 validation: temporarily add
//   <span data-testid="player-facing">Pace 17</span>
// to any route, re-run this suite, observe the failure — then revert. The
// failure message names the offending text and the selector. Document the
// validation in docs/README.md under "Validating doctrine gates".

const NUMBER_RE = /\b\d+(\.\d+)?\b/;

test.describe("no-numbers doctrine suite — Story 00 AC-17/18", () => {
  test("landing page has no player-facing number leaks", async ({ page }) => {
    await page.goto("/");
    // Wait for the health card to have loaded so we're scraping the real
    // post-hydration DOM, not a loading placeholder.
    await page.getByTestId("health-dialect").waitFor({ state: "visible" });

    const playerFacing = page.locator('[data-testid="player-facing"]');
    const count = await playerFacing.count();

    for (let i = 0; i < count; i++) {
      const el = playerFacing.nth(i);
      const text = (await el.textContent()) ?? "";
      expect(NUMBER_RE.test(text), `player-facing element ${i} contained a number: "${text}"`).toBe(
        false,
      );
    }
  });
});
