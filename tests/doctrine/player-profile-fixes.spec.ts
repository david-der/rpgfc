import { expect, test } from "@playwright/test";

// Fix Spec 01 — Playwright-level verification for the six craft fixes
// landed on top of Story 01. Each test maps to a FIX in
// docs/stories/RPG_FC_Fix_Spec_01_Player_Profile.docx.
//
// The component-level tests in packages/web/src/test/components/ cover the
// per-primitive behavior (KeyNumber typography, TabBar font, TierPill
// variants, CertaintyText tier styling). The tests in this file verify
// the fixes hold at the rendered-page level against the real Hono bundle.

test.describe("fix spec 01 — player profile", () => {
  test("FIX-01: identity line appears exactly once", async ({ page }) => {
    await page.goto("/players/1");
    await page.locator("h1").waitFor();

    // Grab the identity prose from the hero subtitle (the element directly
    // after the h1 heading).
    const heroSubtitle = page.locator("h1 ~ p").first();
    await expect(heroSubtitle).toBeVisible();
    const identity = (await heroSubtitle.textContent())?.trim();
    expect(identity).toBeTruthy();

    // Now count how many elements on the page contain that exact string.
    // Must be exactly one — otherwise the Overview body is duplicating it.
    const matches = page.getByText(identity as string, { exact: true });
    expect(await matches.count()).toBe(1);
  });

  test("FIX-02: Facts list has no Experience row", async ({ page }) => {
    await page.goto("/players/1");
    await page.locator('[data-testid="player-facts"]').waitFor();

    const facts = page.locator('[data-testid="player-facts"]');
    const dtTexts = await facts.locator("dt").allTextContents();
    expect(dtTexts).not.toContain("Experience");

    // Defence in depth: no dd in the facts list should contain any
    // ExperienceTier literal.
    const tiers = ["Rookie", "Developing", "Established", "Veteran", "Elder"];
    const ddTexts = await facts.locator("dd").allTextContents();
    for (const tierWord of tiers) {
      for (const dd of ddTexts) {
        expect(
          dd.toLowerCase(),
          `Facts dd contained experience tier "${tierWord}": "${dd}"`,
        ).not.toContain(tierWord.toLowerCase());
      }
    }
  });

  test("FIX-03: age element width is stable across profiles", async ({ page }) => {
    // Navigate to two different profiles and compare the bounding-box
    // width of the age element. If font-mono + tabular-nums is working,
    // the width should be identical between players even though the
    // actual age digits are different.
    await page.goto("/players/1");
    const ageA = page.locator('[data-testid="age-allowlist-number"]');
    await expect(ageA).toBeVisible();
    const widthA = (await ageA.boundingBox())?.width ?? 0;
    expect(widthA).toBeGreaterThan(0);

    await page.goto("/players/42");
    const ageB = page.locator('[data-testid="age-allowlist-number"]');
    await expect(ageB).toBeVisible();
    const widthB = (await ageB.boundingBox())?.width ?? 0;
    expect(widthB).toBeGreaterThan(0);

    // Allow a tolerance of 1px for anti-aliasing rounding, but the
    // tabular-nums guarantee is that the width should be essentially
    // identical. Two-digit numbers should always land at the same width.
    expect(Math.abs(widthA - widthB)).toBeLessThanOrEqual(1);
  });

  test("FIX-04: TabBar labels render in Inter, not Newsreader", async ({ page }) => {
    await page.goto("/players/1");
    const tabs = page.getByRole("tab");
    expect(await tabs.count()).toBeGreaterThan(0);
    const firstTab = tabs.first();
    const fontFamily = await firstTab.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily).toMatch(/Inter/i);
    expect(fontFamily).not.toMatch(/Newsreader/i);
  });

  test("FIX-05: hero TierPill is muted, not saturated", async ({ page }) => {
    await page.goto("/players/1");
    await page.locator("h1").waitFor();

    // The TierPill is the sibling of the Career label in the hero; find
    // it by its uppercase experience-tier text.
    const tiers = ["Rookie", "Developing", "Established", "Veteran", "Elder"];
    let pill = null;
    for (const tier of tiers) {
      const candidate = page.locator("span", { hasText: new RegExp(`^${tier}$`, "i") }).first();
      if (await candidate.count()) {
        pill = candidate;
        break;
      }
    }
    expect(pill, "could not locate the TierPill in the hero").not.toBeNull();

    const { bg, color, borderWidth } = await pill!.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        borderWidth: cs.borderTopWidth,
      };
    });
    // Muted variant: parchment-50 background (#FAF7F0 = rgb(250, 247, 240)),
    // NOT the saturated moss-500 fill (#5C6B33 = rgb(92, 107, 51)).
    expect(bg).not.toBe("rgb(92, 107, 51)");
    expect(bg).toBe("rgb(250, 247, 240)");
    // moss-700 text (#363F1E = rgb(54, 63, 30)).
    expect(color).toBe("rgb(54, 63, 30)");
    // 1px border.
    expect(borderWidth).toBe("1px");
  });

  test("FIX-06: overall CertaintyText is visible in the hero", async ({ page }) => {
    await page.goto("/players/1");
    const certainty = page.locator('[data-testid="player-certainty"]');
    await expect(certainty).toBeVisible();
    const text = (await certainty.textContent()) ?? "";
    // The label should call out known + one of the five tiers.
    const tiers = ["Certain", "Confident", "Likely", "Speculation", "Unknown"];
    const hasTier = tiers.some((t) => text.includes(t));
    expect(hasTier, `hero certainty line did not name a tier: "${text}"`).toBe(true);
  });
});
