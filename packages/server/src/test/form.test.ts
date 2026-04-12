// Story 06 AC-10, AC-11 — recentFormFor / bucketForm pure-function
// behavior.

import { describe, expect, it } from "vitest";

import { bucketForm } from "../application/players/form.js";

describe("bucketForm — Story 06", () => {
  it("AC-10: averages [Excellent, Good, Average, Average, Poor] → Average", () => {
    // Weights: 4+3+2+2+1 = 12, avg 2.4, rounded → bucket 2 → Average.
    expect(bucketForm([4, 3, 2, 2, 1])).toBe("Average");
  });

  it("five Excellents → Excellent", () => {
    expect(bucketForm([4, 4, 4, 4, 4])).toBe("Excellent");
  });

  it("five Dreadfuls → Dreadful", () => {
    expect(bucketForm([0, 0, 0, 0, 0])).toBe("Dreadful");
  });

  it("a single recent Excellent → Excellent", () => {
    expect(bucketForm([4])).toBe("Excellent");
  });

  it("AC-11: empty list → Average (the neutral default)", () => {
    expect(bucketForm([])).toBe("Average");
  });

  it("symmetric mix [Excellent, Dreadful, Average] → Average", () => {
    expect(bucketForm([4, 0, 2])).toBe("Average");
  });

  it("[Good, Good, Good, Good, Average] → Good", () => {
    expect(bucketForm([3, 3, 3, 3, 2])).toBe("Good");
  });
});
