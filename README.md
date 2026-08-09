# Wago Simple

[![CI](https://github.com/howlil/wago-simple/actions/workflows/ci.yml/badge.svg)](https://github.com/howlil/wago-simple/actions/workflows/ci.yml)
[![CodeQL](https://github.com/howlil/wago-simple/actions/workflows/codeql.yml/badge.svg)](https://github.com/howlil/wago-simple/actions/workflows/codeql.yml)
[![Container](https://github.com/howlil/wago-simple/actions/workflows/release-container.yml/badge.svg)](https://github.com/howlil/wago-simple/actions/workflows/release-container.yml)
[![License](https://img.shields.io/github/license/howlil/wago-simple)](LICENSE)

A lightweight, self-hosted, single-account WhatsApp gateway with a small HTTP API and web dashboard.

Built with **Node.js**, **TypeScript**, **Express**, **React**, **Baileys**, and **pnpm**, and distributed as one Docker image containing only the gateway core.

> [!IMPORTANT]
> Wago Simple uses Baileys, an unofficial WhatsApp Web client. It is not affiliated with, endorsed by, or supported by WhatsApp or Meta. This project does not guarantee account safety or ban prevention.

## Scope

Wago Simple intentionally stays small: one WhatsApp account, one running gateway instance, persistent local auth state, recipient consent controls, and a compact API for controlled outbound text messaging.

It is **not** a bulk sender, campaign platform, multi-tenant SaaS, scraping tool, or anti-detection system.

## Features

- Single WhatsApp account per instance
- One-click first-run pairing flow
- Automatically generated App ID and API key
- Copyable gateway credentials in the dashboard
- QR-based pairing and account changes
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

## Distribution Boundary

The distributable Wago core is strictly:

```text
backend/
frontend/
```

The repository also contains `docs/`, an Astro documentation/branding site maintained and hosted separately by the project owner. It is **not part of the Wago runtime artifact**.

The project enforces this boundary in several places:

- Docker build context excludes `docs/`
- GHCR publishing only reacts to core/container changes
- `pnpm build` builds backend + frontend only
- `pnpm build:docs` is an explicit separate docs build
- `pnpm pack` excludes `docs/` through `.npmignore`
- `git archive` excludes `docs/` through `.gitattributes`

Because this is a public repository, the `docs/` source is still visible in GitHub. The exclusion applies to distributed build/runtime artifacts, not repository visibility.

## Quick Start

### Requirements

- Docker Engine
- Docker Compose v2
- HTTPS reverse proxy or PaaS routing for public deployments

### 1. Configure the public origin

```bash
git clone https://github.com/howlil/wago-simple.git
cd wago-simple
cp .env.production.example .env
```

Set the public dashboard origin:

```env
CORS_ORIGIN=https://wago.example.com
```

`CORS_ORIGIN` is the browser origin allowed to call Wago. Production rejects `*`.

`API_KEY` is optional. If omitted, Wago starts in one-time first-run setup mode and generates the API key from the dashboard when you start WhatsApp pairing. If you prefer to pre-provision authentication, set `API_KEY` in `.env` before starting the container.

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

Open the dashboard through `CORS_ORIGIN` and click **Pair WhatsApp**.

On a fresh gateway Wago will automatically:

1. generate the App ID if one does not already exist
2. generate a cryptographically random API key
3. authenticate the current browser session
4. show the App ID and API key with Copy buttons
5. display the WhatsApp QR when Baileys provides it

Then open **WhatsApp → Linked devices → Link a device** and scan the QR.

The API key and WhatsApp QR are separate credentials. Wago creates the API key as part of the pairing workflow for convenience; it is not derived from WhatsApp QR material.

The generated API key is persisted by hash only on the backend. The dashboard keeps the raw value in browser session storage so it can be copied during the current browser session. Save it if an external API client needs it.

> [!IMPORTANT]
> A gateway without an existing API key is in first-run claim mode. Complete setup immediately after deployment. For environments where the public URL may be exposed before the owner can open it, pre-provision `API_KEY` instead.

The WhatsApp session is persisted under `/app/data/auth`, so normal container restarts do not require pairing again.

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
| `POST` | `/app/bootstrap` | First run only | Generate gateway credentials and browser auth |
| `GET` | `/recipients` | API key | List recipient records |
| `POST` | `/recipients/allow` | API key | Allow a recipient |
| `POST` | `/recipients/:phone/opt-out` | API key | Mark recipient opted out |
| `GET` | `/whatsapp/status` | API key | WhatsApp connection state |
| `GET` | `/whatsapp/qr` | API key | Current QR payload/status |
| `GET` | `/whatsapp/qr/image` | API key | Current QR as SVG |
| `POST` | `/whatsapp/rebind` | API key | Clear auth and start a new pairing session |
| `POST` | `/messages/send` | API key | Send text |
| `GET` | `/messages/:id/status` | API key | Read retained status |

## Production Configuration

Wago keeps production configuration intentionally small:

| Variable | Required | Purpose |
| --- | --- | --- |
| `CORS_ORIGIN` | Yes | Public browser origin; `*` is rejected |
| `API_KEY` | No | Optional pre-provisioned bearer secret; otherwise generated during first-run pairing |

Runtime details such as ports, filesystem paths, secure-cookie policy, logging, body limit, country code, and WhatsApp version strategy are fixed internal defaults. This keeps deployment predictable and prevents a simple gateway from turning into a configuration matrix.

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

Core-affecting pushes to `main` publish `latest`, `main`, and `sha-<short-sha>`. Git tags matching `v*` additionally publish version-oriented tags. Changes that only touch `docs/` do not publish a new core image.

For reproducible deployment, edit the image tag in `docker-compose.yml` to the release or `sha-*` tag you want.

## Local Development

Requirements: Node.js 26 and pnpm 11.21.0.

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

`pnpm build` verifies only the distributable backend/frontend core. The documentation site is intentionally separate:

```bash
pnpm build:docs
```

Run applications separately when needed:

```bash
pnpm --dir backend dev   # http://127.0.0.1:3000
pnpm --dir frontend dev  # http://127.0.0.1:5173, proxied to backend :3000
pnpm --dir docs dev
```

Or run the local container stack:

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Security

Read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Never publish WhatsApp auth files, live QR payloads, API keys, auth cookies, full phone/JID identifiers, message content, or raw unredacted production logs.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Before opening a core pull request, run:

```bash
pnpm check
pnpm test
pnpm build
```

The documentation/branding site under `/docs` is maintained and hosted separately from the distributable core.

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

Wago Simple is provided as-is for self-hosted integration and development use. Operators are responsible for consent, applicable WhatsApp terms/policies, and local law. Spam, bulk outreach, restriction bypassing, ban evasion, fingerprint manipulation, proxy rotation, and anti-detection behavior are outside project scope.
