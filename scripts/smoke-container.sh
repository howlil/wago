#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-wago-hardening-smoke}"
ROLLBACK_IMAGE="${ROLLBACK_IMAGE:-}"
ROLLBACK_CORS_ORIGIN="${ROLLBACK_CORS_ORIGIN:-https://wago.example.com}"
NAME="wago-hardening-smoke-$RANDOM"
ROLLBACK_NAME="${NAME}-rollback"
VOLUME="wago-hardening-smoke-$RANDOM"
PORT="${PORT:-39030}"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker rm -f "$ROLLBACK_NAME" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for_health() {
  local container_name="$1"

  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null; then
      return 0
    fi

    if ! docker inspect "$container_name" >/dev/null 2>&1; then
      return 1
    fi

    sleep 1
  done

  return 1
}

run_container() {
  local container_name="$1"
  local image="$2"
  local cors_origin="${3:-}"
  local env_args=()

  if [[ -n "$cors_origin" ]]; then
    env_args=(-e "CORS_ORIGIN=$cors_origin")
  fi

  docker run -d \
    --name "$container_name" \
    -p "127.0.0.1:${PORT}:3000" \
    -v "$VOLUME:/app/data" \
    "${env_args[@]}" \
    "$image" >/dev/null
  wait_for_health "$container_name"
}

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  docker build -t "$IMAGE" .
fi

docker volume create "$VOLUME" >/dev/null
run_container "$NAME" "$IMAGE"

curl -fsS "http://127.0.0.1:${PORT}/health" | grep -q '"status":"ok"'
READY_BEFORE="$(curl -fsS "http://127.0.0.1:${PORT}/ready")"
echo "$READY_BEFORE" | grep -q '"apiKeyConfigured":false'
curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null

MIGRATIONS_BEFORE="$(docker exec "$NAME" node --input-type=module -e '
  import { DatabaseSync } from "node:sqlite";
  const db = new DatabaseSync("/app/data/wago.db");
  const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
  process.stdout.write(JSON.stringify(rows.map((row) => row.version)));
  db.close();
')"
[[ "$MIGRATIONS_BEFORE" == "[1,2,3]" ]]

docker restart "$NAME" >/dev/null
wait_for_health "$NAME"

READY_AFTER="$(curl -fsS "http://127.0.0.1:${PORT}/ready")"
[[ "$READY_BEFORE" == "$READY_AFTER" ]]

MIGRATIONS_AFTER="$(docker exec "$NAME" node --input-type=module -e '
  import { DatabaseSync } from "node:sqlite";
  const db = new DatabaseSync("/app/data/wago.db");
  const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
  process.stdout.write(JSON.stringify(rows.map((row) => row.version)));
  db.close();
')"
[[ "$MIGRATIONS_AFTER" == "[1,2,3]" ]]

if [[ -n "$ROLLBACK_IMAGE" ]]; then
  docker rm -f "$NAME" >/dev/null
  run_container "$ROLLBACK_NAME" "$ROLLBACK_IMAGE" "$ROLLBACK_CORS_ORIGIN"

  curl -fsS "http://127.0.0.1:${PORT}/health" | grep -q '"status":"ok"'
  ROLLBACK_READY="$(curl -fsS "http://127.0.0.1:${PORT}/ready")"
  [[ "$ROLLBACK_READY" == "$READY_BEFORE" ]]
  curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null

  ROLLBACK_MIGRATIONS="$(docker exec "$ROLLBACK_NAME" node --input-type=module -e '
    import { DatabaseSync } from "node:sqlite";
    const db = new DatabaseSync("/app/data/wago.db");
    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
    process.stdout.write(JSON.stringify(rows.map((row) => row.version)));
    db.close();
  ')"
  [[ "$ROLLBACK_MIGRATIONS" == "[1,2,3]" ]]
fi

echo "Container smoke, restart persistence, and rollback compatibility checks passed."
