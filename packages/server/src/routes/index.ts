// Routes barrel. The Hono app is mounted in src/index.ts; this file only
// aggregates sub-routers so that adding a new route surface is a one-line
// change.
export { createHealthRoute } from "./health.js";
