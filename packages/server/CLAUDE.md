# @rpgfc/server — operating notes

Root `CLAUDE.md` has the big picture. This file holds the rules that are
load-bearing *inside* this package. If something here drifts from the TDD or
root CLAUDE.md, the docs win — update this file to match.

## 1. Layer direction (hexagonal — deps flow inward)

```
routes/  →  rendering/  →  application/  →  domain/ + infrastructure/
```

- **`routes/**`** is the lint-enforced boundary. The `rpgfc/no-hidden-in-routes`
  ESLint rule refuses any import under this path from `../application/**`
  or any path matching `*/hidden*` (including `@rpgfc/shared/types/hidden`).
  Routes may only import from `../rendering/` public exports and Zod schemas.
- **`rendering/**`** is the ONLY subtree allowed to read `HiddenPlayer.hiddenAttrs`.
  Import via the deliberate side-door: `@rpgfc/shared/types/hidden`. Produce
  `RenderedPlayer` values (and the other `Rendered*` shapes once Story 01+
  adds them).
- **`application/**`** returns `HiddenPlayer` internally. It is invisible to
  routes. If you catch yourself wanting to call an application service from
  a route, you are re-litigating the rendering boundary — stop and ask.
- **`domain/**`** is stdlib-only. No Hono, no Drizzle, no framework imports.
- **`infrastructure/**`** owns Drizzle repositories, AWS SDK clients, and
  the sim-service HTTP client. (Story 00 leaves it implied; Story 01+ will
  materialize it.)

## 2. Dual-dialect discipline (TDD v2 §5)

Every schema change produces **both** SQLite and Postgres migrations in the
same PR. CI's `test-postgres` job refuses drift.

Banned — the portability scan test grep-asserts on these:

- `JSONB` — JSON goes in `TEXT` columns and is parsed at the app boundary.
- `ARRAY` — use join tables.
- Native `CREATE TYPE` enums — use `TEXT` columns with a Zod enum on write.
- `ILIKE`, `date_trunc`, `generate_series`, other Postgres-only SQL — push
  the logic to the app layer.
- `TIMESTAMP` — SQLite has no native timestamp type. Use ISO-8601 strings
  and parse to `Date` at the boundary.

Every SQLite connection must run the TDD pragmas: `journal_mode = WAL`,
`foreign_keys = ON`, `synchronous = NORMAL`. `createDbClient` sets these
automatically — don't open a second connection bypassing it.

## 3. Migration runner

`src/db/migrate.ts` runs plain `.sql` files in order and records applied
names in a `_migrations` ledger table per dialect. Safe to call on every
container boot (idempotent).

- New migrations land under `src/db/migrations/{sqlite,postgres}/NNNN_*.sql`.
  Story 00 ships `0000_initial.sql` hand-written; Story 01 onwards uses
  `pnpm db:generate` (drizzle-kit) and commits the generated SQL.
- Migrations must be wrapped in `BEGIN`/`COMMIT` or be idempotent.
- Never edit a previously-committed migration. Add a new one.

## 4. Hono RPC type inference

The web package imports `AppType` from `src/index.ts` as a **type-only**
import (`import type { AppType }`) and builds a typed client via
`hc<AppType>("/")`. For this to produce concrete response shapes rather
than `any`:

- **Keep the route chain inline in `createApiApp()`.** Splitting via
  `.use(...)` or `.route("/foo", subRouter)` with a generically-typed
  sub-router collapses inference. If you must factor routes out, return
  the Hono builder expression itself, not a pre-widened type.
- **Never export a conditional return type from `createApp()`.** The
  static-file-serving wrapper returns a different shape when `staticDir`
  is set — if `AppType` were derived from `createApp`, the union would
  destroy inference. `AppType = ReturnType<typeof createApiApp>` keeps
  the web client's view of the API pristine.

## 5. Env parsing

`src/env.ts` is the single source of truth for env validation (Zod).
Story 00 AC-13 requires a missing or malformed `DATABASE_URL` to fail
program startup with a Zod error. Keep `parseEnv` pure (takes an env
record, returns or throws) so the unit test can inject synthetic maps.

Dev default for `DATABASE_URL` is injected by the root `pnpm dev` script,
not by `env.ts` — the schema itself must remain strict so AC-13 stays live.

## 6. Tests

- Live under `src/test/` alongside the code.
- Write AC-numbered tests **first**. Reference the AC number in a comment
  above the test (`// AC-11: ...`). Run, observe red, implement, observe
  green. Paste the red output into the commit or PR description.
- AC-07 (Postgres client) is gated on `TEST_POSTGRES_URL`; it's skipped
  locally and runs in CI's `test-postgres` job. Do not unskip it on a
  machine that has no local Postgres reachable.
- The lint-fixture test shells out to `pnpm exec eslint --no-ignore` — the
  `--no-ignore` flag is mandatory because the workspace `.eslintrc.cjs`
  keeps `tests/fixtures/eslint/violations` in `ignorePatterns` to avoid
  polluting the main lint sweep.

## 7. Runtime shape

`src/dev-server.ts` is the Node process entry — used by both `pnpm dev`
(via `tsx watch`) and the Docker image (via `entrypoint.sh`). The runtime
serves the built Vite bundle as static assets when `WEB_DIST` is set,
matching the single-container design of TDD v2 §2.1.

If you add a new env var, wire it through `env.ts` — never `process.env`
reads deep in the code.
