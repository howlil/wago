# Security Policy

Security fixes target the latest `main` and latest stable container release.

## Secrets and durable state

Treat the entire `/app/data` directory and its backups as credential-bearing private state:

- `/app/data/wago.db`, WAL, and SHM — gateway state, generated API-key hashes, browser-session hashes, recipient/outbound state, webhook settings/queue, lease state, and audit events
- `/app/data/auth/` — long-lived Baileys/WhatsApp credentials

Never publish `WAGO_ADMIN_PASSWORD`, API keys, bearer headers, browser cookies, webhook signing secrets, QR payloads, Baileys credentials, `/app/data` backups, full phone/JIDs, message text, or unredacted production logs.

`WAGO_ADMIN_PASSWORD` is a deployment secret used only to establish browser sessions. It is not persisted by Wago. Machine API keys are separate server-to-server credentials; generated raw keys are persisted only as SHA-256 hashes.

## Authentication boundary

```text
human operator -> WAGO_ADMIN_PASSWORD -> HttpOnly wago_session
machine client  -> API_KEY / generated wa_ key -> Authorization: Bearer ...
```

Production browser sign-in and cookie-authenticated state changes require same-origin requests. First generated machine-key bootstrap requires an authenticated browser session in production. Machine API keys cannot create dashboard sessions.

Browser sessions are opaque, HttpOnly, SameSite=Lax, Secure in production, and stored in SQLite as hashes. Session revocation does not change WhatsApp authentication. Generated API-key rotation invalidates the old machine key and revokes other dashboard sessions while preserving the initiating session.

## Operational boundary

- Keep Wago behind HTTPS when exposed outside localhost.
- Configure a strong `WAGO_ADMIN_PASSWORD`; the enforced minimum is 12 bytes, but substantially higher entropy is recommended.
- Keep machine credentials in a server-side secret manager, never a public browser bundle.
- Run exactly one active process for one `/app/data` volume and WhatsApp account.
- Production must use durable `/app/data`; Wago rejects disposable container storage.
- Back up the whole `/app/data` state after a controlled stop and rehearse restores in isolation.
- Never use `docker compose down -v` for a normal upgrade.
- Configure webhook URL/signing-secret lifecycle through authenticated Settings.
- Treat webhook delivery as at least once and deduplicate by `Webhook-Id`.
- Rebind WhatsApp and rotate affected secrets if durable state or credentials are exposed.

Released SQLite migrations are append-only. Old schema columns may remain inert after compatibility code is removed; rewriting migration history would create a larger upgrade risk than leaving unused columns in place.

## Reporting a vulnerability

Use GitHub private security advisories when available. Do not open public issues for credential exposure, authentication bypass, request-forgery paths, persistence corruption that weakens safety decisions, or message-sending abuse paths.

## Transport boundary

Wago uses Baileys, an unofficial WhatsApp Web client. It does not offer guaranteed ban prevention, spam/bulk messaging, anti-detection behavior, or restriction bypasses.
