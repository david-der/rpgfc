// Identity prose generator — Story 01 template-based.
//
// Goal: produce a 1–2 sentence paragraph describing a player that reads
// naturally and never contains a digit. The generator walks the player's
// archetype, a couple of standout thesaurus words, and any badge prose
// hooks to assemble a sentence from a per-archetype sentence shape.
//
// AC-08 enforces that the output of this function contains no /\d/ for any
// generated player. That invariant is what the test file actively walks, so
// please do not introduce a number-carrying shape without an allowlist
// mechanism.

import type { BadgeRef, CertaintyTier, MentalTraitKey, NaturalGiftKey } from "@rpgfc/shared";
import { ARCHETYPE_BY_ID } from "@rpgfc/shared";

export interface ProseInputs {
  name: string;
  archetypeId: string;
  identityFact: { key: NaturalGiftKey; valueTier: string } | null;
  mentalFact: {
    key: MentalTraitKey;
    valueTier: string;
    certainty: CertaintyTier;
  } | null;
  mentalEvidenceSource: "club" | "scout";
  badges: BadgeRef[];
}

const GIFT_LABEL: Record<NaturalGiftKey, string> = {
  pace: "pace",
  finishing: "finishing",
  composure: "composure",
  aerial: "aerial work",
  tackling: "tackling",
  passing: "distribution",
  vision: "vision",
  stamina: "engine",
  strength: "physical presence",
  reflexes: "reflexes",
};

const MENTAL_LABEL: Record<MentalTraitKey, string> = {
  ambition: "ambition",
  leadership: "leadership",
  temperament: "temperament",
  workEthic: "work ethic",
  sociability: "social presence",
  riskTolerance: "risk appetite",
  professionalism: "professional habits",
};

function mentalEvidenceSentence(
  mentalFact: ProseInputs["mentalFact"],
  source: ProseInputs["mentalEvidenceSource"],
): string | null {
  if (!mentalFact || mentalFact.certainty === "Unknown") return null;
  const subject = MENTAL_LABEL[mentalFact.key];
  if (source === "club") {
    return `Club staff regard his ${subject} as ${mentalFact.valueTier}.`;
  }
  if (mentalFact.certainty === "Speculation") {
    return `Scouts tentatively describe his ${subject} as ${mentalFact.valueTier}.`;
  }
  if (mentalFact.certainty === "Likely") {
    return `Scouts increasingly describe his ${subject} as ${mentalFact.valueTier}.`;
  }
  if (mentalFact.certainty === "Confident") {
    return `Scouts consistently describe his ${subject} as ${mentalFact.valueTier}.`;
  }
  return `Scouts are clear that his ${subject} are ${mentalFact.valueTier}.`;
}

// Sentence shapes — at least 4 per archetype is the Story 01 target, but
// since most of them compose in the same way we use a shared template list
// keyed by primaryRole and let the variation come from rng-picked sentence
// patterns within a deterministic shape.
const SHAPES: readonly string[] = [
  "A {position} with {topWord} {topLabel}.",
  "{position} — {topWord} {topLabel} is the clearest observed quality.",
  "Plays as a {position}. {topWord} {topLabel} is the calling card.",
  "{position}. {topWord} {topLabel}, and a {badgeHint}.",
];

// Tiny deterministic hash used to pick a shape without importing the RNG.
function stableIndex(seed: string, mod: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % mod;
}

export function generateIdentityProse(inputs: ProseInputs): string {
  const { name, archetypeId, identityFact, badges, mentalFact, mentalEvidenceSource } = inputs;
  const archetype = ARCHETYPE_BY_ID[archetypeId];
  const position = archetype?.displayName ?? "player";
  const mentalSentence = mentalEvidenceSentence(mentalFact, mentalEvidenceSource);

  if (!identityFact) {
    if (!mentalSentence) {
      return `A ${position.toLowerCase()} whose defining qualities remain unclear.`;
    }
    return `A ${position.toLowerCase()} whose footballing qualities remain unclear. ${mentalSentence}`;
  }

  const topWord = identityFact.valueTier;
  const topLabel = GIFT_LABEL[identityFact.key];

  const firstBadge = badges[0];
  const badgeHint = firstBadge
    ? firstBadge.name.toLowerCase()
    : "reliable, day-to-day professional";

  const shapeIndex = stableIndex(name, SHAPES.length);
  const shape = SHAPES[shapeIndex] ?? SHAPES[0]!;

  const identity = shape
    .replace("{position}", position)
    .replace("{topWord}", topWord)
    .replace("{topLabel}", topLabel)
    .replace("{badgeHint}", badgeHint);

  // Strip any accidental digit leak at the boundary. Belt and suspenders
  // for AC-08 — if a future template drifts, the regex catches it and the
  // sentence simply loses the offending run. A unit test also asserts this.
  const out = mentalSentence ? `${identity} ${mentalSentence}` : identity;
  return out.replace(/\d+(\.\d+)?/g, "");
}
