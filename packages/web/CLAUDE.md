# @rpgfc/web — operating notes

Root `CLAUDE.md` has the big picture. This file holds the Style Guide rules
and architecture conventions that the web package is most likely to break
silently. The Style Guide wins if this file drifts.

## 1. Hard UI rules — non-negotiable

These are not style suggestions. They are enforced by the Tailwind config
and/or the Playwright doctrine suite. Break any of them and the build
fails or the product thesis fails.

- **Every `border-radius` is `0`.** Tailwind's `rounded-*` utilities are
  aliased to `0` in `tailwind.config.ts`. `rounded-full` (→ `9999px`) is
  the only exception and is reserved for circles — avatars, chart dots,
  status markers. **Never add a new radius key.**
- **`box-shadow` is banned.** All Tailwind shadow utilities are `none`.
  Hierarchy comes from border weight and background tier — not shadow,
  not elevation.
- **Every numeric display uses `font-mono` + tabular-nums.** Scorelines,
  minute markers, dates, fees, ages. Numbers must never shift width
  between updates. The CSS `body` rule sets `font-variant-numeric:
  tabular-nums` for `.font-mono` and `[data-numeric]`.
- **Max prose column = `max-w-prose` (640px).** Match reports, scout
  letters, narrative blocks. Never wider.
- **Typography stack — Newsreader (serif) / Inter (sans) / JetBrains Mono
  (mono).** No other families. Weights: Inter 400/500/600/700; Newsreader
  400/500/700; Mono 400/500. Anything else is forbidden.
- **Color is never load-bearing alone.** Form gradient pairs with tier
  words. Certainty tiers pair color with font-weight + italicization.
  W/D/L strip includes screen-reader text.

## 2. The no-numbers doctrine in JSX

Any element that renders data originating from a player (or a club, or a
match) on the player-viewable surface must be tagged
`data-testid="player-facing"`. The `rpgfc/no-numbers-in-player-facing`
ESLint rule and the Playwright doctrine suite both watch these elements.

**Allowlists.** Ages, years, scorelines, jersey numbers, commit hashes
and other concrete facts are allowed, but only through an explicit
allowlist: append `-allowlist-number` to the `data-testid`. Example:

```tsx
<span data-testid="player-age-allowlist-number">{age}</span>
```

Every allowlist use is a documented decision. When in doubt, err toward
not using one.

**What counts as a number leak.** Raw numeric literals, template strings
containing digits, and member expressions on names like `player.pace`,
`player.finishing`, `player.ovr`, `player.rating` — all blocked by the
lint rule. The authoritative list lives in
`packages/eslint-plugin-rpgfc/rules/no-numbers-in-player-facing.cjs`.

## 3. Component library — compose, don't invent

Pages compose from `src/components/ui/`. The full vocabulary (Card,
SectionHeader, BadgeChip, BadgeStack, CertaintyText, TierPill, Sparkline,
FormStrip, ResultPill, PlayerIdentityCard, ScoutReportCard, NarrativeBlock,
KeyNumber, TabBar, Button, Inspector, Timeline, Toast, Dialog) is
specified in Style Guide §6.

**Don't write freestyle HTML for layout.** If a feature needs something
the component library can't do, add it to `components/ui/` first with a
Style Guide cross-reference, then compose pages against it. Story 00
ships only `Card`; feature components land in Story 01+.

## 4. Page archetypes

Every screen is an instance of one of four archetypes (Style Guide §10):

1. **Dashboard** — hero + 2-col card grid + right Inspector. Charts in
   cards, no dense tables.
2. **List** — filter bar + main column + live-updating right Inspector.
3. **Profile** — club stripe + hero + TabBar (Overview / History /
   Badges / Relationships / Contract / Reports). The reading destination
   of the game.
4. **Editor** — left work area + right Configuration panel + bottom
   persistent action bar. Never floating action buttons.

Pick one before designing a new screen. If none fit, update the Style
Guide first — don't invent a fifth archetype ad-hoc.

## 5. Hono RPC client (`src/lib/api.ts`)

```ts
import type { AppType } from "@rpgfc/server";   // TYPE ONLY
import { hc } from "hono/client";
export const api = hc<AppType>("/");
```

The `type` keyword on the import is **mandatory**. Without it, Vite pulls
the server's runtime modules (better-sqlite3, pg, pino, Node built-ins)
into the browser bundle and the build fails with "cannot resolve
'node:fs'" or similar. See root CLAUDE.md §16 and Story 00 §9.5.

When the RPC client inference shows `any` for a response body, the root
cause is almost always on the server side — see
`packages/server/CLAUDE.md` §4 for the fix pattern.

## 6. Routing (TanStack Router)

- File-based routes under `src/routes/`. Filename = path, with `$param`
  for dynamic segments.
- `routeTree.gen.ts` is **regenerated on every `vite` and `vite build`**
  by `@tanstack/router-plugin`. It is committed (Story 00 §9.4) so a
  clean clone can `pnpm typecheck` and `pnpm build` without first
  running the dev server.
- Each route exports `Route = createFileRoute(...)({ component })`. The
  root layout lives in `__root.tsx`.
- Use the route's `loader` for server data that should be available
  before the component mounts. Otherwise use `useQuery` in the component.

## 7. Server state — TanStack Query

- **No client-side global store for server state.** Every server-
  originated value lives in the Query cache.
- Local UI state → `useState` / `useReducer`.
- Cross-tree sharing → React Context for small scopes; Zustand is
  permitted only for genuine cross-cutting concerns (e.g., toast queue).
  The default answer is always "keep it in the component tree."

## 8. Tests

- **Unit / component tests** via Vitest (+ jsdom + @testing-library/react)
  live under `src/test/` alongside the code.
- **Type-only tests** use the `.test-d.ts` suffix and are checked by
  `tsc --noEmit`, not by vitest. See `src/test/api-types.test-d.ts`.
- **Doctrine tests** (Playwright) live in `tests/doctrine/` at the repo
  root, not inside this package.
