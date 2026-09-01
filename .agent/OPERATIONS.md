# Wago Operations

This file owns durable production constraints: persistence, deployment, readiness, backup/restore, rollback, and release safety.

## Persistent state

Durable application state lives under `/app/data`:

```text
/app/data/
├── wago.db          SQLite application database
├── wago.db-wal      may exist while WAL is active
├── wago.db-shm      may exist while WAL is active
└── auth/            Baileys authentication state
```

Treat the entire directory and its backups as secret-bearing state.

Rules:

- SQLite is the authoritative application store.
- Released migrations are append-only; never rewrite a migration version already shipped.
- Multi-write durable invariants belong inside explicit transaction boundaries.
- Baileys auth remains filesystem-backed under `/app/data/auth`.
- Never run multiple active Wago instances against the same SQLite/auth volume.
- Production must fail closed when durable storage cannot be trusted as persistent.

## Single-owner runtime

One deployed Wago instance owns one process, one active WhatsApp account/socket lifecycle, and one persistent `/app/data` volume.

Do not introduce distributed locking, multi-replica state sharing, or multi-session ownership without an explicitly approved architecture change.

Startup and shutdown must be deterministic. Ownership loss or unsafe persistent-state conditions must degrade/fail closed rather than silently continuing.

## Health and readiness

`/health` is liveness. Readiness represents whether the application can safely perform expected work and may distinguish healthy, degraded, and not-ready states.

User-facing operational state must be truthful:

- disconnected is not connected;
- unavailable/unknown is not healthy;
- invalid session requires explicit recovery/pairing;
- degraded persistence/account state must not be presented as normal.

Do not make request-time readiness depend on expensive or unstable filesystem/protocol inspection when owned cached state can safely represent the same invariant.

## WhatsApp lifecycle

Baileys is an unofficial WhatsApp Web client. Wago cannot guarantee unrestricted deliverability or ban prevention.

- Recoverable disconnects may reconnect with bounded backoff.
- Terminal session invalidation stops reconnect attempts and requires pairing again.
- Credential-write failures surface as degraded operational state.
- Rebind/logout/session replacement must preserve clear lifecycle ownership and must not create concurrent socket generations that can both mutate current state.
- Persist normalized operational/audit facts, never raw protocol packets or secret-bearing payloads.

## Sensitive data and logging

Never log or commit API keys, setup tokens, cookies, authorization headers, QR payloads, Baileys credentials, message text, full phone numbers/JIDs, raw arbitrary Baileys frames/protocol payloads, or copied `/app/data` contents.

Structured logs should contain only sanitized context needed to operate the changed behavior.

## Backup and restore

Back up the whole `/app/data` state as one sensitive unit before risky durable-state changes.

- Protect backups like credentials.
- Restore only into a controlled stopped/replacement instance.
- Do not use `docker compose down -v` during normal upgrades unless destroying gateway state is explicitly intended.
- Validate restored state before resuming normal operation.
- Preserve compatibility with a known-good rollback image when changing durable state whenever reasonably possible.

If a migration makes a copied persistent volume impossible for the intended rollback baseline to open safely, treat that as a material release/migration problem rather than accepting it silently.

## Container and release

Wago remains Docker-first and one-container by default.

Release-relevant changes should preserve production image buildability, supported architecture builds used by repository workflows, persistent `/app/data` semantics across restart/replacement, deterministic publication behavior, and rollback compatibility appropriate to the durable change.

Do not run container/release verification as ceremony for unrelated documentation or presentation-only changes. Run it when the affected risk or mandatory repository gates require it.

## Webhooks and outbound operations

Webhook delivery is at-least-once. Retries/manual redelivery must preserve stable delivery identity where the current contract relies on it. HMAC/signature behavior and delivery-attempt state are compatibility/security boundaries and change deliberately.

Idempotency, recipient permission, account/recipient/new-chat safeguards, cooldown/circuit behavior, and health checks are defensive controls, not anti-detection techniques. Do not add fake typing for evasion, proxy/fingerprint rotation, device spoofing, bulk/campaign machinery, or restriction bypass behavior.