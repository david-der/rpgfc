import type { BadgeRef, CertaintyTier } from "@rpgfc/shared";
import { BADGE_BY_KEY } from "@rpgfc/shared";

import type { RenderContext } from "./context.js";

// Walk the player's badge keys and produce BadgeRef[] for the UI.
//
// Story 01 does not yet support per-badge certainty (every badge on the
// player inherits the global certainty tier). Story 02+ introduces a badge
// knowledge graph and per-badge confidence.

export interface PlayerBadgeSnapshot {
  badgeKeys: string[];
}

export function resolveBadges(
  snapshot: PlayerBadgeSnapshot,
  certainty: CertaintyTier,
): BadgeRef[] {
  const refs: BadgeRef[] = [];
  for (const key of snapshot.badgeKeys) {
    const def = BADGE_BY_KEY[key];
    if (!def) continue; // silently skip unknown badges

    // For tiered badges, Story 01 treats every award as tier 1 until the
    // tiering system lands. This is called out in the badge schema's
    // documentation.
    const tier = def.tiers ? 1 : null;
    const displayName = def.tiers ? (def.tiers[0]?.displayName ?? def.displayName) : def.displayName;
    const prose = def.tiers ? (def.tiers[0]?.prose ?? "") : def.displayName;

    refs.push({
      key: def.key,
      name: displayName,
      category: def.category,
      tier,
      prose,
      certainty,
    });
  }
  return refs;
}

// Swallow the unused-parameter warning — the function signature is the
// public contract for later stories.
void function usesContext(_c: RenderContext) {
  /* reserved for Story 02+ per-badge certainty */
};
