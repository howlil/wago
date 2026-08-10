# Wago

[![CI](https://github.com/howlil/wago/actions/workflows/ci.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/ci.yml)
[![CodeQL](https://github.com/howlil/wago/actions/workflows/codeql.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/codeql.yml)
[![Container](https://github.com/howlil/wago/actions/workflows/release-container.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/release-container.yml)
[![License](https://img.shields.io/github/license/howlil/wago)](LICENSE)

A lightweight, self-hosted, single-account WhatsApp gateway with a protected HTTP API and web control dashboard.

Wago is built with **Node.js**, **TypeScript**, **Express**, **React**, **SQLite**, and **Baileys**. The production image runs one Node.js process that serves both the API and compiled React dashboard while maintaining one WhatsApp session.

> [!IMPORTANT]
> Wago uses Baileys, an unofficial WhatsApp Web client. It is not affiliated with, endorsed by, or supported by WhatsApp or Meta. Wago does not guarantee account safety or ban prevention.

## Scope

Wago intentionally stays small: one WhatsApp account, one running gateway instance, persistent local auth state, recipient consent controls, operator activity, and controlled outbound text messaging.

It is **not** a bulk sender, campaign platform, multi-tenant SaaS, scraping tool, anti-detection system, or restriction-bypass toolkit.

## Features

- Single WhatsApp account per instance
- First-run credential bootstrap from the dashboard
- Optional pre-provisioned API key
- QR pairing, automatic reconnect, and explicit account rebind
- REST API and responsive React control dashboard
- Recipient allowlist and opt-out controls in both UI and API
- Manual text sending with retained message status
- API-key authentication through Bearer token or bootstrap HttpOnly cookie
- Idempotency and account/recipient/new-chat outbound limits
- WhatsApp account-health and reach-out restriction checks
- SQLite-backed gateway settings, binding, recipient state, outbound safety, and activity log
- Persistent Baileys auth under the same `/app/data` volume
- Structured logging with sensitive-field redaction
- Health and readiness endpoints
- Hardened single-container Docker Compose deployment
- `linux/amd64` and `linux/arm64` GHCR images with SBOM and provenance
- CI, CodeQL, tests, and core Docker build checks

## Architecture

The architecture is intentionally single-instance and easy to inspect. The diagram source is stored as PlantUML in the repository so architecture changes can be reviewed with code.

![Wago runtime architecture](https://www.plantuml.com/plantuml/proxy?src=https%3A%2F%2Fraw.githubusercontent.com%2Fhowlil%2Fwago%2Fmain%2Fdocs%2Fdiagrams%2Fsystem-architecture.puml&fmt=svg)

[PlantUML source](docs/diagrams/system-architecture.puml) · [Detailed architecture docs](docs/src/components/docs/ArchitectureDoc.astro)

At a high level:

```text
Browser / API client
        |
        v
Express middleware -> auth/rate limits -> route layer
                                           |       |
                                           |       +-> pairing/status/rebind -> Baileys
                                           |
                                           +-> outbound policy -> Baileys -> WhatsApp Web
                                                    |
                                                    +-> recipient + account-health checks

Persistent: /app/data/wago.db + /app/data/auth/
Transient: QR/connection/reconnect + health/message caches
```

Application durable state uses the Node.js built-in SQLite driver. The database runs in WAL mode with schema migrations and a busy timeout. Accepted outbound safety state and recipient successful-send metadata are committed transactionally.

## Distribution Boundary

The runtime artifact is strictly the gateway core:

```text
backend/
frontend/
```

The `docs/` Astro site is maintained separately and is not bundled into the runtime image. `pnpm build` builds the backend/frontend core; `pnpm build:docs` builds the documentation site explicitly.

## Quick Start

### Requirements

- Docker Engine
- Docker Compose v2
- HTTPS reverse proxy, tunnel, or PaaS routing for public deployment

### 1. Clone and configure the public origin

```bash
git clone https://github.com/howlil/wago.git
cd wago
cp .env.production.example .env
```

For first-run setup from the dashboard:

```env
CORS_ORIGIN=https://wago.example.com
API_KEY=
```

`CORS_ORIGIN` is required in production and must not be `*`.

`API_KEY` is optional. Leave it empty to let a fresh gateway create credentials once from the dashboard. Set it before startup when you prefer pre-provisioned authentication or when the public URL may be reachable before the owner can claim the gateway.

### 2. Start Wago

```bash
docker compose pull
docker compose up -d
curl http://127.0.0.1:3000/health
```

Expected response:

```json
{"status":"ok"}
```

Compose binds Wago to `127.0.0.1:3000`. Put Caddy, Traefik, Nginx, Cloudflare Tunnel, or your PaaS router in front of it for public access.

### 3. Bootstrap credentials and pair WhatsApp

Open the dashboard at `CORS_ORIGIN`.

On a fresh gateway without `API_KEY`, clicking **Pair WhatsApp** will:

1. generate a cryptographically random `wa_...` API-key candidate in the browser
2. call `POST /app/bootstrap` from the configured origin
3. persist the App ID and SHA-256 hash of the generated key
4. authenticate the browser with both the raw key for the current browser session and an HttpOnly cookie
5. start `POST /whatsapp/pair`
6. display the QR when Baileys provides it

Save the raw API key if an external REST client needs it. The server does not persist the raw generated key.

If the gateway was already initialized, enter the existing API key in **Gateway Credentials** instead; first-run bootstrap does not create a replacement key.

Then open **WhatsApp → Linked devices → Link a device** and scan the QR.

### 4. Allow a recipient

Use the dashboard recipient controls, or the API:

```bash
export WAGO_URL="https://wago.example.com"
export WAGO_API_KEY="your-api-key"

curl -X POST "$WAGO_URL/recipients/allow" \
  -H "Authorization: Bearer $WAGO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone":"6281234567890","label":"Example recipient"}'
```

Local numbers beginning with `0` are normalized using the internal country-code default `62`.

### 5. Send a message

```bash
curl -X POST "$WAGO_URL/messages/send" \
  -H "Authorization: Bearer $WAGO_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: example-001" \
  -d '{"to":"6281234567890","text":"Hello from Wago"}'
```

A successful request returns HTTP `202` with `status: "pending"`. This means the outbound operation was accepted by the Wago/Baileys layer; it is not proof of delivery or read status.

## API Summary

Protected endpoints accept:

```http
Authorization: Bearer <API_KEY>
```

The web dashboard may also authenticate through the HttpOnly cookie created during bootstrap.

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | HTTP process liveness |
| `GET` | `/ready` | Public | App ID and API-key configuration state |
| `GET` | `/app/info` | Public | Setup and request-auth state |
| `POST` | `/app/bootstrap` | First run | Create/recover browser gateway credentials |
| `GET` | `/activity?limit=100` | API key | Read persisted operator activity |
| `GET` | `/recipients` | API key | List recipient policy records |
| `POST` | `/recipients/allow` | API key | Allow a recipient |
| `POST` | `/recipients/:phone/opt-out` | API key | Mark a recipient opted out |
| `GET` | `/whatsapp/status` | API key | Connection, binding, and account health |
| `GET` | `/whatsapp/qr` | API key | Current QR payload/status |
| `GET` | `/whatsapp/qr/image` | API key | Current QR as SVG |
| `POST` | `/whatsapp/pair` | API key | Start pairing for an unbound gateway |
| `POST` | `/whatsapp/rebind` | API key | Replace the current WhatsApp binding |
| `POST` | `/messages/send` | API key | Send protected outbound text |
| `GET` | `/messages/:id/status` | API key | Read retained message status |

See the documentation site API reference for payloads, error codes, and limits.

## Outbound Safety

Before `Baileys.sendMessage()` runs, Wago evaluates:

- recipient allowlist state
- recipient opt-out state
- idempotency key reuse
- WhatsApp account-health / reach-out restrictions
- account rate limit: 30 accepted sends per minute
- recipient rate limit: 5 accepted sends per recipient per minute
- new-chat limit: 10 new recipients per hour

`POST /messages/send` also has a 30-request/minute HTTP route limiter. `POST /whatsapp/pair` and `POST /whatsapp/rebind` are each limited to 5 requests/minute.

Outbound safety state is durable. Idempotency TTLs, account/per-recipient/new-chat windows, known-recipient classification, reach-out cooldowns, and outbound pause state survive normal process/container restarts.

## Persistence

The `wago_data` volume stores:

```text
/app/data/wago.db          SQLite application state
/app/data/wago.db-wal      SQLite WAL file while the database is active
/app/data/wago.db-shm      SQLite shared-memory file while WAL is active
/app/data/auth/            Baileys multi-file authentication state
```

`wago.db` contains gateway settings/API-key hash, WhatsApp binding metadata, recipient allow/opt-out and successful-outbound history, outbound safety state, schema migrations, and the bounded operator activity log.

Transient state is intentionally limited to current QR/connection/reconnect state, account-health cache, recent-message content, and temporary message-status cache. Message bodies are not persisted to SQLite.

When upgrading from the previous JSON-backed persistence format, Wago imports the existing app settings, binding, recipients, outbound policy, and activity log into SQLite once. Existing legacy JSON files are left untouched as a recovery artifact and are ignored after the import marker is recorded.

Never use `docker compose down -v` during a normal upgrade because `-v` removes the persistent volume.

## Container Images

The current distribution image remains:

```text
ghcr.io/howlil/wago-simple
```

The repository is `howlil/wago`; the `wago-simple` image name is retained as the existing registry identifier.

Core-affecting pushes to `main` publish `latest`, `main`, and `sha-*` tags. `v*` Git tags can additionally publish version/semver tags. Docs-only changes do not publish a new core image.

## Local Development

Requirements: Node.js 26 and pnpm 11.21.0.

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

Run the apps independently when needed:

```bash
pnpm --dir backend dev   # http://127.0.0.1:3000
pnpm --dir frontend dev  # http://127.0.0.1:5173
pnpm --dir docs dev
```

Build the documentation site separately:

```bash
pnpm build:docs
```

## Security

Read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Never publish WhatsApp auth files, `wago.db`/WAL files, live QR payloads, API keys, auth cookies, full phone/JID identifiers, message content, or raw unredacted production logs.

For public deployments, complete first-run setup immediately or pre-provision `API_KEY` before exposing the URL.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Before opening a core pull request, run:

```bash
pnpm check
pnpm test
pnpm build
```

For documentation changes, also run:

```bash
pnpm build:docs
```

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

Wago is provided as-is for self-hosted integration and development use. Operators are responsible for consent, applicable WhatsApp terms/policies, and local law. Spam, bulk outreach, restriction bypassing, ban evasion, fingerprint manipulation, proxy rotation, and anti-detection behavior are outside project scope.
