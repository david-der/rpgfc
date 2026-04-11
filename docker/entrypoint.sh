#!/bin/sh
# RPG FC container entrypoint.
#
# 1. Runs migrations for the configured DATABASE_URL dialect (idempotent).
# 2. Starts the Hono server. Static assets are served from $WEB_DIST
#    (set in the Dockerfile to /app/public).
#
# Log output is shaped for the boot-time smoke tests in tests/docker/:
#   "Running migrations for dialect <dialect>"
#   "Migrations applied"
#   "Starting Hono server on :<port>"
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "FATAL: DATABASE_URL is not set" >&2
  exit 1
fi

DIALECT_PREFIX="${DATABASE_URL%%:*}"
case "$DIALECT_PREFIX" in
  sqlite)    DIALECT="sqlite" ;;
  postgres|postgresql) DIALECT="postgres" ;;
  *)
    echo "FATAL: unsupported DATABASE_URL scheme: $DIALECT_PREFIX" >&2
    exit 1
    ;;
esac

echo "Running migrations for dialect $DIALECT"
node ./dist/db/migrate.js
echo "Migrations applied"

echo "Starting Hono server on :${PORT:-8787}"
exec node ./dist/dev-server.js
