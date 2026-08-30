# Wago Project Model

## Product shape

Wago is a production-grade, self-hosted WhatsApp gateway for one account per deployed instance.

It is intentionally small and operable by one engineer. Production-grade means correctness, security, data integrity, reliability, recoverability, and clear failure behavior; it does not mean distributed infrastructure or enterprise layering.

## System shape

Current runtime:

```text
React dashboard
      |
      v
Express + TypeScript
      |
      +--> SQLite application state
      +--> filesystem-backed Baileys auth
      +--> Baileys / WhatsApp Web

single Node.js process
single Docker container
single persistent /app/data volume
single active WhatsApp account
```

Core technology choices:

- Express + TypeScript backend;
- React + Vite frontend;
- Baileys as the WhatsApp protocol client;
- SQLite as authoritative durable application storage;
- filesystem-backed Baileys authentication;
- Docker-first deployment.

## Product interaction model

The dashboard is the human-facing control plane. External applications use the HTTP API as the data plane.

```text
Human operator
  -> dashboard browser session
  -> Control / Settings / Audit Log

Application
  -> Bearer API key
  -> Wago HTTP API
  -> WhatsApp
```

Frontend workspace ownership follows operator intent:

```text
Control   = observe + operate
Settings  = configure
Audit Log = investigate
```

This boundary is part of the product model, not only a layout preference.

- Control owns gateway readiness, WhatsApp connection/account operation, account health, and diagnostics.
- Settings owns machine API credentials, recipient policy, webhooks, and operator browser-session administration.
- Audit Log owns operational evidence and investigation.
- Machine API credentials and dashboard browser sessions remain separate security concepts.

## Project structure and ownership

Organize code from behavior outward:

```text
behavior
  -> owner
  -> boundary
  -> module / feature
  -> file
```

Do not start from a generic folder template and force behavior into it.

### Backend

```text
backend/src/
├── app.ts
├── index.ts
├── app/             application composition and lifecycle
├── modules/
│   ├── access/
│   ├── activity/
│   ├── gateway/
│   ├── messages/
│   ├── recipients/
│   ├── webhooks/
│   └── whatsapp/
├── infrastructure/  application-level runtime/persistence mechanisms
├── http/            transport plumbing and HTTP-specific behavior
├── config/          environment/runtime configuration
├── errors/          genuinely cross-cutting error primitives
├── architecture/    executable dependency/boundary regressions
└── utils/           only ownerless low-level utilities
```

Ownership rules:

- `index.ts` wires process startup/shutdown, HTTP server, and top-level lifecycle; it does not own business behavior.
- `app/` owns application composition and coordination broader than one feature.
- `modules/<capability>/` is the default owner for capability routes, policy, state, persistence, and tests.
- `http/` owns reusable transport mechanisms, not feature policy.
- `infrastructure/` owns application-level mechanisms such as database setup, mount/lease behavior, and logging.
- `config/` reads and validates runtime configuration; it does not become persistence or feature ownership.
- Baileys-specific protocol/socket behavior stays inside `modules/whatsapp/`.

A module may remain flat while its files share one owner and reason to change. Create subfolders only when they materially improve ownership or locality of reasoning.

### Frontend

```text
frontend/src/
├── App.tsx           application composition
├── main.tsx          runtime bootstrap
├── features/
│   ├── access/       operator/browser-session UI behavior
│   ├── activity/     audit/event investigation
│   ├── dashboard/    operational dashboard/readiness coordination
│   ├── gateway/      gateway/API integration controls
│   ├── messages/     message diagnostics/status
│   ├── recipients/   recipient policy controls
│   ├── settings/     delivery/webhook configuration
│   └── whatsapp/     WhatsApp connection/account UI
├── pages/            route/workspace composition
└── shared/           proven cross-feature primitives/infrastructure
    ├── api/
    ├── components/
    ├── hooks/
    ├── layout/
    ├── types/
    └── ui/
```

Frontend rules:

- behavior and state stay feature-local by default;
- `pages/` compose features according to the Control/Settings/Audit workspace boundary;
- `pages/` do not own feature networking or business state;
- `shared/` is admitted only when a concern is genuinely cross-feature with one clear reason to change;
- `App.tsx` and shell code remain composition surfaces, not feature logic containers;
- prefer React local state and focused hooks until current complexity proves a broader state mechanism is needed;
- UI vocabulary should expose Wago concepts rather than provider/library internals unless technical diagnosis requires them.

## Placement rule

For new or changed behavior, decide in this order:

```text
What behavior changes?
  -> Who owns the invariant/state?
  -> Is there an existing module/feature owner?
  -> Which boundary contains the side effect?
  -> What is the smallest coherent change?
```

Default placement:

- capability-owned behavior -> existing backend module or frontend feature;
- HTTP-only parsing/auth/status/serialization -> HTTP/route boundary;
- Baileys protocol behavior -> WhatsApp module;
- SQLite statements for a capability -> capability-owned persistence/store code;
- database migration/transaction/runtime mechanics -> infrastructure database boundary;
- application-wide startup/shutdown/composition -> `app/` / `index.ts`;
- genuinely cross-feature frontend primitive -> `shared/`;
- workspace composition -> `pages/` without moving feature ownership into the page.

Avoid generic global `services/`, `repositories/`, `controllers/`, `managers/`, `helpers/`, `common/`, or `types/` structures when ownership can remain feature-local.

## Dependency rule

Dependencies point toward the owner of meaning and invariants.

Typical backend flow:

```text
HTTP route
  -> capability service/policy when orchestration is real
  -> owned store or protocol boundary
  -> SQLite / Baileys mechanism
```

Rules:

- routes do not execute SQL or manipulate raw Baileys sockets;
- business policy does not choose HTTP status codes;
- infrastructure does not depend on feature internals;
- cross-module use goes through a narrow public capability API rather than private-file imports;
- framework/provider details stay at their boundary;
- avoid dependency cycles; a cycle is usually an ownership problem.

Frontend dependency direction:

```text
App -> pages -> features -> shared
feature -> its own local modules
shared -> shared
```

## State rule

Every meaningful mutable state must have:

```text
owner
+ mutation boundary
+ lifecycle
+ invariant
```

Keep state and the code that protects its invariant close together. Prefer one writable source of truth and derive secondary views when cheaper than synchronizing duplicate state.

Durable state belongs to its persistence owner. Ephemeral socket/UI/cache state may remain in memory when durability is not required for correctness, safety, or diagnosis.

## Structural constraints

- local before shared;
- explicit before clever;
- cohesive before arbitrarily small;
- lower coupling before speculative reuse;
- no file-size or one-class-per-file rules;
- no layer-per-pattern architecture;
- no abstraction solely to make mocking easier;
- duplication may be cheaper than coupling when reasons to change differ;
- extract only when a real ownership, dependency, substitution, or repeated-behavior boundary exists now.

## Hard product and architecture constraints

Unless explicitly changed by an approved requirement:

- one Wago process owns one WhatsApp account;
- one active Wago instance owns a persistent `/app/data` volume;
- SQLite remains authoritative application storage;
- Baileys auth remains filesystem-backed under `/app/data/auth`;
- Baileys internals do not leak outside the WhatsApp module or user-facing gateway vocabulary without a diagnostic reason;
- public API behavior remains stable unless deliberately changed;
- sensitive auth/session/message/protocol data is not persisted or logged unnecessarily;
- browser-session authentication remains separate from machine Bearer API-key access;
- outbound safeguards are defensive controls, never anti-detection mechanisms;
- disconnected, unavailable, degraded, checking, and invalid-session states are represented truthfully;
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
