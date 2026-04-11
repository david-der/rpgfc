// Server-internal minter for RenderedPlayer. Exported via the public barrel
// so the server's rendering layer can construct branded values, but the web
// package should never import it — it only consumes RenderedPlayer values
// served over the wire, it does not mint them.
//
// This is a convenience re-export; the implementation lives in ./player.js
// alongside its branded counterpart asHiddenPlayer.
export { asRenderedPlayer } from "./player.js";
