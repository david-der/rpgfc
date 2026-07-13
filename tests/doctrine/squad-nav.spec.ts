import { expect, test } from "@playwright/test";

// Story 05 — AC-18: Tactics + Squad nav entries and their active states.

test.describe("squad + tactics nav — Story 05", () => {
  test("AC-18: Tactics and Squad entries highlight when active", async ({ page }) => {
    // Home → Tactics.
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await nav.getByRole("link", { name: "Tactics", exact: true }).click();
    await expect(page).toHaveURL(/\/tactics$/);
    await expect(nav.locator('a[aria-current="page"]')).toHaveText("Tactics");

    // Tactics → Squad.
    await nav.getByRole("link", { name: "Squad", exact: true }).click();
    await expect(page).toHaveURL(/\/squad$/);
    await expect(nav.locator('a[aria-current="page"]')).toHaveText("Squad");

    // Squad → Home (verify active state follows a back-nav).
    await nav.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL("http://localhost:8787/");
    await expect(nav.locator('a[aria-current="page"]')).toHaveText("Home");
  });
});
