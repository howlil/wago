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

Already implemented and treated as baseline:

- outbound consent/opt-out, idempotency, account/recipient/new-chat limits, pause state
- async `202 pending` send semantics
- account reach-out/new-chat-cap checks
- bounded reconnect backoff
- redacted structured logging
- API key/cookie/Origin hardening
- graceful shutdown
- Docker/GHCR/CI/CodeQL/OSS documentation
- frontend feature boundaries and shared layout
- durable application state in `/app/data/wago.db`
- SQLite WAL, migrations, normalized outbound-safety tables, transactional accepted-send bookkeeping

## Non-Goals

Do not add Redis, PostgreSQL, Kafka, queues, multi-session/multi-tenant architecture, message-history persistence, raw protocol payload persistence, bulk/campaign features, anti-detection behavior, or unrelated refactors.

## Execution Protocol

This milestone is intentionally not one-shot. For every iteration:

1. mark only that iteration `in progress`
2. write a failing regression test
3. verify the RED failure is for the intended missing behavior
4. implement the smallest coherent change
5. run focused tests and relevant build/check
6. review the diff for lifecycle/security races
7. update this ledger with RED/GREEN evidence and commit SHA
8. merge only after the iteration quality gate is green
9. stop before the next iteration

---

## Operational Incident: GHCR Release Queue

**Status:** root cause identified; workflow change intentionally kept separate from Iteration 18.

Evidence:

- Release Container run `31377431025` / run #42 remains `in_progress` from commit `75f6531909c16960a806b6285eb9f9fcf8525224`.
- Its `Publish Core GHCR Image` job is stuck at `Build and push core image`.
- `.github/workflows/release-container.yml` uses `concurrency: release-container-${{ github.ref }}` with `cancel-in-progress: false`.
- Therefore newer `main` release runs wait in `pending`; when another pending run arrives, GitHub can replace/cancel the older pending run while the stale in-progress run continues holding the concurrency slot.

Recommended remediation, as a separate release-workflow hotfix:

- cancel stale run #42 once from GitHub Actions to release the current lock;
- change release concurrency to `cancel-in-progress: true` because only the newest `main/latest` image matters;
- add bounded `timeout-minutes` to the publish job so a hung build cannot block releases indefinitely;
- verify the next `main` release publishes `ghcr.io/howlil/wago-simple:latest`.

---

## Milestone 4: Audit Observability and Honest Session State

### Iteration 17: Session-State Correctness

**Status:** completed and merged as `ca75e9e206ea7582ea50068c94e1d8a2af19dae4`.

Completed:

- central terminal/recoverable disconnect classifier;
- explicit account-health `unavailable | checking | available` state;
- health invalidation on disconnect/rebind/shutdown/missing auth/init failure;
- logged-out sessions clear binding and stop reconnect;
- recoverable disconnect keeps binding but health becomes unavailable;
- stale socket references are cleared;
- obsolete in-flight account-health refreshes cannot restore stale `available` state;
- CI, Docker build, and CodeQL green.

Frontend rendering of unavailable health remains deferred to Iteration 19.

### Iteration 18: Structured Low-Level Baileys Audit Backend

**Status:** completed — backend checkpoint reached on `feature/audit-log-backend-iteration18`.

Goal: persist useful Baileys lifecycle evidence without storing raw sensitive protocol payloads.

#### 18A — SQLite Audit Model and Query Layer

- [x] RED migration/query/store regressions before production changes.
- [x] Add migration v3 with `source TEXT NOT NULL DEFAULT 'wago'`.
- [x] Add source/category/level + newest-first audit indexes.
- [x] Move audit event/source/metadata types into `activity/audit-event.ts` while keeping existing call sites compatible.
- [x] Raise bounded retention from 300 to 2,000.
- [x] Add server-side `listAudit()` filtering and keyset cursor pagination.
- [x] Search only `code`, `title`, and `description`; cap search text to 100 chars.
- [x] Invalid cursor fails with stable `INVALID_AUDIT_CURSOR`.
- [x] Equal-timestamp pagination is tested with a fixed clock and row identity tie-breaker.

Acceptance:

- [x] existing activity writes default to `source=wago`;
- [x] filtering/pagination happens in SQLite, not by loading all rows into application memory;
- [x] equal timestamps paginate deterministically using row identity;
- [x] only newest 2,000 events remain.

Evidence:

- RED head `e9e36a6d7d27d438beda2a78002d2e9d3b3f874a`; CI `31414388145` failed on missing query module, migration/source contract, and 2,000-row retention as intended.
- GREEN CI `31414932289` passed check, tests, core build, and Docker build.

#### 18B — Strict Baileys Audit Sanitizer

- [x] RED tests for secret dropping, identifier masking, and nested object/array rejection.
- [x] Add `activity/baileys-audit.ts`.
- [x] Allow primitive metadata only.
- [x] Drop secret/protocol keys including QR, credential/key material, tokens, cookies, authorization, password, message/text, and arbitrary payloads.
- [x] Mask JID/phone values with existing `maskIdentifier()`.
- [x] `recordBaileysAudit()` always persists `source=baileys`.

Acceptance:

- [x] raw protocol objects never enter SQLite metadata through the Baileys adapter;
- [x] full phone/JID/message/QR/auth data cannot be persisted by this adapter.

Evidence:

- RED head `d1add1e1a55dc010f0165b14905686edda70d468`; CI `31415124314` failed because the sanitizer/adapter did not yet exist.
- GREEN CI `31415218064` passed sanitizer tests, project tests/builds, and Docker build.

#### 18C — Baileys Lifecycle Instrumentation

- [x] RED lifecycle/audit regressions first.
- [x] Record socket creation, QR-ready without QR value, connection open/close, disconnect classification, reconnect scheduling, terminal session invalidation, and shutdown.
- [x] Record credential persistence failures and bounded/coalesced credential update success.
- [x] Record message server ACK/rejection without message body or recipient/message identity leakage in audit metadata.
- [x] Record reach-out timelock/new-chat-cap checks/changes and account-health fetch failures using safe primitive metadata.
- [x] Reuse Iteration 17 disconnect classification; reconnect/session semantics are not re-derived.
- [x] Audit persistence failure is isolated from the WhatsApp lifecycle.

Acceptance:

- [x] terminal logout can be diagnosed after the fact from audit rows;
- [x] close event exposes status code/reason/terminal/reconnect/socket generation without raw protocol payload;
- [x] no raw Baileys packet/frame persistence is enabled.

Evidence:

- RED head `97670655d7dc9e333eabe9374f4166519a1b20e0`; CI `31415527250` failed only because the four expected lifecycle audit records did not exist yet.
- GREEN CI `31415984687` passed lifecycle regressions, full tests/build, and Docker build.

#### 18D — Filtered Cursor-Based Audit API

- [x] RED authenticated route tests.
- [x] `GET /activity` accepts `limit`, `before`, `source`, `category`, `level`, and `q`.
- [x] Whitelist enum filters; invalid filter returns `400 INVALID_AUDIT_FILTER`.
- [x] Invalid cursor returns `400 INVALID_AUDIT_CURSOR`.
- [x] Default limit 100; query layer clamps to 1..200.
- [x] Response is `{ success, events, nextCursor? }`.
- [x] Existing API-key authentication behavior remains unchanged.

Evidence:

- RED head `3dfd7bd3d9621b4cc6f109754eb02fd1c24f579e`; CI `31416257346` kept auth green while filter/cursor contracts failed as intended.
- GREEN CI `31416505166` passed route tests, full tests/build, and Docker build.

Iteration 18 final verification:

- [x] focused activity/database/audit/lifecycle/route regressions
- [x] backend + frontend tests through root CI
- [x] backend + frontend/core build through root CI
- [x] `pnpm check` through root CI
- [x] production Docker build
- [x] diff review for pagination/test determinism and lifecycle/privacy boundaries
- [x] reviewed code head `4ac04fdf4e8a1c3766863e2affbecea2dc3b05f6`
- [x] fresh reviewed-code CI `31416724276` success
- [x] fresh reviewed-code CodeQL `31416724242` success

Checkpoint: stop here after final PR-head verification and merge. Do not start frontend `/audit` work in this iteration.

### Iteration 19: Dedicated Audit Log Page and Navigation

**Status:** pending.

Goal: move operational history out of Control and build a readable `/audit` page.

Planned scope:

- remove Activity Log from Control;
- add `/audit` route and data-driven Control/Audit Log navigation;
- build source/category/level/search filters, expandable technical detail, refresh and cursor `Load more`;
- keep default view operator-friendly;
- update Account Health/Outbound cards so unavailable/disconnected state is explicit;
- add frontend route/status/pagination regression tests.

### Iteration 20: Integration Hardening, Docs, and Release Gate

**Status:** pending.

Goal: verify session invalidation + audit behavior end-to-end and leave repository/docs internally consistent.

Planned scope:

- audit status derivations and sensitive logging paths;
- update architecture/operations/security docs;
- test malformed cursor, unknown disconnect reason, fetch failure, rebind, shutdown, restart, and equal timestamps;
- manual linked-device-removal smoke procedure;
- full check/test/build, Docker, Docs CI, CodeQL, and release validation.

---

## Implementation Rules

- Prefer explicit failure/unknown state over optimistic status.
- Test Wago classifiers/adapters/state transitions, not Baileys internals.
- Keep one WhatsApp account per process.
- Treat `/app/data/wago.db`, WAL/SHM files, and `/app/data/auth` as secret-bearing state.
- Never persist QR data, auth data, API keys, cookies, tokens, full phone/JID, message text, or arbitrary raw protocol payloads.
- Do not run multiple replicas against the same SQLite/auth volume.
- Keep transient state transient unless durability is required for safety or diagnosis.
- Avoid unrelated refactors during each iteration.
