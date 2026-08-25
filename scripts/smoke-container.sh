#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-wago-hardening-smoke}"
ROLLBACK_IMAGE="${ROLLBACK_IMAGE:-}"
ROLLBACK_CORS_ORIGIN="${ROLLBACK_CORS_ORIGIN:-https://wago.example.com}"
EXPECTED_MIGRATIONS="${EXPECTED_MIGRATIONS:-[1,2,3,4,5,6,7,8]}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-wago-smoke-admin-password-2026}"
API_KEY_CANDIDATE="${API_KEY_CANDIDATE:-wa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"
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
    if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null; then return 0; fi
    if [[ "$(docker inspect -f '{{.State.Running}}' "$container_name" 2>/dev/null || echo false)" == "false" ]]; then
      docker logs "$container_name" >&2 || true
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
    if [[ "$(docker inspect -f '{{.State.Running}}' "$container_name" 2>/dev/null || echo false)" == "false" ]]; then return 0; fi
    sleep 1
  done
  docker logs "$container_name" >&2 || true
  return 1
}

stop_and_remove() {
  docker stop -t 10 "$1" >/dev/null
  docker rm "$1" >/dev/null
}

run_container() {
  local container_name="$1"
  local image="$2"
  local cors_origin="${3:-}"
  local env_args=(-e "WAGO_ADMIN_PASSWORD=$ADMIN_PASSWORD")
  if [[ -n "$cors_origin" ]]; then env_args+=(-e "CORS_ORIGIN=$cors_origin"); fi

  docker run -d \
    --name "$container_name" \
    -p "127.0.0.1:${PORT}:3000" \
    -v "$VOLUME:/app/data" \
    "${env_args[@]}" \
    "$image" >/dev/null
  wait_for_health "$container_name"
}

read_migrations() {
  docker exec "$1" node --input-type=module -e '
    import { DatabaseSync } from "node:sqlite";
    const db = new DatabaseSync("/app/data/wago.db");
    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
    process.stdout.write(JSON.stringify(rows.map((row) => row.version)));
    db.close();
  '
}

read_app_id() {
  docker exec "$1" node --input-type=module -e '
    import { DatabaseSync } from "node:sqlite";
    const db = new DatabaseSync("/app/data/wago.db");
    const row = db.prepare("SELECT app_id FROM app_settings WHERE id = 1").get();
    process.stdout.write(String(row?.app_id ?? ""));
    db.close();
  '
}

read_api_key_hash() {
  docker exec "$1" node --input-type=module -e '
    import { DatabaseSync } from "node:sqlite";
    const db = new DatabaseSync("/app/data/wago.db");
    const row = db.prepare("SELECT api_key_hash FROM app_settings WHERE id = 1").get();
    process.stdout.write(String(row?.api_key_hash ?? ""));
    db.close();
  '
}

sign_in_and_bootstrap() {
  local login_headers session_cookie bootstrap_response
  login_headers="$(curl -fsS -D - -o /tmp/wago-login-body \
    -X POST "http://127.0.0.1:${PORT}/app/session" \
    -H 'Host: wago.example.com' \
    -H 'Origin: https://wago.example.com' \
    -H 'Content-Type: application/json' \
    --data "{\"password\":\"$ADMIN_PASSWORD\"}")"
  grep -q '"authenticated":true' /tmp/wago-login-body
  session_cookie="$(awk 'BEGIN { IGNORECASE=1 } /^set-cookie:/ { print $2; exit }' <<< "$login_headers" | tr -d '\r' | cut -d';' -f1)"
  [[ "$session_cookie" == wago_session=* ]]

  bootstrap_response="$(curl -fsS \
    -X POST "http://127.0.0.1:${PORT}/app/bootstrap" \
    -H 'Host: wago.example.com' \
    -H 'Origin: https://wago.example.com' \
    -H "Cookie: $session_cookie" \
    -H 'Content-Type: application/json' \
    --data "{\"apiKey\":\"$API_KEY_CANDIDATE\"}")"
  grep -q '"success":true' <<< "$bootstrap_response"
  grep -q "\"apiKey\":\"$API_KEY_CANDIDATE\"" <<< "$bootstrap_response"
}

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then docker build -t "$IMAGE" .; fi

# Production must reject disposable /app/data.
docker run -d --name "$EPHEMERAL_NAME" -e "WAGO_ADMIN_PASSWORD=$ADMIN_PASSWORD" "$IMAGE" >/dev/null
wait_for_exit "$EPHEMERAL_NAME"
grep -q 'PERSISTENT_DATA_REQUIRED' <<< "$(docker logs "$EPHEMERAL_NAME" 2>&1)"

docker volume create "$VOLUME" >/dev/null
run_container "$NAME" "$IMAGE"

grep -q '"status":"ok"' <<< "$(curl -fsS "http://127.0.0.1:${PORT}/health")"
grep -q '"apiKeyConfigured":false' <<< "$(curl -fsS "http://127.0.0.1:${PORT}/ready")"
MIGRATIONS_BEFORE="$(read_migrations "$NAME")"
[[ "$MIGRATIONS_BEFORE" == "$EXPECTED_MIGRATIONS" ]]
APP_ID_BEFORE="$(read_app_id "$NAME")"
[[ -n "$APP_ID_BEFORE" ]]

sign_in_and_bootstrap
grep -q '"apiKeyConfigured":true' <<< "$(curl -fsS "http://127.0.0.1:${PORT}/ready")"
API_KEY_HASH_BEFORE="$(read_api_key_hash "$NAME")"
[[ "$API_KEY_HASH_BEFORE" =~ ^[0-9a-f]{64}$ ]]

# A second process sharing the same volume must fail closed.
docker run -d --name "$CONTENDER_NAME" -e "WAGO_ADMIN_PASSWORD=$ADMIN_PASSWORD" -v "$VOLUME:/app/data" "$IMAGE" >/dev/null
wait_for_exit "$CONTENDER_NAME"
grep -q 'WAGO_INSTANCE_ALREADY_ACTIVE' <<< "$(docker logs "$CONTENDER_NAME" 2>&1)"

docker restart "$NAME" >/dev/null
wait_for_health "$NAME"
grep -q '"apiKeyConfigured":true' <<< "$(curl -fsS "http://127.0.0.1:${PORT}/ready")"
[[ "$(read_migrations "$NAME")" == "$EXPECTED_MIGRATIONS" ]]
[[ "$(read_api_key_hash "$NAME")" == "$API_KEY_HASH_BEFORE" ]]

# Normal replacement is stop-old-before-start-new.
stop_and_remove "$NAME"
run_container "$REPLACEMENT_NAME" "$IMAGE"
[[ "$(read_app_id "$REPLACEMENT_NAME")" == "$APP_ID_BEFORE" ]]
[[ "$(read_api_key_hash "$REPLACEMENT_NAME")" == "$API_KEY_HASH_BEFORE" ]]

if [[ -n "$ROLLBACK_IMAGE" ]]; then
  stop_and_remove "$REPLACEMENT_NAME"
  run_container "$ROLLBACK_NAME" "$ROLLBACK_IMAGE" "$ROLLBACK_CORS_ORIGIN"
  grep -q '"status":"ok"' <<< "$(curl -fsS "http://127.0.0.1:${PORT}/health")"
  grep -q '"apiKeyConfigured":true' <<< "$(curl -fsS "http://127.0.0.1:${PORT}/ready")"
  [[ "$(read_app_id "$ROLLBACK_NAME")" == "$APP_ID_BEFORE" ]]
  [[ "$(read_api_key_hash "$ROLLBACK_NAME")" == "$API_KEY_HASH_BEFORE" ]]
fi

echo "Container storage, admin-session bootstrap, machine-key persistence, single-instance, replacement, and rollback checks passed."
