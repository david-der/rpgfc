// CertaintyText — Style Guide §2.6.
//
// Inline text with certainty-tier styling. The treatment combines color,
// font weight, and italic/upright so colorblind users still read the
// difference. Never use color alone.
//
//   Certain      parchment-900  semibold  upright
//   Confident    parchment-700  medium    upright
//   Likely       parchment-600  regular   upright
//   Speculation  parchment-500  regular   italic
//   Unknown      parchment-400  regular   italic + dashed underline

import type { ReactNode } from "react";

import type { CertaintyTier } from "@rpgfc/shared";

const TIER_CLASS: Record<CertaintyTier, string> = {
  Certain: "font-semibold not-italic text-parchment-900",
  Confident: "font-medium not-italic text-parchment-700",
  Likely: "font-normal not-italic text-parchment-600",
  Speculation: "font-normal italic text-parchment-500",
  Unknown: "font-normal italic text-parchment-400 underline decoration-dashed",
};

interface CertaintyTextProps {
  certainty: CertaintyTier;
  children: ReactNode;
}

export function CertaintyText({ certainty, children }: CertaintyTextProps) {
  return (
    <span
      className={TIER_CLASS[certainty]}
      title={`${certainty}`}
      aria-label={`${certainty.toLowerCase()} — ${typeof children === "string" ? children : ""}`}
    >
      {children}
    </span>
  );
}
