# Backend Production Hardening Execution Ledger

This ledger tracks execution of the approved backend hardening design and implementation plan without competing with the concise root `plan.md`.

Authoritative artifacts:

- design: `.agent/specs/2026-08-10-backend-production-hardening-design.md`
- implementation plan: `.agent/plans/2026-08-10-backend-production-hardening.md`
- final verification checkpoint: `.agent/checkpoints/2026-08-11-backend-production-hardening-verification.md`
- execution branch: `staging/backend-production-hardening`
- integration PR: #18

Architecture remains a production-grade single-instance modular monolith: Express + TypeScript + Baileys + SQLite + filesystem Baileys auth + React + one production container. No Redis, distributed queue, database server, DI framework, microservice split, or ceremonial architecture was introduced.

## Mainline Reconciliation

**Status:** completed.

The original staging history was rebuilt on top of the post-PR-21 / post-Iteration-20 mainline rather than merging stale public docs and planning layout back into the repository.

Preserved archaeology branches:

- `backup/backend-production-hardening-pre-reconcile`
- `backup/zero-config-pairing-pre-reconcile`

The rebuilt staging line preserved current Audit/Session Iteration 20 lifecycle behavior and moved hardening design/plan/evidence under `.agent/` rather than restoring `docs/superpowers`.

Zero-config first pairing from the old PR #15 is represented in PR #18 and covered by regression tests; PR #15 was closed as superseded instead of being merged from its obsolete persistence baseline.

## Hardening Iteration 0 — Baseline Integration and Staging Safety

**Status:** completed.

- approved design and implementation plan;
- zero-config first-pairing/bootstrap integrated;
- SQLite settings and Bearer/cookie authentication preserved;
- current session-state work reconciled from main;
- baseline tests/build/Docker/Docs/CodeQL verified.

Initial verified runtime head: `77a80bb69c42511a39e012b58738d4900469f1d1`.

## Hardening Iteration 1 — Characterization and Contract Lock

**Status:** completed.

Characterization coverage locks:

- authentication and validation responses;
- malformed/oversized JSON;
- outbound policy HTTP mappings;
- disconnected WhatsApp handling;
- sanitized unexpected failures;
- message-status contracts;
- first boot/session resume/pair/QR/rebind lifecycle;
- recoverable reconnect, terminal logout, initialization failure, health invalidation, and shutdown.

Checkpoint: `731edd074678edfceb02ef25cc95dee2ce778dc2`.

## Hardening Iteration 2 — Typed Application Errors and HTTP Mapping

**Status:** completed.

Implemented:

- neutral `ApplicationError` and stable application error codes;
- HTTP mapping outside business policy;
- sanitized unknown-error response/logging;
- typed outbound, audit-cursor, phone, and WhatsApp integration failures;
- outbound policy no longer owns HTTP status semantics or trusts arbitrary `Error.name` values as application policy codes.

Key TDD checkpoints include RED `4ba3d65...`, `1ff89db...`, `3c04117...`, and `9fb7f30...`; reviewed GREEN runtime head `334fc94b95d49b0bde234c5ea81b28f449f76062` passed its full gate.

## Hardening Iteration 3 — Message Application Service

**Status:** completed.

Implemented a small messages application boundary with manual dependency injection only. HTTP routes retain transport validation/auth/rate-limit/idempotency/activity/response responsibilities; the service owns send/status use-case delegation.

TDD evidence:

- RED `803a86b...` — missing service;
- RED `9633046...` — routes still bypassed service;
- GREEN `bb8ea1146ed13d44ecf1384674e411a7c26e0bac` — route/service boundary and existing contracts green.

## Hardening Iteration 4 — Outbound Policy Decoupling

**Status:** completed by acceptance review; no duplicate code move required.

The planned target had already been reached during Iteration 2:

- outbound policy returns typed application decisions/errors;
- no HTTP status table lives in policy;
- retry metadata remains on typed application errors;
- HTTP mapping remains in `backend/src/http/errors/error-response.ts`;
- outbound policy safety semantics and public response contracts remain covered by characterization tests.

No redundant abstraction was introduced merely to satisfy the checklist.

## Hardening Iteration 5 — WhatsApp Runtime and Lifecycle Split

**Status:** completed.

Valid RED CI `31432130876` failed only because the new sender/lifecycle boundaries did not exist while pre-existing suites stayed green.

Implemented:

- `modules/whatsapp/runtime.ts` — private socket/generation/lifecycle flags;
- `modules/whatsapp/lifecycle.ts` — socket creation, events, reconnect, credentials, pairing, rebind, and shutdown;
- `modules/whatsapp/sender.ts` — connected-state check, normalization, outbound policy, send orchestration, caches/status, accepted-state persistence;
- `modules/whatsapp/observability.ts` — sanitized Baileys audit/account-health adapter;
- typed WhatsApp rejection mapping;
- `whatsapp/client.ts` reduced to compatibility facade;
- public `whatsapp.ts` exposes narrow Wago-level operations and never the raw Baileys socket.

GREEN CI `31432667063` passed formatting/lint, tests, core production builds, and Docker build after formatter-only cleanup.

## Hardening Iteration 6 — Persistence and Transaction Ownership

**Status:** completed.

Valid RED head `11cc7db549909cf2a6996720cef6b895089d6136`, CI `31432938378` proved three gaps:

- migration ownership module missing;
- transaction helper missing;
- forced accepted-state persistence failure still resolved instead of failing closed.

Implemented:

- released migrations 1–3 moved unchanged into `infrastructure/database/migrations.ts`;
- migration versions and SQL semantics were not rewritten;
- shared SQLite transaction helper with rollback behavior;
- old public database transaction wrapper retained for callers;
- accepted outbound multi-write safety state remains atomic;
- forced durable-state failure rolls back partial idempotency state and raises typed `OUTBOUND_STATE_PERSIST_FAILED`.

Migration, transaction, persistence-failure, existing SQLite, policy, HTTP, and application suites are green in the final automated gate.

## Hardening Iteration 7 — HTTP and Application Lifecycle Cleanup

**Status:** completed.

Valid RED CI `31433647723` showed 189 existing tests passing and exactly three new boundary suites failing because their modules were absent.

Implemented:

- shared Express `asyncHandler`;
- one final HTTP error middleware for malformed JSON, oversized payloads, typed application errors, and sanitized unknown failures;
- existing public unknown-error code `INTERNAL_ERROR` preserved rather than introducing an undocumented contract break;
- asynchronous message, recipient, and WhatsApp routes use the shared async boundary while endpoint-specific response contracts remain intact;
- explicit idempotent application lifecycle owner;
- shutdown sequence after HTTP intake closes: WhatsApp shutdown → outbound policy flush → database checkpoint → database close;
- duplicate legacy `server-lifecycle` implementation/test retired;
- gateway readiness moved behind `modules/gateway/readiness.ts` with unchanged public `/ready` response shape.

## Hardening Iteration 8 — Production Engineering Rules and Documentation

**Status:** completed.

`AGENTS.md` now describes the repository as a production-grade, single-instance modular monolith and uses the approved priority order:

1. Correctness
2. Security
3. Data integrity
4. Reliability
5. Maintainability
6. Observability
7. Simplicity
8. Performance
9. Extensibility

Mandatory rules cover module ownership, external-input validation, typed expected errors, bug-fix regressions, explicit transaction boundaries, append-only released migrations, explicit lifecycle transitions, retry idempotency, sanitized logs, graceful lifecycle behavior, deliberate API contract changes, and Baileys containment.

Anti-over-engineering rules explicitly reject decorative microservices, Redis/queues, generic layer factories, unnecessary ports/adapters/DTO ceremony, SQL in routes, and HTTP decisions in business policy.

A repository search found no stale MVP framing in current public Architecture/Development docs, so those public files were intentionally left unchanged.

## Hardening Iteration 9 — Full Verification and Rollback Gate

**Status:** automated gate completed; physical-handset limitation documented.

Added `scripts/smoke-container.sh` and CI coverage that verifies:

- current production Docker build;
- fresh empty-volume startup;
- `/health`, `/ready`, and dashboard reachability;
- exact released migration set `[1,2,3]`;
- stable app identity/readiness over restart;
- no destructive migration reapplication;
- known-good `main` image build;
- rollback of the same copied persistent state to the known-good image;
- rollback `/health`, `/ready`, dashboard, and migration readability.

Runtime verification head `03f6c0f2d0a5067b3fd4ed9dcf997ce208de4990`:

- CI `31434458628` — success;
- formatting/lint — success;
- backend/frontend tests — success;
- backend/frontend production builds — success;
- public documentation build — success;
- Docker current image build — success;
- restart/persistence smoke — success;
- rollback image + same-volume rehearsal — success;
- CodeQL `31434458742` — success.

Physical WhatsApp QR scanning cannot be performed by the GitHub connector/hosted runner and is **not** claimed as executed. Pair/QR/connected/resume/reconnect/terminal-invalid/rebind/shutdown behavior is covered by automated Wago/Baileys lifecycle regressions. The limitation and exact automated evidence are recorded in `.agent/checkpoints/2026-08-11-backend-production-hardening-verification.md`.

## Final PR Gate

The verification checkpoint and this ledger are record-only changes after runtime verification head `03f6c0f...`.

Before merge, the exact final PR head containing these records must satisfy:

- Core CI including repository check, all tests, core production builds, and docs build;
- Docker current-image build;
- deterministic restart/persistence smoke;
- same-volume rollback rehearsal against current `main`;
- CodeQL;
- `main...staging/backend-production-hardening` compare with `behind_by=0`;
- diff review for approved scope and accidental architecture ceremony.

## Engineering Rules

MUST: preserve module ownership; validate untrusted boundaries; use typed expected errors and stable public codes; add regression coverage before behavior-moving fixes; use explicit transactions for multi-write invariants; keep released migrations append-only; make state transitions explicit; preserve retry idempotency; keep logs sanitized; keep Baileys internals inside the WhatsApp module.

SHOULD: prefer composition, narrow exported APIs, colocated focused tests, and interfaces only where they create a real boundary.

MUST NOT: add distributed infrastructure by default; create ceremonial layers; put SQL in routes; put HTTP-status decisions in business policy; expose raw Baileys sockets across modules; swallow errors; log secrets/full identifiers/message bodies; or make destructive schema changes without migration/rollback design.
