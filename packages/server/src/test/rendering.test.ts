// Story 01 + Story 03 — rendering layer tests.
//
// Story 03 replaced the synthetic viewerScoutLevel with a real knowledge
// graph snapshot on RenderContext. The AC-08 / AC-09 / AC-10 contracts
// from Story 01 still hold; the test fixtures just speak to the new
// snapshot shape instead of the old level integer.
import { describe, expect, it } from "vitest";

import type { CertaintyTier, ClubColors } from "@rpgfc/shared";
import { asHiddenPlayer } from "@rpgfc/shared/types/hidden";

import { generateWorld } from "../application/generation/generate-world.js";
import { tierWordFor } from "../rendering/thesaurus.js";
import { bucketExperience } from "../rendering/experience.js";
import type { FactObservation, PlayerKnowledge } from "../rendering/knowledge.js";
import { renderPlayer } from "../rendering/player.js";
import type { RenderContext, RenderPlayerDeps } from "../rendering/index.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

const STUB_COLORS: ClubColors = {
  primary: "#5C6B33",
  secondary: "#865732",
  stripe: "#363F1E",
  primaryInk: "#FAF7F0",
  secondaryInk: "#FAF7F0",
};

const deps: RenderPlayerDeps = {
  findClub: (id) => ({
    id,
    name: `Club ${id}`,
    nationality: "ES",
    reputation: "Regional",
    colors: STUB_COLORS,
  }),
};

function world() {
  return generateWorld({
    seed: 42,
    clubCount: 5,
    playersPerClub: 10,
    referenceDate: REFERENCE_DATE,
  });
}

// Build a deterministic knowledge snapshot at a chosen overall tier.
// Story 03's aggregateOverallCertainty takes the min of max-per-fact-type,
// so a snapshot with one Certain fact across each fact type yields the
// requested ceiling.
function snapshotAtTier(playerId: number, tier: CertaintyTier): PlayerKnowledge {
  const observation = (factType: string, factKey: string): FactObservation => ({
    factType,
    factKey,
    factValueTier: "tier",
    certainty: tier,
    observedAt: REFERENCE_DATE.toISOString(),
    sourceScoutId: 1,
  });
  const all: FactObservation[] = [
    observation("natural_gift_tier", "pace"),
    observation("mental_trait_tier", "leadership"),
    observation("badge_presence", "clutch_finisher"),
    observation("club_membership", "current_club"),
  ];
  const best = new Map<string, FactObservation>();
  for (const fact of all) best.set(`${fact.factType}:${fact.factKey}`, fact);
  return { playerId, all, best };
}

describe("AC-08 — rendering prose never contains digits", () => {
  it("for every player in a seeded world at every certainty level", () => {
    const w = world();
    const players = w.clubs.flatMap((c) =>
      c.players.map((p, i) => asHiddenPlayer({ id: i + 1, ...p })),
    );

    const tiers: CertaintyTier[] = ["Unknown", "Speculation", "Likely", "Confident", "Certain"];
    for (const tier of tiers) {
      for (const hidden of players) {
        const ctx: RenderContext = {
          now: REFERENCE_DATE,
          knowledge: snapshotAtTier(hidden.id, tier),
        };
        const rendered = renderPlayer(hidden, ctx, deps);
        expect(
          /\d/.test(rendered.prose.identity),
          `identity prose contained a digit at tier ${tier}: "${rendered.prose.identity}"`,
        ).toBe(false);
        expect(
          /\d/.test(rendered.prose.currentForm),
          `form prose contained a digit at tier ${tier}: "${rendered.prose.currentForm}"`,
        ).toBe(false);
      }
    }
  });
});

describe("AC-09 — certainty is driven by the knowledge snapshot", () => {
  it("renders an unobserved external player neutrally without leaking badges", () => {
    const w = world();
    const playerWithBadges = w.clubs.flatMap((c) => c.players).find((p) => p.badgeKeys.length > 0);
    expect(playerWithBadges).toBeDefined();
    const hidden = asHiddenPlayer({ id: 1, ...playerWithBadges!, clubId: 2 });
    const empty: PlayerKnowledge = { playerId: 1, all: [], best: new Map() };

    const rendered = renderPlayer(
      hidden,
      { now: REFERENCE_DATE, knowledge: empty, viewerClubId: 1 },
      deps,
    );

    expect(rendered.certainty).toBe("Unknown");
    expect(rendered.badges).toEqual([]);
    expect(rendered.prose.identity).toContain("defining qualities remain unclear");
  });

  it("renders the scout's observed gift wording even when it contradicts hidden truth", () => {
    const w = world();
    const hidden = asHiddenPlayer({
      id: 1,
      ...w.clubs[0]!.players[0]!,
      clubId: 2,
      hiddenAttrs: {
        pace: 100,
        finishing: 0,
        composure: 0,
        aerial: 0,
        tackling: 0,
        passing: 0,
        vision: 0,
        stamina: 0,
        strength: 0,
        reflexes: 0,
      },
    });
    const observed = snapshotAtTier(1, "Confident");
    observed.all = [];
    observed.best = new Map();
    const fact: FactObservation = {
      factType: "natural_gift_tier",
      factKey: "passing",
      factValueTier: "otherworldly",
      certainty: "Confident",
      observedAt: REFERENCE_DATE.toISOString(),
      sourceScoutId: 1,
    };
    observed.all.push(fact);
    observed.best.set("natural_gift_tier:passing", fact);

    const rendered = renderPlayer(
      hidden,
      { now: REFERENCE_DATE, knowledge: observed, viewerClubId: 1 },
      deps,
    );

    expect(rendered.certainty).toBe("Confident");
    expect(rendered.prose.identity).toContain("otherworldly distribution");
    expect(rendered.prose.identity).not.toContain("pace");
  });

  it("renders observed-present badges without checking hidden truth and omits observed-absent badges", () => {
    const w = world();
    const hidden = asHiddenPlayer({
      id: 1,
      ...w.clubs[0]!.players[0]!,
      clubId: 2,
      badgeKeys: [],
    });
    const knowledge: PlayerKnowledge = { playerId: 1, all: [], best: new Map() };
    const present: FactObservation = {
      factType: "badge_presence",
      factKey: "clutch_finisher",
      factValueTier: "present",
      certainty: "Likely",
      observedAt: REFERENCE_DATE.toISOString(),
      sourceScoutId: 1,
    };
    const absent: FactObservation = {
      factType: "badge_presence",
      factKey: "press_resistant",
      factValueTier: "absent",
      certainty: "Certain",
      observedAt: REFERENCE_DATE.toISOString(),
      sourceScoutId: 1,
    };
    knowledge.all.push(present, absent);
    knowledge.best.set("badge_presence:clutch_finisher", present);
    knowledge.best.set("badge_presence:press_resistant", absent);

    const rendered = renderPlayer(
      hidden,
      { now: REFERENCE_DATE, knowledge, viewerClubId: 1 },
      deps,
    );

    expect(rendered.badges.map((badge) => badge.key)).toEqual(["clutch_finisher"]);
    expect(rendered.badges[0]?.certainty).toBe("Likely");
  });

  it("gives the managed club a detailed Certain projection", () => {
    const w = world();
    const playerWithBadges = w.clubs.flatMap((c) => c.players).find((p) => p.badgeKeys.length > 0);
    expect(playerWithBadges).toBeDefined();
    const hidden = asHiddenPlayer({ id: 1, ...playerWithBadges!, clubId: 1 });
    const empty: PlayerKnowledge = { playerId: 1, all: [], best: new Map() };

    const rendered = renderPlayer(
      hidden,
      { now: REFERENCE_DATE, knowledge: empty, viewerClubId: 1 },
      deps,
    );

    expect(rendered.certainty).toBe("Certain");
    expect(rendered.badges.map((badge) => badge.key)).toEqual(hidden.badgeKeys);
    expect(rendered.badges.every((badge) => badge.certainty === "Certain")).toBe(true);
    expect(rendered.prose.identity).not.toContain("defining qualities remain unclear");
  });

  it("an empty snapshot yields Unknown", () => {
    const w = world();
    const hidden = asHiddenPlayer({ id: 1, ...w.clubs[0]!.players[0]! });
    const empty: PlayerKnowledge = { playerId: 1, all: [], best: new Map() };
    const rendered = renderPlayer(hidden, { now: REFERENCE_DATE, knowledge: empty }, deps);
    expect(rendered.certainty).toBe("Unknown");
  });

  it("a fully-Certain snapshot yields Certain overall", () => {
    const w = world();
    const hidden = asHiddenPlayer({ id: 1, ...w.clubs[0]!.players[0]! });
    const ctx: RenderContext = {
      now: REFERENCE_DATE,
      knowledge: snapshotAtTier(1, "Certain"),
    };
    const rendered = renderPlayer(hidden, ctx, deps);
    expect(rendered.certainty).toBe("Certain");
  });

  it("rendered badges fall back to overall certainty when no per-badge observation exists", () => {
    const w = world();
    const playerWithBadges = w.clubs.flatMap((c) => c.players).find((p) => p.badgeKeys.length > 0);
    expect(playerWithBadges).toBeDefined();
    const hidden = asHiddenPlayer({ id: 1, ...playerWithBadges! });

    // Snapshot has no per-badge observations — every badge resolves to
    // Unknown via the per-badge fallback rule.
    const empty: PlayerKnowledge = { playerId: 1, all: [], best: new Map() };
    const rendered = renderPlayer(hidden, { now: REFERENCE_DATE, knowledge: empty }, deps);
    for (const badge of rendered.badges) {
      expect(badge.certainty).toBe("Unknown");
    }
  });

  it("a per-badge observation overrides the overall certainty for that badge", () => {
    const w = world();
    const playerWithBadges = w.clubs.flatMap((c) => c.players).find((p) => p.badgeKeys.length > 0);
    const hidden = asHiddenPlayer({ id: 1, ...playerWithBadges! });
    const knownBadgeKey = hidden.badgeKeys[0]!;

    // Build a snapshot that's overall Confident on the gifts but only
    // Speculation on the specific badge — that one chip should be
    // Speculation while every other chip is Unknown.
    const snap = snapshotAtTier(1, "Confident");
    snap.best.set(`badge_presence:${knownBadgeKey}`, {
      factType: "badge_presence",
      factKey: knownBadgeKey,
      factValueTier: "present",
      certainty: "Speculation",
      observedAt: REFERENCE_DATE.toISOString(),
      sourceScoutId: 2,
    });
    snap.all.unshift(snap.best.get(`badge_presence:${knownBadgeKey}`)!);

    const rendered = renderPlayer(hidden, { now: REFERENCE_DATE, knowledge: snap }, deps);
    const targetBadge = rendered.badges.find((b) => b.key === knownBadgeKey);
    expect(targetBadge?.certainty).toBe("Speculation");
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
  it("populates every RenderedPlayer field including the expanded club ref", () => {
    const w = world();
    const hidden = asHiddenPlayer({ id: 7, ...w.clubs[0]!.players[0]!, clubId: 1 });
    const rendered = renderPlayer(
      hidden,
      { now: REFERENCE_DATE, knowledge: snapshotAtTier(7, "Confident") },
      {
        findClub: () => ({
          id: 1,
          name: "Real Madrid",
          nationality: "ES",
          reputation: "Elite",
          colors: STUB_COLORS,
        }),
      },
    );
    expect(rendered.id).toBe(7);
    expect(rendered.name).toBe(hidden.name);
    expect(rendered.age).toBeGreaterThanOrEqual(17);
    expect(rendered.positionLabel.length).toBeGreaterThan(0);
    expect(rendered.prose.identity.length).toBeGreaterThan(10);
    expect(rendered.prose.currentForm.length).toBeGreaterThan(10);
    expect(rendered.certainty).toBe("Confident");
    expect(rendered.experience).toBeDefined();
    expect(rendered.club?.colors.primary).toBe(STUB_COLORS.primary);
    expect(rendered.club?.reputation).toBe("Elite");
  });
});
