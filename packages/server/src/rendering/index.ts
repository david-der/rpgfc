// The rendering boundary (TDD v2 §6). This is the ONLY module in the
// codebase permitted to read HiddenPlayer.hiddenAttrs. Routes may not import
// from here via a deep path — the custom ESLint rule `no-hidden-in-routes`
// forbids route files from importing anything except this barrel's public
// entry points.
//
// Story 00 leaves this barrel intentionally empty. Story 01 adds:
//   - renderPlayer(hidden, ctx): RenderedPlayer
//   - renderClub(hidden, ctx): RenderedClub
//   - prose generation helpers, qualitative thesaurus, badge resolution

export {};
