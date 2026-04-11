// FIX-05: TierPill defaults to muted; solid is opt-in.
// Muted = 1px moss-500 border + parchment-50 bg + moss-700 text.
// Solid  = moss-500 bg + moss-500 border + parchment-50 text.
// Both variants stay zero-radius, no shadow.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TierPill } from "../../components/ui/TierPill";

describe("TierPill — FIX-05", () => {
  it("default variant is muted", () => {
    render(<TierPill label="Veteran" tier="Veteran" />);
    const pill = screen.getByText("Veteran");
    // Muted signature: parchment-50 background, moss-700 text, moss-500 border.
    expect(pill.className).toMatch(/bg-parchment-50/);
    expect(pill.className).toMatch(/text-moss-700/);
    expect(pill.className).toMatch(/border-moss-500/);
    // Must not default to a saturated moss fill.
    expect(pill.className).not.toMatch(/bg-moss-500/);
  });

  it("solid variant opts in to the fully saturated look", () => {
    render(<TierPill label="Veteran" tier="Veteran" variant="solid" />);
    const pill = screen.getByText("Veteran");
    expect(pill.className).toMatch(/bg-moss-500/);
    expect(pill.className).toMatch(/text-parchment-50/);
  });

  it("both variants keep zero radius and no shadow", () => {
    const { rerender } = render(<TierPill label="Veteran" tier="Veteran" />);
    let pill = screen.getByText("Veteran");
    // Sharp edges: no rounded-* utility except rounded-full (not relevant here).
    expect(pill.className).not.toMatch(/\brounded-(sm|md|lg|xl|2xl|3xl|full)\b/);
    expect(pill.className).not.toMatch(/\bshadow(-sm|-md|-lg|-xl|-2xl)?\b/);

    rerender(<TierPill label="Veteran" tier="Veteran" variant="solid" />);
    pill = screen.getByText("Veteran");
    expect(pill.className).not.toMatch(/\brounded-(sm|md|lg|xl|2xl|3xl|full)\b/);
    expect(pill.className).not.toMatch(/\bshadow(-sm|-md|-lg|-xl|-2xl)?\b/);
  });

  it("carries the 1px border in the muted case", () => {
    render(<TierPill label="Veteran" tier="Veteran" />);
    const pill = screen.getByText("Veteran");
    expect(pill.className).toMatch(/\bborder\b/);
  });
});
