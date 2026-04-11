import { expect, test } from "@playwright/test";

// Story 03 — /scouts and /scouts/$id Playwright coverage.
// AC-14: /scouts is reachable from the primary nav and lists 4 scouts.
// AC-15: /scouts/$id Profile composes the expected shape and leaks no
// digits inside data-testid="player-facing".

const NUMBER_RE = /\b\d+(\.\d+)?\b/;

test.describe("scouts — Story 03", () => {
  test("AC-14: Scouts entry in primary nav navigates to /scouts and lists 4 cards", async ({
    page,
  }) => {
    await page.goto("/");
    const scoutsLink = page.getByRole("link", { name: "Scouts" });
    await expect(scoutsLink).toBeVisible();
    await scoutsLink.click();
    await expect(page).toHaveURL(/\/scouts$/);

    const nav = page.getByRole("navigation", { name: "Primary" });
    const active = nav.locator('a[aria-current="page"]');
    await expect(active).toHaveText("Scouts");

    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBe(4);
  });

  test("AC-15: /scouts/$id renders the Profile shape with no player-facing digit leaks", async ({
    page,
  }) => {
    await page.goto("/scouts/1");

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(headingText).toBeTruthy();

    // TabBar has Overview + Recent reports tabs.
    const tabs = page.getByRole("tab");
    expect(await tabs.count()).toBeGreaterThanOrEqual(2);
    const activeTab = page.locator('[role="tab"][aria-selected="true"]');
    await expect(activeTab).toHaveText("Overview");

    // No player-facing digit leaks anywhere on the page.
    const playerFacing = page.locator('[data-testid="player-facing"]');
    const count = await playerFacing.count();
    for (let i = 0; i < count; i++) {
      const text = (await playerFacing.nth(i).textContent()) ?? "";
      expect(NUMBER_RE.test(text), `player-facing leak: "${text}"`).toBe(false);
    }
  });
});
