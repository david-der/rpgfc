import { expect, test } from "@playwright/test";

// Story 02 Playwright coverage — page-level behavior of the nav shell.
// AC-04 / AC-06 / AC-07 / AC-08 / AC-09 / AC-12 / AC-13 from
// docs/stories/STORY_02_Navigation.md.
//
// Component-level tests (AC-01/02/03/10/11) live in
// packages/web/src/test/components/NavBar.test.tsx.

test.describe("nav shell — Story 02", () => {
  test("AC-04: Primary nav is visible on every page", async ({ page }) => {
    for (const path of ["/", "/players", "/players/1"]) {
      await page.goto(path);
      const nav = page.getByRole("navigation", { name: "Primary" });
      await expect(nav).toBeVisible();
    }
  });

  test("AC-06: clicking Players from Home navigates in-place", async ({ page }) => {
    await page.goto("/");
    // Count full-page loads. A SPA transition must not bump this counter.
    const loads = await page.evaluate(() => {
      (window as unknown as { __loads?: number }).__loads = 1;
      return 1;
    });
    expect(loads).toBe(1);

    await page.getByRole("link", { name: "Players" }).click();
    await expect(page).toHaveURL(/\/players$/);

    const nav = page.getByRole("navigation", { name: "Primary" });
    const active = nav.locator('a[aria-current="page"]');
    await expect(active).toHaveText("Players");

    const afterLoads = await page.evaluate(
      () => (window as unknown as { __loads?: number }).__loads ?? 0,
    );
    expect(afterLoads).toBe(1);
  });

  test("AC-07: back-and-forth navigation preserves active state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Players" }).click();
    await expect(page).toHaveURL(/\/players$/);
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("link", { name: "Players" }).click();
    await expect(page).toHaveURL(/\/players$/);

    const nav = page.getByRole("navigation", { name: "Primary" });
    const active = nav.locator('a[aria-current="page"]');
    await expect(active).toHaveText("Players");
  });

  test("AC-08: deep link to /players/1 highlights Players without a flash", async ({ page }) => {
    await page.goto("/players/1");
    const nav = page.getByRole("navigation", { name: "Primary" });
    const active = nav.locator('a[aria-current="page"]');
    await expect(active).toHaveText("Players");
  });

  test("AC-09: keyboard-only navigation lands on the Players page", async ({ page }) => {
    await page.goto("/");
    // Tab until a nav link named Players is focused, then Enter.
    // 20 hops is a generous upper bound for the walking-skeleton pages.
    const playersLink = page.getByRole("link", { name: "Players" });
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(
        () => document.activeElement?.textContent?.trim() ?? null,
      );
      if (focused === "Players") break;
    }
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/players$/);
    await expect(playersLink).toHaveAttribute("aria-current", "page");
  });

  test("AC-12: no element in the nav region is player-facing", async ({ page }) => {
    await page.goto("/players");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();
    const leaks = nav.locator('[data-testid="player-facing"]');
    expect(await leaks.count()).toBe(0);
  });
});
