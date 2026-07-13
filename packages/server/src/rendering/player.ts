import type {
  BadgeRef,
  CertaintyTier,
  NaturalGiftKey,
  RenderedClubRef,
  RenderedPlayer,
} from "@rpgfc/shared";
import { ARCHETYPE_BY_ID, asRenderedPlayer } from "@rpgfc/shared";
import type { HiddenPlayer } from "@rpgfc/shared/types/hidden";

import { resolveBadges } from "./badges.js";
import type { RenderContext } from "./context.js";
import { bucketExperience } from "./experience.js";
import {
  projectPlayerKnowledge,
  type ProjectedGiftFact,
  type ProjectedMentalFact,
} from "./knowledge.js";
import { generateFormProse } from "./prose/form.js";
import { generateIdentityProse } from "./prose/identity.js";
import { tierWordFor } from "./thesaurus.js";

// The Rendering Boundary's public face. This function is the ONLY place in
// the codebase permitted to read HiddenPlayer.hiddenAttrs directly — enforced
// by the `no-hidden-in-routes` ESLint rule and by architectural convention.
//
// External players are rendered exclusively from observed facts. Managed-
// club staff receive a Certain qualitative projection of their own players.

export interface RenderPlayerDeps {
  /** Fetch a fully-hydrated club ref by id. Returns null when the player
   *  is a free agent or the club id can't be resolved. */
  findClub: (id: number) => RenderedClubRef | null;
}

function managedIdentityFact(hidden: HiddenPlayer): ProjectedGiftFact {
  const entries = Object.entries(hidden.hiddenAttrs) as Array<[NaturalGiftKey, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  const [key, value] = entries[0] ?? ["pace", 50];
  return {
    key,
    valueTier: tierWordFor(key, value, "fine"),
    certainty: "Certain",
  };
}

function managedMentalFact(hidden: HiddenPlayer): ProjectedMentalFact {
  return {
    key: "professionalism",
    valueTier: tierWordFor("professionalism", hidden.mentalTraits.professionalism, "fine"),
    certainty: "Certain",
  };
}

export function renderPlayer(
  hidden: HiddenPlayer,
  ctx: RenderContext,
  deps: RenderPlayerDeps,
): RenderedPlayer {
  const isManagedPlayer = ctx.viewerClubId !== undefined && hidden.clubId === ctx.viewerClubId;
  const observed = projectPlayerKnowledge(ctx.knowledge);
  const identityFact = isManagedPlayer ? managedIdentityFact(hidden) : observed.identityFact;
  const mentalFact = isManagedPlayer ? managedMentalFact(hidden) : observed.mentalFact;
  const overall: CertaintyTier = isManagedPlayer ? "Certain" : observed.identityCertainty;
  const badgeFacts = isManagedPlayer
    ? hidden.badgeKeys.map((key) => ({ key, certainty: "Certain" as const }))
    : observed.badges;
  const badges: BadgeRef[] = resolveBadges({ name: hidden.name, badges: badgeFacts });

  const identity = generateIdentityProse({
    name: hidden.name,
    archetypeId: hidden.archetypeId,
    identityFact,
    mentalFact,
    mentalEvidenceSource: isManagedPlayer ? "club" : "scout",
    badges,
  });
  const currentForm = generateFormProse(hidden);

  const club = hidden.clubId !== null ? deps.findClub(hidden.clubId) : null;
  const archetype = ARCHETYPE_BY_ID[hidden.archetypeId];
  const positionLabel = archetype?.positionLabel ?? "??";

  return asRenderedPlayer({
    id: hidden.id,
    name: hidden.name,
    age: hidden.age,
    nationality: hidden.nationality,
    preferredFoot: hidden.preferredFoot,
    positionLabel,
    preferredPositions: hidden.preferredPositions,
    club,
    badges,
    prose: { identity, currentForm },
    certainty: overall,
    experience: bucketExperience(hidden.experienceYears),
  });
}
