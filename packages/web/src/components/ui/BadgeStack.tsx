// BadgeStack — groups a set of BadgeChips by category.
//
// Each group has a small-caps uppercase category label above the chips.
// Groups with no badges are hidden. The full taxonomy order from
// BADGE_CATEGORIES is preserved so the reader sees the same section order
// on every player.

import type { BadgeRef } from "@rpgfc/shared";
import { BADGE_CATEGORIES } from "@rpgfc/shared";

import { BADGE_CATEGORY_META } from "../../lib/badge-grammar";
import { BadgeChip } from "./BadgeChip";

interface BadgeStackProps {
  badges: BadgeRef[];
}

export function BadgeStack({ badges }: BadgeStackProps) {
  if (badges.length === 0) {
    return (
      <p className="text-sm italic text-parchment-500">No badges confirmed for this player yet.</p>
    );
  }

  const byCategory = new Map<string, BadgeRef[]>();
  for (const b of badges) {
    const list = byCategory.get(b.category) ?? [];
    list.push(b);
    byCategory.set(b.category, list);
  }

  return (
    <div className="space-y-4">
      {BADGE_CATEGORIES.map((category) => {
        const chips = byCategory.get(category);
        if (!chips || chips.length === 0) return null;
        const meta = BADGE_CATEGORY_META[category];
        return (
          <section key={category}>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-parchment-500">
              {meta.label}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((b) => (
                <BadgeChip key={b.key} badge={b} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
