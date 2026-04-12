import { expect, test } from "@playwright/test";

// Nav shell Playwright coverage. Tests the primary nav using the
// Scouting entry (was Players before the nav rationalization).

test.describe("nav shell", () => {
  test("AC-04: Primary nav is visible on every page", async ({ page }) => {
    for (const path of ["/", "/scouts", "/players/1"]) {
      await page.goto(path);
      const nav = page.getByRole("navigation", { name: "Primary" });
      await expect(nav).toBeVisible();
    }
  });

  test("AC-06: clicking Scouting from Home navigates in-place", async ({ page }) => {
    await page.goto("/");
    const loads = await page.evaluate(() => {
      (window as unknown as { __loads?: number }).__loads = 1;
      return 1;
    });
    expect(loads).toBe(1);

    await page.getByRole("link", { name: "Scouting" }).click();
    await expect(page).toHaveURL(/\/scouts$/);

    const nav = page.getByRole("navigation", { name: "Primary" });
    const active = nav.locator('a[aria-current="page"]');
    await expect(active).toHaveText("Scouting");

    const afterLoads = await page.evaluate(
      () => (window as unknown as { __loads?: number }).__loads ?? 0,
    );
    expect(afterLoads).toBe(1);
  });

  test("AC-07: back-and-forth navigation preserves active state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Scouting" }).click();
    await expect(page).toHaveURL(/\/scouts$/);
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("link", { name: "Scouting" }).click();
    await expect(page).toHaveURL(/\/scouts$/);

    const nav = page.getByRole("navigation", { name: "Primary" });
    const active = nav.locator('a[aria-current="page"]');
    await expect(active).toHaveText("Scouting");
  });

  test("AC-08: deep link to /players/1 does not crash the nav", async ({ page }) => {
    await page.goto("/players/1");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();
  });

  test("AC-09: keyboard-only navigation lands on the Scouting page", async ({ page }) => {
    await page.goto("/");
    const scoutingLink = page.getByRole("link", { name: "Scouting" });
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(
        () => document.activeElement?.textContent?.trim() ?? null,
      );
      if (focused === "Scouting") break;
    }
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/scouts$/);
    await expect(scoutingLink).toHaveAttribute("aria-current", "page");
  });

  test("AC-12: no element in the nav region is player-facing", async ({ page }) => {
    await page.goto("/scouts");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();
    const leaks = nav.locator('[data-testid="player-facing"]');
    expect(await leaks.count()).toBe(0);
  });
});
