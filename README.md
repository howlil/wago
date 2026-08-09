# Wago Simple

[![CI](https://github.com/howlil/wago-simple/actions/workflows/ci.yml/badge.svg)](https://github.com/howlil/wago-simple/actions/workflows/ci.yml)
[![CodeQL](https://github.com/howlil/wago-simple/actions/workflows/codeql.yml/badge.svg)](https://github.com/howlil/wago-simple/actions/workflows/codeql.yml)
[![Container](https://github.com/howlil/wago-simple/actions/workflows/release-container.yml/badge.svg)](https://github.com/howlil/wago-simple/actions/workflows/release-container.yml)
[![License](https://img.shields.io/github/license/howlil/wago-simple)](LICENSE)

A lightweight, self-hosted, single-account WhatsApp gateway with a small HTTP API and web dashboard.

Built with **Node.js**, **TypeScript**, **Express**, **React**, and **Baileys**, and distributed as one Docker image.

> [!IMPORTANT]
> Wago Simple uses Baileys, an unofficial WhatsApp Web client. It is not affiliated with, endorsed by, or supported by WhatsApp or Meta. This project does not guarantee account safety or ban prevention.

## Scope

Wago Simple intentionally stays small: one WhatsApp account, one running gateway instance, persistent local auth state, recipient consent controls, and a compact API for controlled outbound text messaging.

It is **not** a bulk sender, campaign platform, multi-tenant SaaS, scraping tool, or anti-detection system.

## Features

- Single WhatsApp account per instance
- QR-based pairing and session rebind
- REST API for text messages and retained message status
- Web dashboard for status, QR pairing, and manual sending
- Recipient allowlist and opt-out state
- API-key authentication
- Idempotency support
- Account, recipient, and new-chat safety limits
- Persistent WhatsApp auth and recipient state
- Structured JSON logging
- Health and readiness endpoints
- Hardened Docker Compose deployment
- `linux/amd64` and `linux/arm64` GHCR images
- CI, CodeQL, SBOM, and provenance

## Quick Start

### Requirements

- Docker Engine
- Docker Compose v2
- HTTPS reverse proxy or PaaS routing for public deployments

### 1. Configure exactly two production values

```bash
git clone https://github.com/howlil/wago-simple.git
cd wago-simple
cp .env.production.example .env
openssl rand -hex 32
```

`.env` contains only:

```env
API_KEY=replace-with-a-long-random-secret
CORS_ORIGIN=https://wago.example.com
```

`API_KEY` protects the dashboard and REST API. `CORS_ORIGIN` is the public browser origin allowed to call Wago.

Everything else is an internal default: HTTP port `3000`, host publish `127.0.0.1:3000`, `/app/data` persistence, secure production cookies, disabled production bootstrap, `32kb` JSON limit, country code `62`, structured request logging, and the default Baileys WhatsApp version strategy.

Production fails fast if either required value is missing or if `CORS_ORIGIN=*` is used.

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

Compose intentionally binds Wago to `127.0.0.1:3000`. Put Caddy, Traefik, Nginx, Cloudflare Tunnel, or your PaaS router in front of it for public access.

### 3. Pair WhatsApp

Open the dashboard through `CORS_ORIGIN`, enter the API key, then scan the QR from **WhatsApp → Linked devices → Link a device**.

The session is persisted under `/app/data/auth`, so normal container restarts do not require pairing again.

### 4. Allow a recipient

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
  -d '{"to":"6281234567890","text":"Hello from Wago Simple"}'
```

A successful request returns HTTP `202` with a pending status. This means Wago/Baileys accepted the outbound request; it is not a delivery or read receipt.

## API

Protected endpoints use:

```http
Authorization: Bearer <API_KEY>
```

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Process health |
| `GET` | `/ready` | Public | Readiness metadata |
| `GET` | `/app/info` | Public | App/authentication state |
| `POST` | `/app/bootstrap` | Development only | Generate a development API key |
| `GET` | `/recipients` | API key | List recipient records |
| `POST` | `/recipients/allow` | API key | Allow a recipient |
| `POST` | `/recipients/:phone/opt-out` | API key | Mark recipient opted out |
| `GET` | `/whatsapp/status` | API key | WhatsApp connection state |
| `GET` | `/whatsapp/qr` | API key | Current QR payload/status |
| `GET` | `/whatsapp/qr/image` | API key | Current QR as SVG |
| `POST` | `/whatsapp/rebind` | API key | Clear auth and pair another account |
| `POST` | `/messages/send` | API key | Send text |
| `GET` | `/messages/:id/status` | API key | Read retained status |

## Production Configuration

Wago deliberately exposes only two operator-controlled production environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `API_KEY` | Yes | Bearer secret for protected operations |
| `CORS_ORIGIN` | Yes | Public browser origin; `*` is rejected |

Runtime details such as ports, filesystem paths, secure-cookie policy, logging, body limit, bootstrap policy, country code, and WhatsApp version strategy are fixed internal defaults. This keeps deployment predictable and prevents a simple gateway from turning into a configuration matrix.

## Outbound Safety

Before Baileys is called, Wago requires an allowed recipient and applies opt-out, idempotency, account rate, recipient rate, new-chat, and WhatsApp account-health checks.

Transient policy state is in memory and resets on process restart. Recipient allowlist/opt-out state and WhatsApp auth remain persistent under `/app/data`.

## Docker and Persistence

The production service uses a read-only root filesystem, drops Linux capabilities, enables `no-new-privileges`, uses tmpfs for `/tmp`, runs as the non-root `node` user, and stores persistent state in the `wago_data` volume.

Important paths:

```text
/app/data/auth                 WhatsApp authentication state
/app/data/app-settings.json    Generated application identity/settings
/app/data/recipients.json      Recipient allowlist and opt-out records
```

Never use `docker compose down -v` during a normal upgrade because `-v` removes the persistent volume.

## Container Images

Images are published to:

```text
ghcr.io/howlil/wago-simple
```

`main` publishes `latest`, `main`, and `sha-<short-sha>`. Git tags matching `v*` additionally publish version-oriented tags. For reproducible deployment, edit the image tag in `docker-compose.yml` to the release or `sha-*` tag you want.

## Local Development

Requirements: Node.js 26 and pnpm 11.18.0.

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

Run applications separately when needed:

```bash
pnpm --dir backend dev
pnpm --dir frontend dev
pnpm --dir docs dev
```

Or run the local container stack:

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Security

Read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Never publish WhatsApp auth files, live QR payloads, API keys, auth cookies, full phone/JID identifiers, message content, or raw unredacted production logs.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Before opening a pull request, run:

```bash
pnpm check
pnpm test
pnpm build
```

See the documentation portal under `/docs` for architecture, API, deployment, operations, development, and OSS project policy.

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

Wago Simple is provided as-is for self-hosted integration and development use. Operators are responsible for consent, applicable WhatsApp terms/policies, and local law. Spam, bulk outreach, restriction bypassing, ban evasion, fingerprint manipulation, proxy rotation, and anti-detection behavior are outside project scope.
