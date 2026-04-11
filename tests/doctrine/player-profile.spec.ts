import { expect, test } from "@playwright/test";

// Story 01 AC-18 / AC-19 / AC-20 / AC-21: the /players/$id Profile page
// composes Style Guide primitives and carries no number leaks.

const NUMBER_RE = /\b\d+(\.\d+)?\b/;

test.describe("player profile — Story 01", () => {
  test("AC-18: Profile page renders the core composition", async ({ page }) => {
    await page.goto("/players/1");

    // Club stripe at the top.
    const stripe = page.locator("[aria-hidden]").first();
    await expect(stripe).toBeVisible();

    // Serif h1 carrying the player name.
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(headingText).toBeTruthy();

    // NarrativeBlock with the current-form paragraph. Fix Spec 01 (FIX-01)
    // moved the identity prose to the hero subtitle and gave the Overview
    // body's drop cap to currentForm, so the NarrativeBlock's aria-label
    // is now "Current form".
    const narrative = page.locator('[aria-label="Current form"]').first();
    await expect(narrative).toBeVisible();

    // BadgeStack — at least the Overview panel exposes one chip.
    // Badges are inside player-facing spans; the test just needs one chip.
    const chips = page.locator("[title]").filter({ hasText: /./ });
    expect(await chips.count()).toBeGreaterThan(0);

    // TabBar with six tabs, Overview active.
    const tabs = page.locator('[role="tab"]');
    expect(await tabs.count()).toBe(6);
    const activeTab = page.locator('[role="tab"][aria-selected="true"]');
    await expect(activeTab).toHaveText("Overview");
  });

  test("AC-18: no digit leaks on player-facing elements", async ({ page }) => {
    await page.goto("/players/1");
    await page.locator("h1").waitFor();

    const playerFacing = page.locator('[data-testid="player-facing"]');
    const count = await playerFacing.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = (await playerFacing.nth(i).textContent()) ?? "";
      expect(NUMBER_RE.test(text), `player-facing element contained a digit: "${text}"`).toBe(
        false,
      );
    }
  });

  test("AC-19: tab navigation never leaks digits", async ({ page }) => {
    await page.goto("/players/1");
    await page.locator("h1").waitFor();

    const tabKeys = ["History", "Badges", "Relationships", "Contract", "Reports", "Overview"];
    for (const key of tabKeys) {
      await page.getByRole("tab", { name: key }).click();
      // Allow the tab panel to switch.
      await page.waitForTimeout(50);
      const playerFacing = page.locator('[data-testid="player-facing"]');
      const count = await playerFacing.count();
      for (let i = 0; i < count; i++) {
        const text = (await playerFacing.nth(i).textContent()) ?? "";
        expect(NUMBER_RE.test(text), `[tab=${key}] player-facing leak: "${text}"`).toBe(false);
      }
    }
  });

  test("AC-20: age is explicitly allowlisted", async ({ page }) => {
    await page.goto("/players/1");
    await page.locator("h1").waitFor();

    const age = page.locator('[data-testid="age-allowlist-number"]');
    await expect(age).toBeVisible();
    const text = (await age.textContent()) ?? "";
    // The age element must contain a digit — it's the single allowed
    // numeric surface on the profile page.
    expect(/\d/.test(text)).toBe(true);
    // And it must NOT be tagged player-facing (the allowlist suffix pulls
    // it out of the doctrine scrape).
    const ageIsPlayerFacing = await age.evaluate(
      (el) => el.getAttribute("data-testid") === "player-facing",
    );
    expect(ageIsPlayerFacing).toBe(false);
  });

  test("AC-21: Newsreader is in the heading font stack", async ({ page }) => {
    await page.goto("/players/1");
    const heading = page.locator("h1");
    const fontFamily = await heading.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily).toMatch(/Newsreader/i);
  });
});
