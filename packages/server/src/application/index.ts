// Application services layer (TDD v2 §2.2 — hexagonal).
//
// Returns HiddenPlayer shapes internally. The route layer is forbidden from
// importing this module directly; it must go through ../rendering. The
// `no-hidden-in-routes` ESLint rule enforces that at lint time.
//
// Story 00 is empty. Story 01 lands the first service (players.ts).
export {};
