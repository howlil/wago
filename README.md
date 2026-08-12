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
- durable, signed delivery webhooks for server-acknowledged and rejected outbound messages
- webhook delivery history, restart recovery, retry, and authenticated manual redelivery
- WhatsApp reach-out/new-chat account-health signals
- local account, recipient, and new-chat outbound guardrails
- structured Wago/Baileys audit events with filtering and cursor pagination
- SQLite-backed durable application state and persistent Baileys auth
- redacted structured logs, liveness/readiness endpoints, Docker/GHCR distribution, CI, and CodeQL

Wago intentionally does **not** provide bulk campaigns, scraping, multi-session/multi-tenant behavior, anti-detection features, restriction bypassing, or message-history storage. Inbound messages, media, groups, and device delivery/read receipts are not part of the current public API.

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

Webhook delivery state is also persisted in `/app/data/wago.db`; no Redis, RabbitMQ, or external queue is required.

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

### Optional delivery webhook

Configure both values to receive asynchronous outbound status callbacks:

```env
WEBHOOK_URL=https://app.example.com/api/internal/wago/webhook
WEBHOOK_SECRET=<at-least-32-character-high-entropy-secret>
```

`WEBHOOK_URL` and `WEBHOOK_SECRET` are a pair. Supplying only one is a startup configuration error rather than silently disabling callbacks. The URL must use HTTP or HTTPS and cannot contain embedded credentials. Use HTTPS whenever the callback crosses an untrusted network; HTTP remains supported for deliberately private container/service networking.

For signing-secret rotation, temporarily configure the old secret as well:

```env
WEBHOOK_SECRET=<new-current-secret>
WEBHOOK_SECRET_PREVIOUS=<old-secret-during-rotation>
```

While `WEBHOOK_SECRET_PREVIOUS` is present, Wago includes valid signatures for both current and previous secrets. Remove the previous value after the consumer has completed rotation.

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

A normal server-to-server integration needs three operations, with an optional durable webhook for asynchronous status.

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

The exposed retained states are `pending`, `accepted`, and `rejected`. `accepted` means WhatsApp produced at least a server acknowledgement; it does not mean the recipient device delivered or read the message. Message-status storage remains a transient convenience API and can expire or disappear after process restart. Webhook delivery state is persisted separately.

### 4. Optionally receive durable signed webhooks

When webhook configuration is enabled, Wago persists a callback when a retained outbound message becomes server-acknowledged or rejected. Network delivery happens outside the Baileys event handler.

Example server-acknowledged event:

```json
{
  "version": "1",
  "id": "2f6a7ef0-4f59-4ed4-9846-820d7f7b37c3",
  "event": "message.server_accepted",
  "createdAt": "2026-08-12T14:00:00.000Z",
  "data": {
    "messageId": "3EB0...",
    "status": "accepted"
  }
}
```

A rejection uses `event: "message.rejected"`, `status: "rejected"`, and may include a stable `data.error` code. Wago deliberately does not place message text, API credentials, or recipient phone/JID data in the webhook payload.

Webhook requests include:

```http
Content-Type: application/json
User-Agent: Wago-Webhooks/1.0
Webhook-Id: <delivery-uuid>
Webhook-Timestamp: <unix-seconds>
Webhook-Signature: v1,<base64-hmac> [v1,<previous-secret-hmac>]
X-Wago-Event: message.server_accepted
X-Wago-Delivery: <delivery-uuid>
```

The signature is HMAC-SHA256 over this exact UTF-8 string:

```text
<webhook-id>.<webhook-timestamp>.<raw-json-request-body>
```

Use `WEBHOOK_SECRET` to recompute the HMAC and compare decoded signatures in constant time. Verify the signature against the **raw body before trusting parsed JSON**, require a recent timestamp (five minutes is the recommended tolerance), and deduplicate by `Webhook-Id`. These checks protect against body tampering and replay of an old signed callback.

During secret rotation, accept a signature produced by either the new current secret or the explicitly configured previous secret. The `Webhook-Signature` header can contain multiple space-separated `v1,<base64>` signatures.

Webhook delivery is **at least once**. A callback may be received again after a timeout, process interruption, retry, or operator-requested redelivery. Consumer handling must therefore be idempotent.

Wago persists callback state in SQLite before attempting delivery. Network errors, timeouts, HTTP `408`, `429`, and `5xx` responses are retried with bounded exponential-style backoff and jitter for up to 24 hours. Redirects and other `4xx` responses are treated as permanent failures. A Wago restart does not discard pending retries: stale in-flight claims become eligible for recovery. Callback requests time out after five seconds and redirects are not followed automatically.

### 5. Inspect and redeliver webhook deliveries

Webhook delivery metadata is available through authenticated operator endpoints. Responses are sanitized and do not expose the callback body, signing secrets, recipient identifiers, or message text.

```bash
curl "$WAGO_URL/webhooks/deliveries?status=failed&limit=50" \
  -H "Authorization: Bearer $WAGO_API_KEY"

curl "$WAGO_URL/webhooks/deliveries/<delivery-id>" \
  -H "Authorization: Bearer $WAGO_API_KEY"

curl -X POST "$WAGO_URL/webhooks/deliveries/<delivery-id>/redeliver" \
  -H "Authorization: Bearer $WAGO_API_KEY"
```

Manual redelivery preserves the same signed delivery ID for deterministic consumer deduplication, increments `redeliveryCount`, resets the attempt cycle, and creates a fresh 24-hour delivery horizon. A delivery currently being attempted returns HTTP `409`. Redelivery while webhook configuration is disabled returns HTTP `503`.

## API summary

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | HTTP process liveness |
| `GET` | `/ready` | Public | App ID, API-credential state, and webhook configuration state |
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
| `GET` | `/webhooks/deliveries` | API key | List durable webhook delivery metadata |
| `GET` | `/webhooks/deliveries/:id` | API key | Inspect one webhook delivery |
| `POST` | `/webhooks/deliveries/:id/redeliver` | API key | Queue manual webhook redelivery |

`GET /activity` accepts `source`, `category`, `level`, `q`, `before`, and `limit`. See the Astro API reference for complete request fields, responses, errors, and the interactive Hybrid API Explorer.

## Outbound safety model

Before an outbound send reaches `Baileys.sendMessage()`, Wago evaluates recipient permission/opt-out state, idempotency, local rate windows, new-chat classification, and available WhatsApp account-health/reach-out signals.

Current Wago-local defaults are:

- account: 30 accepted sends per 60 seconds
- recipient: 5 accepted sends per recipient per 60 seconds
- new chats: 10 new recipients per hour
- `/messages/send`: 30 HTTP requests/minute
- `/whatsapp/pair` and `/whatsapp/rebind`: 5 HTTP requests/minute each
- `/webhooks/deliveries/:id/redeliver`: 20 HTTP requests/minute per source IP

These are **local defensive defaults, not official WhatsApp safe limits or anti-ban guarantees.**

## Persistence

The `wago_data` volume contains secret-bearing state:

```text
/app/data/wago.db          SQLite application state
/app/data/wago.db-wal      SQLite WAL while active
/app/data/wago.db-shm      SQLite shared memory while active
/app/data/auth/            Baileys authentication/session state
```

`wago.db` contains gateway settings and generated API-key hash, WhatsApp binding metadata, recipient policy/state, outbound-safety state, durable webhook delivery/outbox state, schema migrations, and a bounded structured audit log. Current audit retention keeps the newest 2,000 events.

Message bodies are not persisted in SQLite. Webhook payloads contain only the intentionally minimal callback envelope (delivery/event/message IDs, status, timestamps, schema version, and a stable rejection code when relevant); they do not contain outbound message text or recipient phone/JID data. QR/connection/reconnect state, account-health cache, and recent message-status cache remain transient.

Never use `docker compose down -v` for a normal upgrade; `-v` removes persistent gateway state, including queued webhook deliveries.

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

Never publish live API keys, webhook signing secrets, auth cookies, QR payloads, `/app/data` backups, Baileys credentials, full phone/JID identifiers, message content, or raw unredacted production logs.

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

Wago is provided as-is for self-hosted integration and development use. Operators are responsible for recipient permission, applicable WhatsApp terms/policies, and local law. Spam, bulk outreach, restriction bypassing, ban evasion, fingerprint manipulation, proxy rotation, and anti-detection behavior are outside project scope.
