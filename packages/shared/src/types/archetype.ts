import type { MentalTraitKey, NaturalGiftKey, PreferredFoot } from "./attributes.js";

// An Archetype is a template used during player generation. It defines the
// distribution of gifts and traits, the starting badge bias, and the position
// label the generator uses for the resulting player. PRD §6.2.
//
// Every distribution is (mean, spread); the generator samples from a normal
// distribution and clamps to [0, 100].

export interface AttributeDistribution {
  mean: number;
  spread: number;
}

export type GiftDistribution = Record<NaturalGiftKey, AttributeDistribution>;
export type TraitDistribution = Record<MentalTraitKey, AttributeDistribution>;

export interface Archetype {
  id: string;
  displayName: string;
  primaryRole: string;         // e.g. "Striker", "Center-Back"
  positionLabel: string;       // shorter label for UI (e.g. "ST", "CB")
  giftDist: GiftDistribution;
  traitDist: TraitDistribution;
  startingBadgeKeys: string[]; // stable keys into the badge library
  inbornBadgeChances: Record<string, number>; // key → probability [0, 1]
  preferredFootWeights: Record<PreferredFoot, number>;
  ageRange: [number, number];
}
