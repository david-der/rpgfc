// Runtime smoke for the shared package. The real assertion is the type-only
// test in brands.test-d.ts; this file just ensures vitest has something to run
// and that the minter functions produce values of the correct runtime shape.
import { describe, expect, it } from "vitest";
import { asHiddenPlayer } from "../types/hidden.js";
import { asRenderedPlayer } from "../types/player.js";

describe("rendering boundary brands", () => {
  it("asHiddenPlayer preserves runtime shape", () => {
    const h = asHiddenPlayer({ id: 1, name: "Juan Moreno" });
    expect(h).toEqual({ id: 1, name: "Juan Moreno" });
  });

  it("asRenderedPlayer preserves runtime shape", () => {
    const r = asRenderedPlayer({
      id: 2,
      name: "Diogo Marques",
      badges: [],
      certainty: "Likely",
    });
    expect(r).toEqual({
      id: 2,
      name: "Diogo Marques",
      badges: [],
      certainty: "Likely",
    });
  });
});
