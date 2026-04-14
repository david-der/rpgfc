// Runtime smoke for the shared package. The real assertion is the type-only
// test in brands.test-d.ts; this file just ensures vitest has something to run
// and that the minter functions produce values of the correct runtime shape.
import { describe, expect, it } from "vitest";

import { asRenderedPlayer } from "../types/player.js";
import { asHiddenPlayer } from "../types/hidden.js";
import type { NaturalGifts, MentalTraits } from "../types/attributes.js";

const blankGifts: NaturalGifts = {
  pace: 50,
  finishing: 50,
  composure: 50,
  aerial: 50,
  tackling: 50,
  passing: 50,
  vision: 50,
  stamina: 50,
  strength: 50,
  reflexes: 50,
};

const blankTraits: MentalTraits = {
  ambition: 50,
  leadership: 50,
  temperament: 50,
  workEthic: 50,
  sociability: 50,
  riskTolerance: 50,
  professionalism: 50,
};

describe("rendering boundary brands", () => {
  it("asHiddenPlayer preserves runtime shape for the full vector", () => {
    const h = asHiddenPlayer({
      id: 1,
      runId: 1,
      clubId: null,
      name: "Juan Moreno",
      dob: "2002-03-14",
      age: 24,
      nationality: "ES",
      preferredFoot: "Left",
      archetypeId: "inverted_winger",
      hiddenAttrs: blankGifts,
      mentalTraits: blankTraits,
      badgeKeys: [],
      preferredPositions: ["LW", "ST"],
      experienceYears: 0,
      narrativeSeed: { hometown: "Málaga", story: "academy product" },
    });
    expect(h.name).toBe("Juan Moreno");
    expect(h.hiddenAttrs.pace).toBe(50);
    expect(h.badgeKeys).toEqual([]);
  });

  it("asRenderedPlayer preserves runtime shape", () => {
    const r = asRenderedPlayer({
      id: 2,
      name: "Diogo Marques",
      age: 24,
      nationality: "PT",
      preferredFoot: "Left",
      positionLabel: "LW",
      preferredPositions: ["LW", "ST"],
      club: null,
      badges: [],
      prose: { identity: "A left winger.", currentForm: "Fresh." },
      certainty: "Confident",
      experience: "Developing",
    });
    expect(r.prose.identity).toBe("A left winger.");
    expect(r.certainty).toBe("Confident");
  });
});
