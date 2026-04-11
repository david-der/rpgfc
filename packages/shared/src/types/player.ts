import type { BadgeRef } from "./badge.js";
import type { CertaintyTier } from "./certainty.js";

// ─────────────────────────────────────────────────────────────────────────────
//  THE RENDERING BOUNDARY (TDD v2 §6)
// ─────────────────────────────────────────────────────────────────────────────
//
// HiddenPlayer carries the raw numeric vector the simulator consumes.
// It lives in this package so the server's rendering/ module can import it,
// BUT it is not re-exported from the public barrel (src/index.ts). The web
// package cannot reach it at all — the ESLint `no-restricted-imports` rule
// and the web-side stricter tsconfig prevent it.
//
// RenderedPlayer is the only player shape permitted to cross the HTTP wire.
// The brand makes the two types nominally distinct at compile time, so that
// accidentally returning a HiddenPlayer from a Hono handler is a type error.
//
// Story 00 keeps both bodies intentionally minimal. Story 01 adds
// hiddenAttrs, badge wiring, prose, certainty, and experience tiers.

declare const HIDDEN_BRAND: unique symbol;
declare const RENDERED_BRAND: unique symbol;

export interface HiddenPlayer {
  readonly [HIDDEN_BRAND]: never;
  id: number;
  name: string;
}

export interface RenderedPlayer {
  readonly [RENDERED_BRAND]: never;
  id: number;
  name: string;
  badges: BadgeRef[];
  certainty: CertaintyTier;
}

// Internal constructors. These are the ONLY sanctioned way to mint a value of
// either branded type — they exist so call sites can't silently forge one.
// The server's rendering module imports `asRenderedPlayer`; no one else should.
// Story 00: no production call sites yet. These functions exist as anchors for
// the brand enforcement the upcoming stories will lean on.
export function asHiddenPlayer<T extends { id: number; name: string }>(v: T): HiddenPlayer {
  return v as unknown as HiddenPlayer;
}

export function asRenderedPlayer<
  T extends {
    id: number;
    name: string;
    badges: BadgeRef[];
    certainty: CertaintyTier;
  },
>(v: T): RenderedPlayer {
  return v as unknown as RenderedPlayer;
}
