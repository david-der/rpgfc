# RPG FC — Developer README

This is the engineer-facing entry point. For product context, read the design
docs in this directory:

- `RPG_FC_Product_Requirements_Document.docx` — PRD v1.0
- `RPG_FC_Technical_Design_Document_v2.docx` — TDD v2.0 (TypeScript stack)
- `RPG_FC_Design_and_Style_Guide.docx` — Style Guide v1.0
- `stories/RPG_FC_Story_00_Walking_Skeleton.docx` — Story 00

For the agent-facing operating manual, see `../CLAUDE.md` at the repo root.

---

## First-run flow (AC-01)

Prerequisites: **Node 20 LTS** and **pnpm 9** on your PATH. Nothing else.

```
git clone <repo>
cd rpgfc
pnpm install
pnpm dev
```

Within 10 seconds you should see:

- Vite dev server on <http://localhost:5173>
- Hono API on <http://localhost:8787>
- SQLite save file at `./saves/dev.db` (auto-migrated on first boot)
- The landing page in your browser with the backend dialect (`sqlite`)
  rendered inside the "Backend health" card

If `pnpm install` fails on `better-sqlite3`, you are probably on a machine
without the native toolchain. Install Xcode Command Line Tools on macOS
(`xcode-select --install`) or `build-essential` + `python3` on Linux.

## Local dev against Postgres

```
docker compose up -d postgres
# edit .env.local — set DATABASE_URL=postgres://rpgfc:rpgfc@localhost:5432/rpgfc
pnpm dev
```

`docker-compose.yml` boots a disposable Postgres 16. The application binary
is identical; only `DATABASE_URL` changes.

## Make targets

| Target | What it does |
|---|---|
| `make dev` | `pnpm dev` — starts web + server with hot reload |
| `make test` | `pnpm test` — Vitest across all packages |
| `make test-pg` | Runs server tests against a disposable Postgres |
| `make doctrine` | Playwright no-numbers suite |
| `make lint` | ESLint + TypeScript check |
| `make db-reset` | Wipes and recreates `./saves/dev.db` |
| `make build` | Full production bundle |
| `make docker` | Builds the Fargate-ready image locally |

## Validating doctrine gates

The four doctrine gates (TDD v2 §18 / Story 00 §3.6) protect the no-numbers
product thesis. Each gate must fail when a deliberate violation is
introduced. Walk through these once after any scaffolding change.

### Gate 1 — TypeScript strict compile (AC-02)

```
pnpm typecheck
```

To validate: add a raw numeric field to `RenderedPlayer` (e.g., `pace:
number;`), re-run `pnpm typecheck`. The `@rpgfc/web` package's
`api-types.test-d.ts` should compile but the intent is caught by review —
the branded type alone can't stop a human-typed property rename, so keep
code review attentive to response-shape additions.

### Gate 2 — `rpgfc/no-numbers-in-player-facing` (AC-03, AC-04)

```
pnpm lint           # normal sweep, should be green
pnpm lint:fixtures  # runs eslint on the deliberate violations directory
```

`pnpm lint:fixtures` MUST exit non-zero. The error output must name
`rpgfc/no-numbers-in-player-facing`. To validate the rule catches new
violations, temporarily add

```tsx
<span data-testid="player-facing">Pace 17</span>
```

to `packages/web/src/routes/index.tsx`, run `pnpm lint`, observe the error,
then revert.

### Gate 3 — `rpgfc/no-hidden-in-routes` (AC-05)

Same drill as Gate 2. The fixture lives at
`tests/fixtures/eslint/violations/packages/server/src/routes/route-imports-hidden.ts`.
The path is synthetic — the file is outside the real server tree — so the
rule's filename matcher fires on it without polluting production code.

To validate on a real file, temporarily add this import to any file under
`packages/server/src/routes/`:

```ts
import { HiddenPlayer } from "@rpgfc/shared/types/hidden";
```

Run `pnpm lint`. Expect an error from `rpgfc/no-hidden-in-routes`. Revert.

### Gate 4 — Playwright doctrine suite (AC-17, AC-18)

```
pnpm doctrine
```

This builds both packages, boots the production Hono server serving the
built Vite bundle from `./packages/web/dist`, and walks the landing page
asserting no `data-testid="player-facing"` element contains a number.

To validate the gate: temporarily add `<span data-testid="player-facing">Pace
17</span>` to `packages/web/src/routes/index.tsx`, rebuild, re-run
`pnpm doctrine`, observe the failure message naming the offending text,
then revert.

## Dual-dialect regression drill (AC-20)

The CI matrix must refuse a PR that works on SQLite but not on Postgres.
To prove this once: add a column to the Drizzle schema that uses a
SQLite-only type (e.g., `BLOB` affinity with a non-standard collation).
Generate migrations via `pnpm db:generate`, push, watch `test-sqlite` pass
and `test-postgres` fail. Revert, reopen, confirm both green.

## Repository layout

```
rpgfc/
├── CLAUDE.md                       # agent operating manual
├── Makefile
├── package.json                    # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json              # strict everywhere
├── .eslintrc.cjs                   # hosts rpgfc/* custom rules
├── docker/
│   ├── Dockerfile                  # multi-stage, non-root UID 1001
│   └── entrypoint.sh               # runs migrations, starts Hono
├── docker-compose.yml              # disposable local Postgres
├── .github/workflows/ci.yml        # 4-job matrix: lint, sqlite, pg, doctrine
├── docs/                           # PRD, TDD, Style Guide, stories, README
├── packages/
│   ├── shared/                     # @rpgfc/shared — types, Zod, constants
│   ├── server/                     # @rpgfc/server — Hono, Drizzle, rendering
│   ├── web/                        # @rpgfc/web — Vite + React + Tailwind
│   ├── eslint-plugin-rpgfc/        # custom rules (plain CommonJS)
│   └── infra/                      # @rpgfc/infra — CDK (Story 09)
└── tests/
    ├── doctrine/                   # Playwright no-numbers suite
    ├── docker/                     # container smoke scripts
    └── fixtures/eslint/violations/ # deliberate lint-rule triggers
```
