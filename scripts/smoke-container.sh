#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-wago-hardening-smoke}"
ROLLBACK_IMAGE="${ROLLBACK_IMAGE:-}"
ROLLBACK_CORS_ORIGIN="${ROLLBACK_CORS_ORIGIN:-https://wago.example.com}"
EXPECTED_MIGRATIONS="${EXPECTED_MIGRATIONS:-[1,2,3,4,5,6,7]}"
NAME="wago-hardening-smoke-$RANDOM"
REPLACEMENT_NAME="${NAME}-replacement"
CONTENDER_NAME="${NAME}-contender"
EPHEMERAL_NAME="${NAME}-ephemeral"
ROLLBACK_NAME="${NAME}-rollback"
VOLUME="wago-hardening-smoke-$RANDOM"
PORT="${PORT:-39030}"

cleanup() {
  docker rm -f "$NAME" "$REPLACEMENT_NAME" "$CONTENDER_NAME" "$EPHEMERAL_NAME" "$ROLLBACK_NAME" >/dev/null 2>&1 || true
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

  docker logs "$container_name" >&2 || true
  return 1
}

wait_for_exit() {
  local container_name="$1"
  for _ in $(seq 1 20); do
    if [[ "$(docker inspect -f '{{.State.Running}}' "$container_name" 2>/dev/null || echo false)" == "false" ]]; then
      return 0
    fi
    sleep 1
  done
  docker logs "$container_name" >&2 || true
  return 1
}

stop_and_remove() {
  local container_name="$1"
  docker stop -t 10 "$container_name" >/dev/null
  docker rm "$container_name" >/dev/null
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

read_migrations() {
  local container_name="$1"
  docker exec "$container_name" node --input-type=module -e '
    import { DatabaseSync } from "node:sqlite";
    const db = new DatabaseSync("/app/data/wago.db");
    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
    process.stdout.write(JSON.stringify(rows.map((row) => row.version)));
    db.close();
  '
}

read_app_id() {
  local container_name="$1"
  docker exec "$container_name" node --input-type=module -e '
    import { DatabaseSync } from "node:sqlite";
    const db = new DatabaseSync("/app/data/wago.db");
    const row = db.prepare("SELECT app_id FROM app_settings WHERE id = 1").get();
    process.stdout.write(String(row?.app_id ?? ""));
    db.close();
  '
}

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  docker build -t "$IMAGE" .
fi

# Production image-mode deploys without durable /app/data must fail closed.
docker run -d --name "$EPHEMERAL_NAME" "$IMAGE" >/dev/null
wait_for_exit "$EPHEMERAL_NAME"
EPHEMERAL_LOGS="$(docker logs "$EPHEMERAL_NAME" 2>&1)"
grep -q 'PERSISTENT_DATA_REQUIRED' <<< "$EPHEMERAL_LOGS"

docker volume create "$VOLUME" >/dev/null
run_container "$NAME" "$IMAGE"

HEALTH_BEFORE="$(curl -fsS "http://127.0.0.1:${PORT}/health")"
grep -q '"status":"ok"' <<< "$HEALTH_BEFORE"
READY_BEFORE="$(curl -fsS "http://127.0.0.1:${PORT}/ready")"
grep -q '"apiKeyConfigured":false' <<< "$READY_BEFORE"
curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null

MIGRATIONS_BEFORE="$(read_migrations "$NAME")"
[[ "$MIGRATIONS_BEFORE" == "$EXPECTED_MIGRATIONS" ]]
APP_ID_BEFORE="$(read_app_id "$NAME")"
[[ -n "$APP_ID_BEFORE" ]]

# A second process sharing the same volume must not become active.
docker run -d --name "$CONTENDER_NAME" -v "$VOLUME:/app/data" "$IMAGE" >/dev/null
wait_for_exit "$CONTENDER_NAME"
CONTENDER_LOGS="$(docker logs "$CONTENDER_NAME" 2>&1)"
grep -q 'WAGO_INSTANCE_ALREADY_ACTIVE' <<< "$CONTENDER_LOGS"

docker restart "$NAME" >/dev/null
wait_for_health "$NAME"

READY_AFTER="$(curl -fsS "http://127.0.0.1:${PORT}/ready")"
[[ "$READY_BEFORE" == "$READY_AFTER" ]]
MIGRATIONS_AFTER="$(read_migrations "$NAME")"
[[ "$MIGRATIONS_AFTER" == "$EXPECTED_MIGRATIONS" ]]

# Normal replacement is stop-old-before-start-new so shutdown can release the lease.
stop_and_remove "$NAME"
run_container "$REPLACEMENT_NAME" "$IMAGE"
APP_ID_AFTER="$(read_app_id "$REPLACEMENT_NAME")"
[[ "$APP_ID_AFTER" == "$APP_ID_BEFORE" ]]

if [[ -n "$ROLLBACK_IMAGE" ]]; then
  stop_and_remove "$REPLACEMENT_NAME"
  run_container "$ROLLBACK_NAME" "$ROLLBACK_IMAGE" "$ROLLBACK_CORS_ORIGIN"

  ROLLBACK_HEALTH="$(curl -fsS "http://127.0.0.1:${PORT}/health")"
  grep -q '"status":"ok"' <<< "$ROLLBACK_HEALTH"
  ROLLBACK_READY="$(curl -fsS "http://127.0.0.1:${PORT}/ready")"
  grep -q '"apiKeyConfigured":false' <<< "$ROLLBACK_READY"
  curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null
fi

echo "Container storage, single-instance, replacement persistence, and rollback checks passed."
