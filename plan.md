# Wago Engineering Iteration Plan

## Target

Build a production-ready, single-account, self-hosted WhatsApp gateway that stays small and understandable:

- one process
- one WhatsApp account
- one persistent `/app/data` volume
- SQLite for application durable state
- Baileys auth under `/app/data/auth`
- transient protocol/UI caches in memory
- Docker-first deployment
- conservative outbound behavior
- no bulk/campaign/anti-detection features

Production-ready does not mean zero WhatsApp enforcement risk. Baileys is an unofficial WhatsApp Web client, so Wago must fail closed, expose session health truthfully, and never disguise protocol uncertainty as a healthy state.

## Current Foundation

The previous production-readiness work is already implemented and should be treated as baseline rather than reworked in this milestone:

- outbound consent/opt-out, idempotency, account/recipient/new-chat limits, pause state
- async `202 pending` send semantics
- account reach-out/new-chat-cap checks
- bounded reconnect backoff
- focused WhatsApp modules
- redacted structured logging
- API key/cookie/Origin hardening
- graceful shutdown
- Docker/GHCR/CI/CodeQL/OSS documentation
- frontend feature boundaries and shared layout
- application durable state consolidated into `/app/data/wago.db`
- SQLite WAL, migrations, normalized outbound-safety tables, transactional accepted-send bookkeeping

Open release validation such as tagged-release smoke tests remains separate from the work below.

## Non-Goals

Do not add:

- Redis, PostgreSQL, Kafka, BullMQ, or another database service
- multi-session or multi-tenant architecture
- raw Baileys packet/frame persistence
- message-history persistence
- raw QR/auth/Signal-key persistence outside Baileys' existing auth store
- bulk sender/campaign scheduler
- fake typing, random delays, proxy/fingerprint rotation, or anti-detection behavior
- a custom frontend router unless the small routing dependency proves unnecessary

## Execution Protocol

This milestone is intentionally **not one-shot**.

For every iteration:

1. mark only that iteration `in progress`
2. write a failing regression test for the behavior being changed
3. implement the smallest coherent change
4. run focused tests
5. run the relevant package build/check
6. update this file with the actual result and commit SHA
7. stop at a checkpoint before starting the next iteration

Do not merge to `main` until all iterations below are complete and the final quality gate is green.

---

## Milestone 4: Audit Observability and Honest Session State

### Iteration 17: Session-State Correctness

**Status:** in progress

Goal: fix the current bug where WhatsApp can be disconnected/unlinked while outbound/account-health UI still appears normal.

Tasks:

- [ ] Add one central disconnect classifier for terminal vs recoverable Baileys disconnects.
- [ ] Explicitly model account-health availability (`unavailable`, `checking`, `available`).
- [ ] Invalidate operator-visible account health when connection closes, rebind starts, or shutdown clears the active socket.
- [ ] Treat `DisconnectReason.loggedOut` as terminal: clear binding, do not reconnect, require pairing.
- [ ] Keep binding for recoverable disconnects, but never expose cached health as currently available.
- [ ] Force health refresh after a successful `connection=open`.
- [ ] Make backend status snapshots truthful when health is unavailable.
- [ ] Add regression tests for linked-device removal/logged-out behavior and recoverable disconnect behavior.

Acceptance:

- [ ] `WhatsApp: disconnected` can never imply `Outbound: Normal` through stale health data.
- [ ] Terminal logout requires a new pairing and does not schedule reconnect.
- [ ] Recoverable disconnect keeps the binding but exposes health as unavailable until restored.
- [ ] Existing send hard-check still rejects when socket/status is not connected.

Verification:

- [ ] focused WhatsApp/account-health tests
- [ ] `pnpm --dir backend test`
- [ ] `pnpm --dir backend run build`
- [ ] `pnpm check`

Checkpoint: stop here and review the state model before Iteration 18.

### Iteration 18: Structured Low-Level Baileys Audit Backend

**Status:** pending

Goal: persist useful Baileys lifecycle evidence without storing raw sensitive protocol payloads.

Tasks:

- [ ] Add `source: wago | baileys` to the audit event model and SQLite schema.
- [ ] Add a dedicated Baileys audit adapter/sanitizer.
- [ ] Record selected lifecycle events: socket creation, QR availability without QR value, connection open/close, disconnect classification, reconnect scheduling, terminal session invalidation, credential persistence failures, message ACK/rejection, reach-out timelock/new-chat-cap changes.
- [ ] Never persist message body, QR value, credentials, Signal keys, tokens, cookies, API keys, full JIDs/phones, or arbitrary nested Baileys payloads.
- [ ] Increase bounded audit retention to 2,000 events.
- [ ] Add server-side filters and cursor pagination to `GET /activity`.
- [ ] Add indexes for newest-first pagination and common filters.
- [ ] Add backend security/regression tests for sanitization, retention, filters, and pagination.

Acceptance:

- [ ] A terminal disconnect can be diagnosed from audit history after the event.
- [ ] Technical detail is useful enough to identify status code/reason/reconnect decision/socket generation.
- [ ] Sensitive fields never enter SQLite audit metadata.
- [ ] The API does not load/filter the whole 2,000-row timeline in application memory.

Verification:

- [ ] focused activity/audit tests
- [ ] `pnpm --dir backend test`
- [ ] `pnpm --dir backend run build`
- [ ] `pnpm check`

Checkpoint: stop here and inspect real audit payload shape before building UI.

### Iteration 19: Dedicated Audit Log Page and Navigation

**Status:** pending

Goal: move operational history out of Control and make low-level diagnostics friendly to ordinary users.

Tasks:

- [ ] Remove Activity Log completely from the Control page.
- [ ] Add a real `/audit` page.
- [ ] Generalize `DashboardShell` into an application shell with page title/action slots.
- [ ] Make sidebar navigation data-driven with `Control` and `Audit Log` on desktop/mobile.
- [ ] Add routing with the smallest maintainable solution; prefer `react-router-dom` if a dependency is needed.
- [ ] Build Audit Log UI with search, source/category/level filters, newest-first timeline, source/severity/category labels, friendly descriptions, expandable technical details, refresh, and `Load more` cursor pagination.
- [ ] Keep technical metadata opt-in; default view must be readable without knowing Baileys internals.
- [ ] Update Account Health/Outbound cards so disconnected/unavailable state is visually explicit rather than optimistic.
- [ ] Add frontend regression tests for routes, sidebar active state, no Activity Log on Control, audit filtering/pagination, and disconnected status semantics.

Acceptance:

- [ ] Sidebar contains exactly the intended workspace pages: `Control` and `Audit Log`.
- [ ] Control has no Activity Log panel.
- [ ] Audit Log is useful to both an operator and a developer debugging Baileys.
- [ ] `Outbound: Normal` is shown only when backend is reachable, WhatsApp is connected, account health is available, and no active restriction is reported.

Verification:

- [ ] `pnpm --dir frontend test`
- [ ] `pnpm --dir frontend run build`
- [ ] `pnpm check`

Checkpoint: stop here for UX review before final hardening.

### Iteration 20: Integration Hardening, Docs, and Release Gate

**Status:** pending

Goal: prove the whole behavior end-to-end and leave the repository internally consistent.

Tasks:

- [ ] Audit all status derivations for stale/optimistic values.
- [ ] Audit all Baileys logging paths for accidental sensitive persistence.
- [ ] Update architecture/operations/security documentation for Audit Log, session invalidation, retention, and privacy boundaries.
- [ ] Add/adjust tests for equal timestamps, malformed cursors, unknown disconnect reason, health fetch failure, rebind, shutdown, and restart.
- [ ] Perform manual linked-device-removal smoke procedure and document expected state transitions.
- [ ] Run full root check/test/build, Docker build, Docs CI, and CodeQL.
- [ ] Open PR only after the branch is internally green; squash-merge only after all checks pass.

Acceptance:

- [ ] Removing Wago from WhatsApp Linked Devices changes Wago to disconnected/pairing-required state without stale healthy outbound indicators.
- [ ] Audit Log contains enough sanitized evidence to explain the transition.
- [ ] No raw secret/message/session payload is persisted by Audit Log.
- [ ] Core, frontend, Docker, docs, and CodeQL gates are green.

Verification:

- [ ] `pnpm check`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] production Docker build
- [ ] Docs CI
- [ ] CodeQL

---

## Implementation Rules

- Prefer explicit failure/unknown state over optimistic status.
- Do not unit-test Baileys internals; test Wago's classifiers, adapters, and state transitions.
- Keep one WhatsApp account per process.
- Treat `/app/data/wago.db`, WAL/SHM files, and `/app/data/auth` as secret-bearing state.
- Do not log or persist QR data, auth data, API keys, cookies, tokens, full phone numbers/JIDs, or message text.
- Do not run multiple replicas against the same SQLite/auth volume.
- Keep transient state transient unless durability is required for safety or diagnosis.
- Avoid unrelated refactors during these iterations.
