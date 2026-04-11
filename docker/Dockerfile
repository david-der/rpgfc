# syntax=docker/dockerfile:1.7
# RPG FC — multi-stage image per TDD v2 §12.1.
#
#   Stage 1 (build):   install, build shared → web → server, prune dev deps.
#   Stage 2 (runtime): non-root (UID 1001), minimal Node-only image.
#
# Image target size: < 250 MB (Story 00 AC-21). Alpine + a pruned pnpm deploy
# gets us there comfortably when only server runtime deps remain.

# ────────────────────────── Stage 1: build ──────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# better-sqlite3 is a native module — needs python3, make, g++ to build its
# binding on Alpine (Story 00 §9.1 known risk). Installed here, discarded
# with the build stage.
RUN apk add --no-cache python3 make g++ libc6-compat

# Enable pnpm via corepack (bundled with Node 20).
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Install deps first so Docker layer-caching shortcuts work on source-only
# changes. Copy manifest files before copying the rest.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json .eslintrc.cjs .prettierrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
COPY packages/eslint-plugin-rpgfc/package.json packages/eslint-plugin-rpgfc/

RUN pnpm install --frozen-lockfile

# Copy sources and build.
COPY . .
RUN pnpm --filter @rpgfc/shared build \
 && pnpm --filter @rpgfc/web build \
 && pnpm --filter @rpgfc/server build

# Prune dev dependencies into a clean /app/deploy directory. `pnpm deploy`
# copies the production closure and rewrites workspace: links.
RUN pnpm --filter @rpgfc/server deploy --prod /app/deploy

# ────────────────────────── Stage 2: runtime ────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# libc6-compat is needed at runtime for better-sqlite3's native binding.
RUN apk add --no-cache libc6-compat

# Non-root user — TDD v2 §17 security control.
RUN addgroup -g 1001 -S rpgfc && adduser -u 1001 -S rpgfc -G rpgfc

# Pruned server bundle (includes node_modules with only prod deps).
COPY --from=build --chown=rpgfc:rpgfc /app/deploy ./
# Compiled web bundle → ./public. Hono serves it when WEB_DIST=/app/public.
COPY --from=build --chown=rpgfc:rpgfc /app/packages/web/dist ./public
# Migration SQL files alongside the runtime so the entrypoint can find them.
COPY --from=build --chown=rpgfc:rpgfc /app/packages/server/src/db/migrations ./dist/db/migrations

COPY --chown=rpgfc:rpgfc docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER 1001
EXPOSE 8787
ENV NODE_ENV=production
ENV WEB_DIST=/app/public
ENTRYPOINT ["./entrypoint.sh"]
