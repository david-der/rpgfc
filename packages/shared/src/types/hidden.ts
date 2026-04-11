// Deliberate side-door for server-only imports.
//
// The ESLint rule `no-restricted-imports` on the web package forbids any path
// matching `*/hidden*`, which means the web package cannot touch this file
// while the server's rendering/ module can.
//
// Import path from server:
//   import type { HiddenPlayer } from "@rpgfc/shared/types/hidden";
//   import { asHiddenPlayer } from "@rpgfc/shared/types/hidden";
export type { HiddenPlayer, NarrativeSeed, NewHiddenPlayer } from "./player.js";
export { asHiddenPlayer, asNewHiddenPlayer } from "./player.js";
