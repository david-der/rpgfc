# tests/ — operating notes

Per-package unit and integration tests live next to their code under
`packages/*/src/test/`. This directory holds the cross-cutting test
artifacts: the Playwright doctrine suite, deliberate-violation fixtures
for the ESLint rules, and container-boot smoke scripts.

## 1. Test tiers (TDD v2 §18)

| Tier | Runner | Scope | Where |
|---|---|---|---|
| Unit | Vitest | Pure functions, rendering, domain logic | `packages/*/src/test/` |
| Integration | Vitest + test DB | Drizzle repos against both dialects | `packages/server/src/test/` |
| API | Vitest + Hono test client | Routes end-to-end, Zod-validated | `packages/server/src/test/` |
| **Doctrine (E2E)** | **Playwright** | **Rendered DOM scraped for number leakage** | **`tests/doctrine/`** |

## 2. Doctrine suite (`tests/doctrine/`)

This is **the** load-bearing test in the repo. A regression here is a
product-quality incident — the no-numbers thesis relies on it.

- `playwright.config.ts` spins a single Hono process with
  `WEB_DIST=packages/web/dist` so the SPA and the API share one origin
  and one process — the same shape the Docker image uses at runtime
  (TDD v2 §2.1).
- Specs:
  - `landing-palette.spec.ts` — Story 00 AC-14: parchment-50 bg,
    parchment-900 text, Newsreader font family on the heading.
  - `landing-health.spec.ts` — Story 00 AC-15: `data-testid="health-
    dialect"` shows `sqlite` within 2s.
  - `no-numbers.spec.ts` — Story 00 AC-17/18: every element marked
    `data-testid="player-facing"` is scraped and asserted to contain no
    digits, except when the `data-testid` ends with `-allowlist-number`.

**AC-18 validation.** At least once per story, temporarily inject
`<span data-testid="player-facing">Pace 17</span>` into a route,
re-run `pnpm doctrine`, observe the failure, and revert. Document the
screenshot in `docs/README.md`.

## 3. Deliberate-violation fixtures (`tests/fixtures/eslint/violations/`)

Fixtures for the custom ESLint rules. They intentionally break the rules
they target. Two safeguards keep them out of the regular lint sweep:

1. `.eslintrc.cjs` `ignorePatterns` excludes the fixtures directory.
2. `packages/server/src/test/lint-fixtures.test.ts` shells out with
   `pnpm exec eslint --no-ignore "<path>"` so eslint will process the
   fixtures despite the workspace ignore. The `--no-ignore` flag is
   mandatory.

The route-import fixture lives at
`tests/fixtures/eslint/violations/packages/server/src/routes/route-imports-hidden.ts`
because the `rpgfc/no-hidden-in-routes` rule's filename predicate
matches on `packages[/\\]server[/\\]src[/\\]routes[/\\]`. The path is
synthetic but necessary for the rule to fire.

## 4. Container smoke (`tests/docker/`)

Shell scripts that boot the `rpgfc:dev` image and verify end-to-end
behavior:

- `image-size.sh` — Story 00 AC-21 (image < 250 MB, UID 1001).
- `sqlite-boot.sh` — Story 00 AC-09 (container runs migrations against
  SQLite on boot and serves `/api/health`).
- `postgres-boot.sh` — Story 00 AC-10 (same against Postgres; expects
  `TEST_POSTGRES_URL` in the environment).

Each script greps the container logs for the canonical strings emitted
by `entrypoint.sh`:

```
Running migrations for dialect <dialect>
Migrations applied
Starting Hono server on :<port>
```

If you change those log lines, update all three scripts in the same PR.

## 5. Why there's a `package.json` here

`tests/package.json` declares `"type": "module"` so Playwright's loader
can evaluate `playwright.config.ts` as ESM. Without it, Playwright's CJS
transformer tries to load the config as CommonJS, sees ESM `import`
syntax, and fails with `ReferenceError: exports is not defined`.

This is not a real workspace package — it has no dependencies, no
scripts, and isn't listed in `pnpm-workspace.yaml`. Treat it as a
module-type marker only.
