import { expect, test } from "@playwright/test";

// Story 03 AC-16: the Reports tab on /players/$id renders ScoutReportCard
// instances after observation ticks have populated the knowledge graph.
//
// The flow exercised here:
//   1. Navigate to /scouts/1 (Henri Lavigne).
//   2. Use the AssignmentPicker to start a Player Focus on player 1.
//   3. Click "Run observation tick" twice to write reports.
//   4. Navigate to /players/1, click the Reports tab, and assert at
//      least one scout-report-card is visible.

test("AC-16: Reports tab populates after a focus + tick + tick flow", async ({ page }) => {
  await page.goto("/scouts/1");
  await page.locator("h1").waitFor();

  // Start Player Focus on player id 1.
  const playerRadio = page.getByLabel("Player Focus");
  await playerRadio.check();
  // Player id input defaults to 1; just submit.
  const startButton = page.getByRole("button", { name: "Start" });
  await expect(startButton).toBeEnabled();
  await startButton.click();

  // Wait for the active assignment summary to update.
  await expect(page.locator("text=Player Focus").first()).toBeVisible();

  // Run two observation ticks.
  const tickButton = page.getByRole("button", { name: /observation tick/i });
  await tickButton.click();
  // Allow the mutation success state to settle.
  await page.waitForTimeout(150);
  await tickButton.click();
  await page.waitForTimeout(150);

  // Now check the Reports tab on the player profile.
  await page.goto("/players/1");
  await page.locator("h1").waitFor();
  await page.getByRole("tab", { name: "Reports" }).click();

  const reportCards = page.locator('[data-testid="scout-report-card"]');
  await expect(reportCards.first()).toBeVisible();
  expect(await reportCards.count()).toBeGreaterThanOrEqual(1);
});
