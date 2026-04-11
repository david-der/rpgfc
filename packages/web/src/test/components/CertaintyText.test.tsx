// FIX-06: CertaintyText follows the Style Guide §2.6 typography table.
// One assertion per tier on color + weight + italic. The existing
// component from Story 01 was written but never unit-tested; this test
// locks the tier treatment in so it cannot drift silently.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CertaintyTier } from "@rpgfc/shared";

import { CertaintyText } from "../../components/ui/CertaintyText";

interface TierExpectation {
  tier: CertaintyTier;
  // Tailwind class fragments the component MUST emit for each tier.
  expectedClassFragments: string[];
  unexpectedClassFragments: string[];
}

const EXPECTATIONS: TierExpectation[] = [
  {
    tier: "Certain",
    expectedClassFragments: ["text-parchment-900", "font-semibold", "not-italic"],
    unexpectedClassFragments: ["italic", "underline"],
  },
  {
    tier: "Confident",
    expectedClassFragments: ["text-parchment-700", "font-medium", "not-italic"],
    unexpectedClassFragments: ["italic", "underline"],
  },
  {
    tier: "Likely",
    expectedClassFragments: ["text-parchment-600", "font-normal", "not-italic"],
    unexpectedClassFragments: ["italic", "underline"],
  },
  {
    tier: "Speculation",
    expectedClassFragments: ["text-parchment-500", "font-normal", "italic"],
    unexpectedClassFragments: ["underline"],
  },
  {
    tier: "Unknown",
    expectedClassFragments: [
      "text-parchment-400",
      "font-normal",
      "italic",
      "underline",
      "decoration-dashed",
    ],
    unexpectedClassFragments: [],
  },
];

describe("CertaintyText — FIX-06", () => {
  for (const { tier, expectedClassFragments, unexpectedClassFragments } of EXPECTATIONS) {
    it(`renders ${tier} with the Style Guide §2.6 treatment`, () => {
      render(<CertaintyText certainty={tier}>sample prose</CertaintyText>);
      const el = screen.getByText("sample prose");
      for (const frag of expectedClassFragments) {
        expect(el.className, `missing ${frag} for ${tier}`).toContain(frag);
      }
      for (const frag of unexpectedClassFragments) {
        // Allow italic fragments only where the tier expects italic.
        if (frag === "italic" && expectedClassFragments.includes("italic")) continue;
        // The className is space-separated; tokenize and compare exactly
        // so `italic` doesn't accidentally match `not-italic`.
        const tokens = el.className.split(/\s+/);
        expect(tokens, `unexpected ${frag} for ${tier}`).not.toContain(frag);
      }
    });
  }

  it("aria-label announces the certainty tier name", () => {
    render(<CertaintyText certainty="Confident">Iván Fernández</CertaintyText>);
    const el = screen.getByText("Iván Fernández");
    const ariaLabel = el.getAttribute("aria-label") ?? "";
    expect(ariaLabel.toLowerCase()).toContain("confident");
  });
});
