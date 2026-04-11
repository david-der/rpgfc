import { expect, test } from "@playwright/test";

// Story 05 — AC-18: Tactics + Squad nav entries and their active states.

test.describe("squad + tactics nav — Story 05", () => {
  test("AC-18: Tactics and Squad entries highlight when active", async ({ page }) => {
    // Home → Tactics.
    await page.goto("/");
    await page.getByRole("link", { name: "Tactics" }).click();
    await expect(page).toHaveURL(/\/tactics$/);
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.locator('a[aria-current="page"]')).toHaveText("Tactics");

    // Tactics → Squad.
    await page.getByRole("link", { name: "Squad" }).click();
    await expect(page).toHaveURL(/\/squad$/);
    await expect(nav.locator('a[aria-current="page"]')).toHaveText("Squad");

    // Squad → Home (verify active state follows a back-nav).
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL("http://localhost:8787/");
    await expect(nav.locator('a[aria-current="page"]')).toHaveText("Home");
  });
});
