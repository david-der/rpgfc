import type { Archetype, AttributeDistribution } from "../types/archetype.js";

// Story 01 seed archetypes — 12 templates covering the full positional
// spectrum. Each declares (mean, spread) for every gift and trait; the
// generator samples a normal distribution and clamps to [0, 100].
//
// Archetype ids are lower_snake_case. The preferred-foot weights are absolute
// (the generator normalizes). Inborn badge chances are independent rolls.

const d = (mean: number, spread: number): AttributeDistribution => ({ mean, spread });

// Uniform "average" baseline used as a starting point for traits; feel free
// to override per archetype.
const baseTraits = {
  ambition: d(60, 15),
  leadership: d(50, 18),
  temperament: d(60, 15),
  workEthic: d(65, 12),
  sociability: d(55, 15),
  riskTolerance: d(55, 15),
  professionalism: d(65, 12),
};

function archetype(a: Archetype): Archetype {
  return a;
}

export const PRESSING_FORWARD = archetype({
  id: "pressing_forward",
  displayName: "Pressing Forward",
  primaryRole: "Striker",
  positionLabel: "ST",
  giftDist: {
    pace: d(78, 10),
    finishing: d(74, 12),
    composure: d(70, 10),
    aerial: d(55, 15),
    tackling: d(35, 12),
    passing: d(60, 12),
    vision: d(62, 12),
    stamina: d(82, 8),
    strength: d(65, 12),
    reflexes: d(40, 15),
  },
  traitDist: {
    ...baseTraits,
    workEthic: d(82, 8),
    ambition: d(72, 12),
  },
  startingBadgeKeys: ["tireless_runner"],
  inbornBadgeChances: { lightning_quick: 0.15, two_footed: 0.05 },
  preferredFootWeights: { Right: 6, Left: 3, Both: 1 },
  ageRange: [18, 32],
});

export const TARGET_MAN_ARCHETYPE = archetype({
  id: "target_man",
  displayName: "Target Man",
  primaryRole: "Striker",
  positionLabel: "ST",
  giftDist: {
    pace: d(50, 10),
    finishing: d(72, 12),
    composure: d(70, 10),
    aerial: d(82, 8),
    tackling: d(40, 12),
    passing: d(60, 12),
    vision: d(60, 12),
    stamina: d(65, 12),
    strength: d(82, 8),
    reflexes: d(45, 15),
  },
  traitDist: {
    ...baseTraits,
    temperament: d(70, 12),
  },
  startingBadgeKeys: ["target_man"],
  inbornBadgeChances: { aerial_dominance: 0.15 },
  preferredFootWeights: { Right: 6, Left: 3, Both: 1 },
  ageRange: [20, 34],
});

export const CREATIVE_TEN = archetype({
  id: "creative_ten",
  displayName: "Creative Ten",
  primaryRole: "Attacking Midfielder",
  positionLabel: "AM",
  giftDist: {
    pace: d(62, 12),
    finishing: d(68, 12),
    composure: d(75, 10),
    aerial: d(45, 12),
    tackling: d(35, 12),
    passing: d(82, 8),
    vision: d(85, 8),
    stamina: d(68, 12),
    strength: d(55, 12),
    reflexes: d(55, 15),
  },
  traitDist: {
    ...baseTraits,
    ambition: d(75, 10),
    temperament: d(55, 18),
    riskTolerance: d(75, 12),
  },
  startingBadgeKeys: [],
  inbornBadgeChances: { hawk_eyed: 0.2, two_footed: 0.08 },
  preferredFootWeights: { Right: 5, Left: 5, Both: 2 },
  ageRange: [19, 32],
});

export const DESTROYER = archetype({
  id: "destroyer",
  displayName: "Destroyer",
  primaryRole: "Defensive Midfielder",
  positionLabel: "DM",
  giftDist: {
    pace: d(55, 12),
    finishing: d(40, 15),
    composure: d(60, 12),
    aerial: d(68, 12),
    tackling: d(85, 8),
    passing: d(60, 12),
    vision: d(55, 12),
    stamina: d(80, 10),
    strength: d(78, 10),
    reflexes: d(45, 15),
  },
  traitDist: {
    ...baseTraits,
    temperament: d(48, 18),
    workEthic: d(80, 10),
  },
  startingBadgeKeys: [],
  inbornBadgeChances: {},
  preferredFootWeights: { Right: 7, Left: 2, Both: 1 },
  ageRange: [21, 33],
});

export const SWEEPER_KEEPER_ARCHETYPE = archetype({
  id: "sweeper_keeper",
  displayName: "Sweeper-Keeper",
  primaryRole: "Goalkeeper",
  positionLabel: "GK",
  giftDist: {
    pace: d(45, 12),
    finishing: d(20, 10),
    composure: d(78, 10),
    aerial: d(72, 10),
    tackling: d(35, 15),
    passing: d(70, 12),
    vision: d(68, 12),
    stamina: d(55, 12),
    strength: d(70, 10),
    reflexes: d(82, 8),
  },
  traitDist: {
    ...baseTraits,
    temperament: d(72, 10),
    professionalism: d(78, 10),
  },
  startingBadgeKeys: ["sweeper_keeper"],
  inbornBadgeChances: { quick_reflexes: 0.2 },
  preferredFootWeights: { Right: 7, Left: 3, Both: 0 },
  ageRange: [20, 38],
});

export const FLYING_FULLBACK = archetype({
  id: "flying_fullback",
  displayName: "Flying Fullback",
  primaryRole: "Fullback",
  positionLabel: "FB",
  giftDist: {
    pace: d(80, 10),
    finishing: d(48, 15),
    composure: d(60, 12),
    aerial: d(55, 15),
    tackling: d(62, 12),
    passing: d(68, 12),
    vision: d(62, 12),
    stamina: d(85, 8),
    strength: d(62, 12),
    reflexes: d(45, 15),
  },
  traitDist: {
    ...baseTraits,
    riskTolerance: d(70, 12),
    workEthic: d(80, 10),
  },
  startingBadgeKeys: [],
  inbornBadgeChances: { lightning_quick: 0.1 },
  preferredFootWeights: { Right: 5, Left: 5, Both: 1 },
  ageRange: [19, 32],
});

export const BALL_PLAYING_CB = archetype({
  id: "ball_playing_cb",
  displayName: "Ball-Playing Center-Back",
  primaryRole: "Center-Back",
  positionLabel: "CB",
  giftDist: {
    pace: d(58, 12),
    finishing: d(35, 15),
    composure: d(78, 8),
    aerial: d(78, 10),
    tackling: d(72, 10),
    passing: d(78, 10),
    vision: d(70, 12),
    stamina: d(68, 10),
    strength: d(76, 10),
    reflexes: d(50, 15),
  },
  traitDist: {
    ...baseTraits,
    leadership: d(68, 15),
    professionalism: d(75, 10),
  },
  startingBadgeKeys: [],
  inbornBadgeChances: { hawk_eyed: 0.12 },
  preferredFootWeights: { Right: 7, Left: 3, Both: 1 },
  ageRange: [21, 34],
});

export const STOPPER_CB = archetype({
  id: "stopper_cb",
  displayName: "Stopper Center-Back",
  primaryRole: "Center-Back",
  positionLabel: "CB",
  giftDist: {
    pace: d(55, 12),
    finishing: d(30, 12),
    composure: d(68, 12),
    aerial: d(85, 8),
    tackling: d(82, 8),
    passing: d(55, 12),
    vision: d(55, 12),
    stamina: d(72, 10),
    strength: d(85, 8),
    reflexes: d(48, 15),
  },
  traitDist: {
    ...baseTraits,
    temperament: d(50, 15),
    workEthic: d(78, 10),
  },
  startingBadgeKeys: [],
  inbornBadgeChances: { aerial_dominance: 0.2 },
  preferredFootWeights: { Right: 8, Left: 2, Both: 0 },
  ageRange: [22, 34],
});

export const BOX_TO_BOX = archetype({
  id: "box_to_box",
  displayName: "Box-to-Box Midfielder",
  primaryRole: "Central Midfielder",
  positionLabel: "CM",
  giftDist: {
    pace: d(68, 10),
    finishing: d(58, 12),
    composure: d(65, 12),
    aerial: d(62, 12),
    tackling: d(68, 10),
    passing: d(70, 10),
    vision: d(68, 10),
    stamina: d(88, 6),
    strength: d(68, 10),
    reflexes: d(50, 15),
  },
  traitDist: {
    ...baseTraits,
    workEthic: d(85, 8),
  },
  startingBadgeKeys: ["tireless_runner"],
  inbornBadgeChances: {},
  preferredFootWeights: { Right: 6, Left: 3, Both: 1 },
  ageRange: [20, 32],
});

export const INVERTED_WINGER_ARCH = archetype({
  id: "inverted_winger_arch",
  displayName: "Inverted Winger",
  primaryRole: "Winger",
  positionLabel: "LW",
  giftDist: {
    pace: d(80, 8),
    finishing: d(68, 12),
    composure: d(65, 12),
    aerial: d(42, 12),
    tackling: d(35, 12),
    passing: d(68, 12),
    vision: d(70, 12),
    stamina: d(75, 10),
    strength: d(55, 12),
    reflexes: d(48, 15),
  },
  traitDist: {
    ...baseTraits,
    riskTolerance: d(72, 12),
  },
  startingBadgeKeys: ["inverted_winger"],
  inbornBadgeChances: { lightning_quick: 0.18, two_footed: 0.08 },
  preferredFootWeights: { Right: 7, Left: 2, Both: 1 },
  ageRange: [18, 30],
});

export const CLASSIC_NINE = archetype({
  id: "classic_nine",
  displayName: "Classic Nine",
  primaryRole: "Striker",
  positionLabel: "ST",
  giftDist: {
    pace: d(68, 12),
    finishing: d(85, 8),
    composure: d(78, 8),
    aerial: d(70, 10),
    tackling: d(25, 10),
    passing: d(55, 12),
    vision: d(58, 12),
    stamina: d(65, 12),
    strength: d(72, 10),
    reflexes: d(52, 15),
  },
  traitDist: {
    ...baseTraits,
    ambition: d(78, 10),
  },
  startingBadgeKeys: [],
  inbornBadgeChances: { hawk_eyed: 0.1 },
  preferredFootWeights: { Right: 6, Left: 3, Both: 1 },
  ageRange: [19, 33],
});

export const SHOT_STOPPER = archetype({
  id: "shot_stopper",
  displayName: "Shot-Stopper Keeper",
  primaryRole: "Goalkeeper",
  positionLabel: "GK",
  giftDist: {
    pace: d(40, 10),
    finishing: d(15, 8),
    composure: d(82, 8),
    aerial: d(75, 10),
    tackling: d(30, 15),
    passing: d(55, 15),
    vision: d(60, 12),
    stamina: d(55, 12),
    strength: d(72, 10),
    reflexes: d(88, 6),
  },
  traitDist: {
    ...baseTraits,
    temperament: d(75, 10),
    professionalism: d(78, 10),
  },
  startingBadgeKeys: [],
  inbornBadgeChances: { quick_reflexes: 0.25 },
  preferredFootWeights: { Right: 7, Left: 3, Both: 0 },
  ageRange: [19, 38],
});

export const ARCHETYPE_LIBRARY: readonly Archetype[] = [
  PRESSING_FORWARD,
  TARGET_MAN_ARCHETYPE,
  CREATIVE_TEN,
  DESTROYER,
  SWEEPER_KEEPER_ARCHETYPE,
  FLYING_FULLBACK,
  BALL_PLAYING_CB,
  STOPPER_CB,
  BOX_TO_BOX,
  INVERTED_WINGER_ARCH,
  CLASSIC_NINE,
  SHOT_STOPPER,
] as const;

export const ARCHETYPE_BY_ID: Record<string, Archetype> = Object.fromEntries(
  ARCHETYPE_LIBRARY.map((a) => [a.id, a]),
);
