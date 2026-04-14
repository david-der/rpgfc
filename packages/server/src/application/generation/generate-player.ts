// Player generation pipeline — PRD §6.1.
//
// Deterministic given a seeded Random. Never calls Math.random(), Date.now(),
// or any other implicit source of entropy. The caller supplies a reference
// date (usually the run's baseline) so DoB math stays reproducible.

import type {
  Archetype,
  MentalTraitKey,
  NaturalGiftKey,
  NarrativeSeed,
  PreferredFoot,
} from "@rpgfc/shared";
import type { NewHiddenPlayer } from "@rpgfc/shared/types/hidden";
import { asNewHiddenPlayer } from "@rpgfc/shared/types/hidden";
import {
  ARCHETYPE_LIBRARY,
  BADGE_BY_KEY,
  MENTAL_TRAIT_KEYS,
  NATURAL_GIFT_KEYS,
} from "@rpgfc/shared";

import { pickName, pickStory } from "./names.js";
import type { Random } from "./rng.js";

export interface GenerationContext {
  runId: number;
  clubId: number | null;
  referenceDate: Date; // baseline for age math — "today" in the game world
  rng: Random;
  /** Force a specific age (used by the youth-intake pipeline). */
  overrideAge?: number;
}

function sampleNormalClamped(rng: Random, mean: number, spread: number, lo = 0, hi = 100): number {
  const raw = rng.normal(mean, spread);
  return Math.max(lo, Math.min(hi, Math.round(raw)));
}

function sampleGifts(rng: Random, archetype: Archetype) {
  const out: Partial<Record<NaturalGiftKey, number>> = {};
  for (const key of NATURAL_GIFT_KEYS) {
    const dist = archetype.giftDist[key];
    out[key] = sampleNormalClamped(rng, dist.mean, dist.spread);
  }
  return out as Record<NaturalGiftKey, number>;
}

function sampleTraits(rng: Random, archetype: Archetype) {
  const out: Partial<Record<MentalTraitKey, number>> = {};
  for (const key of MENTAL_TRAIT_KEYS) {
    const dist = archetype.traitDist[key];
    out[key] = sampleNormalClamped(rng, dist.mean, dist.spread);
  }
  return out as Record<MentalTraitKey, number>;
}

function pickFoot(rng: Random, archetype: Archetype): PreferredFoot {
  const feet: PreferredFoot[] = ["Right", "Left", "Both"];
  const weights = feet.map((f) => archetype.preferredFootWeights[f] ?? 0);
  return rng.weighted(feet, weights);
}

function pickAge(rng: Random, archetype: Archetype): number {
  const [lo, hi] = archetype.ageRange;
  return rng.int(lo, hi);
}

function rollInbornBadges(rng: Random, archetype: Archetype): string[] {
  const keys: string[] = [];
  for (const [key, chance] of Object.entries(archetype.inbornBadgeChances)) {
    if (rng.chance(chance)) keys.push(key);
  }
  return keys;
}

function rollExperienceBadges(
  rng: Random,
  archetype: Archetype,
  experienceYears: number,
): string[] {
  // Simple model: older players pick up more earned-skill and achievement
  // badges. Story 01 wants AC-07 — at least 60% of players with ≥1
  // Achievement or EarnedSkill badge — so this function is deliberately
  // generous. Each full year of experience after the first two contributes
  // one "roll" at a ~22% chance against the archetype's compatible pool.
  //
  // The compatible pool is the union of the archetype's suggested badge keys
  // and every EarnedSkill / Achievement badge in the library that isn't
  // already in the pool. This keeps even non-hinted archetypes from ending
  // up with empty badge stacks.

  if (experienceYears <= 2) return [];
  const rolls = experienceYears - 2;

  const compatiblePool = new Set<string>(archetype.startingBadgeKeys);
  // Add a small curated set from the library so generation never starves.
  const generalPool = [
    "clutch_finisher",
    "press_resistant",
    "dead_ball_specialist",
    "first_touch",
    "aerial_threat",
    "dribble_master",
    "long_range_shooter",
    "consistency",
    "iron_man",
    "academy_graduate",
    "coachs_favourite",
  ];
  for (const k of generalPool) compatiblePool.add(k);

  const pool = [...compatiblePool];
  const awarded = new Set<string>(archetype.startingBadgeKeys);
  for (let i = 0; i < rolls; i++) {
    if (!rng.chance(0.22)) continue;
    const candidate = rng.pick(pool);
    awarded.add(candidate);
  }
  return [...awarded];
}

function buildDob(age: number, referenceDate: Date, rng: Random): string {
  // Shift birth year by age, then jitter the month/day deterministically.
  const year = referenceDate.getUTCFullYear() - age;
  const month = rng.int(1, 12);
  // Keep day safe for every month (1–28 avoids Feb edge cases).
  const day = rng.int(1, 28);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function generatePlayer(ctx: GenerationContext): NewHiddenPlayer {
  const { rng, runId, clubId, referenceDate } = ctx;

  // 1. Pick archetype uniformly for Story 01. Later stories can weight this
  //    by league quality, squad needs, etc.
  const archetype = rng.pick(ARCHETYPE_LIBRARY);

  // 2–3. Sample gifts and traits.
  const hiddenAttrs = sampleGifts(rng, archetype);
  const mentalTraits = sampleTraits(rng, archetype);

  // 4. Roll inborn natural-gift badges.
  const inborn = rollInbornBadges(rng, archetype);

  // 5. Regional flavor — Story 01 keeps this trivial: picks a name pool and
  //    records the hometown as part of the narrative seed.
  const naming = pickName(rng);
  const narrativeSeed: NarrativeSeed = {
    hometown: naming.hometown,
    story: pickStory(rng, naming.hometown),
  };

  // 6. Assign age and experience years.
  const age = ctx.overrideAge ?? pickAge(rng, archetype);
  const experienceYears = Math.max(0, age - 17);

  // 7. Starting badges for age-appropriate experience.
  const earned = rollExperienceBadges(rng, archetype, experienceYears);

  // Merge and de-duplicate badge keys; only keep ones the library knows about.
  const allKeys = [...new Set([...inborn, ...earned])].filter((k) => BADGE_BY_KEY[k] !== undefined);

  // 8. Finalize.
  const preferredFoot = pickFoot(rng, archetype);
  const dob = buildDob(age, referenceDate, rng);

  const preferredPositions = derivePreferredPositions(archetype.positionLabel, rng);

  return asNewHiddenPlayer({
    runId,
    clubId,
    name: naming.name,
    dob,
    age,
    nationality: naming.nationality,
    preferredFoot,
    archetypeId: archetype.id,
    hiddenAttrs,
    mentalTraits,
    badgeKeys: allKeys,
    preferredPositions,
    experienceYears,
    narrativeSeed,
  });
}

// Adjacent position families — a player's secondary positions are
// drawn from these pools based on their primary. A CM might also
// play CAM or CDM; a ST might also play LW; an FB might also play
// LWB. The generator picks 0-2 secondary positions deterministically.
const ADJACENT_POSITIONS: Record<string, readonly string[]> = {
  GK: [],
  CB: ["CDM"],
  FB: ["LWB", "RWB", "LM", "RM"],
  DM: ["CM", "CB"],
  CM: ["CDM", "CAM", "LM", "RM"],
  AM: ["CM", "LW", "RW", "ST"],
  LW: ["LM", "ST", "RW"],
  ST: ["LW", "RW", "CAM"],
};

function derivePreferredPositions(primary: string, rng: Random): string[] {
  const positions = [primary];
  const adjacents = ADJACENT_POSITIONS[primary] ?? [];
  if (adjacents.length === 0) return positions;
  // 60% chance of one secondary, 25% chance of two.
  if (rng.chance(0.6) && adjacents.length > 0) {
    positions.push(rng.pick(adjacents));
  }
  if (rng.chance(0.25) && adjacents.length > 1) {
    const remaining = adjacents.filter((p) => !positions.includes(p));
    if (remaining.length > 0) positions.push(rng.pick(remaining));
  }
  return positions.slice(0, 3);
}
