# Backend Production Hardening Design

Status: Approved design baseline
Date: 2026-08-10
Target branch: `staging/backend-production-hardening`
Target architecture: production-grade single-instance modular monolith

## 1. Context

Wago has outgrown its original MVP framing. The backend already contains production-oriented behavior such as SQLite migrations, WAL mode, transactions, structured logging, request middleware, persistent outbound policy state, activity history, WhatsApp account binding, reconnect logic, rate limiting, idempotency support, graceful shutdown, health endpoints, and container deployment.

The implementation should now be maintained as a production-grade backend while preserving the operational simplicity of a single self-hosted instance.

This design intentionally does not convert Wago into a distributed platform or enterprise-style framework stack.

## 2. Architectural Decision

Wago remains a single-instance modular monolith:

- one Node.js/Express process per Wago instance;
- one WhatsApp account per Wago instance;
- Baileys remains the WhatsApp protocol client;
- SQLite remains the authoritative application database;
- Baileys authentication state remains filesystem-backed on the persistent volume;
- one Docker container remains the default production deployment unit;
- the dashboard and backend remain deployable together as one application.

This is the production architecture, not a temporary MVP architecture.

## 3. Goals

The hardening/refactor must improve:

1. correctness and explicit state transitions;
2. security boundaries and sensitive-data handling;
3. data integrity and transaction ownership;
4. reliability across reconnect, restart, rebind, and deployment;
5. maintainability when new features are added;
6. testability without requiring real WhatsApp connectivity in CI;
7. operational visibility through useful structured logs, health, readiness, and stable errors;
8. rollback safety during staged production changes.

The code should remain understandable and operable by one engineer.

## 4. Non-Goals

Do not introduce these without a demonstrated requirement:

- microservices;
- multi-tenant architecture;
- multiple WhatsApp sessions in one Wago instance;
- PostgreSQL/MySQL as a mandatory dependency;
- Redis;
- Kafka, RabbitMQ, BullMQ, or another queue system;
- Kubernetes-specific architecture;
- CQRS/event sourcing;
- a dependency-injection framework;
- repository interfaces for every table;
- generic internal frameworks;
- speculative abstractions for hypothetical future features.

Production-grade means reliable and maintainable, not maximally complex.

## 5. Baseline and Staging Policy

All backend hardening work must occur on `staging/backend-production-hardening` or smaller branches derived from it.

`main` must not receive partial refactors.

The currently open zero-config pairing work affects authentication/configuration and must be resolved before the production-hardening branch is considered merge-ready. Before implementation begins, staging must be rebased or refreshed onto the final accepted `main` baseline so the refactor is tested against the actual authentication model.

A refactor must not be merged because it only "looks cleaner". Observable behavior, tests, container build, lifecycle behavior, and persistence safety must pass first.

## 6. Target Backend Shape

The target is feature-oriented modularity with a small shared infrastructure layer.

```text
backend/src/
  app/
    app.ts
    server.ts
    lifecycle.ts

  config/
    config.ts
    runtime-paths.ts

  modules/
    gateway/
    whatsapp/
    messages/
    recipients/
    outbound-policy/
    activity/

  infrastructure/
    database/
    logging/
    persistence/

  http/
    middleware/
    errors/
    validation/
    response/

  shared/
    errors/
    utils/
```

The exact file names may vary where the existing code has a clearer name. The important rule is ownership, not directory ceremony.

Do not create directories containing meaningless one-line wrappers merely to match this diagram.

## 7. Dependency Direction

The normal request path is:

```text
HTTP route
  -> module service/application operation
    -> module policy/domain logic
      -> SQLite store and/or Baileys boundary
```

Rules:

- routes own HTTP parsing, authentication middleware attachment, request validation, and HTTP response construction;
- routes must not manipulate raw Baileys sockets or execute SQL;
- services own application orchestration and use-case sequencing;
- policy/domain code owns business decisions and must not choose HTTP status codes;
- persistence code owns SQL and transaction-safe data access;
- Baileys-specific protocol details stay inside the WhatsApp module;
- infrastructure must not import HTTP route code;
- cross-module calls should use small exported APIs rather than importing another module's private files.

Manual dependency injection is allowed when it materially improves isolation or testing. A DI framework is not required.

## 8. Module Responsibilities

### 8.1 WhatsApp

Owns:

- Baileys socket lifecycle;
- credential persistence coordination;
- connection state;
- QR state;
- reconnect scheduling;
- rebind/logout behavior;
- recipient JID resolution that depends on Baileys;
- account-health queries that depend on WhatsApp;
- protocol event translation into application-level events/state.

It must expose a small application-facing API. Raw Baileys socket objects must not leak into routes or unrelated modules.

The existing WhatsApp client is a refactor hotspot because connection lifecycle, sending, policy interaction, message-status handling, account health, credential writes, pairing, and rebind logic currently meet in one module. Split only along real reasons to change.

### 8.2 Messages

Owns:

- send-message application orchestration;
- message command validation beyond transport syntax;
- message status retrieval contract;
- idempotent application behavior where applicable;
- translation of send outcomes into stable application results.

It coordinates WhatsApp and outbound-policy modules but does not own raw Baileys behavior.

### 8.3 Outbound Policy

Owns:

- recipient permission/opt-out checks;
- account and recipient send limits;
- new-chat limits;
- idempotency reservation/check rules;
- reach-out cooldown rules;
- account-health gating;
- outbound pause behavior.

It returns typed policy decisions/errors. It must not map those decisions to HTTP response codes.

### 8.4 Recipients

Owns:

- recipient records;
- allow/opt-out state;
- normalized recipient identity used by the application;
- last successful outbound metadata.

### 8.5 Activity

Owns persisted operator/application activity events. It is not a general-purpose event bus.

### 8.6 Gateway/Application Setup

Owns app identity, first-run credential/bootstrap state, and gateway-level configuration persisted by Wago.

## 9. Error Model

Use stable typed application errors instead of checking arbitrary message strings in routes.

Examples include:

- `WhatsAppNotConnectedError`;
- `RecipientNotAllowedError`;
- `RecipientOptedOutError`;
- `RecipientRateLimitedError`;
- `AccountRateLimitedError`;
- `DuplicateMessageError`;
- `PhoneNotRegisteredError`;
- `MessageRejectedError`.

The HTTP layer contains the mapping from application errors to:

- HTTP status;
- stable public error code;
- sanitized client message;
- optional retry metadata.

Unexpected errors are logged internally with context and returned as sanitized 5xx responses. Stack traces, secrets, Baileys credentials, API keys, and sensitive payloads must not be returned to clients.

Do not create an inheritance hierarchy deeper than needed. A small base application error plus explicit subclasses/discriminants is sufficient.

## 10. Validation

Every external boundary must validate untrusted data:

- HTTP body;
- path/query parameters;
- headers used as application input;
- persisted JSON imported from legacy versions;
- environment input that remains supported;
- external library data before it becomes durable application state where assumptions are important.

Validation should be centralized enough to avoid duplicate rules but should not introduce a large schema framework unless request complexity warrants it.

Existing simple validation can remain plain TypeScript when it is clear and well tested.

## 11. Persistence Architecture

### 11.1 SQLite

SQLite remains the authoritative store for Wago-owned application state.

Keep:

- foreign keys enabled;
- WAL journal mode;
- explicit migrations;
- transactional multi-write invariants;
- database file permissions appropriate for sensitive state.

Migration rules:

- migrations are append-only after release;
- an applied migration is never silently rewritten;
- destructive schema changes require an explicit compatibility and rollback plan;
- refactoring code should avoid schema changes unless the schema is actually the problem;
- migrations should be deterministic and testable from a clean database and from supported previous schemas.

### 11.2 Transaction Ownership

If an application invariant requires multiple SQLite writes to succeed or fail together, the owning service/store must define that transaction boundary explicitly.

Do not scatter partial writes across route handlers.

### 11.3 Baileys Credentials

Baileys authentication credentials remain filesystem state under the persistent Wago data volume.

Do not move them into SQLite only for architectural uniformity.

Treat the credential directory as secret production state. Never log or commit it.

### 11.4 Backup Unit

Operational backup must account for both:

- SQLite application state;
- Baileys authentication state.

They are separate storage mechanisms but together represent the recoverable state of one Wago instance.

## 12. Concurrency and State

Because Wago is a single-process instance, do not introduce distributed locks.

Concurrency control should use the smallest correct primitive:

- SQLite transactions for durable data invariants;
- explicit in-process guards for mutually exclusive lifecycle operations such as rebind/reconnect;
- bounded queues only where ordering is genuinely required, such as credential writes;
- idempotency keys for retryable external commands.

All lifecycle state transitions must be explicit and testable. Avoid multiple booleans representing the same conceptual state when a finite state or a single owned state object is clearer.

## 13. WhatsApp Lifecycle Reliability

The following behaviors are first-class production behavior:

- clean fresh start;
- first pairing;
- QR refresh lifecycle;
- successful connection;
- recoverable disconnect;
- bounded reconnect with no duplicate socket race;
- explicit logged-out handling;
- process restart with existing credentials;
- session resume;
- rebind/logout;
- graceful shutdown;
- credential-write flushing before destructive lifecycle operations where required.

Reconnect logic must never create uncontrolled loops or multiple active sockets.

Real Baileys behavior is wrapped behind a testable boundary so CI can exercise lifecycle logic deterministically.

## 14. API Contract Policy

Refactoring must not accidentally change public API behavior.

Existing routes, stable public error codes, and important request/response semantics become characterization/regression baselines.

A public contract may change when the existing contract is materially wrong, but the change must be intentional, documented, tested, and reviewed as an API change rather than being hidden inside a refactor.

Internal structure is free to change without forcing API consumers to change.

## 15. Security Rules

Production backend changes must preserve these properties:

- API keys are never logged;
- persisted generated API credentials are stored as hashes where raw recovery is not required;
- browser cookie-authenticated mutations keep same-origin protection;
- server-to-server API authentication uses explicit authorization credentials;
- sensitive files use restrictive permissions where practical;
- request logging does not serialize secrets or full sensitive payloads;
- public errors are sanitized;
- rate limiting and outbound safety checks are not bypassed by refactoring;
- authentication and authorization checks remain close to the HTTP entry boundary;
- dependency upgrades involving Baileys/security-sensitive libraries require regression verification.

## 16. Observability

Keep observability pragmatic and local-first.

Required:

- structured application logs;
- request correlation/request ID where useful for tracing one request through logs;
- health endpoint for process liveness;
- readiness endpoint that reflects whether the gateway can perform required operations;
- clear lifecycle events for connection, reconnect, rebind, shutdown, database failure, and send failures;
- log levels used consistently.

Do not add Prometheus, OpenTelemetry collectors, external log platforms, or tracing infrastructure until an operational requirement exists.

The code should make future metrics instrumentation possible without being designed around a platform that is not currently required.

## 17. Testing Strategy

### 17.1 Characterization Tests First

Before moving behavior across module boundaries, add or strengthen regression tests that capture the existing intended behavior.

These tests protect the refactor from silently changing semantics.

### 17.2 Unit Tests

Unit-test deterministic business behavior such as:

- policy decisions;
- error mapping;
- normalization;
- state transitions;
- retry/backoff decisions;
- validation;
- small stores/helpers where isolation adds value.

### 17.3 Integration Tests

Use real temporary SQLite databases for persistence integration tests where possible.

Cover:

- clean migrations;
- upgrade migrations;
- transactions and rollback;
- store queries;
- authentication middleware;
- HTTP route contracts;
- bootstrap/setup behavior;
- persistence across application recreation.

### 17.4 Baileys Boundary Tests

CI must not require a real WhatsApp account.

Use a deterministic fake/mock boundary for:

- connect/open/close events;
- QR delivery;
- logout;
- message acceptance/rejection;
- recipient lookup;
- account-health responses.

A separate manual staging smoke test may use a real WhatsApp account before release.

### 17.5 Container Tests

Before merge, verify at minimum:

- Docker image builds;
- container starts from a clean volume;
- `/health` succeeds;
- `/ready` has expected state semantics;
- persistent state survives restart;
- graceful stop exits cleanly.

## 18. CI and Merge Gates

A production-hardening PR is mergeable only when applicable checks pass:

- formatting/lint;
- TypeScript type checks/build;
- backend unit tests;
- integration/characterization tests;
- frontend tests affected by API contract changes;
- Docker build;
- docs build when backend/API docs change;
- CodeQL/security checks already present in the repository.

Do not weaken tests to make a refactor pass.

## 19. Refactor Sequencing

Use incremental refactoring, not a rewrite.

Recommended sequence:

1. refresh staging onto the accepted authentication/config baseline;
2. strengthen characterization tests around current HTTP and lifecycle behavior;
3. establish typed application errors and one HTTP error-mapping boundary;
4. extract message orchestration from routes;
5. separate outbound policy from HTTP concerns;
6. separate WhatsApp lifecycle management from outbound sending concerns;
7. tighten persistence ownership and transaction boundaries;
8. normalize module exports/dependency direction;
9. update documentation and engineering rules;
10. run full regression, container, persistence, and manual staging smoke tests.

Each step should leave the staging branch runnable and testable.

## 20. Rollback Strategy

Production deployments should be tied to immutable Git/image revisions when possible.

If revision B fails after deploying over revision A:

1. stop routing new work to the bad revision if the platform supports it;
2. redeploy the previously known-good revision A;
3. preserve the persistent data volume;
4. verify health/readiness and WhatsApp session state;
5. investigate the failed revision from logs and staging.

Database changes during this hardening effort should remain backward-compatible across at least the immediate previous deploy whenever feasible. Destructive migrations are outside the default refactor scope.

## 21. AGENTS.md Production Engineering State

The repository engineering state must be changed from MVP language to:

> Wago is a production-grade, single-instance modular monolith for one self-hosted WhatsApp account per instance.

Engineering priority order:

1. Correctness
2. Security
3. Data integrity
4. Reliability
5. Maintainability
6. Observability
7. Simplicity
8. Performance
9. Extensibility

Extensibility is deliberately below correctness and simplicity. Future features must fit proven needs rather than speculative architecture.

### Mandatory Engineering Rules

Backend changes MUST:

- preserve clear module ownership;
- validate external input;
- use stable typed errors for expected failure modes;
- include regression coverage for bug fixes;
- use explicit transaction boundaries for multi-write invariants;
- keep released database migrations append-only;
- make lifecycle/state transitions explicit;
- make retryable commands idempotent where duplicate execution has consequences;
- keep logs structured and sanitized;
- support graceful startup/shutdown behavior;
- document deliberate public API changes;
- keep Baileys internals behind the WhatsApp module boundary;
- keep the code understandable without requiring an architecture framework manual.

Backend changes SHOULD:

- prefer composition over inheritance;
- colocate feature logic and its tests;
- introduce interfaces only at meaningful boundaries or when multiple implementations/testing seams justify them;
- prefer narrow exported module APIs;
- improve existing code when the problem directly blocks the change being made;
- use small dependencies only when they clearly reduce risk or complexity.

Backend changes MUST NOT:

- introduce microservices without an operational requirement;
- add Redis/queues only as architectural decoration;
- introduce generic repository/service/controller layers mechanically for every feature;
- add factories, adapters, ports, mappers, or DTO layers without a concrete reason;
- expose raw Baileys internals across modules;
- put SQL in route handlers;
- put HTTP status decisions inside business policy code;
- swallow errors silently;
- log credentials/tokens/session data;
- perform destructive schema migration without an explicit migration/rollback design;
- optimize for hypothetical scale that conflicts with the single-instance product model.

## 22. Feature Addition Rule

For every new backend feature:

1. identify the module that owns the behavior;
2. define the external contract and failure modes;
3. reuse an existing abstraction only when it actually fits;
4. otherwise create the smallest boundary that makes the feature understandable and testable;
5. add tests at the cheapest layer that proves the behavior;
6. add integration coverage when persistence, lifecycle, authentication, or external protocol behavior changes;
7. update API/operations documentation when users or operators observe a change;
8. avoid infrastructure that is not required by the feature.

A new feature does not automatically require a controller/service/repository/interface/factory stack.

## 23. Acceptance Criteria for the Hardening Program

The refactor is complete when:

- `AGENTS.md` no longer describes Wago as an MVP and contains the approved production engineering rules;
- major backend modules have clear ownership and narrow public APIs;
- routes are thin HTTP adapters rather than business orchestration centers;
- policy logic no longer owns HTTP semantics;
- the WhatsApp integration no longer concentrates unrelated lifecycle, policy, and message orchestration responsibilities in one hotspot;
- SQLite migrations and transaction ownership are explicit and tested;
- expected application failures use stable typed errors;
- existing intended API behavior has characterization coverage;
- fresh start, restart, resume, reconnect, rebind, shutdown, and send paths are covered at appropriate test layers;
- Docker build and runtime health checks pass;
- no unnecessary distributed infrastructure has been introduced;
- staging can be rolled back to the previous known-good revision without deleting persistent state.
