// TierPill — Style Guide §6.1.
//
// Qualitative tier display. Reserved for concrete career-stage or form
// signals — NEVER an abstract rating. Two visual variants:
//
//   muted  (default) — 1px moss-500 border, parchment-50 bg, moss-700 text.
//                      Quiet by design; pairs with a busy hero.
//   solid  (opt-in)  — moss-500 bg, moss-500 border, parchment-50 text.
//                      Reserved for places where the tier is the main
//                      message of the surrounding card (e.g., a dedicated
//                      form badge on a match report header).
//
// FIX-05: the hero version used a fully-saturated moss fill which pulled
// the eye harder than "subtle color earns attention" wants (Style Guide
// §2). The muted variant is now the default, so every existing call site
// becomes a quiet outlined pill unless it explicitly opts into solid.
//
// Zero radius. No shadow. Uppercase + tracking-wide + Inter. Small.

import type { ExperienceTier } from "@rpgfc/shared";

export type TierPillVariant = "muted" | "solid";

interface TierPillProps {
  /** The tier value to display. ExperienceTier in Story 01; may widen
   *  when form tiers reach the UI. */
  tier: ExperienceTier;
  /** Optional display label — defaults to the tier string itself. */
  label?: string;
  variant?: TierPillVariant;
}

const BASE_CLASS =
  "inline-flex h-6 items-center border px-2 font-sans text-xs font-semibold uppercase tracking-wide";

const VARIANT_CLASS: Record<TierPillVariant, string> = {
  muted: "bg-parchment-50 text-moss-700 border-moss-500",
  solid: "bg-moss-500 text-parchment-50 border-moss-500",
};

export function TierPill({ tier, label, variant = "muted" }: TierPillProps) {
  const text = label ?? tier;
  return <span className={`${BASE_CLASS} ${VARIANT_CLASS[variant]}`}>{text}</span>;
}
