import type { MentalTraits, NaturalGifts } from "@rpgfc/shared";
import { ARCHETYPE_BY_ID, PITCH_SLOT_POSITION_FAMILIES } from "@rpgfc/shared";
import type { HiddenPlayer } from "@rpgfc/shared/types/hidden";

import type { PositionFamily, SimPlayer } from "./interface.js";

export interface HiddenPlayerSimulationSource {
  playerId: HiddenPlayer["id"];
  archetypeId: HiddenPlayer["archetypeId"];
  positionLabel: string;
  badgeCount: number;
  badgeKeys: readonly string[];
  hiddenAttrsJson: string;
  mentalTraitsJson: string;
  fatigue: number;
}

const DEFAULT_GIFTS: NaturalGifts = {
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

const DEFAULT_TRAITS: MentalTraits = {
  ambition: 50,
  leadership: 50,
  temperament: 50,
  workEthic: 50,
  sociability: 50,
  riskTolerance: 50,
  professionalism: 50,
};

function parsePrivateVector<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function matchesFamily(positionLabel: string, families: readonly string[]): boolean {
  const upper = positionLabel.toUpperCase();
  return families.some((family) => upper.includes(family.toUpperCase()));
}

function familyFromPositionLabel(label: string): PositionFamily {
  const upper = label.toUpperCase();
  if (upper.includes("GK")) return "gk";
  if (/CB|FB|LB|RB|WB/.test(upper)) return "defender";
  if (/DM|CM|AM|LM|RM/.test(upper)) return "midfielder";
  return "forward";
}

function familyFromSlot(slot: string): PositionFamily {
  if (slot === "GK") return "gk";
  if (/^(LB|RB|LWB|RWB|DC)/.test(slot)) return "defender";
  if (/^(DMC|MC|AMC)/.test(slot)) return "midfielder";
  return "forward";
}

export function compilePlayer(slot: string, player: HiddenPlayerSimulationSource): SimPlayer {
  const families = (PITCH_SLOT_POSITION_FAMILIES as Partial<Record<string, readonly string[]>>)[
    slot
  ];
  return {
    playerId: player.playerId,
    badgeCount: player.badgeCount,
    badgeKeys: [...player.badgeKeys],
    positionFit: families ? matchesFamily(player.positionLabel, families) : true,
    positionFamily: families ? familyFromSlot(slot) : familyFromPositionLabel(player.positionLabel),
    primaryRole: ARCHETYPE_BY_ID[player.archetypeId]?.primaryRole ?? "Central Midfielder",
    gifts: parsePrivateVector(player.hiddenAttrsJson, DEFAULT_GIFTS),
    traits: parsePrivateVector(player.mentalTraitsJson, DEFAULT_TRAITS),
    fatigue: player.fatigue,
    slot,
  };
}
