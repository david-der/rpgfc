import { expect, test } from "@playwright/test";

// Story 04 doctrine: the no-numbers rule extends to currency.
//
// No `£`, `$`, `€`, or `¥` anywhere on any player-facing surface. The
// wire invariant is already enforced by a server-side test (routes'
// JSON bodies contain no "cents" substring and only tier words), and
// the UI's ContractCard / BidComposer / ListingCard all render tier
// words rather than raw sums. This spec is the belt-and-suspenders
// check that walks the real page and fails loudly if any symbol slips
// through.

const CURRENCY_GLYPH_RE = /[£$€¥]/;

test.describe("no-currency-glyphs — Story 04", () => {
  const routes = ["/", "/players", "/players/1", "/transfers", "/transfers/1", "/fixtures", "/squad", "/tactics"];
  for (const route of routes) {
    test(`no currency glyph on ${route}`, async ({ page }) => {
      await page.goto(route);
      // Give the page a beat to hydrate if it has data-dependent
      // content (transfers listings, player profile, etc.).
      await page.waitForTimeout(200);
      const bodyText = (await page.locator("body").textContent()) ?? "";
      expect(
        CURRENCY_GLYPH_RE.test(bodyText),
        `currency glyph found on ${route}: "${bodyText.slice(0, 200)}"`,
      ).toBe(false);
    });
  }
});
