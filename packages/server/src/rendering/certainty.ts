// Certainty resolution — Story 03.
//
// Story 01 routed certainty through `viewerScoutLevel`, a single integer
// on the request context. Story 03 replaces that with the knowledge graph:
// `computeCertainty` now consults a per-player observation snapshot. The
// rendering layer is the only code that touches knowledge_nodes — routes
// stay layered through `renderPlayerById` / `renderPlayersPage` exactly
// as before.
//
// The function signature is still `(hidden, ctx)`. The snapshot lives on
// `ctx.knowledge` (an optional field on RenderContext). When absent, every
// player resolves as Unknown — that is the safe default for any caller
// that hasn't loaded knowledge yet.

import type { CertaintyTier } from "@rpgfc/shared";

import type { RenderContext } from "./context.js";
import { aggregateOverallCertainty } from "./knowledge.js";

export function computeCertainty(_hidden: unknown, ctx: RenderContext): CertaintyTier {
  if (!ctx.knowledge) return "Unknown";
  return aggregateOverallCertainty(ctx.knowledge);
}
