#!/bin/sh
# AC-10: the container runs migrations against Postgres on boot and serves
# /api/health.
#
# Expects a reachable Postgres via $TEST_POSTGRES_URL in the form
#   postgres://user:pass@host:5432/db
# that is network-accessible from Docker. In CI the workflow starts a
# Postgres service container and links it; locally you can run
#   docker compose up -d postgres
# and pass postgres://rpgfc:rpgfc@host.docker.internal:5432/rpgfc.
set -e

IMAGE="${IMAGE:-rpgfc:dev}"
if [ -z "${TEST_POSTGRES_URL:-}" ]; then
  echo "TEST_POSTGRES_URL not set — skipping"
  exit 0
fi

CONTAINER="rpgfc-pg-smoke-$$"
PORT=18788

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starting $IMAGE with Postgres at $TEST_POSTGRES_URL"
docker run -d --name "$CONTAINER" \
  -e DATABASE_URL="$TEST_POSTGRES_URL" \
  -p "$PORT:8787" \
  "$IMAGE" >/dev/null

for i in $(seq 1 40); do
  if curl -fsS "http://localhost:$PORT/api/health" >/tmp/health-$$.json 2>/dev/null; then
    break
  fi
  sleep 0.5
done

LOGS=$(docker logs "$CONTAINER" 2>&1)
echo "----- container logs -----"
echo "$LOGS"
echo "--------------------------"

echo "$LOGS" | grep -q "Running migrations for dialect postgres" || {
  echo "FAIL: missing 'Running migrations for dialect postgres' log line"
  exit 1
}
echo "$LOGS" | grep -q "Migrations applied" || {
  echo "FAIL: missing 'Migrations applied' log line"
  exit 1
}
echo "$LOGS" | grep -q "Starting Hono server on :8787" || {
  echo "FAIL: missing 'Starting Hono server on :8787' log line"
  exit 1
}

if ! grep -q '"dialect":"postgres"' /tmp/health-$$.json; then
  echo "FAIL: /api/health did not report dialect=postgres"
  cat /tmp/health-$$.json
  exit 1
fi

rm -f /tmp/health-$$.json
echo "OK"
