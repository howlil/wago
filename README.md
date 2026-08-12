# Wago

[![CI](https://github.com/howlil/wago/actions/workflows/ci.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/ci.yml)
[![Docs CI](https://github.com/howlil/wago/actions/workflows/docs-ci.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/docs-ci.yml)
[![CodeQL](https://github.com/howlil/wago/actions/workflows/codeql.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/codeql.yml)
[![Container](https://github.com/howlil/wago/actions/workflows/release-container.yml/badge.svg)](https://github.com/howlil/wago/actions/workflows/release-container.yml)
[![License](https://img.shields.io/github/license/howlil/wago)](LICENSE)

Wago is a lightweight, self-hosted WhatsApp gateway for one WhatsApp account. It combines a protected HTTP API, a React control dashboard, SQLite application state, and a Baileys session in one small runtime.

> [!IMPORTANT]
> Wago uses [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial WhatsApp Web client. Wago is not affiliated with or endorsed by WhatsApp or Meta and cannot guarantee that an account will never be restricted or banned.

## Why Wago

Wago is intentionally narrow. It is designed for developers and self-hosters who want one inspectable gateway behind an existing application, not a campaign platform or multi-tenant messaging SaaS.

Current capabilities include:

- one WhatsApp account per Wago instance
- first-run browser credential bootstrap or an optional pre-provisioned `API_KEY`
- QR pairing, reconnect handling, connection status, terminal-session invalidation, and explicit account rebind
- Bearer-authenticated REST API for external applications
- recipient allow and opt-out controls
- protected outbound text messaging with idempotency
- retained recent message state: `pending`, `accepted`, or `rejected`
- WhatsApp reach-out/new-chat account-health signals
- local account, recipient, and new-chat outbound guardrails
- structured Wago/Baileys audit events with filtering and cursor pagination
- SQLite-backed durable application state and persistent Baileys auth
- redacted structured logs, liveness/readiness endpoints, Docker/GHCR distribution, CI, and CodeQL

Wago intentionally does **not** provide bulk campaigns, scraping, multi-session/multi-tenant behavior, anti-detection features, restriction bypassing, or message-history storage. Inbound messages, webhooks, media, groups, and delivery/read receipts are not part of the current public API.

## Architecture

```text
Browser / mobile client
         |
         v
Application backend
         |
         | Authorization: Bearer <WAGO_API_KEY>
         v
        Wago
         |
         | Baileys
         v
    WhatsApp Web
```

Keep the Wago API key on the **server side** of the application integrating Wago. Do not embed it in a public React/Vue/browser bundle.

The Wago runtime itself stays small:

```text
HTTP API + React dashboard
           |
           v
       one Node.js process
        /             \
   SQLite state     Baileys auth
 /app/data/wago.db  /app/data/auth/
                         |
                         v
                    WhatsApp Web
```

Reviewable PlantUML sources live under [`docs/diagrams/`](docs/diagrams/).

## Quick start

Requirements: Docker Engine, Docker Compose v2, and an HTTPS reverse proxy/tunnel/PaaS route when Wago is exposed outside localhost.

```bash
git clone https://github.com/howlil/wago.git
cd wago
docker compose pull
docker compose up -d
curl http://127.0.0.1:3000/health
```

Expected liveness response:

```json
{"status":"ok"}
```

The stock Compose file needs no environment file. It publishes Wago only on `127.0.0.1:3000`, mounts the persistent `wago_data` volume at `/app/data`, uses a read-only root filesystem, drops Linux capabilities, and enables `no-new-privileges`.

Open the Wago dashboard through your HTTPS route. On a fresh data volume with no pre-provisioned API credential, the dashboard can bootstrap a generated credential once and then start WhatsApp pairing. Scan the QR from **WhatsApp → Linked devices → Link a device**.

### Optional pre-provisioned API key

The runtime reads `API_KEY` when it is explicitly supplied to the container environment. This is optional; the stock Compose workflow uses first-run browser bootstrap instead.

For platforms or custom Compose overrides that inject environment variables:

```env
API_KEY=<long-random-secret>
```

When `API_KEY` is absent and no generated credential hash exists in SQLite, first-run bootstrap is available. Once a credential exists, bootstrap is not a general key-rotation endpoint.

## Browser-origin security

Wago does not expose a configurable CORS allowlist.

For production browser bootstrap and state-changing requests authenticated by the dashboard cookie, Wago validates the request origin against the request host. Bootstrap requires an HTTPS origin in production, and the origin host must match the Wago host.

This is separate from server-to-server Bearer authentication. External applications should normally call Wago from their backend rather than directly from a public browser bundle.

## Pairing and WhatsApp Web version

Before creating a new Baileys socket, Wago attempts to resolve the current WhatsApp Web version. If live version resolution fails, the lifecycle falls back to the Baileys bundled/default version so pairing can still proceed without hard-coding a stale version through deployment configuration.

The resolved live version is cached for the process lifetime after a successful lookup.

## Use Wago from another application

External applications authenticate with:

```http
Authorization: Bearer <API_KEY>
```

A normal server-to-server integration needs three operations.

### 1. Allow a recipient when permission is recorded

```bash
export WAGO_URL="https://wago.example.com"
export WAGO_API_KEY="your-api-key"

curl -X POST "$WAGO_URL/recipients/allow" \
  -H "Authorization: Bearer $WAGO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone":"6281234567890","label":"Example recipient"}'
```

Do this when your application has a real basis to send to that recipient. Do not call `allow` before every message just to bypass recipient policy. A later `POST /recipients/:phone/opt-out` blocks future outbound sends until permission is explicitly restored.

### 2. Send a text message

```bash
curl -X POST "$WAGO_URL/messages/send" \
  -H "Authorization: Bearer $WAGO_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123-status-update" \
  -d '{"to":"6281234567890","text":"Your request has been processed."}'
```

Successful submission returns HTTP `202`:

```json
{
  "success": true,
  "messageId": "...",
  "status": "pending"
}
```

`202 pending` means the Wago/Baileys outbound operation was accepted for processing. It is **not** proof of delivery or read status.

### 3. Optionally check retained message state

```bash
curl "$WAGO_URL/messages/<message-id>/status" \
  -H "Authorization: Bearer $WAGO_API_KEY"
```

The exposed retained states are `pending`, `accepted`, and `rejected`. Message-status storage is transient and can expire or disappear after process restart.

## API summary

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | HTTP process liveness |
| `GET` | `/ready` | Public | App ID and API-credential configuration state |
| `GET` | `/app/info` | Public | Setup, credential-source, and current request-auth state |
| `POST` | `/app/bootstrap` | First run | Create or recover browser gateway credentials |
| `GET` | `/activity` | API key | Query sanitized audit events with filters/cursor pagination |
| `GET` | `/recipients` | API key | List recipient policy records |
| `POST` | `/recipients/allow` | API key | Explicitly allow a recipient |
| `POST` | `/recipients/:phone/opt-out` | API key | Block outbound to a recipient |
| `GET` | `/whatsapp/status` | API key | Connection, binding, and account-health snapshot |
| `GET` | `/whatsapp/qr` | API key | Current QR payload/status |
| `GET` | `/whatsapp/qr/image` | API key | QR as SVG, or JSON when unavailable/already connected |
| `POST` | `/whatsapp/pair` | API key | Start pairing for an unbound gateway |
| `POST` | `/whatsapp/rebind` | API key | Clear the current binding and pair another account |
| `POST` | `/messages/send` | API key | Send protected outbound text |
| `GET` | `/messages/:id/status` | API key | Read retained recent message state |

`GET /activity` accepts `source`, `category`, `level`, `q`, `before`, and `limit`. See the Astro API reference for complete request fields, responses, errors, and the interactive Hybrid API Explorer.

## Outbound safety model

Before an outbound send reaches `Baileys.sendMessage()`, Wago evaluates recipient permission/opt-out state, idempotency, local rate windows, new-chat classification, and available WhatsApp account-health/reach-out signals.

Current Wago-local defaults are:

- account: 30 accepted sends per 60 seconds
- recipient: 5 accepted sends per recipient per 60 seconds
- new chats: 10 new recipients per hour
- `/messages/send`: 30 HTTP requests/minute
- `/whatsapp/pair` and `/whatsapp/rebind`: 5 HTTP requests/minute each

These are **local defensive defaults, not official WhatsApp safe limits or anti-ban guarantees.**

## Persistence

The `wago_data` volume contains secret-bearing state:

```text
/app/data/wago.db          SQLite application state
/app/data/wago.db-wal      SQLite WAL while active
/app/data/wago.db-shm      SQLite shared memory while active
/app/data/auth/            Baileys authentication/session state
```

`wago.db` contains gateway settings and generated API-key hash, WhatsApp binding metadata, recipient policy/state, outbound-safety state, schema migrations, and a bounded structured audit log. Current audit retention keeps the newest 2,000 events.

Message bodies are not persisted in SQLite. Current QR/connection/reconnect state, account-health cache, and recent message-status cache remain transient.

Never use `docker compose down -v` for a normal upgrade; `-v` removes persistent gateway state.

## Public documentation

The public Astro site lives in [`docs/`](docs/) and is bilingual (`/en` and `/id`). The product landing pages are intentionally separate from technical API tooling. The Hybrid API Explorer lives under the API reference and can:

- select every current public endpoint
- build path/query/header/body fields
- generate cURL, JavaScript, Python, and Node.js examples
- optionally send a request directly from the browser to a Wago base URL you provide
- display HTTP status, latency, content type, and formatted response

The explorer never proxies requests through the documentation server. The entered API key stays in component memory and generated snippets always use `YOUR_API_KEY`.

Because Wago core does not enable cross-origin browser access, live explorer calls work only when browser origin rules are satisfied by your deployment (for example, same-origin routing or an intentionally configured reverse proxy). For real integrations, prefer server-to-server calls.

Run the public docs locally with:

```bash
pnpm --dir docs dev
```

Validate documentation changes with:

```bash
pnpm --dir docs test
pnpm build:docs
```

## Container image

```text
ghcr.io/howlil/wago-simple:latest
```

The repository name is `wago`; `wago-simple` remains the existing GHCR image identifier. The production image supports `linux/amd64` and `linux/arm64` and ships the gateway core, not the Astro documentation site.

## Development

Requirements: Node.js 26 and pnpm 11.21.0.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm build:docs
```

Useful local commands:

```bash
pnpm --dir backend dev
pnpm --dir frontend dev
pnpm --dir docs dev
```

## Security and contributing

Read [SECURITY.md](SECURITY.md) before reporting a vulnerability and [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

Never publish live API keys, auth cookies, QR payloads, `/app/data` backups, Baileys credentials, full phone/JID identifiers, message content, or raw unredacted production logs.

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

Wago is provided as-is for self-hosted integration and development use. Operators are responsible for recipient permission, applicable WhatsApp terms/policies, and local law. Spam, bulk outreach, restriction bypassing, ban evasion, fingerprint manipulation, proxy rotation, and anti-detection behavior are outside project scope.
