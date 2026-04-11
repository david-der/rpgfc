// FIX-03: Age / any displayed number renders in JetBrains Mono with
// tabular-nums. Written before the component change so the initial run
// shows the serif violation in red. After the change:
//   font-family begins with "JetBrains Mono"
//   font-feature-settings contains "tnum"
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KeyNumber } from "../../components/ui/KeyNumber";

describe("KeyNumber — FIX-03", () => {
  it("renders the value in JetBrains Mono with tabular-nums", () => {
    render(<KeyNumber value={27} label="Age" allowlistReason="age" />);
    // The value span carries the data-testid for the doctrine suite.
    const el = screen.getByTestId("age-allowlist-number");
    const styles = getComputedStyle(el);
    expect(styles.fontFamily).toMatch(/JetBrains Mono/i);
    // jsdom doesn't compute font-variant-numeric from Tailwind class names,
    // so assert the class is present as a proxy.
    expect(el.className).toMatch(/tabular-nums/);
    expect(el.className).toMatch(/font-mono/);
    // Must NOT carry font-serif any more.
    expect(el.className).not.toMatch(/font-serif/);
  });

  it("includes a label sibling", () => {
    render(<KeyNumber value={27} label="Age" allowlistReason="age" />);
    expect(screen.getByText(/age/i)).toBeInTheDocument();
  });
});
