# Wago Architecture

This file owns durable runtime architecture, ownership, dependency direction, data/security/deployment boundaries, and system invariants.

## Runtime shape

```text
React + Vite dashboard
        |
        v
Express + TypeScript gateway
        |
        +--> SQLite application state
        +--> filesystem-backed Baileys auth
        +--> Baileys / WhatsApp Web

one Node.js process
one Docker container
one persistent /app/data volume
one active WhatsApp account
```

Wago is a single-instance modular monolith. Keep this topology until a concrete requirement justifies changing it.

## Monorepo layout

```text
apps/
├── gateway/      HTTP API, persistence, WhatsApp integration, operational behavior
├── dashboard/    React operator control plane
└── docs/         public Astro documentation

Taskfile.yml      canonical developer command surface
pnpm-workspace.yaml
pnpm-lock.yaml
```

The root Taskfile orchestrates developer workflows; each app keeps its own implementation scripts in `package.json`.

## Gateway ownership

`apps/gateway/src/` is organized around capability ownership:

```text
app/             application composition/lifecycle
modules/         capability-owned behavior
infrastructure/  application-level runtime/persistence mechanisms
http/            reusable transport behavior
config/          runtime configuration
errors/          genuinely cross-cutting error primitives
utils/           only ownerless low-level utilities
```

Current capability owners include `access`, `activity`, `gateway`, `messages`, `metrics`, `recipients`, `webhooks`, and `whatsapp`.

Rules:

- `index.ts` owns process startup/shutdown and top-level lifecycle, not business policy.
- `app/` owns composition or coordination broader than one capability.
- `modules/<capability>/` is the default owner for capability policy, state, persistence, routes, and tests.
- `http/` owns transport plumbing, not feature policy.
- `infrastructure/` owns application-level mechanisms such as database setup, mount/lease behavior, and logging.
- Baileys sockets, protocol events, reconnect logic, credential writes, and provider adaptation stay inside `modules/whatsapp/`.
- Routes do not execute SQL or manipulate raw Baileys sockets.
- Business policy does not choose HTTP status codes.
- Cross-module access goes through narrow public capability boundaries rather than private-file imports.

## Dashboard ownership

`apps/dashboard/src/` follows:

```text
App.tsx           application composition
main.tsx          runtime bootstrap
features/         feature-owned behavior/state
pages/            route/workspace composition
shared/           proven cross-feature primitives/infrastructure
```

Current feature owners include `access`, `activity`, `dashboard`, `gateway`, `messages`, `recipients`, `settings`, and `whatsapp`.

Dependency direction:

```text
App -> pages -> features -> shared
feature -> its own local modules
shared -> shared
```

Keep behavior and state feature-local by default. `pages/` compose workspaces but do not own feature networking or business state. `shared/` is for genuinely cross-feature primitives with one reason to change.

`apps/dashboard/DESIGN.md` owns detailed interaction, information architecture, responsive layout, and visual rules.

## State and persistence

Durable application state lives under `/app/data`:

```text
/app/data/
├── wago.db
├── wago.db-wal      may exist while WAL is active
├── wago.db-shm      may exist while WAL is active
└── auth/            Baileys authentication state
```

SQLite is authoritative for application state. Baileys auth remains filesystem-backed. Treat the entire directory and backups as secret-bearing state.

Every meaningful mutable state needs a clear owner, mutation boundary, lifecycle, invariant, and persistence requirement. Prefer one writable source of truth and derive secondary views when cheaper than synchronizing duplicate state.

Released migrations are append-only. Multi-write durable invariants belong inside explicit transaction boundaries.

## Single-owner deployment invariant

Only one active Wago instance may own a given `/app/data` volume/account at a time.

Do not introduce shared-volume replicas, distributed locking, multi-session ownership, or concurrent socket generations without an explicitly approved architecture change.

Production must fail closed when persistence ownership or durability cannot be trusted.

## Security boundaries

Human dashboard authentication and machine API authentication are separate boundaries.

Never log or commit API keys, setup credentials, cookies, authorization headers, QR payloads, Baileys credentials, message text, full phone numbers/JIDs, raw arbitrary Baileys frames, or copied `/app/data` contents.

Validate untrusted input at HTTP, persistence/import, and provider boundaries. Keep transport-specific response/status mapping at the HTTP boundary.

## Health and readiness

`/health` is process liveness. Readiness represents whether Wago can safely perform expected gateway work.

Operational state must remain truthful: disconnected is not connected; unknown is not healthy; invalid session requires explicit recovery; degraded persistence/account state is not normal readiness.

Prefer owned cached state over expensive request-time filesystem/protocol probing when both represent the same invariant safely.

## Backup, restore, and rollback

Back up the whole `/app/data` state as one sensitive unit before risky durable-state changes. Restore only into a controlled stopped/replacement instance. Do not use `docker compose down -v` during normal upgrades unless destroying state is explicitly intended.

Durable-state changes should preserve compatibility with a known-good rollback baseline whenever reasonably possible; otherwise surface the migration/rollback decision explicitly.
