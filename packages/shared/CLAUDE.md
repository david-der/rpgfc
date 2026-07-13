# @rpgfc/shared — operating notes

This package is consumed by both `@rpgfc/web` (browser) and `@rpgfc/server`
(Node). That dual-consumption is the reason for the strictest rule in the
workspace: **the public barrel must stay safe for the web.**

## 1. Public barrel vs. the `hidden` side-door

- **`src/index.ts`** — the public barrel. Everything exported here is
  reachable from the web package. Store what's safe: `RenderedPlayer`,
  `BadgeRef`, `BadgeCategory`, `CertaintyTier`, `ExperienceTier`, their
  `readonly` constant arrays, and plain constants like `APP_NAME`.
- **`src/types/hidden.ts`** — the deliberate side-door. Only the server's
  `rendering/**` public projection and protected `sim/compile-player.ts`
  compiler import from it. The web package is blocked from reaching this
  path by the root ESLint `no-restricted-imports` rule on `packages/web/**`
  (pattern: `*/hidden*`).

**Never re-export anything from `types/hidden.ts` through the public
barrel.** If you need a new hidden-only helper, add it to `hidden.ts` and
let the server's rendering layer or protected simulation compiler import it
directly. If a helper is
actually safe for both sides, it isn't a hidden helper — put it in the
public barrel from the start.

## 2. Brands

`HiddenPlayer` and `RenderedPlayer` carry nominal brands via
`unique symbol` properties (`HIDDEN_BRAND`, `RENDERED_BRAND`). The two
types are distinct at compile time; accidentally assigning one to the
other is a type error.

Mint branded values **only** through the sanctioned constructors:

- `asHiddenPlayer(...)` — server-internal, imported via
  `@rpgfc/shared/types/hidden`.
- `asRenderedPlayer(...)` — imported from the public barrel by the
  server's rendering layer.

Nothing else should construct a branded value. If you need to widen the
set of mint sites, update these functions instead of adding casts at call
sites.

## 3. Adding new exports

Decision matrix for where a new symbol belongs:

| Question | Answer → put it in |
|---|---|
| Is this a branded hidden shape or a helper that reads `hiddenAttrs`? | `src/types/hidden.ts` (NOT re-exported from the barrel) |
| Is this a rendered shape, a qualitative tier, or a public enum? | `src/types/` + export from `src/index.ts` |
| Is this a shared Zod schema for request/response validation? | `src/schemas/` |
| Is this a compile-time constant the UI and backend share? | `src/constants/` |

## 4. Tests

- `src/test/brands.test.ts` — runtime smoke for the brand constructors.
- `src/test/brands.test-d.ts` — type-only assertions (checked by
  `tsc --noEmit`, not vitest).

When you add a new branded type, add its distinctness assertion to the
`.test-d.ts` file too.

## 5. Build output

This package is consumed by the other workspace packages through
`"main": "./src/index.ts"` — i.e. directly from source via pnpm workspace
links and bundler resolution. The `tsc` build exists mainly for the
Docker multi-stage `pnpm deploy --prod`, which expects a `dist/`.
