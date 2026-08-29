# Wago

[![CI](https://github.com/howlil/wago/actions/workflows/ci.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/ci.yml)
[![CodeQL](https://github.com/howlil/wago/actions/workflows/codeql.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/codeql.yml)
[![Container](https://github.com/howlil/wago/actions/workflows/release-container.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/release-container.yml)
[![License](https://img.shields.io/github/license/howlil/wago)](LICENSE)

Wago is a lightweight, self-hosted WhatsApp gateway for one WhatsApp account. It combines a protected HTTP API, a React control dashboard, SQLite application state, and a Baileys session in one small runtime.

> [!IMPORTANT]
> Wago uses [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial WhatsApp Web client. Wago is not affiliated with or endorsed by WhatsApp or Meta and cannot guarantee that an account will never be restricted or banned.

## What Wago is

Wago is intentionally narrow. It is designed for developers and self-hosters who need one inspectable gateway behind an existing application, not a campaign platform or multi-tenant messaging SaaS.

Current capabilities include:

- one WhatsApp account per Wago instance
- zero-`.env` first-run setup from the dashboard
- separate admin-password dashboard authentication and machine Bearer API credentials
- salted persisted admin-password hash and opaque HttpOnly dashboard sessions
- generated or optional deployment-managed machine API keys
- API-key rotation independent from normal dashboard sign-in
- QR pairing, reconnect handling, terminal-session invalidation, and explicit rebind
- recipient allow and opt-out controls
- protected outbound text messaging with idempotency and local guardrails
- retained recent message state: `pending`, `accepted`, or `rejected`
- durable signed delivery webhooks with retry, restart recovery, history, and manual redelivery
- webhook configuration, test delivery, and signing-secret rotation from authenticated Settings
- WhatsApp reach-out/new-chat account-health signals
- structured sanitized Wago/Baileys audit events
- SQLite-backed durable application state and persistent Baileys auth
- separate liveness (`/health`) and operational readiness (`/ready`)
- Docker/GHCR distribution, CI, CodeQL, and multi-architecture images

Wago intentionally does **not** provide bulk campaigns, scraping, multi-session/multi-tenant behavior, anti-detection features, restriction bypassing, message-history persistence, inbound messaging APIs, media, or groups.

## Authentication model

Wago deliberately separates human and machine credentials:

```text
First browser visit
    |
    | create admin password
    v
Wago stores salted password hash in SQLite
    |
    | later sign-in
    v
HttpOnly wago_session
    |
    v
Protected dashboard actions

Application backend
    |
    | Authorization: Bearer <WAGO_API_KEY>
    v
Wago HTTP API
```

The raw admin password is never stored. Wago persists only a salted scrypt hash in private SQLite state and exchanges a valid password for an opaque HttpOnly browser session. The machine API key is separate and intended for external server-to-server clients. Do not embed either credential in a public browser bundle.

Durable state lives under one directory:

```text
/app/data/wago.db          SQLite application state
/app/data/wago.db-wal      SQLite WAL while active
/app/data/wago.db-shm      SQLite shared memory while active
/app/data/auth/            Baileys authentication/session state
```

Wago remains single-account and single-active-instance. Never run two active Wago processes against the same `/app/data` volume.

## Quick start

Requirements: Docker Engine, Docker Compose v2, and an HTTPS reverse proxy/tunnel/PaaS route when Wago is exposed outside localhost.

### Default — no `.env` required

```bash
git clone https://github.com/howlil/wago.git
cd wago
docker compose pull
docker compose up -d
curl http://127.0.0.1:3000/health
```

Open Wago. On a fresh instance, a dedicated setup screen asks you to create the admin password before any Control, Settings, or Audit workspace is rendered. Wago stores only a salted password hash in SQLite and immediately creates an HttpOnly browser session.

Then click **Pair WhatsApp**. Wago generates the machine API key, persists only its SHA-256 hash, shows the raw key once for you to save in your application or secret manager, and starts WhatsApp QR pairing.

No `.env`, setup token, log-derived secret, or restart is required for the default first-run path.

> [!IMPORTANT]
> A fresh instance uses first-browser ownership for admin setup. Complete the first-run admin setup before exposing an uninitialized Wago dashboard to an untrusted network.

### Optional — pre-provisioned machine API key

Use `API_KEY` only when your deployment platform or secret manager must own the machine credential:

```bash
API_KEY="$(openssl rand -hex 32)" docker compose up -d
```

An environment-managed API key is not copied into SQLite and cannot be rotated from the dashboard; rotate it in the deployment secret manager instead. Dashboard authentication is still created and managed inside Wago and does not require an environment password.

## Production storage is mandatory

The stock Compose file mounts the named volume `wago_data` at `/app/data`. Production intentionally refuses to start when `/app/data` is backed only by the container writable layer, root overlay, `tmpfs`, `ramfs`, or an unverifiable disposable filesystem.

A generic image deployment must deliberately attach stable storage at `/app/data`:

```text
stable named/bind volume -> /app/data
```

Do not disable `PERSISTENT_DATA_REQUIRED` to make a deployment boot. Fix the platform mount instead. A bare image-level anonymous volume is not a substitute for a platform-managed stable volume identity that is reattached across replacement containers.

Never use `docker compose down -v` for a normal upgrade; `-v` removes persistent gateway state, including the admin credential hash, WhatsApp auth, and queued webhook deliveries.

## Browser and API authentication

The dashboard and external application API use different credentials:

- a fresh dashboard creates its admin password through `POST /app/admin/setup`
- Wago persists only a salted scrypt hash of that password in SQLite
- `POST /app/session` exchanges the admin password for an opaque HttpOnly `wago_session` cookie
- external applications use `Authorization: Bearer <API_KEY>`
- generated API keys are stored as hashes only
- rotating a generated API key revokes other dashboard sessions while preserving the initiating session
- `POST /app/session/logout-all` revokes every dashboard session without changing WhatsApp auth

Production admin setup, dashboard sign-in, and state-changing cookie requests enforce same-origin checks. First machine-key bootstrap also requires an authenticated browser session in production.

Wago does not expose a configurable browser CORS allowlist. External integrations should normally call Wago from their backend.

## Pairing

On a fresh gateway:

1. open Wago and set the admin password on the dedicated setup screen
2. click **Pair WhatsApp**
3. save the generated machine API key when it is shown
4. scan the QR from **WhatsApp → Linked devices → Link a device**

Later pairing/rebind operations use the authenticated browser session. The machine API key is not required for normal dashboard sign-in.

Before creating a socket, Wago attempts to resolve the current WhatsApp Web version through Baileys. If that lookup fails, it continues with the Baileys bundled/default version rather than hard-coding a deployment version.

## Basic server-to-server flow

```bash
export WAGO_URL="https://wago.example.com"
export WAGO_API_KEY="your-api-key"
```

### 1. Allow a recipient

```bash
curl -X POST "$WAGO_URL/recipients/allow" \
  -H "Authorization: Bearer $WAGO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone":"6281234567890","label":"Example recipient"}'
```

Only allow a recipient when your application has a legitimate basis to send to that recipient. Do not call `allow` before every message as a policy bypass.

### 2. Send a text message

```bash
curl -X POST "$WAGO_URL/messages/send" \
  -H "Authorization: Bearer $WAGO_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123-status-update" \
  -d '{"to":"6281234567890","text":"Your request has been processed."}'
```

Successful submission returns HTTP `202` with `status: "pending"`. This means Wago accepted the outbound operation; it is not proof of recipient-device delivery or read state.

### 3. Check retained message state

```bash
curl "$WAGO_URL/messages/<message-id>/status" \
  -H "Authorization: Bearer $WAGO_API_KEY"
```

The retained states are `pending`, `accepted`, and `rejected`. `accepted` means WhatsApp produced at least a server acknowledgement. Recent message-status state is transient and may disappear after restart.

## Delivery webhooks

Webhook configuration is managed from **Settings → Webhook integration**. Wago persists the callback URL and signing secret in private SQLite state because the raw signing secret is required to produce HMAC signatures.

After saving an enabled webhook configuration, **Send test webhook** queues a `wago.test` callback through the same production signing, timeout, durable queue, retry, and delivery-history path. The test body contains no message content or recipient data. `POST /webhooks/test` is a dashboard-only action: it requires a valid browser session, enforces same-origin in production, and does not accept Bearer-only API authentication.

Webhook requests include a stable delivery ID, timestamp, event type, and HMAC-SHA256 signature. Consumers must:

- verify the signature against the raw request body
- enforce a reasonable timestamp age
- deduplicate by `Webhook-Id`
- handle callbacks idempotently

Delivery semantics are **at least once**. Retry and manual redelivery preserve the same delivery ID. Network errors, timeouts, `408`, `429`, and `5xx` responses are retried durably for up to 24 hours.

Wago deliberately excludes message text, API credentials, and recipient phone/JID data from webhook payloads.

## API summary

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | HTTP process liveness |
| `GET` | `/ready` | Public | Operational `ok` / `degraded` / `not_ready` snapshot |
| `GET` | `/app/info` | Public | Dashboard-auth mode, API credential source, and request-auth state |
| `POST` | `/app/admin/setup` | Fresh same-origin dashboard | Create the one-time admin credential and browser session |
| `POST` | `/app/session` | Admin password | Exchange the human credential for a browser session |
| `POST` | `/app/bootstrap` | Browser session | Create or verify the generated machine API key; production requires an authenticated same-origin dashboard session |
| `POST` | `/app/api-key/rotate` | Browser session | Rotate generated machine API key |
| `POST` | `/app/session/logout` | Browser session | End current dashboard session |
| `POST` | `/app/session/logout-all` | Browser session | Revoke every dashboard session |
| `GET` | `/activity` | API key/session | Query sanitized audit events |
| `GET` | `/recipients` | API key/session | List recipient policy records |
| `POST` | `/recipients/allow` | API key/session | Explicitly allow a recipient |
| `POST` | `/recipients/:phone/opt-out` | API key/session | Block outbound to a recipient |
| `GET` | `/whatsapp/status` | API key/session | Connection, binding, and account-health snapshot |
| `GET` | `/whatsapp/qr` | API key/session | Current QR payload/status |
| `GET` | `/whatsapp/qr/image` | API key/session | Current QR as SVG |
| `POST` | `/whatsapp/pair` | API key/session | Start pairing for an unbound gateway |
| `POST` | `/whatsapp/rebind` | API key/session | Replace the bound WhatsApp account |
| `POST` | `/messages/send` | API key/session | Send protected outbound text |
| `GET` | `/messages/:id/status` | API key/session | Read retained recent message state |
| `GET` | `/webhooks/settings` | API key/session | Read persisted webhook settings |
| `PUT` | `/webhooks/settings` | API key/session | Update webhook URL/enabled state |
| `POST` | `/webhooks/settings/rotate-secret` | API key/session | Start signing-secret rotation |
| `POST` | `/webhooks/settings/complete-rotation` | API key/session | Finish signing-secret rotation |
| `POST` | `/webhooks/test` | Browser session | Queue a signed test callback through the durable production webhook path |
| `GET` | `/webhooks/deliveries` | API key/session | List durable delivery metadata |
| `GET` | `/webhooks/deliveries/:id` | API key/session | Inspect one delivery |
| `POST` | `/webhooks/deliveries/:id/redeliver` | API key/session | Queue manual redelivery |

See the Astro API reference for complete request fields, response contracts, errors, and the Hybrid API Explorer. Dashboard-only operator actions such as `/app/admin/setup` and `/webhooks/test` are documented here and in Configuration rather than exposed through the machine-oriented API Explorer.

## Outbound safety

Before a send reaches Baileys, Wago evaluates recipient permission/opt-out state, idempotency, local rate windows, new-chat classification, and available WhatsApp account-health/reach-out signals.

Current local defaults include:

- account: 30 accepted sends per 60 seconds
- recipient: 5 accepted sends per recipient per 60 seconds
- new chats: 10 new recipients per hour
- `/messages/send`: 30 HTTP requests/minute
- `/whatsapp/pair` and `/whatsapp/rebind`: 5 HTTP requests/minute each
- `/webhooks/test`: 5 requests/minute for authenticated dashboard sessions
- webhook manual redelivery: 20 requests/minute per source IP

These are Wago defensive defaults, **not** official WhatsApp safe limits or anti-ban guarantees.

## Persistence, backup, and restore

`wago.db` contains gateway settings, generated API-key hash, salted admin-password hash, browser sessions, WhatsApp binding metadata, recipient state, outbound policy state, webhook queue/settings, instance lease, migrations, and bounded structured audit events.

Message bodies, raw admin passwords, current QR values, reconnect state, account-health cache, and recent message-status cache are not persisted as durable application history.

For filesystem backup, stop Wago cleanly and capture the entire `/app/data` volume as one secret-bearing snapshot. Do not copy only `wago.db` from a live WAL-mode database. Backups contain the admin-password hash, WhatsApp credentials, and webhook signing material; protect them accordingly.

## Container image

```text
ghcr.io/howlil/wago-simple:latest
```

The repository name is `wago`; `wago-simple` remains the existing GHCR distribution identifier. The production image supports `linux/amd64` and `linux/arm64`.

## Documentation

The bilingual public Astro documentation lives in [`docs/`](docs/). Internal implementation specs and historical execution notes live under [`.agent/`](.agent/) and are not product documentation.

## Development

Requirements: Node.js 26 and pnpm 11.21.0.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Useful local commands:

```bash
pnpm --dir backend dev
pnpm --dir frontend dev
pnpm --dir docs dev
```

## Security and contributing

Read [SECURITY.md](SECURITY.md) before reporting a vulnerability and [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

Never publish live admin passwords, API keys, webhook signing secrets, auth cookies, QR payloads, `/app/data` backups, Baileys credentials, full phone/JID identifiers, message content, or raw unredacted production logs.

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

Wago is provided as-is for self-hosted integration and development use. Operators are responsible for recipient permission, applicable WhatsApp terms/policies, and local law. Spam, bulk outreach, restriction bypassing, ban evasion, fingerprint manipulation, proxy rotation, and anti-detection behavior are outside project scope.
