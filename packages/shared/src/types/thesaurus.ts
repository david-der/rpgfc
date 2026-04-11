import type { MentalTraitKey, NaturalGiftKey } from "./attributes.js";

// The qualitative thesaurus (PRD §4.3).
//
// Each hidden attribute has a tier list of words ordered from lowest value to
// highest. `fine` is the full tier list (5–7 words). `coarse` collapses into
// 3 words for low-scout viewers.
//
// `tierWordFor(attr, value, precision)` walks this list at render time. The
// thesaurus lives in @rpgfc/shared so test fixtures and render logic agree
// on the vocabulary.

export type ThesaurusKey = NaturalGiftKey | MentalTraitKey;
export type ThesaurusPrecision = "fine" | "coarse";

export interface ThesaurusEntry {
  attribute: ThesaurusKey;
  fine: readonly string[];
  coarse: readonly string[];
}

export type Thesaurus = Record<ThesaurusKey, ThesaurusEntry>;
