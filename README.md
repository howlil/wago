# Wago

[![CI](https://github.com/howlil/wago/actions/workflows/ci.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/ci.yml)
[![CodeQL](https://github.com/howlil/wago/actions/workflows/codeql.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/codeql.yml)
[![Container](https://github.com/howlil/wago/actions/workflows/release-container.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/release-container.yml)

Wago is a small self-hosted WhatsApp gateway for **one WhatsApp account per instance**. It combines an Express API, React operator dashboard, SQLite durable state, and a Baileys session in one Docker-first runtime.

> [!IMPORTANT]
> Wago uses Baileys, an unofficial WhatsApp Web client. Wago is not affiliated with WhatsApp/Meta and cannot guarantee that an account will never be restricted.

## Shape

```text
human operator
  -> WAGO_ADMIN_PASSWORD
  -> HttpOnly browser session
  -> dashboard actions

application backend
  -> Authorization: Bearer <API_KEY>
  -> Wago HTTP API

Wago
  -> SQLite /app/data/wago.db
  -> Baileys /app/data/auth/
  -> one active process/account/volume
```

Wago intentionally does not provide bulk campaigns, scraping, anti-detection, restriction bypasses, multi-session/multi-tenant behavior, media/groups, or distributed-service machinery.

## Quick start

Requirements: Docker Engine, Docker Compose v2, and HTTPS when exposing Wago outside localhost.

```bash
git clone https://github.com/howlil/wago.git
cd wago
export WAGO_ADMIN_PASSWORD="$(openssl rand -base64 32)"
docker compose pull
docker compose up -d
curl http://127.0.0.1:3000/health
```

Then:

1. Open the dashboard through your HTTPS route.
2. Sign in with `WAGO_ADMIN_PASSWORD`.
3. Click **Pair WhatsApp**.
4. Save the generated machine API key when it is shown.
5. Scan the QR from WhatsApp -> Linked devices.

The admin password is never persisted to SQLite or browser storage. Generated machine API keys are shown when created/rotated; Wago persists only their SHA-256 hash.

### Optional deployment-managed API key

```bash
export WAGO_ADMIN_PASSWORD="$(openssl rand -base64 32)"
export API_KEY="$(openssl rand -hex 32)"
docker compose up -d
```

`API_KEY` remains a machine credential. Dashboard sign-in still uses `WAGO_ADMIN_PASSWORD`.

## Storage and operations

Production requires durable storage at `/app/data` and exactly one active Wago process for that volume/account.

```text
/app/data/wago.db
/app/data/wago.db-wal
/app/data/wago.db-shm
/app/data/auth/
```

Wago fails closed when production storage is disposable/unverifiable and uses a SQLite lease to reject overlapping owners. For filesystem backups, stop Wago and capture the entire `/app/data` volume as one secret-bearing snapshot. Do not use `docker compose down -v` during a normal upgrade.

## Server-to-server example

```bash
export WAGO_URL="https://wago.example.com"
export WAGO_API_KEY="your-machine-api-key"

curl -X POST "$WAGO_URL/recipients/allow" \
  -H "Authorization: Bearer $WAGO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone":"6281234567890","label":"Example recipient"}'

curl -X POST "$WAGO_URL/messages/send" \
  -H "Authorization: Bearer $WAGO_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123-status-update" \
  -d '{"to":"6281234567890","text":"Your request has been processed."}'
```

A successful send submission returns HTTP `202` with `status: "pending"`; that is acceptance by Wago, not proof of recipient-device delivery/read state.

## Webhooks

Configure delivery webhooks from **Settings -> Webhook integration**. Callback URL and signing-secret lifecycle are owned by SQLite-backed settings. Delivery is **at least once**; receivers must verify HMAC, validate timestamp age, and deduplicate by `Webhook-Id`.

## Health

- `GET /health` — process liveness.
- `GET /ready` — operational `ok | degraded | not_ready` snapshot.

## Releases

Container distribution remains:

```text
ghcr.io/howlil/wago-simple
```

- `edge` and `sha-*` track verified `main` for integration testing.
- `latest` points only to a stable SemVer release.
- pin a SemVer tag or immutable digest for reproducible production deployments.

See [`RELEASING.md`](RELEASING.md).

## Development

Node.js 26 and pnpm 11.21.0:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Engineering workflow and architecture boundaries live in [`AGENTS.md`](AGENTS.md). `.agent/` is intentionally only a lightweight exception workspace for high-risk design decisions; Git, tests, PRs, and CI are the normal execution record.

## Security

Treat `WAGO_ADMIN_PASSWORD`, API keys, webhook signing secrets, browser cookies, QR payloads, `/app/data` backups, Baileys credentials, phone/JID identifiers, message content, and raw production logs as sensitive. See [`SECURITY.md`](SECURITY.md).

## License

MIT. See [`LICENSE`](LICENSE).
