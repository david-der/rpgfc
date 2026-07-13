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
  /** Club managed by the current viewer. Club staff provide a Certain
   *  projection of their own players without requiring scout reports. */
  viewerClubId?: number;
  /** Knowledge-graph snapshot for the player being rendered. The rendering
   *  layer projects only observed facts from it; route layers do not
   *  interact with it directly. */
  knowledge?: PlayerKnowledge;
}
