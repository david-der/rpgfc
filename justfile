# RPG FC — task runner.
#
# Run `just` alone to see the recipe list. Every recipe is a thin wrapper
# over the underlying pnpm / docker command so you can always drop down a
# level without losing context. Keep this file boring; clever recipes belong
# in scripts, not here.

# ── meta ────────────────────────────────────────────────────────────────────

# Default: list available recipes.
default:
    @just --list --unsorted

# Show this file's recipes as a doc page.
help:
    @just --list

# ── install & clean ────────────────────────────────────────────────────────

# Install all workspace dependencies (idempotent, frozen lockfile).
install:
    pnpm install --frozen-lockfile

# Unfrozen install — use when bumping versions and regenerating pnpm-lock.
install-unfrozen:
    pnpm install

# Nuke build outputs but keep node_modules (fast reset).
clean:
    rm -rf packages/*/dist packages/web/dist coverage playwright-report test-results tests/test-results
    find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete 2>/dev/null || true

# Full nuke: node_modules, build outputs, save files, pnpm store.
clean-all: clean
    rm -rf node_modules packages/*/node_modules
    rm -rf saves/*.db saves/*.db-shm saves/*.db-wal

# Wipe and recreate the local SQLite save file.
db-reset:
    rm -f saves/dev.db saves/dev.db-shm saves/dev.db-wal
    @echo "saves/dev.db removed — next dev run will recreate and migrate."

# ── dev loop ───────────────────────────────────────────────────────────────

# Start Vite (:5173) + Hono (:8787) in parallel with a default SQLite DB.
dev:
    pnpm dev

# Just the backend, useful when poking the API with curl.
dev-server:
    DATABASE_URL=sqlite:$PWD/saves/dev.db pnpm --filter @rpgfc/server dev

# Just the frontend (assumes the backend is already running somewhere).
dev-web:
    pnpm --filter @rpgfc/web dev

# Run a full season simulation. Writes saves/post-season.db + a markdown report.
sim:
    pnpm season-sim

# Boot the UI against the post-season save. `just dev-post-season club=7`
dev-post-season club="1":
    MANAGED_CLUB_ID={{club}} pnpm dev:post-season

# Sim, then immediately browse the result. `just play club=7`
play club="1": sim
    MANAGED_CLUB_ID={{club}} pnpm dev:post-season

# Hit the live /api/health endpoint on :8787.
ping:
    @curl -sS http://localhost:8787/api/health | jq . 2>/dev/null || curl -sS http://localhost:8787/api/health

# ── build ──────────────────────────────────────────────────────────────────

# Build shared → web → server in the correct order.
build:
    pnpm build

# Build only the web bundle (fast iteration for doctrine tweaks).
build-web:
    pnpm --filter @rpgfc/web build

# ── quality gates ──────────────────────────────────────────────────────────

# TypeScript strict compile across every package.
typecheck:
    pnpm typecheck

# ESLint (with our custom rpgfc rules).
lint:
    pnpm lint

# ESLint against the deliberate-violation fixtures. MUST exit non-zero.
lint-fixtures:
    @echo "This should FAIL — that's the point. Expect rpgfc/* rule errors below."
    -pnpm exec eslint --no-ignore tests/fixtures/eslint/violations/player-facing-numbers.tsx
    -pnpm exec eslint --no-ignore tests/fixtures/eslint/violations/packages/server/src/routes/route-imports-hidden.ts

# Prettier in check mode (CI-style).
format-check:
    pnpm format:check

# Prettier in write mode (fixup).
format:
    pnpm format

# ── tests ──────────────────────────────────────────────────────────────────

# Vitest across the workspace. Defaults to in-memory SQLite.
test:
    pnpm test

# Server tests against a disposable Postgres. Boots compose first if needed.
test-pg: pg-up
    TEST_POSTGRES_URL=postgres://rpgfc:rpgfc@localhost:5432/rpgfc pnpm --filter @rpgfc/server test

# Playwright doctrine suite (the no-numbers gate).
doctrine:
    pnpm doctrine

# ── full runs ──────────────────────────────────────────────────────────────

# Mirror the CI matrix locally. Run before pushing anything non-trivial.
ci: lint typecheck test doctrine format-check
    @echo "Local CI passed. Push with confidence."

# Just the doctrine gates (all four): typecheck, both custom rules, doctrine.
gate: typecheck lint doctrine
    @echo "All four doctrine gates passed."

# Fresh clone dry run — delete everything, reinstall, build, test.
fresh: clean-all install build test
    @echo "Fresh install + full build + tests succeeded."

# ── postgres (disposable, via docker compose) ──────────────────────────────

# Boot the local Postgres 16 service for dual-dialect work.
pg-up:
    docker compose up -d postgres

# Stop the local Postgres (preserves its volume).
pg-down:
    docker compose stop postgres

# Stop and wipe the local Postgres volume entirely.
pg-nuke:
    docker compose down -v

# psql shell into the dev Postgres. Requires psql locally.
pg-shell:
    PGPASSWORD=rpgfc psql -h localhost -U rpgfc -d rpgfc

# ── container ──────────────────────────────────────────────────────────────

# Build the Fargate-ready Docker image as rpgfc:dev.
docker:
    docker build -f docker/Dockerfile -t rpgfc:dev .

# Run the built image against a tmp SQLite volume on :18787.
docker-run-sqlite: docker
    @echo "Starting rpgfc:dev with SQLite on :18787 (Ctrl-C to stop)"
    docker run --rm -it \
        -e DATABASE_URL=sqlite:/data/test.db \
        -v /tmp/rpgfc-sqlite:/data \
        -p 18787:8787 \
        rpgfc:dev

# Run the image boot smoke scripts (AC-09 / AC-21).
docker-smoke: docker
    IMAGE=rpgfc:dev ./tests/docker/image-size.sh
    IMAGE=rpgfc:dev ./tests/docker/sqlite-boot.sh

# ── migrations ─────────────────────────────────────────────────────────────

# Regenerate Drizzle migrations for both dialects from schema diffs.
# Story 00 ships hand-written initial migrations; later stories use this.
db-generate:
    pnpm --filter @rpgfc/server db:generate
