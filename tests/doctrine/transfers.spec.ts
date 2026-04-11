import { expect, test } from "@playwright/test";

// Story 04 — /transfers + /transfers/$playerId + Contract tab.
// AC-15, AC-16, AC-17, AC-18.
//
// The currency-glyph invariant ($, £, €) is exercised here as a
// separate test so a regression on the wire surfaces with a clear
// failure message.

const NUMBER_RE = /\b\d+(\.\d+)?\b/;
const CURRENCY_GLYPH_RE = /[£$€¥]/;

test.describe("transfers — Story 04", () => {
  test("AC-15: /transfers lists at least 5 listings with no digit leaks", async ({ page }) => {
    await page.goto("/transfers");
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(5);

    // Scrape every player-facing element. No digits allowed except the
    // age allowlist.
    const playerFacing = page.locator('[data-testid="player-facing"]');
    const count = await playerFacing.count();
    for (let i = 0; i < count; i++) {
      const text = (await playerFacing.nth(i).textContent()) ?? "";
      expect(NUMBER_RE.test(text), `leak at listing elt ${i}: "${text}"`).toBe(false);
    }

    // And no currency glyphs anywhere in the page body.
    const bodyText = (await page.locator("body").textContent()) ?? "";
    expect(
      CURRENCY_GLYPH_RE.test(bodyText),
      `currency glyph on /transfers: ${bodyText.slice(0, 200)}`,
    ).toBe(false);
  });

  test("AC-16: /transfers/$playerId shows the BidComposer", async ({ page }) => {
    await page.goto("/transfers/1");
    const composer = page.locator('[data-testid="bid-composer"]');
    await expect(composer).toBeVisible();
    // Three tier selects + one role select.
    await expect(page.locator('[data-testid="bid-fee-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="bid-wage-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="bid-role-select"]')).toBeVisible();
  });

  test("AC-17: happy-path force-accept surfaces a ContractCard on the profile", async ({
    page,
  }) => {
    // Pick the first listing.
    await page.goto("/transfers");
    const firstCard = page.locator("article").first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    // On the player-scoped transfer page, submit a Significant/Significant
    // bid so the evaluator path is consistent.
    await page.locator('[data-testid="bid-composer"]').waitFor();
    await page.locator('[data-testid="bid-fee-select"]').selectOption("Significant");
    await page.locator('[data-testid="bid-wage-select"]').selectOption("Significant");
    await page.locator('[data-testid="bid-role-select"]').selectOption("Star Player");
    await page.getByRole("button", { name: /submit offer/i }).click();

    // Wait for the bid-result ribbon.
    const ribbon = page.locator('[data-testid="bid-result"]');
    await expect(ribbon).toBeVisible();

    // If the happy path didn't land Signed on the first pass, use
    // force-accept.
    const state = await ribbon.locator("div").nth(1).textContent();
    if (!state?.trim().startsWith("SIGNED")) {
      await page.getByRole("button", { name: /force accept/i }).click();
      await page.waitForTimeout(200);
    }

    // The URL for the profile we just moved is inferrable from /transfers/N.
    const url = page.url();
    const match = url.match(/\/transfers\/(\d+)/);
    expect(match).not.toBeNull();
    const playerId = match![1]!;

    await page.goto(`/players/${playerId}`);
    await page.locator("h1").waitFor();
    await page.getByRole("tab", { name: "Contract" }).click();

    // Either the card is visible, or the "no contract" placeholder
    // shows — the force-accept above always produces a contract, but
    // if Playwright's in-memory DB didn't carry state between requests
    // we still assert structural correctness.
    const card = page.locator("article").filter({ hasText: /seasons left/i });
    await expect(card).toBeVisible();
    // AC-17 secondary: the seasons-left numeric surface is the ONLY
    // allowlisted number on the Contract tab.
    const seasons = page.locator('[data-testid="seasons-remaining-allowlist-number"]');
    await expect(seasons).toBeVisible();
  });

  test("AC-18: Transfers entry highlights on /transfers and deeper routes", async ({ page }) => {
    // Home → Transfers → /transfers/1.
    await page.goto("/");
    await page.getByRole("link", { name: "Transfers" }).click();
    await expect(page).toHaveURL(/\/transfers$/);
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.locator('a[aria-current="page"]')).toHaveText("Transfers");

    // Deep-link to /transfers/1 — Transfers stays active.
    await page.goto("/transfers/1");
    await expect(nav.locator('a[aria-current="page"]')).toHaveText("Transfers");
  });
});
