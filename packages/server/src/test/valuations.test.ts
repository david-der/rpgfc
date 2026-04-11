// Story 04 AC-05 — valuation determinism.
import { describe, expect, it } from "vitest";

import { estimateValueCents } from "../application/transfers/valuations.js";

describe("estimateValueCents — Story 04 AC-05", () => {
  it("produces the same result for the same input", () => {
    const input = {
      archetypeId: "creative_ten",
      experienceYears: 7,
      badgeKeys: ["clutch_finisher", "press_resistant"],
      name: "Iván Fernández",
    };
    const a = estimateValueCents(input);
    const b = estimateValueCents(input);
    expect(a).toBe(b);
  });

  it("produces different results for different names (noise)", () => {
    const base = {
      archetypeId: "creative_ten",
      experienceYears: 7,
      badgeKeys: [] as string[],
    };
    const a = estimateValueCents({ ...base, name: "Iván Fernández" });
    const b = estimateValueCents({ ...base, name: "Diogo Marques" });
    // Name noise is ±15%, so two identical-shape players differ by a
    // strictly-positive amount.
    expect(Math.abs(a - b)).toBeGreaterThan(0);
  });

  it("scales by primary role — strikers cost more than fullbacks on average", () => {
    const shared = {
      experienceYears: 7,
      badgeKeys: [] as string[],
      name: "Same Name",
    };
    const striker = estimateValueCents({ ...shared, archetypeId: "classic_nine" });
    const fullback = estimateValueCents({ ...shared, archetypeId: "flying_fullback" });
    expect(striker).toBeGreaterThan(fullback);
  });

  it("peaks at the Developing / Established age range", () => {
    const shared = {
      archetypeId: "creative_ten",
      badgeKeys: [] as string[],
      name: "Same Name",
    };
    const rookie = estimateValueCents({ ...shared, experienceYears: 0 });
    const peak = estimateValueCents({ ...shared, experienceYears: 7 });
    const elder = estimateValueCents({ ...shared, experienceYears: 20 });
    expect(peak).toBeGreaterThan(rookie);
    expect(peak).toBeGreaterThan(elder);
  });
});
