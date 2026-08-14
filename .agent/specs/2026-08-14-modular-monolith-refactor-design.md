# Modular Monolith Refactor Design

## Status

Approved for implementation on `refactor/modular-monolith-structure`.

This refactor is intentionally incremental. It must never be merged until the user explicitly requests a merge.

## Goal

Make Wago easier to grow and maintain by removing architectural drift and giving every feature one obvious ownership boundary, while preserving the existing pragmatic single-process modular-monolith architecture.

The target is not Clean Architecture ceremony. The target is a small feature-first modular monolith that follows DRY, YAGNI, KISS, explicit ownership, and test-first refactoring.

## Non-goals

Do not introduce:

- microservices;
- Redis, Kafka, RabbitMQ, BullMQ, or a generic event bus;
- dependency-injection frameworks;
- generic repository/controller/service hierarchies;
- DTO/mapper/port/adapter layers without a demonstrated seam;
- Prisma or another ORM;
- Redux, Zustand, or TanStack Query solely for this refactor;
- intentional public API behavior changes;
- a big-bang directory rewrite.

## Current problem

The backend currently mixes three structural conventions:

1. feature modules under `src/modules/*`;
2. horizontal technical folders such as `routes`, `middleware`, and `infrastructure`;
3. legacy domain folders such as `whatsapp`, `webhooks`, `policy`, `recipients`, and `activity`.

This creates ambiguous ownership. The WhatsApp domain is the clearest example: behavior is split between `modules/whatsapp`, `whatsapp`, `routes/whatsapp.routes.ts`, and the root `whatsapp.ts` facade.

There are also several responsibility hotspots:

- `config/index.ts` mixes environment configuration, SQLite access, legacy webhook import, persisted app settings, API-key bootstrap, and API-key rotation;
- `modules/whatsapp/lifecycle.ts` owns socket creation, event wiring, credential persistence, reconnect logic, status transitions, and lifecycle orchestration;
- `frontend/src/api.ts` owns the HTTP transport plus every feature's API types/functions;
- `useDashboardController.ts` owns access, pairing, messaging, dialogs, notices, clipboard behavior, and presentation derivation.

## Target architecture

Backend feature code should converge on one convention:

```text
backend/src/
├── app.ts
├── index.ts
├── app/
│   └── lifecycle.ts
├── config/
│   ├── env.ts
│   └── runtime-paths.ts
├── http/
│   ├── middleware/
│   └── errors/
├── infrastructure/
│   ├── database.ts
│   ├── database/
│   ├── data-mount.ts
│   ├── instance-lease.ts
│   ├── legacy-json-import.ts
│   └── logger.ts
├── modules/
│   ├── access/
│   ├── activity/
│   ├── whatsapp/
│   ├── messages/
│   ├── recipients/
│   └── webhooks/
└── shared/
```

A module may contain `routes.ts`, a focused service/policy, stores, and internal helpers. It does not need every conventional enterprise layer.

### Dependency direction

```text
HTTP route
  -> application service/policy when orchestration is real
  -> store or protocol adapter
  -> SQLite / Baileys
```

Rules:

- `config` reads/validates environment and runtime paths only. It must not open/query/mutate SQLite.
- `infrastructure` must not depend on feature modules.
- feature SQL lives with the feature store; migrations and transaction mechanics remain infrastructure.
- Baileys-specific behavior remains inside `modules/whatsapp`.
- routes own transport validation, authentication/rate-limit middleware, HTTP status, and response serialization.
- business policy must not own HTTP status codes.
- introduce a service/factory only when it creates a concrete orchestration boundary or test seam.

## Refactoring strategy

Use a strangler-style internal refactor. Never relocate the entire source tree in one change.

For each module:

1. add an architecture/characterization test that describes the next desired boundary;
2. run it and confirm the intended RED failure;
3. move or extract the smallest responsibility required to satisfy the boundary;
4. update imports without changing the public runtime contract;
5. run focused tests until GREEN;
6. run relevant neighboring tests/build checks;
7. keep the module green before touching the next module.

Existing tests are contract safety nets. New architecture tests exist only for meaningful boundaries that should remain stable; do not test arbitrary file-count or style preferences.

## Module order

### Phase 1 — Access/config core

Untangle `config/index.ts` first because it is imported broadly and currently creates hidden persistence dependencies.

Target:

```text
config/
├── env.ts
└── runtime-paths.ts

modules/access/
├── api-key.ts
├── settings-store.ts
├── browser-session-store.ts
└── routes.ts
```

`config` becomes pure environment/runtime configuration. Persisted app settings and API-key lifecycle become access-module responsibilities.

### Phase 2 — HTTP plumbing

Consolidate duplicate middleware namespaces under `http/middleware` and remove dead compatibility aliases only after all consumers move.

### Phase 3 — WhatsApp core

Consolidate all WhatsApp-owned files under `modules/whatsapp`.

Split only the proven hotspot responsibilities:

- lifecycle orchestration;
- socket event wiring;
- serialized credential persistence.

Do not create class/factory hierarchies.

### Phase 4 — Messages and outbound policy

Move message routes and outbound safety policy into the messages module. Preserve the currently cohesive policy logic unless a concrete responsibility split becomes necessary.

### Phase 5 — Webhooks

Move webhook routes/settings/delivery components into one module. Keep durable store factories that accept `DatabaseSync` where they provide a real test seam.

### Phase 6 — Activity and recipients

Move remaining feature-owned routes/stores/queries into their modules and remove legacy top-level domain folders when no consumer remains.

### Phase 7 — Frontend boundaries

Keep the existing feature-first React architecture.

Refactor incrementally:

- create one shared HTTP client;
- move API calls/types beside their features;
- fold readiness into the dashboard's existing refresh lifecycle;
- split the dashboard controller into focused access/pairing/messaging concerns;
- keep React local state; do not add a new state library.

### Phase 8 — Repository hygiene

Only after runtime modules are stable:

- remove proven dead aliases/no-op compatibility functions;
- ignore/untrack generated Astro metadata when safe;
- evaluate one pnpm workspace lockfile and update Docker caching/install behavior atomically if the payoff remains worthwhile.

Package-manager cleanup is not allowed to block the architectural refactor.

## TDD policy

Every phase uses RED -> GREEN -> REFACTOR.

For structural changes, RED should normally be an architecture test that fails because a forbidden dependency/path still exists. Existing behavior tests must remain green throughout.

No production refactor is made first and covered afterward.

When a runtime defect is discovered during the refactor, add a focused regression test reproducing that defect before fixing it.

## Git policy

- exactly one working branch for the full refactor: `refactor/modular-monolith-structure`;
- no iteration/retry/follow-up branches;
- meaningful TDD/refactor checkpoint commits are allowed;
- do not create a PR merely to perform the work;
- never merge until the user explicitly says to merge;
- when eventually authorized, verify the final head and mandatory gates before any merge action.

## Acceptance criteria

The refactor is complete only when:

1. each backend domain has one obvious feature ownership location;
2. `config` has no SQLite or feature-store side effects;
3. the WhatsApp lifecycle hotspot has focused collaborators without enterprise-layer ceremony;
4. frontend feature APIs no longer depend on one god `api.ts` file;
5. dashboard polling has one lifecycle rather than independent readiness/status schedulers;
6. dead legacy aliases/directories are removed only after consumers migrate;
7. public HTTP behavior, durable SQLite semantics, Baileys auth compatibility, readiness behavior, and security controls remain unchanged unless explicitly approved separately;
8. focused tests, full backend/frontend tests, builds, lint/check, and release-relevant container verification are green at the final branch head;
9. the branch remains unmerged until explicit user authorization.
