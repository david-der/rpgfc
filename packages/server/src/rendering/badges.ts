import type { BadgeRef, CertaintyTier } from "@rpgfc/shared";
import { BADGE_BY_KEY } from "@rpgfc/shared";

// Resolve presentation-ready badge refs from the viewer's observed badge
// facts. The caller deliberately does not pass the player's hidden badge
// list for an external player.

export interface ObservedBadgeSnapshot {
  name: string;
  badges: Array<{ key: string; certainty: CertaintyTier }>;
}

function substituteName(template: string, name: string): string {
  return template.replace(/\{name\}/g, name);
}

export function resolveBadges(snapshot: ObservedBadgeSnapshot): BadgeRef[] {
  const refs: BadgeRef[] = [];
  const seen = new Set<string>();
  for (const observed of snapshot.badges) {
    if (seen.has(observed.key)) continue;
    seen.add(observed.key);
    const def = BADGE_BY_KEY[observed.key];
    if (!def) continue; // silently skip unknown badges

    // For tiered badges, Story 01 treats every award as tier 1 until the
    // tiering system lands. This is called out in the badge schema's
    // documentation.
    const tier = def.tiers ? 1 : null;
    const displayName = def.tiers
      ? (def.tiers[0]?.displayName ?? def.displayName)
      : def.displayName;
    const rawProse = def.tiers ? (def.tiers[0]?.prose ?? "") : def.displayName;
    const prose = substituteName(rawProse, snapshot.name);

    refs.push({
      key: def.key,
      name: displayName,
      category: def.category,
      tier,
      prose,
      certainty: observed.certainty,
    });
  }
  return refs;
}
