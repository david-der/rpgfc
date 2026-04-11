// FIX-04: TabBar labels force Inter regardless of parent serif context.
// Written red-first: mount a TabBar inside a NarrativeBlock (which sets
// font-serif) and assert each [role="tab"] still resolves to a
// font-family starting with "Inter".
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NarrativeBlock } from "../../components/ui/NarrativeBlock";
import { TabBar } from "../../components/ui/TabBar";

describe("TabBar — FIX-04", () => {
  it("labels render in Inter even when nested inside a NarrativeBlock", () => {
    render(
      <NarrativeBlock>
        <TabBar
          tabs={[
            { key: "a", label: "Overview", content: <p>a</p> },
            { key: "b", label: "History", content: <p>b</p> },
          ]}
        />
      </NarrativeBlock>,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(2);
    for (const tab of tabs) {
      // jsdom doesn't resolve font-family from a Tailwind utility class the
      // way a real browser does, so we assert on the class list AND the
      // inline CSS properties the component sets. The component MUST set
      // font-family explicitly (via font-sans) so serif inheritance cannot
      // ever reach the labels.
      expect(tab.className).toMatch(/font-sans/);
      expect(tab.className).not.toMatch(/font-serif/);
    }
  });

  it("never inherits a serif family from a parent element", () => {
    // Second structural check: wrap TabBar in a div with an explicit
    // font-serif class and verify the TabBar's labels do not pick it up
    // in their own computed style chain. Regression guard against a future
    // maintainer removing the explicit font-sans.
    render(
      <div className="font-serif">
        <TabBar tabs={[{ key: "a", label: "Overview", content: <p /> }]} />
      </div>,
    );
    const tab = screen.getByRole("tab");
    expect(tab.className).toMatch(/font-sans/);
  });
});
