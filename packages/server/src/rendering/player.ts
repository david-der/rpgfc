import type { BadgeRef, CertaintyTier, RenderedClubRef, RenderedPlayer } from "@rpgfc/shared";
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
// Story 03 changes:
//   - `findClub` returns the full RenderedClubRef (colors + reputation +
//     nationality), not the Story 01 (id, name) stub.
//   - Per-badge certainty is read from the knowledge graph snapshot on
//     ctx, not the global player tier. A badge the manager has never been
//     told about renders Unknown even if the player overall is Confident.

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
  /** Fetch a fully-hydrated club ref by id. Returns null when the player
   *  is a free agent or the club id can't be resolved. */
  findClub: (id: number) => RenderedClubRef | null;
}

function badgeCertaintyFromKnowledge(
  ctx: RenderContext,
  badgeKey: string,
  fallback: CertaintyTier,
): CertaintyTier {
  if (!ctx.knowledge) return fallback;
  const obs = ctx.knowledge.best.get(`badge_presence:${badgeKey}`);
  return obs?.certainty ?? "Unknown";
}

export function renderPlayer(
  hidden: HiddenPlayer,
  ctx: RenderContext,
  deps: RenderPlayerDeps,
): RenderedPlayer {
  const overall: CertaintyTier = computeCertainty(hidden, ctx);
  const precision = overall === "Certain" || overall === "Confident" ? "fine" : "coarse";

  // Each badge gets its own per-fact certainty when the knowledge graph
  // has an observation for it; falls back to the player's overall
  // certainty otherwise. The legacy `resolveBadges(snapshot, certainty)`
  // call assigned a single certainty across the whole stack — Story 03
  // overrides per-badge after the fact.
  const baseBadges = resolveBadges({ name: hidden.name, badgeKeys: hidden.badgeKeys }, overall);
  const badges: BadgeRef[] = baseBadges.map((b) => ({
    ...b,
    certainty: badgeCertaintyFromKnowledge(ctx, b.key, overall),
  }));

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
    preferredPositions: hidden.preferredPositions,
    club,
    badges,
    prose: { identity, currentForm },
    certainty: overall,
    experience: bucketExperience(hidden.experienceYears),
  });
}
