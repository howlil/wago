# Wago Project

This file owns durable product intent, scope, user-visible behavior, compatibility contracts, hard constraints, and non-goals. Architecture placement belongs in `ARCHITECTURE.md`; implementation conventions belong in `CODE_PATTERNS.md`.

## Product intent

Wago is a production-grade, self-hosted WhatsApp gateway for one WhatsApp account per deployed instance. It is intentionally small enough to operate, inspect, recover, and reason about as one application.

Production-grade means correctness, security, data integrity, reliability, recoverability, and truthful failure behavior. It does not imply distributed infrastructure or enterprise layering.

The dashboard is the human control plane. External applications use the HTTP API as the machine data plane.

```text
Human operator -> Dashboard -> Control / Settings / Audit Log
Application    -> Bearer API key -> Wago HTTP API -> WhatsApp
```

## Operator model

Workspace ownership is intentional:

- **Control** = observe + operate gateway readiness, WhatsApp connection/account lifecycle, health, and compact diagnostics.
- **Settings** = configure machine API credentials, recipient policy, webhooks, and browser-session administration.
- **Audit Log** = investigate searchable operational evidence and technical detail.

Browser-session authentication and machine Bearer API-key access are separate security concepts.

The dashboard is not a CRM, inbox, campaign manager, or general WhatsApp client.

## Core product behavior

Wago currently provides:

- one WhatsApp account per active deployed instance;
- first-run dashboard admin setup and HttpOnly browser sessions;
- optional machine Bearer API credentials for external integrations;
- QR pairing, reconnect handling, invalid-session recovery, and explicit rebind;
- recipient allow/opt-out policy;
- protected outbound text messaging with concurrency-safe idempotency and bounded defensive safeguards;
- durable sanitized outbound diagnostics using Wago-owned message IDs;
- signed at-least-once webhooks with retry, restart recovery, bounded attempt evidence, and manual redelivery;
- sanitized audit logging and low-cardinality operational metrics;
- separate liveness and readiness semantics;
- Docker-first self-hosted distribution;
- public documentation under `apps/docs/`.

## Compatibility contracts

Unless the user explicitly authorizes a breaking change:

- public HTTP behavior remains stable;
- persisted SQLite state and released migrations remain compatible with supported upgrade/rollback expectations;
- browser-session authentication remains separate from machine Bearer API-key access;
- webhook delivery identity/signature semantics remain deliberate compatibility boundaries;
- message bodies, raw auth secrets, raw protocol frames, and unnecessary recipient identifiers are not persisted or logged as diagnostics;
- disconnected, checking, unavailable, degraded, and invalid-session states remain distinguishable where observable;
- public compatibility routes such as `GET /messages/:id/status` are not removed merely because a newer route exists.

## Hard constraints

Unless a concrete approved requirement changes them:

- one Wago process owns one WhatsApp account;
- one active Wago instance owns one persistent `/app/data` volume;
- SQLite remains authoritative application storage;
- Baileys authentication remains filesystem-backed under `/app/data/auth`;
- Baileys/provider internals do not leak into unrelated capabilities or primary user-facing vocabulary without a diagnostic reason;
- outbound safeguards are defensive controls, never enforcement-evasion mechanisms;
- the dashboard remains a control plane rather than a CRM/general WhatsApp client.

## Product vocabulary

Prefer Wago-owned concepts such as gateway readiness, WhatsApp connection, message operation, delivery diagnostics, recipient policy, webhook delivery, and audit evidence.

Expose Baileys-specific concepts only where protocol diagnosis materially requires them.

## Non-goals

Do not introduce without a concrete approved requirement:

- microservices or multi-service deployment;
- multi-session or multi-tenant architecture;
- Redis, Kafka, RabbitMQ, BullMQ, or queue infrastructure;
- PostgreSQL/MySQL as a mandatory runtime dependency;
- Kubernetes or service-mesh architecture;
- CQRS or event sourcing;
- dependency-injection frameworks;
- generic repository/service/controller hierarchies;
- speculative provider abstractions or plugin systems;
- CRM/contact-management behavior;
- bulk/campaign behavior, scraping, fingerprint spoofing, proxy rotation, device spoofing, or restriction bypasses.
