import type { CertaintyTier, RenderedPlayer } from "@rpgfc/shared";
import { ARCHETYPE_BY_ID, asRenderedPlayer } from "@rpgfc/shared";
import type { HiddenPlayer } from "@rpgfc/shared/types/hidden";

import { resolveBadges } from "./badges.js";
import { computeCertainty } from "./certainty.js";
import type { RenderContext } from "./context.js";
import { bucketExperience } from "./experience.js";
import { generateFormProse } from "./prose/form.js";
import { generateIdentityProse } from "./prose/identity.js";

// The Rendering Boundary's public face. This function is the ONLY place in
// the codebase permitted to read HiddenPlayer.hiddenAttrs directly — enforced
// by the `no-hidden-in-routes` ESLint rule and by architectural convention.
//
// Takes a HiddenPlayer plus viewer context and produces a RenderedPlayer
// safe for the wire. Callers downstream (routes, response serialization)
// must never see the input type.

function ageFromDob(dob: string, now: Date): number {
  const birth = new Date(dob + "T00:00:00Z");
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export interface RenderPlayerDeps {
  /** Fetch club shell by id for the rendered output. */
  findClub: (id: number) => { id: number; name: string } | null;
}

export function renderPlayer(
  hidden: HiddenPlayer,
  ctx: RenderContext,
  deps: RenderPlayerDeps,
): RenderedPlayer {
  const certainty: CertaintyTier = computeCertainty(hidden, ctx);
  const precision = certainty === "Certain" || certainty === "Confident" ? "fine" : "coarse";

  const badges = resolveBadges({ badgeKeys: hidden.badgeKeys }, certainty);
  const identity = generateIdentityProse({ hidden, badges, precision });
  const currentForm = generateFormProse(hidden);

  const club = hidden.clubId !== null ? deps.findClub(hidden.clubId) : null;
  const archetype = ARCHETYPE_BY_ID[hidden.archetypeId];
  const positionLabel = archetype?.positionLabel ?? "??";

  return asRenderedPlayer({
    id: hidden.id,
    name: hidden.name,
    age: ageFromDob(hidden.dob, ctx.now),
    nationality: hidden.nationality,
    preferredFoot: hidden.preferredFoot,
    positionLabel,
    club,
    badges,
    prose: { identity, currentForm },
    certainty,
    experience: bucketExperience(hidden.experienceYears),
  });
}
