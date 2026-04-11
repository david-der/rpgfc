// BadgeChip — Style Guide §6.3.
//
// The single most important atom in the UI. It carries the no-numbers
// doctrine: players are described by badges, not by attribute bars, and
// every BadgeChip is one of those badges.
//
// Anatomy:
//   - Rectangle, 0 radius, fixed 28px tall.
//   - 4px colored left sliver indicating category (per BADGE_CATEGORY_META).
//   - 16px category glyph (Lucide).
//   - text-sm Inter medium label.
//   - Optional 1–3 parchment-500 diamond tier markers.
//   - 1px parchment-300 border; hover → parchment-700.
//   - title attribute carries the prose description as a native tooltip.

import type { BadgeRef } from "@rpgfc/shared";

import { BADGE_CATEGORY_META } from "../../lib/badge-grammar";

interface BadgeChipProps {
  badge: BadgeRef;
}

export function BadgeChip({ badge }: BadgeChipProps) {
  const meta = BADGE_CATEGORY_META[badge.category];
  const Icon = meta.icon;

  const tier = badge.tier;
  const tierMarkers = tier && tier > 0 ? "◆".repeat(Math.min(3, tier)) : null;
  // Roman-numeral aria label so screen readers never pronounce a raw digit,
  // keeping the no-numbers doctrine intact in the accessibility tree.
  const tierLabel = tier ? (["I", "II", "III"][Math.min(2, tier - 1)] ?? "I") : null;

  return (
    <span
      data-testid="player-facing"
      className="inline-flex h-7 items-center border border-parchment-300 bg-parchment-100 pl-0 pr-2 text-sm text-parchment-900 transition-colors hover:border-parchment-700"
      title={badge.prose || badge.name}
    >
      <span className={`h-full w-1 ${meta.stripeClass}`} aria-hidden />
      <Icon size={14} className={`ml-2 ${meta.iconClass}`} aria-hidden />
      <span className="ml-1.5 font-medium">{badge.name}</span>
      {tierMarkers && tierLabel && (
        <span
          className="ml-2 font-mono text-xs text-parchment-500"
          aria-label={`tier ${tierLabel}`}
        >
          {tierMarkers}
        </span>
      )}
    </span>
  );
}
