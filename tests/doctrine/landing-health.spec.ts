import { expect, test } from "@playwright/test";

// AC-15: the landing page calls /api/health and renders the dialect string
// inside a data-testid="health-dialect" element within 2 seconds of load.

test("landing page renders the backend dialect — Story 00 AC-15", async ({ page }) => {
  await page.goto("/");
  const dialect = page.getByTestId("health-dialect");
  await expect(dialect).toBeVisible({ timeout: 2_000 });
  await expect(dialect).toHaveText("sqlite");
});
