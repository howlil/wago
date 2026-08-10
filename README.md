# Wago

[![CI](https://github.com/howlil/wago/actions/workflows/ci.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/ci.yml)
[![CodeQL](https://github.com/howlil/wago/actions/workflows/codeql.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/codeql.yml)
[![Container](https://github.com/howlil/wago/actions/workflows/release-container.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/release-container.yml)
[![License](https://img.shields.io/github/license/howlil/wago)](LICENSE)

A lightweight, self-hosted, single-account WhatsApp gateway with a protected HTTP API and web control dashboard.

Wago is built with **Node.js**, **TypeScript**, **Express**, **React**, and **Baileys**. The production image runs one Node.js process that serves both the API and compiled React dashboard while maintaining one WhatsApp session.

> [!IMPORTANT]
> Wago uses Baileys, an unofficial WhatsApp Web client. It is not affiliated with, endorsed by, or supported by WhatsApp or Meta. Wago does not guarantee account safety or ban prevention.

## Scope

Wago intentionally stays small: one WhatsApp account, one running gateway instance, persistent local auth state, recipient consent controls, operator activity, and controlled outbound text messaging.

It is **not** a bulk sender, campaign platform, multi-tenant SaaS, scraping tool, anti-detection system, or restriction-bypass toolkit.

## Features

- Single WhatsApp account per instance
- **Zero-config production startup** — no `.env`, `CORS_ORIGIN`, or operator-supplied API key required
- API key generated automatically as part of the first **Pair WhatsApp** flow
- QR pairing, automatic reconnect, and explicit account rebind
- REST API and responsive React control dashboard
- Recipient allowlist and opt-out controls in both UI and API
- Manual text sending with retained message status
- API-key authentication through Bearer token or bootstrap HttpOnly cookie
- Same-origin browser protection derived automatically from the incoming Wago host
- Idempotency and account/recipient/new-chat outbound limits
- WhatsApp account-health and reach-out restriction checks
- Persistent Baileys auth, account binding, recipient state, and activity log
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

Persistent: /app/data
Transient: process-local policy/message/cache state
```

The dashboard and API are served from the **same Wago origin** in production. Wago derives the browser origin from the request host instead of requiring a CORS environment variable. External server-to-server API clients authenticate with `Authorization: Bearer <API_KEY>` and are not dependent on browser CORS.

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

### 1. Clone and start

No production `.env` file is required.

```bash
git clone https://github.com/howlil/wago.git
cd wago
docker compose pull
docker compose up -d
curl http://127.0.0.1:3000/health
```

Expected response:

```json
{"status":"ok"}
```

Compose binds Wago to `127.0.0.1:3000`. Put Caddy, Traefik, Nginx, Cloudflare Tunnel, or your PaaS router in front of it for public access.

### 2. Pair WhatsApp and initialize credentials

Open the public Wago dashboard and click **Pair WhatsApp**.

On a fresh gateway the pairing action automatically:

1. creates a cryptographically random `wa_...` API-key candidate in the browser
2. submits that candidate to the first-run bootstrap endpoint from the **same Wago host**
3. stores only the App ID and SHA-256 hash of the generated key in `/app/data/app-settings.json`
4. authenticates the current browser with the key for the current session plus an HttpOnly cookie
5. starts WhatsApp QR pairing
6. displays the QR when Baileys provides it

The same candidate is retained in the browser until bootstrap succeeds, so a network retry does not silently create a different credential.

Save the raw API key if an external REST client needs it. Wago does not persist the raw generated key.

Then open **WhatsApp → Linked devices → Link a device** and scan the QR.

### 3. Allow a recipient

Use the dashboard recipient controls, or the API:

```bash
export WAGO_URL="https://wago.example.com"
export WAGO_API_KEY="wa_your-generated-api-key"

curl -X POST "$WAGO_URL/recipients/allow" \
  -H "Authorization: Bearer $WAGO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone":"6281234567890","label":"Example recipient"}'
```

Local numbers beginning with `0` are normalized using the internal country-code default `62`.

### 4. Send a message

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

The web dashboard may also authenticate through the HttpOnly cookie created during first pairing.

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | HTTP process liveness |
| `GET` | `/ready` | Public | App ID and API-key configuration state |
| `GET` | `/app/info` | Public | Setup and request-auth state |
| `POST` | `/app/bootstrap` | First pairing | Persist the pairing-generated browser credential |
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

`POST /app/bootstrap` is an implementation detail of the first **Pair WhatsApp** action. Operators do not need to call it manually or configure a bootstrap secret in deployment environment variables.

## Browser Origin Model

Wago does not require `CORS_ORIGIN` in production.

The production dashboard and API are intentionally same-origin. For sensitive cookie-authenticated state changes and first-run bootstrap, Wago compares the browser `Origin` header with the incoming `Host` header. This works behind normal reverse proxies and Cloudflare because the public Host is preserved.

Cross-origin browser API access is not enabled by default. External integrations should call the API server-to-server with the generated Bearer key.

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

## Persistence

The `wago_data` volume stores:

```text
/app/data/auth/                    Baileys multi-file authentication state
/app/data/app-settings.json        App ID and generated API-key hash
/app/data/recipients.json          Recipient allowlist and opt-out records
/app/data/whatsapp-binding.json    Bound WhatsApp account metadata
/app/data/activity-log.json        Operator activity log (max 300 events)
```

The raw generated API key is intentionally not persisted by the server.

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

Vite proxies API routes to the backend, so local frontend development also does not need a CORS environment variable.

Build the documentation site separately:

```bash
pnpm build:docs
```

## Security

Read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Never publish WhatsApp auth files, live QR payloads, API keys, auth cookies, full phone/JID identifiers, message content, or raw unredacted production logs.

For a new public deployment, open the dashboard and complete **Pair WhatsApp** promptly. The first-run bootstrap endpoint only accepts the detected Wago browser origin in production and stops being an initial-claim path once credentials exist.

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
