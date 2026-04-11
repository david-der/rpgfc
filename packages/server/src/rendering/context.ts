// The render context threads viewer state through every rendering function
// so the rendering layer stays pure — no singleton state, no request-scoped
// globals, no hidden coupling to Hono's context object.
//
// Story 03 replaces the synthetic `viewerScoutLevel` with a real
// knowledge-graph snapshot. The orchestrator (renderPlayerById /
// renderPlayersPage) loads observations once per request and hands
// them to renderPlayer via this context.

import type { PlayerKnowledge } from "./knowledge.js";

export interface RenderContext {
  /** The game's current date — used for age math. Separate from real time. */
  now: Date;
  /** Knowledge-graph snapshot for the player being rendered. The
   *  rendering layer's `computeCertainty` reads this; route layers do
   *  not interact with it directly. Optional so callers without a player
   *  context (older tests, list pre-flight) can still build a context. */
  knowledge?: PlayerKnowledge;
}
