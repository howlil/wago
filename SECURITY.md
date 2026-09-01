# Security Policy

## Supported Scope

Security fixes target the latest `main` branch and the latest published container image.

Wago stores durable application state and WhatsApp authentication material under the configured data directory, normally `/app/data` in Docker. Treat the entire directory and its backups like private credentials.

Sensitive runtime files include:

- `/app/data/wago.db` — gateway settings, salted admin-password hash, generated API-key hash, browser-session hashes, webhook callback URL and signing secret, binding metadata, recipient consent state, outbound safety history, webhook delivery state, instance-lease state, operator audit events, and any active incoming-message webhook retry payload that has not yet reached a terminal delivery state
- `/app/data/wago.db-wal` and `/app/data/wago.db-shm` while SQLite WAL mode is active
- `/app/data/auth/` — long-lived Baileys/WhatsApp session credentials

The admin password is created from the Wago dashboard on first run. The raw password is never persisted; Wago stores a salted scrypt hash in SQLite and uses it only to establish dashboard browser sessions. `API_KEY` and generated `wa_...` keys are machine credentials for server-to-server API clients and are intentionally separate from the normal dashboard sign-in path.

## Reporting a Vulnerability

Report vulnerabilities through GitHub private security advisories when available. Do not open a public issue for credential exposure, auth bypass, request forgery, persistence corruption that weakens safety decisions, or message-sending abuse paths.

Do not include these values in public issues, discussions, screenshots, logs, pull requests, or CI artifacts:

- `wago.db`, WAL/SHM files, or `/app/data` backups
- `apps/gateway/data/auth`, `creds.json`, or any Baileys auth file
- QR payloads or QR screenshots from a live session
- admin passwords, API keys, webhook signing secrets, browser-session cookies, or bearer tokens
- full phone numbers, full JIDs, or message text
- raw production logs containing WhatsApp metadata or secrets

If logs are needed, redact secrets and mask identifiers first.

## Audit Data Boundary

The `/audit` workspace and `GET /activity` endpoint expose structured operational evidence, not raw WhatsApp protocol capture. Baileys audit metadata is sanitized before persistence: only safe primitive values are retained, phone/JID-shaped identifiers are masked, and secret/protocol fields such as QR data, credential/key material, tokens, cookies, authorization values, password fields, message/text fields, and nested raw payloads are dropped.

Incoming `message.received` processing follows the same audit boundary. Audit rows may record the stable Wago message ID, webhook delivery ID, event name, and lifecycle state, but must not retain sender phone/JID or message text.

Audit rows still belong to the private gateway state. They can reveal timing, lifecycle state, restriction status, and operational behavior, so protect `wago.db` and authenticated audit access even though the low-level adapter removes message content and session secrets.

## Incoming Webhook Payload Boundary

Wago supports live direct/private incoming text as signed `message.received` callbacks. It does not persist chat history or expose a dashboard inbox.

To provide restart-safe at-least-once delivery, the sender identifier and text may be stored inside the durable webhook retry payload only while that delivery is `pending` or `delivering`, for no longer than the existing 24-hour retry horizon. When the delivery becomes `delivered`, `failed`, or `expired`, SQLite atomically replaces that payload with an empty object while retaining sanitized delivery/attempt metadata.

Consequences:

- treat a live `/app/data` volume and backups as potentially containing message content when incoming webhook deliveries are still active;
- do not expose webhook delivery payloads through diagnostics, logs, or the dashboard;
- terminal `message.received` deliveries cannot be manually redelivered because their sender/text payload has been deliberately destroyed;
- receivers should persist only the incoming content they actually need under their own privacy/retention policy.

## Operational Guidance

- Keep Wago behind HTTPS when exposed outside localhost.
- On a fresh instance, create a strong admin password from the dashboard before exposing the uninitialized dashboard to an untrusted network. Wago requires at least 12 bytes; use a password manager and prefer substantially more entropy than the minimum.
- Keep the machine API key separate from the admin password. External applications use `Authorization: Bearer <API_KEY>` while dashboard users authenticate with the admin password and receive an HttpOnly browser session.
- Run exactly one active Wago process for a persistent `/app/data` volume and WhatsApp account. Wago uses a short SQLite lease to reject overlapping owners, but deployment topology should still use a single replica and avoid blue/green or rolling overlap against the same state directory.
- Production refuses to start when `/app/data` resolves only to the container writable layer or an ephemeral filesystem such as `tmpfs`. Mount durable storage before exposing the service.
- Prefer one HTTPS origin for the bundled dashboard and API. Production admin setup, dashboard sign-in, and first API-key bootstrap require an `Origin` whose host matches the request `Host`; state-changing cookie-authenticated requests also reject mismatched origins.
- A fresh production gateway creates its local root of trust through the same-origin dashboard: `POST /app/admin/setup` -> persisted salted password hash + HttpOnly session -> `POST /app/bootstrap` -> generated machine API key.
- `API_KEY` can still be pre-provisioned by a deployment secret manager. Environment-managed API keys are machine credentials and are rotated in that secret manager rather than from the dashboard.
- Wago does not expose a configurable CORS allowlist. Keep external application integration server-to-server unless you intentionally provide browser cross-origin behavior at your routing/proxy layer.
- Manage webhook callback URL and signing-secret lifecycle from the authenticated Wago Settings workspace.
- Keep `/app/data` on a persistent volume with restricted host access. The webhook signing secret is intentionally recoverable by Wago from this private state because the original secret is required to create HMAC signatures; unlike API keys and browser-session tokens it cannot be stored hash-only.
- Treat webhook delivery as **at least once**. Receiver code must be idempotent and deduplicate callbacks by `Webhook-Id` (the same value is also sent as `X-Wago-Delivery`); for incoming business-message dedupe, also use `data.messageId`.
- Stop the service before filesystem-style backups. This lets shutdown flush Baileys credential writes and checkpoint SQLite WAL state before the snapshot is taken.
- Back up the entire `/app/data` state set, not only `wago.db`. A consistent restore requires the database plus Baileys auth state from the same snapshot.
- Keep backup archives encrypted or otherwise access-restricted, verify file ownership/permissions after restore, and perform restore rehearsals on an isolated single-instance deployment before relying on a backup procedure.
- Never use `docker compose down -v` during a normal upgrade unless the persistent gateway state is intentionally being destroyed.
- Rebind WhatsApp and rotate external secrets if `/app/data`, an auth directory, backup, API credential, webhook signing secret, admin password, or browser session is suspected to be exposed.
- Treat terminal session invalidation as a recovery event: inspect sanitized audit evidence, then pair again rather than forcing an aggressive reconnect loop.

## First-Run Ownership Boundary

Wago intentionally requires no deployment secret for first-run ownership. A fresh instance exposes one one-time admin-account creation operation through the bundled dashboard.

`POST /app/admin/setup` is accepted only while no admin password exists. In production it requires the browser request origin to match the Wago request host. A successful setup hashes the password with a random salt using scrypt, persists only that encoded hash, and issues an opaque HttpOnly browser session. A second setup attempt is rejected.

This is a **first-browser ownership** model. Same-origin validation prevents cross-site requests, but it does not distinguish two users who can directly reach an uninitialized Wago origin. Therefore, do not publish a fresh unclaimed instance to an untrusted network. Create the admin account first, then expose the service through the intended HTTPS route and access controls.

`POST /app/bootstrap` then requires the valid browser session plus same-origin validation before creating the generated machine API key. Only the API-key SHA-256 hash is persisted. The raw generated API key is shown to the authenticated operator so it can be stored in the application or secret manager that will call Wago.

## Browser Credential Boundary

The dashboard and external API have distinct credential responsibilities:

```text
human operator -> persisted admin-password hash -> HttpOnly browser session
machine client  -> API_KEY / generated wa_ key -> Authorization: Bearer ...
```

The raw browser-session token is sent only as an HttpOnly, SameSite=Lax cookie and is Secure in production. SQLite stores only its SHA-256 hash plus creation, last-seen, expiry, and revocation metadata. Browser sessions expire after 30 days and can be revoked without changing the API key.

The raw admin password is never stored. SQLite stores only the salted scrypt representation required to verify future sign-in attempts. The password is not written to cookies, `localStorage`, or `sessionStorage`.

A generated raw API key is returned to the authenticated operator only when it is created or rotated. Wago stores only its SHA-256 hash and does not persist the raw key in browser storage.

Machine API credentials are not accepted as dashboard login credentials. A fresh dashboard must create its admin account once before normal sign-in is available.

Rotating a generated API key from the authenticated dashboard immediately invalidates the previous machine API key and revokes every **other** browser session. The browser performing the rotation remains authenticated so the operator can save the newly generated key. WhatsApp/Baileys authentication state is not changed by API-key rotation.

`POST /app/session/logout-all` revokes every browser session without changing the machine API key or WhatsApp auth. Use it when dashboard-session compromise is suspected. If the machine API key may also be exposed, rotate that credential as well.

External integrations should continue to use `Authorization: Bearer <API_KEY>` from a apps/gateway/server process rather than exposing the API key in a public frontend bundle.

## Transport Boundary

This project uses Baileys, an unofficial WhatsApp Web client. Wago does not provide guaranteed ban prevention and does not support spam, bulk messaging, anti-detection behavior, or bypassing WhatsApp restrictions.
