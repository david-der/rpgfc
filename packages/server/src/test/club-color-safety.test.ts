// Story 03 AC-03: every seeded club pair must clear WCAG AA against the
// parchment-50 page background.
import { describe, expect, it } from "vitest";

import { CLUB_PALETTES, PARCHMENT_50, contrastRatio } from "../application/clubs/palette.js";

describe("club palette color safety — Story 03 AC-03", () => {
  it("every palette's primary color clears WCAG AA against parchment-50", () => {
    for (const palette of CLUB_PALETTES) {
      const ratio = contrastRatio(palette.primary, PARCHMENT_50);
      expect(
        ratio,
        `${palette.id} primary ${palette.primary} contrast against parchment-50 is ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("every palette's stripe color clears WCAG AA against parchment-50", () => {
    for (const palette of CLUB_PALETTES) {
      const ratio = contrastRatio(palette.stripe, PARCHMENT_50);
      expect(
        ratio,
        `${palette.id} stripe ${palette.stripe} contrast against parchment-50 is ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("primary-ink pairs clear 4.5:1 for readable text on fills", () => {
    for (const palette of CLUB_PALETTES) {
      const ratio = contrastRatio(palette.primary, palette.primaryInk);
      expect(
        ratio,
        `${palette.id} primary ${palette.primary} vs ink ${palette.primaryInk}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("palette pool has at least 10 distinct entries", () => {
    const ids = new Set(CLUB_PALETTES.map((p) => p.id));
    expect(ids.size).toBeGreaterThanOrEqual(10);
    expect(ids.size).toBe(CLUB_PALETTES.length);
  });
});
