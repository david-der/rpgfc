// Public type barrel. Everything exported here is safe for the web package.
// HiddenPlayer is *not* re-exported from this file — it lives in ./player.js
// and is imported only by the server's rendering/ module.
export type { CertaintyTier } from "./certainty.js";
export { CERTAINTY_TIERS } from "./certainty.js";
export type { BadgeCategory, BadgeRef } from "./badge.js";
export { BADGE_CATEGORIES } from "./badge.js";
export type { RenderedPlayer } from "./player.js";
