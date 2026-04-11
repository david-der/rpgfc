// The rendering boundary (TDD v2 §6).
//
// This barrel is the ONLY surface routes are allowed to import. Everything
// that needs to read HiddenPlayer.hiddenAttrs lives under this subtree.
// The `no-hidden-in-routes` ESLint rule refuses route files that import
// from `../application/**` or any path matching `*/hidden*`, so routes are
// mechanically forced through here.
//
// Story 01 exposes renderPlayer; later stories add renderClub, renderRun,
// renderManager, etc.

export { renderPlayer } from "./player.js";
export type { RenderPlayerDeps } from "./player.js";
export type { RenderContext } from "./context.js";
export { computeCertainty } from "./certainty.js";
export { bucketExperience } from "./experience.js";
export { tierWordFor } from "./thesaurus.js";
export { renderPlayerById, renderPlayersPage, runPlayersSeed } from "./player-response.js";
export type { RenderedPlayerPage } from "./player-response.js";
