# Security Policy

## Supported Scope

Security fixes target the latest `main` branch and the latest published container image.

Wago stores durable application state and WhatsApp authentication material under the configured data directory, normally `/app/data` in Docker. Treat the entire directory and its backups like private credentials.

Sensitive runtime files include:

- `/app/data/wago.db` — gateway settings, API-key hash, browser-session hashes, webhook callback URL and signing secret, binding metadata, recipient consent state, outbound safety history, webhook delivery state, instance-lease state, and operator audit events
- `/app/data/wago.db-wal` and `/app/data/wago.db-shm` while SQLite WAL mode is active
- `/app/data/auth/` — long-lived Baileys/WhatsApp session credentials
- legacy JSON recovery files retained after an upgrade from the previous persistence format

## Reporting a Vulnerability

Report vulnerabilities through GitHub private security advisories when available. Do not open a public issue for credential exposure, auth bypass, request forgery, persistence corruption that weakens safety decisions, or message-sending abuse paths.

Do not include these values in public issues, discussions, screenshots, logs, pull requests, or CI artifacts:

- `wago.db`, WAL/SHM files, or `/app/data` backups
- `backend/data/auth`, `creds.json`, or any Baileys auth file
- QR payloads or QR screenshots from a live session
- API keys, deployment `SETUP_TOKEN` values, webhook signing secrets, browser-session cookies, or bearer tokens
- full phone numbers, full JIDs, or message text
- raw production logs containing WhatsApp metadata

If logs are needed, redact secrets and mask identifiers first.

## Audit Data Boundary

The `/audit` workspace and `GET /activity` endpoint expose structured operational evidence, not raw WhatsApp protocol capture. Baileys audit metadata is sanitized before persistence: only safe primitive values are retained, phone/JID-shaped identifiers are masked, and secret/protocol fields such as QR data, credential/key material, tokens, cookies, authorization values, message/text fields, and nested raw payloads are dropped.

Audit rows still belong to the private gateway state. They can reveal timing, lifecycle state, restriction status, and operational behavior, so protect `wago.db` and authenticated audit access even though the low-level adapter removes message content and session secrets.

## Operational Guidance

- Keep Wago behind HTTPS when exposed outside localhost.
- Run exactly one active Wago process for a persistent `/app/data` volume and WhatsApp account. Wago uses a short SQLite lease to reject overlapping owners, but deployment topology should still use a single replica and avoid blue/green or rolling overlap against the same state directory.
- Production refuses to start when `/app/data` resolves only to the container writable layer or an ephemeral filesystem such as `tmpfs`. Mount durable storage before exposing the service.
- Prefer one HTTPS origin for the bundled dashboard and API. Production browser bootstrap and API-key-to-session sign-in require an HTTPS `Origin` whose host matches the request `Host`; state-changing cookie-authenticated requests also reject mismatched origins.
- A fresh production deployment that uses dashboard bootstrap must receive a high-entropy `SETUP_TOKEN` of at least 32 bytes through the deployment environment. Same-origin alone does not authorize first ownership. If `SETUP_TOKEN` is absent, first-run web bootstrap is disabled. Alternatively pre-provision `API_KEY`.
- Remove or rotate the deployment `SETUP_TOKEN` after first-run initialization if your secret-management workflow supports doing so. Wago does not persist the setup token in SQLite or browser storage.
- Wago does not expose a configurable CORS allowlist. Keep external application integration server-to-server unless you intentionally provide browser cross-origin behavior at your routing/proxy layer.
- Manage webhook callback URL and signing-secret lifecycle from the authenticated Wago Settings workspace. Legacy webhook environment variables are only a compatibility import path when SQLite has no webhook settings yet.
- Keep `/app/data` on a persistent volume with restricted host access. The webhook signing secret is intentionally recoverable by Wago from this private state because the original secret is required to create HMAC signatures; unlike API keys and browser-session tokens it cannot be stored hash-only.
- Treat webhook delivery as **at least once**. Receiver code must be idempotent and deduplicate by `Webhook-Id` (the same value is also sent as `X-Wago-Delivery`). A receiver may successfully process a callback before Wago records the attempt as delivered, so a later retry can legitimately repeat it.
- Stop the service before filesystem-style backups. This lets shutdown flush Baileys credential writes and checkpoint SQLite WAL state before the snapshot is taken.
- Back up the entire `/app/data` state set, not only `wago.db`. A consistent restore requires the database plus Baileys auth state from the same snapshot.
- Keep backup archives encrypted or otherwise access-restricted, verify file ownership/permissions after restore, and perform restore rehearsals on an isolated single-instance deployment before relying on a backup procedure.
- Never use `docker compose down -v` during a normal upgrade unless the persistent gateway state is intentionally being destroyed.
- Rebind WhatsApp and rotate external secrets if `/app/data`, an auth directory, backup, API credential, webhook signing secret, setup token, or browser session is suspected to be exposed.
- Treat terminal session invalidation as a recovery event: inspect sanitized audit evidence, then pair again rather than forcing an aggressive reconnect loop.

## Browser Credential Boundary

The Wago API key is a long-lived machine credential for external integrations and browser-session recovery. A generated raw API key is returned to the operator only during bootstrap while only its SHA-256 hash is persisted in SQLite. Wago does not store the raw API key in `sessionStorage` or `localStorage`.

The dashboard uses a separate opaque browser-session token. The raw session token is sent only as an HttpOnly, SameSite=Lax cookie and is Secure in production; SQLite stores only its SHA-256 hash plus creation, last-seen, expiry, and revocation metadata. Browser sessions expire after 30 days and can be revoked without changing the API key.

When a browser loses its session cookie, the operator can enter the existing API key once at the Wago dashboard. `POST /app/session` verifies that key and exchanges it for a new browser session; the submitted key is not retained by browser storage. `POST /app/session/logout` revokes only the current browser session, so server-to-server clients using the Bearer API key remain unaffected.

Rotating a generated API key from the authenticated dashboard immediately invalidates the previous machine API key and revokes every **other** browser session. The browser that performs the rotation remains authenticated so the operator has a recovery path to save the newly generated key. WhatsApp/Baileys authentication state is not changed by API-key rotation.

`POST /app/session/logout-all` revokes every browser session without changing the machine API key or WhatsApp auth. Use it when dashboard-session compromise is suspected. If the machine API key may also be exposed, rotate that credential as well.

Upgrades from the legacy dashboard clear the old `wa_gateway_api_key` cookie and remove the former `wago.apiKey` session-storage entry. Legacy raw-key cookies no longer authenticate protected routes.

External integrations should continue to use `Authorization: Bearer <API_KEY>` from a backend/server process rather than exposing the API key in a public frontend bundle.

## Transport Boundary

This project uses Baileys, an unofficial WhatsApp Web client. Wago does not provide guaranteed ban prevention and does not support spam, bulk messaging, anti-detection behavior, or bypassing WhatsApp restrictions.
