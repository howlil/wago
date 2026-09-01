# Wago Project

This file is the durable source of truth for Wago's product shape, architecture, ownership, engineering constraints, and operational boundaries. Keep it current and compact. Do not use it for task plans or history.

## Product

Wago is a production-grade, self-hosted WhatsApp gateway for one WhatsApp account per deployed instance. It is intentionally small enough to operate and reason about as a single application.

Production-grade means correctness, security, data integrity, reliability, recoverability, and truthful failure behavior. It does not imply distributed infrastructure or enterprise layering.

The dashboard is the human control plane. External applications use the HTTP API as the data plane.

```text
Human operator -> Dashboard -> Control / Settings / Audit Log
Application    -> Bearer API key -> Wago HTTP API -> WhatsApp
```

Workspace ownership:

```text
Control   = observe + operate
Settings  = configure
Audit Log = investigate
```

- Control owns gateway readiness, WhatsApp connection/account operation, health, and compact diagnostics.
- Settings owns machine API credentials, recipient policy, webhooks, and operator browser-session administration.
- Audit Log owns operational evidence and investigation.
- Browser-session authentication and machine Bearer API-key access are separate security concepts.
- The dashboard is not a CRM or general WhatsApp client.

## Runtime architecture

```text
React + Vite dashboard
        |
        v
Express + TypeScript
        |
        +--> SQLite application state
        +--> filesystem-backed Baileys auth
        +--> Baileys / WhatsApp Web

one Node.js process
one Docker container
one persistent /app/data volume
one active WhatsApp account
```

Core constraints:

- Express + TypeScript backend.
- React + Vite frontend.
- Baileys is contained behind the WhatsApp capability boundary.
- SQLite is the authoritative durable application store.
- Baileys auth remains filesystem-backed under `/app/data/auth`.
- Docker-first, single-container deployment.
- One active Wago instance owns one persistent `/app/data` volume.
- Public API behavior remains stable unless deliberately changed.

Do not introduce microservices, multi-session/multi-tenant architecture, Redis/Kafka/RabbitMQ/BullMQ, mandatory PostgreSQL/MySQL, Kubernetes/service mesh, CQRS/event sourcing, dependency-injection frameworks, generic repository/service/controller hierarchies, plugin systems, or speculative provider abstractions without a concrete approved requirement.

## Repository ownership

Organize behavior from meaning outward:

```text
behavior -> owner -> boundary -> module/feature -> file
```

### Backend

```text
backend/src/
├── app.ts
├── index.ts
├── app/             application composition/lifecycle
├── modules/         capability-owned behavior
├── infrastructure/  application-level runtime/persistence mechanisms
├── http/            reusable HTTP transport behavior
├── config/          runtime configuration
├── errors/          genuinely cross-cutting error primitives
├── architecture/    executable boundary regressions
└── utils/           only ownerless low-level utilities
```

Current capability owners include `access`, `activity`, `gateway`, `messages`, `metrics`, `recipients`, `webhooks`, and `whatsapp`.

Rules:

- `index.ts` owns process startup/shutdown and top-level lifecycle, not business behavior.
- `app/` owns composition or coordination broader than one capability.
- `modules/<capability>/` is the default owner for capability policy, state, persistence, routes, and tests.
- `http/` owns transport plumbing, not feature policy.
- `infrastructure/` owns application-level mechanisms such as database setup, mount/lease behavior, and logging.
- Baileys socket/protocol behavior stays inside `modules/whatsapp/`.
- Routes do not execute SQL or manipulate raw Baileys sockets.
- Business policy does not choose HTTP status codes.
- Cross-module use goes through narrow public capability boundaries rather than private-file imports.
- Avoid dependency cycles; reconsider ownership before adding indirection to hide one.

### Frontend

```text
frontend/src/
├── App.tsx           application composition
├── main.tsx          runtime bootstrap
├── features/         feature-owned behavior/state
├── pages/            route/workspace composition
└── shared/           proven cross-feature primitives/infrastructure
```

Current feature owners include `access`, `activity`, `dashboard`, `gateway`, `messages`, `recipients`, `settings`, and `whatsapp`.

Dependency direction:

```text
App -> pages -> features -> shared
feature -> its own local modules
shared -> shared
```

Rules:

- Keep behavior/state feature-local by default.
- `pages/` compose workspaces but do not own feature networking or business state.
- `shared/` is for genuinely cross-feature primitives with one clear reason to change.
- Keep `App.tsx` and shell code as composition surfaces.
- Prefer local React state and focused hooks until current complexity proves a broader mechanism is needed.
- Use Wago product vocabulary in UI; expose provider internals only for justified diagnosis.
- `frontend/DESIGN.md` owns detailed UI/interaction/layout rules.

## State and dependency rules

Every meaningful mutable state needs a clear owner, mutation boundary, lifecycle, and invariant. Keep state close to the code that protects it.

Prefer one writable source of truth and derive secondary views when cheaper than synchronizing duplicate state. Durable state belongs to its persistence owner. Ephemeral socket/UI/cache state may remain in memory when durability is not required for correctness, safety, or diagnosis.

Keep dependencies pointing toward the owner of meaning. Framework/provider details stay at their boundary. Add an interface or abstraction only when there is a real current substitution, ownership, volatile-boundary, or repeated-behavior need.

## Engineering constraints

Prefer the smallest correct change with the lowest justified blast radius.

- Local before shared.
- Explicit before clever.
- Cohesive before arbitrarily small.
- Lower coupling before speculative reuse.
- No line-count or one-class-per-file rules.
- No abstraction solely to make mocking easier.
- Duplication can be cheaper than coupling when reasons to change differ.
- Avoid vague global owners such as `manager`, `processor`, `helper`, `common`, or generic `services` when a capability owner exists.
- Validate untrusted input at HTTP, persistence/import, and provider boundaries.
- Keep expected application failures stable/typed where callers need to distinguish them.
- Do not swallow unexpected failures; attach sanitized context at the owning boundary.
- Remove dependencies and local compatibility paths when the current authorized change makes them obsolete.

Verification is risk-based. Prioritize automated protection for business invariants, persistence/data integrity, migrations, concurrency/lifecycle transitions, security/privacy boundaries, and public/provider contracts. Use real SQLite behavior in persistence tests where practical. Test Wago's Baileys adapters/lifecycle rather than real WhatsApp connectivity in unit tests. Keep mocks isolated and deterministic.

## Persistent state and operations

Durable state lives under `/app/data`:

```text
/app/data/
├── wago.db
├── wago.db-wal      may exist while WAL is active
├── wago.db-shm      may exist while WAL is active
└── auth/            Baileys authentication state
```

Treat the whole directory and its backups as secret-bearing state.

Operational constraints:

- Released SQLite migrations are append-only; do not rewrite shipped migration versions.
- Multi-write durable invariants use explicit transactions.
- Never run multiple active Wago instances against the same SQLite/auth volume.
- Production fails closed when durable storage cannot be trusted as persistent.
- Startup/shutdown and WhatsApp socket ownership must be deterministic.
- Terminal WhatsApp session invalidation requires explicit pairing/recovery rather than endless reconnect.
- Recoverable disconnects may reconnect with bounded backoff.
- Credential-write failures surface as degraded state.
- Health/readiness and dashboard state must represent disconnected, unavailable, degraded, checking, and invalid-session states truthfully.
- Do not make request-time readiness depend on expensive/unstable protocol or filesystem inspection when owned cached state safely represents the same invariant.

Never log or commit API keys, setup tokens, cookies, authorization headers, QR payloads, Baileys credentials, message text, full phone numbers/JIDs, raw protocol payloads, or copied `/app/data` contents.

Back up `/app/data` as one sensitive unit before risky durable-state changes. Restore only into a controlled stopped/replacement instance. Do not use `docker compose down -v` during normal upgrades unless destroying gateway state is explicitly intended. Preserve rollback compatibility for durable changes whenever reasonably possible.

## Product safety boundaries

Baileys is an unofficial WhatsApp Web client. Wago cannot guarantee unrestricted deliverability or ban prevention.

Outbound safeguards such as idempotency, recipient permission, account/recipient/new-chat limits, cooldown/circuit behavior, and health checks are defensive product controls. Do not implement bulk/campaign machinery, scraping, fake typing for evasion, fingerprint/device spoofing, proxy rotation, or restriction-bypass behavior.

Persist normalized operational/audit facts, not raw protocol packets or secret-bearing payloads.

Webhook delivery is at-least-once. Retries/manual redelivery preserve stable delivery identity where the contract depends on it. HMAC/signature behavior and delivery-attempt state are compatibility/security boundaries and must change deliberately.

## Context discipline

This file owns durable constraints and decisions directly. Do not create separate committed engineering rulebooks, operations rulebooks, decision diaries, skills, plan/spec files, sprint artifacts, checkpoints, or status documents for information that belongs here.
