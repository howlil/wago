# Backend Production Hardening Execution Ledger

This ledger tracks execution of the approved backend hardening design and implementation plan without competing with the shared repository `plan.md`, which is also updated by the Audit Observability and Outbound Safety milestones.

Authoritative design and implementation plan:

- `docs/superpowers/specs/2026-08-10-backend-production-hardening-design.md`
- `docs/superpowers/plans/2026-08-10-backend-production-hardening.md`

Execution branch: `staging/backend-production-hardening`
Draft integration PR: #18

Architecture remains a production-grade single-instance modular monolith: Express + TypeScript + Baileys + SQLite + filesystem Baileys auth + one production container. Do not add microservices, Redis, distributed queues, Kubernetes, a DI framework, or ceremonial layers without a demonstrated requirement.

## Hardening Iteration 0: Baseline Integration and Staging Safety

**Status:** completed.

- Approved design and implementation plan.
- Integrated zero-config first pairing/bootstrap without required production `.env`/`CORS_ORIGIN`.
- Preserved SQLite-backed settings and Bearer/cookie auth semantics.
- Reconciled session-state work from `main` instead of retaining duplicate implementation.
- Verified tests, builds, Docker, Docs CI, and CodeQL before architecture changes.

Initial verified runtime head: `77a80bb69c42511a39e012b58738d4900469f1d1`.

## Hardening Iteration 1: Characterization and Contract Lock

**Status:** completed — checkpoint reached.

Coverage added before behavior-moving refactors:

- `backend/src/http-contract.test.ts` locks auth, request validation, outbound-policy HTTP mappings, WhatsApp-unavailable handling, sanitized 5xx, and message-status contracts.
- Existing `app.test.ts` locks malformed JSON and payload-too-large responses.
- `backend/src/whatsapp/lifecycle.contract.test.ts` locks first boot, session resume, Pair idempotency, QR transition, and rebind lifecycle.
- Existing WhatsApp suites lock reconnect, terminal logout, initialization failure, health invalidation, and shutdown.

Checkpoint head: `731edd074678edfceb02ef25cc95dee2ce778dc2`.

## Hardening Iteration 2: Typed Application Errors and HTTP Error Boundary

**Status:** completed — checkpoint reached.

Goal: introduce the smallest typed expected-error model, centralize application-error to HTTP mapping, preserve stable public error contracts, sanitize unexpected 5xx responses, and remove HTTP status ownership from business policy code.

Implemented:

- Added neutral `ApplicationError` + stable `ApplicationErrorCode` under `backend/src/errors/`; application errors do not carry HTTP status.
- Added centralized HTTP mapping under `backend/src/http/errors/error-response.ts`, including optional retry metadata.
- Added global `apiErrorHandler` after JSON parser error handling; unexpected failures return only `INTERNAL_ERROR` and a generic message.
- Global unhandled-error logging records only safe context (`event`, method, path, error type) rather than the raw Error/message/cause.
- `outbound-policy.ts` now creates typed policy errors and no longer exports/owns an HTTP-status mapping.
- Policy detection no longer trusts arbitrary `Error.name` spoofing.
- Audit malformed-cursor failures now use `ApplicationError("INVALID_AUDIT_CURSOR", ...)` and flow through the global HTTP boundary.
- Invalid normalized phone and unregistered WhatsApp recipient failures are typed.
- `whatsapp.ts` normalizes the small set of legacy integration errors at the WhatsApp module boundary while keeping raw Baileys/runtime details inside the module.
- `message.routes.ts` keeps request parsing, rate limiting, and activity logging, but delegates all expected application errors to the global HTTP boundary. Unexpected send failures retain the established `SEND_MESSAGE_FAILED` public contract.
- No database migration or new dependency was introduced.
- Message application-service extraction was intentionally not started; that remains Hardening Iteration 3.

TDD evidence:

1. RED `4ba3d65e18fd7afec0a0bac7744947f5a1bad188` — CI #201 failed because `ApplicationError`/mapper did not exist; existing suites remained green.
2. GREEN mapper — CI #204 passed after adding the neutral typed error and HTTP mapper.
3. RED `1ff89db893a51b4abfdd2d372b843cd57867e1f7` — CI #206 failed because the centralized error-handler module did not exist.
4. GREEN handler — CI #209 passed after adding the global API error handler.
5. RED `3c041177e8742a59e189005e4f906a81ac6e4927` — CI #215 produced the intended semantic failures: typed duplicate still mapped to 500, audit cursor was not typed, policy errors still mutated `Error.name`, and spoofed names were trusted.
6. During GREEN refactoring, characterization tests caught a control-flow regression where policy errors were audited but fell through to 500 instead of reaching `next(error)`. The route was corrected so every `ApplicationError` reaches the global boundary after audit logging.
7. RED `9fb7f30454e4a9f51e1d9d7bb2eb2e2c7308466f` — CI #237 proved the global handler still attached raw Error context to logs; the new sanitizer assertion was the only backend failure.
8. GREEN runtime head `334fc94b95d49b0bde234c5ea81b28f449f76062` — raw Error logging was replaced by safe error-type context.

Latest-main reconciliation:

- staging was reconciled with Audit Backend `main c55e25fa6f68ee8ff853b12fbc4a8968fc021a90` before Iteration 2 work;
- staging was reconciled again with Audit Workspace `main a7bfd2c176ef5dad81c216529f90b0aaf696cb3c` before closing the iteration;
- reconciliation head `23ac9383fbfc0c3a8ed5fad16093098cb464079e` had `behind_by=0` and `a7bfd2c...` as merge base;
- frontend from latest `main` is preserved rather than independently modified by this backend iteration.

Verification on runtime head `334fc94b95d49b0bde234c5ea81b28f449f76062`:

- root formatting/lint: CI #238 success;
- backend: 30 test files / 176 tests passed;
- frontend: 3 test files / 19 tests passed;
- backend + frontend production builds: CI #238 success;
- Docker Build Core: CI #238 success;
- Docs CI #84 success;
- CodeQL #239 success.

**Checkpoint:** Hardening Iteration 2 is closed. Stop before Hardening Iteration 3.

## Hardening Iteration 3: Message Application Service

**Status:** completed — checkpoint reached.

Goal: move message send/status orchestration behind one small application boundary while keeping `message.routes.ts` responsible only for HTTP transport concerns and existing activity/error contracts.

Implemented:

- Added `backend/src/modules/messages/message.service.ts` as the messages application boundary.
- Added manual dependency injection through `createMessageService({ sendText, getStatus })`; no DI container or extra architectural framework was introduced.
- `messageService.send()` accepts the application command `{ to, text, idempotencyKey? }` and delegates to the existing WhatsApp facade.
- `messageService.findStatus()` owns status lookup delegation through the existing WhatsApp facade.
- `message.routes.ts` no longer imports `sendTextMessage` or `getMessageStatus` directly.
- The route still owns API-key authentication, HTTP rate limiting, request-shape validation, `Idempotency-Key` extraction/precedence, activity recording, HTTP response status, expected-error forwarding, and the established sanitized `SEND_MESSAGE_FAILED` fallback.
- Existing HTTP characterization remains unchanged and green, including outbound-policy status mappings, disconnected handling, unexpected-send sanitization, and message-status found/not-found contracts.
- No Baileys lifecycle behavior, policy semantics, SQLite schema, dependency, or public API contract changed in this iteration.
- Hardening Iteration 4 was intentionally not started.

TDD evidence:

1. RED `803a86b89c1cf963ea76bceb3bf08a4fa376b1a5` — CI #254 failed only because `message.service.ts` did not exist; the 30 pre-existing backend suites / 176 tests remained green.
2. GREEN service implementation reached `a78afb1e89f246748d15411301adb0c86c25b77a`; the new service unit test passed. That full run was not accepted as the final gate because an unrelated existing 2,000-row activity-retention test hit its 5-second timeout once; later runs returned it to its normal sub-second range without changing that test.
3. RED route boundary `963304627ff6ebd6abf2b168bb2eae0eca69b167` — CI #262 produced exactly the two intended failures: send orchestration still bypassed `messageService.send()` and status lookup still bypassed `messageService.findStatus()`. All unrelated backend tests were green.
4. GREEN runtime head `bb8ea1146ed13d44ecf1384674e411a7c26e0bac` — both route-boundary tests passed and the full contract suite remained green.

Latest-main check:

- `main` remained at `a7bfd2c176ef5dad81c216529f90b0aaf696cb3c` through the Iteration 3 runtime verification;
- staging therefore remained reconciled with the latest `main` baseline for this checkpoint.

Verification on runtime head `bb8ea1146ed13d44ecf1384674e411a7c26e0bac`:

- root formatting/lint: CI #263 success;
- backend: 32 test files / 179 tests passed;
- frontend: 3 test files / 19 tests passed;
- backend + frontend production builds: CI #263 success;
- Docker Build Core: CI #263 success;
- Docs CI #107 success;
- CodeQL #264 success.

**Checkpoint:** Hardening Iteration 3 is closed. Stop before Hardening Iteration 4.

## Hardening Iteration 4: Outbound Policy Decoupling

**Status:** pending.

Remove any remaining transport ownership from outbound-policy code only after reconciling current Milestone 5 behavior. Preserve all outbound-safety decisions, retry metadata, transactional invariants, activity contracts, and public HTTP mappings. Do not broaden this into unrelated policy redesign.

## Remaining Iterations

- Iteration 5 — WhatsApp Runtime and Lifecycle Split
- Iteration 6 — Persistence and Transaction Ownership
- Iteration 7 — HTTP and Application Lifecycle Cleanup
- Iteration 8 — Production Engineering Rules and Documentation
- Iteration 9 — Full Verification, Rollback Rehearsal, and PR Gate

## Engineering Rules

MUST: preserve module ownership; validate untrusted boundaries; use typed expected errors and stable public codes; add regression coverage before behavior-moving refactors; use explicit transactions for multi-write invariants; keep migrations append-only; make state transitions explicit; preserve retry idempotency; keep logs sanitized; keep Baileys internals inside the WhatsApp module.

SHOULD: prefer composition, narrow exported APIs, colocated focused tests, and interfaces only where they create a real boundary.

MUST NOT: add distributed infrastructure by default; create ceremonial layers; put SQL in routes; put HTTP-status decisions in business-policy code; expose raw Baileys sockets across modules; swallow errors; log secrets/full identifiers/message bodies; or make destructive schema changes without migration/rollback design.
