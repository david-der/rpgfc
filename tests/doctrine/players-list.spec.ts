import { expect, test } from "@playwright/test";

// Story 01 AC-17: /players renders a list of PlayerIdentityCards and leaks
// no digits on any data-testid="player-facing" element.

const NUMBER_RE = /\b\d+(\.\d+)?\b/;

test("players list — AC-17", async ({ page }) => {
  await page.goto("/players");

  // Wait for TanStack Query to resolve the list.
  const firstCard = page.locator("article").first();
  await firstCard.waitFor({ state: "visible" });

  // At least three cards visible.
  const cardCount = await page.locator("article").count();
  expect(cardCount).toBeGreaterThanOrEqual(3);

  // Scrape every player-facing element. None may contain a digit.
  const playerFacing = page.locator('[data-testid="player-facing"]');
  const count = await playerFacing.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const text = (await playerFacing.nth(i).textContent()) ?? "";
    expect(NUMBER_RE.test(text), `player-facing element ${i} contained a digit: "${text}"`).toBe(
      false,
    );
  }
});
