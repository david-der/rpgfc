// Story 01 AC-08, AC-09, AC-10 — rendering layer tests.
import { describe, expect, it } from "vitest";

import { asHiddenPlayer } from "@rpgfc/shared/types/hidden";

import { generateWorld } from "../application/generation/generate-world.js";
import { tierWordFor } from "../rendering/thesaurus.js";
import { bucketExperience } from "../rendering/experience.js";
import { renderPlayer } from "../rendering/player.js";
import type { RenderContext, RenderPlayerDeps } from "../rendering/index.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

const deps: RenderPlayerDeps = {
  findClub: (id) => ({ id, name: `Club ${id}` }),
};

function world() {
  return generateWorld({
    seed: 42,
    clubCount: 5,
    playersPerClub: 10,
    referenceDate: REFERENCE_DATE,
  });
}

describe("AC-08 — rendering prose never contains digits", () => {
  it("for every player in a seeded world at every certainty level", () => {
    const w = world();
    const players = w.clubs.flatMap((c) =>
      c.players.map((p, i) => asHiddenPlayer({ id: i + 1, ...p })),
    );

    for (const level of [0, 1, 2, 3, 4, 5]) {
      const ctx: RenderContext = { viewerScoutLevel: level, now: REFERENCE_DATE };
      for (const hidden of players) {
        const rendered = renderPlayer(hidden, ctx, deps);
        expect(
          /\d/.test(rendered.prose.identity),
          `identity prose contained a digit at level ${level}: "${rendered.prose.identity}"`,
        ).toBe(false);
        expect(
          /\d/.test(rendered.prose.currentForm),
          `form prose contained a digit at level ${level}: "${rendered.prose.currentForm}"`,
        ).toBe(false);
      }
    }
  });
});

describe("AC-09 — certainty masking", () => {
  it("low scout level yields Speculation or worse", () => {
    const w = world();
    const hidden = asHiddenPlayer({ id: 1, ...w.clubs[0]!.players[0]! });
    const rendered = renderPlayer(
      hidden,
      { viewerScoutLevel: 0, now: REFERENCE_DATE },
      deps,
    );
    expect(["Unknown", "Speculation", "Likely"]).toContain(rendered.certainty);
  });

  it("max scout level yields Certain", () => {
    const w = world();
    const hidden = asHiddenPlayer({ id: 1, ...w.clubs[0]!.players[0]! });
    const rendered = renderPlayer(
      hidden,
      { viewerScoutLevel: 5, now: REFERENCE_DATE },
      deps,
    );
    expect(rendered.certainty).toBe("Certain");
  });

  it("rendered badges carry per-badge certainty matching the viewer's tier", () => {
    const w = world();
    const playerWithBadges = w.clubs
      .flatMap((c) => c.players)
      .find((p) => p.badgeKeys.length > 0);
    expect(playerWithBadges).toBeDefined();
    const hidden = asHiddenPlayer({ id: 1, ...playerWithBadges! });

    const rendered = renderPlayer(
      hidden,
      { viewerScoutLevel: 5, now: REFERENCE_DATE },
      deps,
    );
    for (const badge of rendered.badges) {
      expect(badge.certainty).toBe("Certain");
    }
  });
});

describe("AC-10 — thesaurus consistency", () => {
  it("same input always produces the same word", () => {
    for (let v = 0; v <= 100; v += 5) {
      const a = tierWordFor("pace", v, "fine");
      const b = tierWordFor("pace", v, "fine");
      expect(a).toBe(b);
    }
  });

  it("fine precision uses all 6 tier words for pace across the value range", () => {
    const seen = new Set<string>();
    for (let v = 0; v <= 100; v++) {
      seen.add(tierWordFor("pace", v, "fine"));
    }
    expect(seen.size).toBe(6);
  });

  it("coarse precision uses 3 words for pace", () => {
    const seen = new Set<string>();
    for (let v = 0; v <= 100; v++) {
      seen.add(tierWordFor("pace", v, "coarse"));
    }
    expect(seen.size).toBe(3);
  });
});

describe("experience bucketing", () => {
  it("walks through all five tiers as years increase", () => {
    expect(bucketExperience(0)).toBe("Rookie");
    expect(bucketExperience(3)).toBe("Developing");
    expect(bucketExperience(7)).toBe("Established");
    expect(bucketExperience(12)).toBe("Veteran");
    expect(bucketExperience(18)).toBe("Elder");
  });
});

describe("renderPlayer composes all the pieces", () => {
  it("populates every RenderedPlayer field", () => {
    const w = world();
    const hidden = asHiddenPlayer({ id: 7, ...w.clubs[0]!.players[0]! });
    const rendered = renderPlayer(
      hidden,
      { viewerScoutLevel: 3, now: REFERENCE_DATE },
      { findClub: () => ({ id: 1, name: "Real Madrid" }) },
    );
    expect(rendered.id).toBe(7);
    expect(rendered.name).toBe(hidden.name);
    expect(rendered.age).toBeGreaterThanOrEqual(17);
    expect(rendered.positionLabel.length).toBeGreaterThan(0);
    expect(rendered.prose.identity.length).toBeGreaterThan(10);
    expect(rendered.prose.currentForm.length).toBeGreaterThan(10);
    expect(rendered.certainty).toBe("Confident");
    expect(rendered.experience).toBeDefined();
  });
});
