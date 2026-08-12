# Security Policy

## Supported Scope

Security fixes target the latest `main` branch and the latest published container image.

Wago stores durable application state and WhatsApp authentication material under the configured data directory, normally `/app/data` in Docker. Treat the entire directory and its backups like private credentials.

Sensitive runtime files include:

- `/app/data/wago.db` — gateway settings, API-key hash, binding metadata, recipient consent state, outbound safety history, and operator audit events
- `/app/data/wago.db-wal` and `/app/data/wago.db-shm` while SQLite WAL mode is active
- `/app/data/auth/` — long-lived Baileys/WhatsApp session credentials
- legacy JSON recovery files retained after an upgrade from the previous persistence format

## Reporting a Vulnerability

Report vulnerabilities through GitHub private security advisories when available. Do not open a public issue for credential exposure, auth bypass, request forgery, persistence corruption that weakens safety decisions, or message-sending abuse paths.

Do not include these values in public issues, discussions, screenshots, logs, pull requests, or CI artifacts:

- `wago.db`, WAL/SHM files, or `/app/data` backups
- `backend/data/auth`, `creds.json`, or any Baileys auth file
- QR payloads or QR screenshots from a live session
- API keys, auth cookies, or bearer tokens
- full phone numbers, full JIDs, or message text
- raw production logs containing WhatsApp metadata

If logs are needed, redact secrets and mask identifiers first.

## Audit Data Boundary

The `/audit` workspace and `GET /activity` endpoint expose structured operational evidence, not raw WhatsApp protocol capture. Baileys audit metadata is sanitized before persistence: only safe primitive values are retained, phone/JID-shaped identifiers are masked, and secret/protocol fields such as QR data, credential/key material, tokens, cookies, authorization values, message/text fields, and nested raw payloads are dropped.

Audit rows still belong to the private gateway state. They can reveal timing, lifecycle state, restriction status, and operational behavior, so protect `wago.db` and authenticated audit access even though the low-level adapter removes message content and session secrets.

## Operational Guidance

- Keep Wago behind HTTPS when exposed outside localhost.
- Prefer one HTTPS origin for the bundled dashboard and API. Production browser bootstrap requires an HTTPS `Origin` whose host matches the request `Host`; state-changing cookie-authenticated requests also reject mismatched origins.
- Wago does not expose a configurable CORS allowlist. Keep external application integration server-to-server unless you intentionally provide browser cross-origin behavior at your routing/proxy layer.
- Pre-provision `API_KEY` when a fresh public deployment could be reached before the owner completes first-run setup; otherwise the default dashboard bootstrap flow can create the first generated credential.
- Keep `/app/data` on a persistent volume with restricted host access.
- Stop the service before filesystem-style backups so SQLite can checkpoint and the database/auth snapshot is consistent.
- Never use `docker compose down -v` during a normal upgrade unless the persistent gateway state is intentionally being destroyed.
- Rebind WhatsApp and rotate external secrets if `/app/data`, an auth directory, backup, or API credential is suspected to be exposed.
- Treat terminal session invalidation as a recovery event: inspect sanitized audit evidence, then pair again rather than forcing an aggressive reconnect loop.

## Browser Credential Boundary

First-run browser bootstrap is a narrow setup path, not a general credential-rotation API. A generated raw key is returned to the operator/browser while only its SHA-256 hash is persisted in SQLite.

The dashboard may authenticate with an HttpOnly cookie after bootstrap. External integrations should use a Bearer API key from a backend/server process rather than exposing the secret in a public frontend bundle.

## Transport Boundary

This project uses Baileys, an unofficial WhatsApp Web client. Wago does not provide guaranteed ban prevention and does not support spam, bulk messaging, anti-detection behavior, or bypassing WhatsApp restrictions.
