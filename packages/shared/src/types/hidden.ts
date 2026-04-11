// Deliberate side-door for server-only imports.
// The ESLint rule `no-restricted-imports` on the web package forbids any path
// matching `*/hidden*`, which means the web package cannot touch this file
// while the server's rendering/ module can.
//
// Import path from server: `import { HiddenPlayer, asHiddenPlayer } from "@rpgfc/shared/types/hidden";`
export type { HiddenPlayer } from "./player.js";
export { asHiddenPlayer } from "./player.js";
