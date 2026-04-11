// The render context threads viewer state through every rendering function
// so the rendering layer stays pure — no singleton state, no request-scoped
// globals, no hidden coupling to Hono's context object.

export interface RenderContext {
  /** 0 = unknown, 5 = fully-known. Story 01 uses a single integer; Story 02+ gates
   *  replace this with a richer knowledge-graph query. */
  viewerScoutLevel: number;
  /** The game's current date — used for age math. Separate from real time. */
  now: Date;
}
