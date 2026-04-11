import type { CertaintyTier } from "@rpgfc/shared";

import type { RenderContext } from "./context.js";

// Certainty masking — PRD §7.1 / TDD §6.3.
//
// Story 01 models the viewer as a single integer `viewerScoutLevel` in
// [0, 5]. Higher level = more confident knowledge. Later stories (real
// scouts, knowledge graph) will replace this with per-fact observation
// counts; the function signature stays identical so the UI doesn't move.

const LEVEL_TO_TIER: readonly CertaintyTier[] = [
  "Unknown", // 0
  "Speculation", // 1
  "Likely", // 2
  "Confident", // 3
  "Confident", // 4
  "Certain", // 5
];

export function computeCertainty(_hidden: unknown, ctx: RenderContext): CertaintyTier {
  // _hidden is accepted for API parity — later stories read observation
  // counts from it. Story 01 ignores it and uses scout level alone.
  const level = Math.max(0, Math.min(5, Math.floor(ctx.viewerScoutLevel)));
  return LEVEL_TO_TIER[level] ?? "Confident";
}
