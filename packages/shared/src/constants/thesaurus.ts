import type { MentalTraitKey, NaturalGiftKey } from "../types/attributes.js";
import type { Thesaurus, ThesaurusEntry } from "../types/thesaurus.js";

// The qualitative thesaurus — PRD §4.3.
//
// Every hidden attribute has a fine-grained tier list (6 words) and a
// coarse 3-tier collapse for low-scout certainty. The `fine` list is
// ordered low → high; `coarse` is too.
//
// Rule: every word is unique within its attribute. Words are specific
// enough that the player can learn to read them — "plodding" ≠ "steady".
// If you find yourself reaching for "good" or "average" or "decent", try
// harder. This is the ONLY public-facing expression of hidden quality,
// so the vocabulary has to do the work.

const gifts: Record<NaturalGiftKey, { fine: string[]; coarse: string[] }> = {
  pace: {
    fine: ["plodding", "steady", "brisk", "quick", "rapid", "electric"],
    coarse: ["slow", "even", "fast"],
  },
  finishing: {
    fine: ["wayward", "honest", "reliable", "sharp", "clinical", "lethal"],
    coarse: ["hit-and-miss", "dependable", "clinical"],
  },
  composure: {
    fine: ["crumbles", "nervy", "steady", "composed", "unflappable", "ice-cold"],
    coarse: ["jittery", "steady", "ice-cold"],
  },
  aerial: {
    fine: ["earthbound", "modest", "fair", "strong", "dominant", "commanding"],
    coarse: ["grounded", "capable", "dominant"],
  },
  tackling: {
    fine: ["absent", "cautious", "willing", "eager", "crunching", "merciless"],
    coarse: ["soft", "willing", "fearsome"],
  },
  passing: {
    fine: ["rough", "tidy", "reliable", "incisive", "silken", "surgical"],
    coarse: ["rough", "tidy", "surgical"],
  },
  vision: {
    fine: ["blinkered", "aware", "observant", "perceptive", "foreseeing", "prophetic"],
    coarse: ["blinkered", "aware", "prophetic"],
  },
  stamina: {
    fine: ["wilting", "honest", "steady", "relentless", "tireless", "inexhaustible"],
    coarse: ["tiring", "steady", "tireless"],
  },
  strength: {
    fine: ["slight", "wiry", "sturdy", "strong", "imposing", "immovable"],
    coarse: ["light", "sturdy", "immovable"],
  },
  reflexes: {
    fine: ["slow", "ordinary", "sharp", "quick", "lightning", "supernatural"],
    coarse: ["slow", "sharp", "supernatural"],
  },
};

const traits: Record<MentalTraitKey, { fine: string[]; coarse: string[] }> = {
  ambition: {
    fine: ["content", "settled", "driven", "hungry", "ruthless", "insatiable"],
    coarse: ["settled", "driven", "insatiable"],
  },
  leadership: {
    fine: ["quiet", "follower", "willing", "respected", "commanding", "inspirational"],
    coarse: ["quiet", "respected", "inspirational"],
  },
  temperament: {
    fine: ["volatile", "hot-headed", "spirited", "even", "phlegmatic", "immovable"],
    coarse: ["volatile", "even", "immovable"],
  },
  workEthic: {
    fine: ["reluctant", "casual", "willing", "diligent", "relentless", "obsessive"],
    coarse: ["reluctant", "diligent", "obsessive"],
  },
  sociability: {
    fine: ["withdrawn", "reserved", "amicable", "popular", "magnetic", "adored"],
    coarse: ["reserved", "amicable", "adored"],
  },
  riskTolerance: {
    fine: ["safe", "careful", "measured", "bold", "daring", "reckless"],
    coarse: ["cautious", "balanced", "daring"],
  },
  professionalism: {
    fine: ["careless", "inconsistent", "dependable", "diligent", "meticulous", "devout"],
    coarse: ["careless", "dependable", "meticulous"],
  },
};

function entry(
  attr: NaturalGiftKey | MentalTraitKey,
  source: { fine: string[]; coarse: string[] },
): ThesaurusEntry {
  return {
    attribute: attr,
    fine: [...source.fine],
    coarse: [...source.coarse],
  };
}

export const THESAURUS: Thesaurus = {
  pace: entry("pace", gifts.pace),
  finishing: entry("finishing", gifts.finishing),
  composure: entry("composure", gifts.composure),
  aerial: entry("aerial", gifts.aerial),
  tackling: entry("tackling", gifts.tackling),
  passing: entry("passing", gifts.passing),
  vision: entry("vision", gifts.vision),
  stamina: entry("stamina", gifts.stamina),
  strength: entry("strength", gifts.strength),
  reflexes: entry("reflexes", gifts.reflexes),
  ambition: entry("ambition", traits.ambition),

  leadership: entry("leadership", traits.leadership),
  temperament: entry("temperament", traits.temperament),
  workEthic: entry("workEthic", traits.workEthic),
  sociability: entry("sociability", traits.sociability),
  riskTolerance: entry("riskTolerance", traits.riskTolerance),
  professionalism: entry("professionalism", traits.professionalism),
};
