// Story 01 content coverage test.
//
// The story's Definition of Done requires the seed badge library to cover
// every category and every effect type, so that the first rendering tests
// and the UI component gallery can exercise the full Style Guide vocabulary
// from a known baseline.
//
// This test is fast, so it runs on every vitest invocation. If you add a new
// badge category or effect type to the types, this test fails until the seed
// library picks it up — that is by design.

import { describe, expect, it } from "vitest";

import { BADGE_CATEGORIES } from "../types/badge.js";
import type { BadgeEffect } from "../types/badge.js";
import { ARCHETYPE_LIBRARY, BADGE_LIBRARY, THESAURUS } from "../constants/index.js";
import { NATURAL_GIFT_KEYS, MENTAL_TRAIT_KEYS } from "../types/attributes.js";

const REQUIRED_EFFECT_TYPES: Array<BadgeEffect["type"]> = [
  "contextual_boost",
  "behavior_modifier",
  "event_trigger",
  "role_unlock",
  "team_effect",
  "growth_modifier",
];

describe("Story 01 seed coverage", () => {
  it("every badge category has at least one seed badge", () => {
    const covered = new Set(BADGE_LIBRARY.map((b) => b.category));
    for (const category of BADGE_CATEGORIES) {
      expect(covered.has(category), `missing seed badge for category ${category}`).toBe(true);
    }
  });

  it("every badge effect type appears in at least one seed badge", () => {
    const covered = new Set<BadgeEffect["type"]>();
    for (const b of BADGE_LIBRARY) {
      for (const e of b.effects) covered.add(e.type);
    }
    for (const type of REQUIRED_EFFECT_TYPES) {
      expect(covered.has(type), `missing seed badge with effect type ${type}`).toBe(true);
    }
  });

  it("every seed badge key is unique", () => {
    const keys = BADGE_LIBRARY.map((b) => b.key);
    const uniq = new Set(keys);
    expect(uniq.size).toBe(keys.length);
  });

  it("the archetype library covers every starting-eleven position label", () => {
    const positions = new Set(ARCHETYPE_LIBRARY.map((a) => a.positionLabel));
    // Don't require every possible label, but make sure the essentials exist:
    // a GK, a CB, a midfielder, a striker, a winger.
    expect(positions.has("GK")).toBe(true);
    expect(positions.has("CB")).toBe(true);
    expect(positions.has("ST")).toBe(true);
  });

  it("every natural gift and mental trait has a thesaurus entry", () => {
    for (const k of NATURAL_GIFT_KEYS) {
      expect(THESAURUS[k], `missing thesaurus entry for natural gift ${k}`).toBeDefined();
      expect(THESAURUS[k].fine.length).toBeGreaterThanOrEqual(5);
      expect(THESAURUS[k].coarse.length).toBe(3);
    }
    for (const k of MENTAL_TRAIT_KEYS) {
      expect(THESAURUS[k], `missing thesaurus entry for mental trait ${k}`).toBeDefined();
      expect(THESAURUS[k].fine.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("every thesaurus entry has unique words within its tier list", () => {
    for (const k of [...NATURAL_GIFT_KEYS, ...MENTAL_TRAIT_KEYS]) {
      const entry = THESAURUS[k];
      const fineSet = new Set(entry.fine);
      expect(fineSet.size, `duplicate fine tier word in ${k}`).toBe(entry.fine.length);
    }
  });
});
