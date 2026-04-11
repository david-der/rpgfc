// Public entry point for @rpgfc/shared. This barrel is what the web package
// sees. Crucially, it does NOT export HiddenPlayer — that type is reachable
// only via `@rpgfc/shared/types/hidden` and is forbidden to the web package
// by an ESLint `no-restricted-imports` rule.
export * from "./types/index.js";
export {
  APP_NAME,
  ARCHETYPE_LIBRARY,
  ARCHETYPE_BY_ID,
  BADGE_LIBRARY,
  BADGE_BY_KEY,
  THESAURUS,
} from "./constants/index.js";
