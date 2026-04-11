#!/bin/sh
# AC-21: the rpgfc:dev image is strictly smaller than 250 MB and runs as
# non-root UID 1001.
set -e

IMAGE="${IMAGE:-rpgfc:dev}"
MAX_BYTES=$((250 * 1024 * 1024))

SIZE=$(docker image inspect --format='{{.Size}}' "$IMAGE")
USER=$(docker image inspect --format='{{.Config.User}}' "$IMAGE")

echo "Image:    $IMAGE"
echo "Size:     $SIZE bytes"
echo "Max:      $MAX_BYTES bytes"
echo "User:     $USER"

if [ "$SIZE" -ge "$MAX_BYTES" ]; then
  echo "FAIL: image size $SIZE ≥ $MAX_BYTES"
  exit 1
fi

if [ "$USER" != "1001" ] && [ "$USER" != "rpgfc" ]; then
  echo "FAIL: image user '$USER' is not UID 1001 / rpgfc"
  exit 1
fi

echo "OK"
