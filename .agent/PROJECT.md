# Wago Project Model

This file owns Wago's durable product shape, architecture, source ownership, hard constraints, and non-goals. It does not own task workflow, implementation ceremony, operational procedures, or current-state history.

## Product shape

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

Core technology and ownership boundaries:

- Express + TypeScript backend.
- React + Vite frontend.
- Baileys is contained behind the WhatsApp capability boundary.
- SQLite is the authoritative durable application store.
- Baileys auth remains filesystem-backed under `/app/data/auth`.
- Docker-first, single-container deployment.
- One active Wago instance owns one persistent `/app/data` volume.
- Public API behavior remains stable unless deliberately changed.

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

Ownership rules:

- `index.ts` owns process startup/shutdown and top-level lifecycle, not business behavior.
- `app/` owns composition or coordination broader than one capability.
- `modules/<capability>/` is the default owner for capability policy, state, persistence, routes, and tests.
- `http/` owns transport plumbing, not feature policy.
- `infrastructure/` owns application-level mechanisms such as database setup, mount/lease behavior, and logging.
- Baileys socket/protocol behavior stays inside `modules/whatsapp/`.
- Routes do not execute SQL or manipulate raw Baileys sockets.
- Business policy does not choose HTTP status codes.
- Cross-module use goes through narrow public capability boundaries rather than private-file imports.

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

Frontend ownership rules:

- Keep behavior/state feature-local by default.
- `pages/` compose workspaces but do not own feature networking or business state.
- `shared/` is for genuinely cross-feature primitives with one clear reason to change.
- Keep `App.tsx` and shell code as composition surfaces.
- Prefer local React state and focused hooks until current complexity proves a broader mechanism is needed.
- Use Wago product vocabulary in UI; expose provider internals only for justified diagnosis.
- `frontend/DESIGN.md` owns detailed UI/interaction/layout rules.

## State and dependency model

Every meaningful mutable state needs a clear owner, mutation boundary, lifecycle, and invariant. Keep state close to the code that protects it.

Prefer one writable source of truth and derive secondary views when cheaper than synchronizing duplicate state. Durable state belongs to its persistence owner. Ephemeral socket/UI/cache state may remain in memory when durability is not required for correctness, safety, or diagnosis.

Dependencies point toward the owner of meaning. Framework/provider details stay at their boundary. Avoid dependency cycles; reconsider ownership before adding indirection to hide one.

## Hard constraints

Unless a concrete approved requirement changes them:

- one Wago process owns one WhatsApp account;
- one active Wago instance owns one persistent `/app/data` volume;
- SQLite remains authoritative application storage;
- Baileys auth remains filesystem-backed under `/app/data/auth`;
- Baileys internals do not leak outside the WhatsApp owner or user-facing gateway vocabulary without a diagnostic reason;
- public API behavior remains stable;
- browser-session authentication remains separate from machine Bearer API-key access;
- sensitive auth/session/message/protocol data is not persisted or logged unnecessarily;
- disconnected, unavailable, degraded, checking, and invalid-session states are represented truthfully;
- outbound safeguards are defensive controls, never enforcement-evasion mechanisms;
- the dashboard remains a control plane, not a CRM or general WhatsApp client.

## Non-goals

Do not introduce without a concrete approved requirement:

- microservices or multi-service deployment;
- multi-session or multi-tenant architecture;
- Redis, Kafka, RabbitMQ, BullMQ, or queue infrastructure;
- PostgreSQL/MySQL as a mandatory runtime dependency;
- Kubernetes/service-mesh architecture;
- CQRS or event sourcing;
- dependency-injection frameworks;
- generic repository/service/controller hierarchies;
- speculative provider abstractions or plugin systems;
- CRM/contact-management behavior;
- bulk/campaign behavior, scraping, fingerprint spoofing, proxy rotation, or restriction bypasses.

Use `.agent/ENGINEERING.md` for implementation rules, `.agent/OPERATIONS.md` for production/persistence rules, `.agent/DECISIONS.md` for durable rationale, and `.agent/STATE.md` for what is currently true.