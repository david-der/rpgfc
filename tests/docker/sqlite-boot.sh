#!/bin/sh
# AC-09: the container runs migrations against SQLite on boot and serves
# /api/health.
set -e

IMAGE="${IMAGE:-rpgfc:dev}"
CONTAINER="rpgfc-sqlite-smoke-$$"
DATA_DIR="$(mktemp -d)"
PORT=18787

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR"
}
trap cleanup EXIT

echo "Starting $IMAGE with SQLite at $DATA_DIR"
docker run -d --name "$CONTAINER" \
  -e DATABASE_URL=sqlite:/data/test.db \
  -v "$DATA_DIR:/data" \
  -p "$PORT:8787" \
  "$IMAGE" >/dev/null

# Give the container up to 20s to boot.
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

echo "$LOGS" | grep -q "Running migrations for dialect sqlite" || {
  echo "FAIL: missing 'Running migrations for dialect sqlite' log line"
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

if [ ! -f "$DATA_DIR/test.db" ]; then
  echo "FAIL: /data/test.db not created inside the container"
  exit 1
fi

if ! grep -q '"dialect":"sqlite"' /tmp/health-$$.json; then
  echo "FAIL: /api/health did not report dialect=sqlite"
  cat /tmp/health-$$.json
  exit 1
fi

rm -f /tmp/health-$$.json
echo "OK"
