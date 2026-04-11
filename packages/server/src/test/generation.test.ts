// Story 01 AC-05, AC-06, AC-07 — generation pipeline tests.
import { describe, expect, it } from "vitest";

import { ARCHETYPE_BY_ID, BADGE_BY_KEY } from "@rpgfc/shared";

import { generateWorld } from "../application/generation/generate-world.js";
import { mulberry32 } from "../application/generation/rng.js";

const REFERENCE_DATE = new Date("2026-06-01T00:00:00Z");

function world(seed = 42) {
  return generateWorld({
    seed,
    clubCount: 10,
    playersPerClub: 20,
    referenceDate: REFERENCE_DATE,
  });
}

describe("generateWorld — AC-05 determinism", () => {
  it("produces bit-for-bit identical output for the same seed", () => {
    const a = world(42);
    const b = world(42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("produces different output for different seeds", () => {
    const a = world(42);
    const b = world(43);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("generates 10 * 20 = 200 players total", () => {
    const w = world();
    const total = w.clubs.reduce((sum, c) => sum + c.players.length, 0);
    expect(total).toBe(200);
  });
});

describe("AC-07 — badge coverage", () => {
  it("at least 60% of generated players have at least one Achievement or EarnedSkill badge", () => {
    const w = world();
    const players = w.clubs.flatMap((c) => c.players);
    const withBadge = players.filter((p) =>
      p.badgeKeys.some((k) => {
        const def = BADGE_BY_KEY[k];
        return def?.category === "Achievement" || def?.category === "EarnedSkill";
      }),
    );
    const ratio = withBadge.length / players.length;
    expect(ratio).toBeGreaterThanOrEqual(0.6);
  });
});

describe("AC-06 — archetype distribution honored", () => {
  it("players from the same archetype cluster near the archetype mean for pace", () => {
    // Simpler than sampling 1,000 of a single archetype: generate a big
    // world and bucket by archetypeId; assert each non-empty bucket's mean
    // pace is within 15 points of the archetype's declared pace.mean.
    // 15 is generous — tighter bounds require far more samples.
    const w = generateWorld({
      seed: 1,
      clubCount: 10,
      playersPerClub: 40,
      referenceDate: REFERENCE_DATE,
    });
    const players = w.clubs.flatMap((c) => c.players);

    const byArch = new Map<string, number[]>();
    for (const p of players) {
      if (!byArch.has(p.archetypeId)) byArch.set(p.archetypeId, []);
      byArch.get(p.archetypeId)!.push(p.hiddenAttrs.pace);
    }

    for (const [id, paces] of byArch) {
      if (paces.length < 15) continue; // ignore small buckets
      const mean = paces.reduce((a, b) => a + b, 0) / paces.length;
      const expected = ARCHETYPE_BY_ID[id]!.giftDist.pace.mean;
      expect(Math.abs(mean - expected)).toBeLessThanOrEqual(15);
    }
  });
});

describe("RNG determinism smoke", () => {
  it("mulberry32 produces the same first 10 values for the same seed", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const first = Array.from({ length: 10 }, () => a.next());
    const second = Array.from({ length: 10 }, () => b.next());
    expect(first).toEqual(second);
  });
});
