# CLAUDE.md — RPG FC

This file is the agent's operating manual for the RPG FC repository. It is read before every non-trivial task. If something in here conflicts with the docs in `docs/`, **the docs win** — update this file to match, not the other way around.

Canonical sources:
- `docs/RPG_FC_Product_Requirements_Document.docx` — PRD v1.0
- `docs/RPG_FC_Technical_Design_Document_v2.docx` — TDD v2.0 (TypeScript stack)
- `docs/RPG_FC_Design_and_Style_Guide.docx` — Style Guide v1.0
- `docs/stories/` — story specs; each story has ACs that must all pass before it ships

Nested operating notes (load these when working inside a subtree):
- `packages/shared/CLAUDE.md` — public barrel vs. the `hidden` side-door, brand discipline
- `packages/server/CLAUDE.md` — layer directions, dual-dialect rules, Hono RPC inference tips
- `packages/web/CLAUDE.md` — Style Guide hard rules, component vocabulary, no-numbers JSX conventions
- `tests/CLAUDE.md` — test tiers, doctrine suite, fixture conventions, container smoke

---

## 1. What RPG FC is

A football management game that blends Football Manager-style depth with rogue-lite meta-progression. The product thesis is one sentence:

> **Kill the number. Show me the player.**

There are no OVR, POT, or 1–20 attribute bars anywhere in the UI, the API, or the public-facing types. Players are expressed through **natural gifts, mental traits, experience, and badges**, surfaced via prose, qualitative tiers, observed events, and certainty tags. Every architectural decision downstream of this thesis exists to make it impossible to violate silently.

### The five design pillars (PRD §2)
1. **No numbers on players** — not even opt-in, not even in tooltips.
2. **Merit must win (eventually)** — variance is spice; over a season, the better squad wins more often, and the player can see why.
3. **Badges are identity, not stats** — discrete, earned, context-specific, story-carrying.
4. **Information has cost** — scouting, time, and observation gate what the player knows. Certainty is first-class.
5. **Respect the player's time** — a match fits in 10–20 minutes, a season in 6–10 hours, a run in a long weekend. Delegation is a first-class feature.

### Anti-patterns (never do these)
- Render a numeric player rating anywhere, under any toggle.
- Reveal a player's full attribute set on signing.
- Tell the player what the optimal tactic is.
- Force per-session training micromanagement.
- Use randomness without a legible cause the player can reason about.
- Radar charts, OVR bars, leaderboards-by-rating, gauges for abstract concepts, 3D charts, pie charts with >3 slices — **banned chart patterns** (Style Guide §8.8).

---

## 2. Architectural thesis

The **Rendering Boundary** (TDD §6) is the most load-bearing decision in the codebase. It is the single seam where the private, numeric `HiddenPlayer` shape becomes the public, prose-and-badge `RenderedPlayer` shape. Every other choice — TypeScript end-to-end, Hono RPC, Drizzle, package layout, lint rules, CI gates — exists to make the boundary either impossible or impossibly loud to bypass.

**If a change weakens the boundary, it is re-litigating the product thesis. Stop and ask.**

### Layered architecture (hexagonal, depends inward)
| Layer | Responsibility | Dependencies |
|---|---|---|
| Domain | Pure business types and functions. No framework imports. `HiddenPlayer` lives here. | stdlib only |
| Application | Use cases, commands, queries. Orchestrates domain + repositories. Returns `HiddenPlayer` internally. | Domain, repo interfaces |
| Infrastructure | Drizzle schemas, repository impls, AWS SDK clients, sim service client. | Application, Domain, Drizzle |
| **Rendering** | Prose generation, badge translation, certainty masking. **The only layer allowed to turn hidden state into public data.** | Domain (read-only), narrative templates |
| **Simulation compiler** | Server-private projection of hidden state into `SimPlayer`. Never exported to routes or web. | Domain (read-only), sim types |
| Interface | Hono routes, Zod schemas, auth middleware. Imports only `RenderedPlayer` types. | Application, Rendering |

### Monorepo packages
- `@rpgfc/shared` — types, Zod schemas, constants. Imported by both web and server. `HiddenPlayer` lives here but is **not re-exported** from the public barrel.
- `@rpgfc/server` — Hono backend, Drizzle schemas, services, rendering boundary, protected sim compiler, and causal engine.
- `@rpgfc/web` — Vite + React SPA, components, pages. Imports only `RenderedPlayer` and friends via `hc<AppType>`.
- `@rpgfc/infra` — AWS CDK stacks (NetworkStack, DatabaseStack, ServiceStack, PipelineStack).

### Directory layout (prescriptive — every file lands in one of these paths)
```
rpgfc/
├── package.json                  # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json            # strict, noImplicitAny, noUncheckedIndexedAccess
├── .eslintrc.cjs                 # hosts custom rpgfc rules
├── .prettierrc
├── justfile                      # primary task runner — run `just` for the recipe list
├── Makefile                      # legacy thin wrapper; prefer `just`
├── docker/{Dockerfile,entrypoint.sh}
├── docker-compose.yml            # disposable local Postgres
├── .github/workflows/{ci.yml,deploy.yml}
├── docs/                         # PRD, TDD, Style Guide, stories
├── packages/
│   ├── shared/src/{types,schemas,constants}
│   ├── server/src/{index.ts,dev-server.ts,env.ts,db,application,rendering,routes,sim,sim-harness,scripts,test}
│   ├── web/src/{main.tsx,routes,components/{ui,features},hooks,lib,test}
│   └── infra/{bin,lib}
├── packages/eslint-plugin-rpgfc/ # no-numbers-in-player-facing, no-hidden-in-routes
└── tests/
    ├── doctrine/                 # Playwright no-numbers suite
    ├── fixtures/eslint/          # deliberate violations for rule tests
    ├── docker/                   # shell scripts that boot the image in CI
    ├── playtest/                 # ad-hoc tsx-driven Playwright tours (screenshots + text snapshots, not CI)
    └── season-sim/               # markdown reports written by `pnpm season-sim`
```

---

## 3. Technology stack (v2 — TypeScript end-to-end)

TDD v2 supersedes v1 (Python/FastAPI). Match simulation is **deferred to a separate Python service**; v1 ships a deterministic in-process stub.

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript 5.4+ | strict mode mandatory; no implicit any |
| Runtime | Node 20 LTS | Fargate-compatible |
| Package manager | pnpm 9 | workspaces are first-class |
| Backend framework | Hono 4.x | tiny; Web Standard Req/Res; RPC type inference |
| ORM | Drizzle 0.30+ | dialect-native SQLite + Postgres |
| Migrations | Drizzle Kit | two config files — one per dialect |
| Validation | Zod 3.23+ | schemas double as TS types via `z.infer` |
| Frontend | React 18, Vite 5 | SPA served as static assets by the same Hono container |
| Router | TanStack Router 1.x | file-based, typed, loader pattern. `routeTree.gen.ts` **must be committed** |
| Data fetching | TanStack Query 5.x | no client-side global store for server state |
| Forms | React Hook Form + Zod | shared schemas with backend |
| Styling | Tailwind CSS 3.4 | zero-radius, parchment palette, box-shadow banned |
| Charts | Recharts | **only** chart library; time-series first |
| Icons | Lucide React | stroke-based, 1.5px |
| Unit tests | Vitest 1.x | + jsdom for components |
| E2E tests | Playwright 1.45+ | doctrine suite scrapes DOM for number leakage |
| Linting | ESLint 9 + typescript-eslint 8 | hosts custom rpgfc rules |
| Formatting | Prettier 3 | CI-enforced |
| Container | `node:20-alpine` | multi-stage build; runs as UID 1001 |
| Cloud | AWS ECS Fargate + RDS Postgres 16 + ALB + Cognito | single task, single DB, single ALB |
| IaC | AWS CDK (TypeScript) | four stacks |
| CI/CD | GitHub Actions | matrix: lint, test-sqlite, test-postgres, doctrine |

**Explicitly not used:** Next.js (Server Components and App Router caching fight dynamic game state), Prisma (SQLite parity is weaker than Drizzle's), OpenAPI codegen (Hono RPC type import replaces it), JSONB / ARRAY / Postgres ENUM / ILIKE / `date_trunc` / sequences (dual-dialect discipline).

---

## 4. Dual-database discipline (TDD §5)

The highest-risk constraint in the stack is that the same binary runs against **SQLite locally** and **Postgres on RDS** by switching one env var. Drizzle makes it tractable but portability is a discipline, not a free lunch.

### Hard rules
- **No JSONB columns.** JSON is stored as TEXT and parsed in the app layer.
- **No ARRAY columns.** Multi-valued relationships use join tables.
- **No native ENUMs.** Text columns validated with Zod enum schemas on write.
- **No Postgres-only functions** (ILIKE, `date_trunc`, `generate_series`). Use portable SQL or push to the app layer.
- **Timestamps are ISO-8601 strings**, not TIMESTAMP — SQLite has no native timestamp type.
- **Auto-increment**: SQLite `integer PK autoIncrement`; Postgres `serial`. Never rely on sequence behavior.
- **Transactions** use Drizzle's `.transaction()` only. No raw BEGIN/COMMIT.
- **Case-sensitive comparisons** only. Normalize in the app layer or use `lower()`.
- **No raw SQL** unless guarded by a dialect check.
- **Every schema change produces migrations for both dialects in the same PR.** A PR that only updates one is blocked by CI.

The client factory is `packages/server/src/db/client.ts`: it reads `DATABASE_URL`, detects the `sqlite:` or `postgres:` prefix, and returns a dialect-tagged Drizzle instance. SQLite connections always set `journal_mode = WAL`, `foreign_keys = ON`, `synchronous = NORMAL`.

### Save-slot model (TDD §10)
- Local dev: one SQLite file per save slot in `./saves/`.
- Prod: one Postgres **schema** per save slot, selected via `SET search_path`.
- **Legacy Hall** (cross-run meta): dedicated separate SQLite file or Postgres schema.
- `saveSlotId` is carried in session state; middleware resolves it to a connection before any query runs.
- Save export is a zip containing the raw SQLite file plus a manifest JSON.
- Every mutating API call is its own transaction. The database **is** the save. No "Save" button in v1.

---

## 5. The Rendering Boundary in code

### Branded types (in `packages/shared/src/types/player.ts`)
```ts
declare const HIDDEN_BRAND: unique symbol;
declare const RENDERED_BRAND: unique symbol;

export interface HiddenPlayer {
  readonly [HIDDEN_BRAND]: never;
  id: number;
  runId: number;
  name: string;
  dob: string;                   // ISO-8601
  clubId: number | null;
  hiddenAttrs: { pace: number; finishing: number; composure: number; /* ... */ };
  badgeIds: number[];
  experienceYears: number;
}

export interface RenderedPlayer {
  readonly [RENDERED_BRAND]: never;
  id: number;
  name: string;
  age: number;                   // computed from dob — a fact, not a rating
  club: { id: number; name: string } | null;
  badges: BadgeRef[];
  prose: { identity: string; currentForm: string };
  certainty: CertaintyTier;
  experience: ExperienceTier;
}

export type CertaintyTier = "Certain" | "Confident" | "Likely" | "Speculation" | "Unknown";
export type ExperienceTier = "Rookie" | "Developing" | "Established" | "Veteran" | "Elder";
export type BadgeCategory =
  | "NaturalGift" | "MentalTrait" | "PositionalMastery"
  | "EarnedSkill" | "Achievement" | "Relationship";
```

### Package-boundary enforcement
- `HiddenPlayer` lives in `@rpgfc/shared` so the server's `rendering/` module and protected simulation compiler can import it, but is **not re-exported** from the package barrel.
- ESLint `no-restricted-imports`: `@rpgfc/web` cannot import any path matching `*/hidden*` in `@rpgfc/shared`.
- A stricter `tsconfig` for web compiles with hidden types marked `unknown`; any destructure of a hidden field is a compile error.

### The render function lives alone
- `packages/server/src/rendering/player.ts` is the only public projection of hidden player state. The narrowly scoped compiler under `packages/server/src/sim/` may read hidden fields only to construct server-private `SimPlayer` inputs; neither hidden nor sim inputs may reach routes or web.
- The custom ESLint rule **`no-hidden-in-routes`** forbids any file under `packages/server/src/routes/**` from importing `../application/**` or any path matching `*/hidden*`. Routes may only call into `../rendering/` public functions.
- By the time data reaches a Hono handler, it is already `RenderedPlayer`. The route's only job: validate with Zod, call the service, return JSON.

### The four doctrine gates (TDD §7.4, §18)
1. **TypeScript strict compile.** The branded types make a raw number leak a compile error at the route boundary.
2. **ESLint `no-numbers-in-player-facing`.** Flags numeric literals or `/\d+/` content in JSX text inside elements with `data-testid="player-facing"`. Lives in `packages/eslint-plugin-rpgfc/`.
3. **ESLint `no-hidden-in-routes`.** Forbids route files from reaching past the rendering layer.
4. **Playwright doctrine suite.** Boots the production build, walks every page, asserts no rendered text under `data-testid="player-facing"` matches the number regex except in allowlisted contexts (ages, years, scorelines, jersey numbers). **A regression here is a product-quality incident.**

Gates 2 and 3 are tested with deliberate fixture violations under `tests/fixtures/eslint/violations/`. Gate 4 is validated once per story by temporarily injecting a `<span data-testid="player-facing">Pace 17</span>` and confirming the suite fails.

---

## 6. API surface (TDD §7)

- All routes live under `/api/*`. Static assets are served from root by the same Hono container.
- Request bodies are validated with Zod via `@hono/zod-validator`.
- Responses are `RenderedX` types only — never hidden types.
- Errors use a consistent envelope: `{ error: { code, message, details? } }`.
- Auth: Cognito Bearer token in prod; a dev token middleware locally (story 00 hardcodes a `userId`).
- Every list endpoint uses cursor-based pagination (`?cursor=&limit=`).

### Hono RPC client (type-only import, no codegen)
```ts
// packages/server/src/index.ts
export type AppType = typeof app;

// packages/web/src/lib/api.ts
import type { AppType } from "@rpgfc/server";   // TYPE ONLY — the `type` keyword is mandatory
export const api = hc<AppType>("/api");
```
Without the `type` keyword the web bundle pulls the server's runtime code and Vite fails on Node built-ins.

### v1 catalogue
`GET /api/health`, `POST/GET /api/runs`, `POST /api/runs/:id/end`, `GET /api/players`, `GET /api/players/:id`, `POST /api/players/generate` (dev only), `GET /api/clubs/:id`, `GET /api/clubs/:id/squad`, `POST /api/transfers/bid`, `GET /api/transfers/window`, `POST /api/season/advance`, `GET /api/season/fixtures`, `GET /api/season/results`, `GET /api/dashboard`.

---

## 7. Simulation (TDD §9) — deferred

The real match sim will be a separate Python HTTP service with its own TDD. v1 ships a deterministic in-process stub so every other feature can be exercised end-to-end.

- `packages/server/src/sim/interface.ts` — `SimEngine` TS interface (`simulateMatch`, `simulateTrainingWeek`, `estimateValueBand`). `ValueBand = "Minimal" | "Modest" | "Notable" | "Significant" | "Elite"` — **a band, not a number**.
- `packages/server/src/sim/stub.ts` — seeded PRNG (`hash(runId, weekNumber, homeId, awayId)`), win-probability from badge counts, truncated-Poisson goals, narrow normal training updates. Tested and shipped as a first-class module.
- `packages/server/src/sim/pythonClient.ts` — scaffold that throws on every call in v1. Flipping `SIM_ENGINE=python` is the only change needed later.

### Season sim harness (distinct from the sim stub)
`packages/server/src/sim-harness/` is a balance-tuning tool, not part of the served app: ten persona strategies (`personas.ts`, `strategies/*.json`) each manage a club through a full 18-match-week season, calling the same application-layer functions the HTTP routes use. `pnpm season-sim` (or `just sim`) runs it, writes `saves/post-season.db`, and emits an analytical markdown report to `tests/season-sim/reports/`. Browse the finished season with `pnpm dev:post-season` (`MANAGED_CLUB_ID=N` picks the club), or do both in one step with `just play club=N`.

---

## 8. Frontend (TDD §8, Style Guide §5–§13)

### Routing and state
- TanStack Router file-based routes under `packages/web/src/routes/`. Each route's `loader` prefetches via the Hono RPC client.
- TanStack Query handles server-state caching and mutations. **No client-side global store for server state** — every server-originated value lives in the Query cache.
- Local UI state: `useState` / `useReducer`. Cross-tree sharing: React Context for small scopes; Zustand only for genuine cross-cutting concerns (e.g., toast queue). Default answer: keep it in the tree.

### Component library (the vocabulary)
`Card`, `SectionHeader`, `BadgeChip`, `BadgeStack`, `CertaintyText`, `TierPill`, `Sparkline`, `FormStrip`, `ResultPill`, `PlayerIdentityCard`, `ScoutReportCard`, `NarrativeBlock`, `KeyNumber`, `TabBar`, `Button` (variants: primary | secondary | ghost | destructive), `Inspector`, `Timeline`, `Toast`, `Dialog`. Feature components **compose these** — there is no freestyle HTML in the product.

### Page archetypes
Every screen is an instance of one:
1. **Dashboard** — hero + 2-col card grid + right Inspector. Charts in cards, no dense tables.
2. **List** — filter bar + main column (cards or compact rows) + live-updating right Inspector.
3. **Profile** — club stripe + hero (name, one-line identity, KeyNumber or BadgeStack) + TabBar (Overview, History, Badges, Relationships, Contract, Reports). The Overview tab is prose + small-multiples. Profiles are the reading destinations of the game.
4. **Editor** — left work area (pitch, calendar, map) + right Configuration panel + bottom persistent action bar.

### Hard UI rules
- **Every `border-radius` is 0.** Tailwind's `rounded-*` utilities are all aliased to `0` except `rounded-full` (reserved for circles: avatars, dots).
- **`box-shadow` is banned.** All shadow utilities are aliased to `none`. Hierarchy comes from border weight and background tier.
- Cards: `parchment-100` fill + 1px `parchment-300` border + optional 2px club-primary top strip + eyebrow (text-xs uppercase tracking-wide parchment-500) + serif title + content `space-y-3`.
- Active tab state: 2px `moss-500` border-bottom. Inactive: 1px `parchment-300`. This is the only 2px border in the UI.
- Max prose column width: `max-w-prose` (640px). Never wider. Match reports and scout letters use Newsreader serif at `text-lg`, `leading-relaxed`, drop-cap on the lead.
- Every numeric display uses `font-mono` (JetBrains Mono) with `tabular-nums`. Numbers must not jump width between updates.
- Icons: Lucide React only, 1.5px stroke. Never larger than 32px except in hero illustrations.
- **Color alone is never load-bearing.** Form gradient is always paired with tier words. Certainty tiers combine color + font-weight + italicization. W/D/L strip has screen-reader text.
- Motion: 150ms ease-out default; 250ms for enter/leave. Banned: parallax, bounce, carousel, confetti, page transitions, card hover-lift.
- `prefers-reduced-motion` disables every animation.

### Color palette (Style Guide §2)
Tokens (always use the Tailwind scale, never raw hex):

- **Parchment** (neutral spine, replaces gray): `parchment-50` `#FAF7F0` (page bg) → `parchment-900` `#1A1812` (deepest ink / Certain tier).
- **Moss** (primary accent): `moss-500` `#5C6B33` = default `--club-primary`.
- **Clay** (secondary accent): `clay-500` `#865732` = default `--club-secondary`.
- **Form gradient** (5 stops, never themed): `form-excellent` `#5B8C4D`, `form-good` `#8FA84A`, `form-average` `#C49B3D`, `form-poor` `#B37238`, `form-dreadful` `#9C4B2F`. Used for form, fitness, mood, composure tiers.
- **W/D/L trio**: `result-win` `#5B8C4D`, `result-draw` `#A89878` (recedes on purpose), `result-loss` `#9C4B2F`.
- **Semantic**: `success` / `warning` / `error` reuse the form stops; `info` `#5C7A83` is a slate-teal — **never blue**.
- **Certainty tiers**: Certain = `parchment-900` semibold upright; Confident = `parchment-700` medium upright; Likely = `parchment-600` regular upright; Speculation = `parchment-500` regular italic; Unknown = `parchment-400` regular italic dashed underline.

Club theming only touches six CSS variables: `--club-primary`, `--club-primary-ink`, `--club-primary-soft`, `--club-secondary`, `--club-secondary-ink`, `--club-stripe`. A 4px `--club-stripe` sits at the top of every club-themed page — the only piece of chrome at full club-color saturation. Contrast is clamped via WCAG 4.5:1. Pure red, electric blue, neon, and near-white are banned at the engine level.

### Typography
- **Newsreader** (serif) — display, prose, match reports, scout letters.
- **Inter** (sans) — UI and body.
- **JetBrains Mono** — all numerics, timestamps, tabular data. Tabular-nums enabled.
- Weights — Inter: 400/500/600/700 only. Newsreader: 400/500/700. Mono: 400/500. Anything else is forbidden.
- Scale: Tailwind defaults anchored at 16px base, 1.25 ratio. No custom sizes.
- Newsreader should be **self-hosted** in `packages/web/public/fonts/` so Playwright tests are offline-deterministic.

### Chart defaults (Style Guide §8)
- Background transparent (inherits parchment card).
- Gridlines horizontal only, `parchment-300` stroke, `strokeDasharray="2 4"`.
- Ticks: `text-xs` JetBrains Mono, `parchment-600` fill.
- Tooltip: `parchment-50` bg, 1px `parchment-700` border, mono values, radius 0.
- First-mount draw: 200ms ease-out. **No animation on updates.**
- **The Form Line Chart y-axis never shows numbers** — only tier words ("dreadful", "poor", "average", "good", "excellent"). Line color interpolates along the form gradient.
- Banned: radar charts, rating bar charts, gauges for abstract concepts, 3D, pie charts >3 slices.

---

## 9. Test strategy (TDD §18)

| Tier | Runner | Scope | When |
|---|---|---|---|
| Unit | Vitest | Pure functions, rendering, domain logic | every PR |
| Integration | Vitest + test DB | Drizzle repositories against both dialects | every PR, matrix |
| API | Vitest + Hono test client | Routes end-to-end, Zod-validated | every PR |
| **Doctrine (E2E)** | **Playwright** | **Rendered DOM scraped for number leakage** | **every PR** |

- A fixture module generates a deterministic baseline save (seed = 42) with 10 clubs and ~200 players. Every test starts from this fixture.
- The doctrine suite is the single most important test in the repo.
- **TDD ordering is mandatory for AC-numbered tests**: write the test, run it, observe red, paste the failure output into the PR description, then implement. The red screenshot is required because it is easy for an agent to write a test that passes trivially.

---

## 10. CI / CD

GitHub Actions workflow runs four parallel jobs on every PR and push to `main`. All four are **required status checks** — a failure in any blocks merge.

1. **`lint`** — `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck`.
2. **`test-sqlite`** — `pnpm test` with `DATABASE_URL=sqlite::memory:`.
3. **`test-postgres`** — same with a live Postgres 16 service container. Ensures dual-dialect discipline.
4. **`doctrine`** — `pnpm build && pnpm exec playwright install --with-deps && pnpm doctrine`.

`build-image` runs only on push to `main`: builds the Docker image, tags with the git SHA, pushes to ECR. Deploy to staging is automatic on main; prod is manual, triggered by a tag. Both use CDK to update the task definition and let ECS roll the service.

CI gates against the no-numbers doctrine:
- **OpenAPI snapshot test** — Hono emits an OpenAPI doc via `@hono/zod-openapi`; a committed snapshot must match. Any new numeric response field requires explicit sign-off.
- **Migration scan** — `grep -E 'jsonb|ARRAY|CREATE TYPE'` across both migration directories must return nothing.

---

## 11. Local development (TDD §11)

**Prereqs:** Node 20 LTS + pnpm 9, OR Docker Desktop. Nothing else — no local Postgres install, no Python runtime.

**First run:**
```
git clone … && cd rpgfc && pnpm install && pnpm dev
# Vite dev server on :5173
# Hono API on :8787
# SQLite file at ./saves/dev.db (auto-migrated)
```

**Postgres portability testing:**
```
docker compose up -d postgres
# set DATABASE_URL=postgres://rpgfc:rpgfc@localhost:5432/rpgfc in .env.local
```

**Task runner is `just`** (the Makefile is a legacy wrapper). Run `just` alone to list all recipes. The daily ones:

| Recipe | What it does |
|---|---|
| `just dev` | Vite (:5173) + Hono (:8787), SQLite at `./saves/dev.db` |
| `just sim` | Full season simulation → `saves/post-season.db` + markdown report |
| `just play club=7` | Sim, then browse the finished season managing club 7 |
| `just test` / `just test-pg` | Vitest workspace-wide / server tests against compose Postgres (boots it first) |
| `just doctrine` | Playwright no-numbers gate (builds web + server first) |
| `just ci` | Mirror the CI matrix locally — run before pushing anything non-trivial |
| `just gate` | The four doctrine gates only (typecheck, lint, doctrine) |
| `just lint-fixtures` | ESLint against the deliberate violations — MUST exit non-zero |
| `just pg-up` / `pg-down` / `pg-nuke` | Disposable Postgres lifecycle |
| `just db-reset` / `just db-generate` | Wipe the dev save / regenerate migrations for both dialects |

**Single test:** `pnpm --filter @rpgfc/server exec vitest run src/test/<file>.test.ts` (same shape for `@rpgfc/web`; add `-t "test name"` to filter within a file).

**Other entry points:** `pnpm season-report --db <save.db>` (or `just report db=…`) renders the standing post-run season report — final tables with tactics, leading scorers, league health, cross-season comparison — into `tests/playtest/results/`; `pnpm gen-art` regenerates the trading-card player art (`packages/server/src/scripts/generate-player-art.ts`) — GPT Image 2 by default (`OPENAI_API_KEY`), `--provider gemini` retained for comparison, `--hero match-art|ceremony-art|all` regenerates the 16:7 hero panels; `tests/playtest/*.ts` are ad-hoc Playwright tours run directly with `tsx` against a live dev server (`PLAYTEST_BASE`, default :5173).

**Env vars (`.env.local`, gitignored):** `DATABASE_URL`, `NODE_ENV`, `PORT=8787`, `LOG_LEVEL=debug`, `SIM_ENGINE=stub`, `AUTH_MODE=dev`. `MANAGED_CLUB_ID` selects the managed club for `dev:post-season`. Cognito, S3, and Python sim vars are unset in local.

---

## 12. Containerization & AWS (TDD §12, §13)

- **Docker:** multi-stage `node:20-alpine`. Build stage runs `pnpm install --frozen-lockfile`, builds shared → web → server, prunes dev deps with `pnpm deploy --prod`. Runtime stage copies pruned server, compiled web to `./public`, migrations to `./migrations`. Runs as non-root UID 1001. Image must be **< 250 MB**.
- **`better-sqlite3` native binding:** Alpine needs `apk add --no-cache python3 make g++` in the build stage, or the `node-gyp` step fails.
- **Entrypoint:** runs dialect-appropriate migrations, then `exec node ./dist/index.js`. Idempotent and safe to run twice.
- **AWS topology:** Route 53 → ALB (HTTPS/ACM) → single ECS Fargate task (1 vCPU / 2 GB) in private subnet → RDS Postgres 16 (`db.t4g.small`). Plus ECR, Secrets Manager, CloudWatch, S3 (save exports), Cognito (auth). No NAT Gateway — use VPC endpoints.
- **Cost envelope:** ~$85/month baseline.
- **Observability:** pino JSON logs → CloudWatch; built-in Fargate/RDS metrics; OpenTelemetry auto-instrumentation → X-Ray (100% sampling at this volume). Alarms on task health, 5xx > 1%, RDS CPU > 80%, RDS free storage < 20%.
- **Security:** Cognito JWT on every `/api` call; `saveSlotId` scoping; Secrets Manager injection (never logged); HTTPS-only; `HttpOnly; Secure; SameSite=Lax` cookies; strict CSP, no inline scripts.

---

## 13. Performance budget

- Page loads: < 1s interactive on warm cache.
- API: p95 < 100ms (reads), < 300ms (writes).
- Vite bundle: < 300KB gzipped for the initial route (TanStack Router code-splits per route).
- Every list endpoint paginated; every query indexed; **N+1 queries are banned in code review.**
- Sim stub: < 50ms per match.

---

## 14. Data model (conceptual, PRD §18)

Core entities: `Player`, `Club`, `Staff`, `Badge`, `BadgeDefinition`, `Match`, `PlayerMatchPerformance`, `Scout`, `ScoutReport`, `KnowledgeNode`, `Run`, `Season`, `Contract`, `Tactic`, `Manager`.

Load-bearing architectural rules:
- **Hidden attributes on `Player` are package-private.** Only the rendering layer may import them.
- **The Knowledge Graph is the read-through layer** — the UI does not read `Player` directly; it reads `KnowledgeNode` filtered to what the manager currently knows. Two managers can see the same player differently. This is fundamental to Scouting and must be preserved.
- **Every random process takes a seed.** World seed + player index; match seed per match; run seed for rogue-lite modifiers. This enables reproducible bug reports, replays, and shared-seed scenarios.
- `Manager` persists across `Run`s and owns the rogue-lite meta state (Legacy Points, unlocks, career history).

---

## 15. Build plan and stories

Stories live in `docs/stories/`. Each has acceptance criteria numbered `AC-NN` that must all pass before the story ships.

- **Story 00 — Walking Skeleton** (`RPG_FC_Story_00_Walking_Skeleton.docx`) — **shipped.** Stood up the entire stack and all four doctrine gates.
- **Stories 01–08** (`STORY_01_Player_Identity.md` … `STORY_08_Transfer_Market_v2.md`) — markdown specs: player identity, navigation, scouting, transfers, tactics/squad, match engine, season/saves, transfer market v2.
- **Stories 09–12** (`STORY_09_Ten_Team_Foundation.md` … `STORY_12_Season_Pressure.md`) — the "Play Readiness" phase: ten-team league contract, truthful knowledge boundary, causal match core, season pressure (availability/rotation/familiarity). Each carries an **audit table marking ACs Partial/Open** — read it before assuming an AC is done; the remaining gaps are the story's authoritative TODO list.
- `RPG_FC_Fix_Spec_01_Player_Profile.docx` — fix spec for the player profile page.

Substantial work has shipped beyond the written specs (finance v2, AI bidding, season sim harness, player card modals, Best XI, match ratings, season archive) — check `git log` before assuming a feature doesn't exist yet. Before starting a story-numbered task, read its spec end-to-end; the ACs are the definition of done.

---

## 16. Working agreements for Claude Code

1. **Always consult the three design docs before making non-trivial decisions.** PRD for product behavior, TDD for architecture, Style Guide for anything visual. The docs win if this file drifts.
2. **Never weaken the public rendering boundary.** Hidden state may become public only through rendering. The protected simulation compiler may consume it only for server-private `SimPlayer` inputs.
3. **Follow red/green TDD ordering** for every AC-numbered test. Write the test first, run it, observe the failure, implement, run again, observe the pass. Paste the red output into the PR description.
4. **Respect dual-dialect discipline.** Every schema change produces migrations for both dialects in the same PR. Run `make test-pg` locally before assuming a schema works in prod.
5. **Don't introduce new dependencies without justification.** The stack is deliberately conventional. A new library needs a paragraph explaining why the existing stack can't do the job.
6. **When unsure whether a UI element is a feature or a doctrine violation**, assume it's a doctrine violation and ask. A numeric leak that ships is a product-quality incident.
7. **`pnpm dev` must keep working on `main` after every merge.** If you break it, fix it immediately.
8. **Use existing component-library primitives** (`Card`, `BadgeChip`, `NarrativeBlock`, etc.) rather than freestyle JSX. Pages compose components; they do not invent layout.
9. **Prefer prose, badges, and qualitative tiers** over tables or numbers in every user-facing surface.
10. **Commit `routeTree.gen.ts`** — TanStack Router codegen output. Without it, CI typecheck fails on a fresh checkout.
11. **`import type { AppType } from "@rpgfc/server"`** — the `type` keyword is mandatory. Without it, Vite pulls Node built-ins into the web bundle.
12. **When writing documentation inside source files, default to none.** The identifier and the code say what. A comment is for a *why* that would surprise a reader: a hidden constraint, a subtle invariant, a workaround. Don't narrate.
