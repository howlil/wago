# Backend Production Hardening Verification — 2026-08-11

## Scope

This checkpoint records the executed verification for PR #18 (`staging/backend-production-hardening`) after Hardening Iterations 4–9 implementation work.

Runtime verification head: `03f6c0f2d0a5067b3fd4ed9dcf997ce208de4990`.
Known-good rollback baseline: `main` at `569b22361efd567dc6a584337c8f5ad553e6652c`.

No credentials, QR payloads, message contents, full JIDs/phone numbers, cookies, API keys, or Baileys auth material are recorded here.

## Automated Verification

GitHub CI run `31434458628` completed successfully on the runtime verification head.

The quality job passed:

- repository formatting/lint (`pnpm check`);
- full backend tests;
- full frontend tests;
- backend production build;
- frontend production build;
- public documentation build.

The Docker/persistence job passed:

- production Docker image build for the hardening revision;
- production Docker image build for the known-good `main` rollback baseline;
- fresh hardening container startup with an empty named volume;
- `/health` returns `status=ok`;
- `/ready` returns the expected unconfigured credential state;
- dashboard root is reachable;
- SQLite `schema_migrations` is exactly `[1,2,3]` on fresh start;
- container restart against the same named volume succeeds;
- app identity/readiness response remains stable across restart;
- migrations remain exactly `[1,2,3]` after restart and are not re-applied destructively;
- hardening container is stopped and the known-good `main` image is started against the same persistent volume;
- rollback image passes `/health`, `/ready`, dashboard root, and the existing migration set;
- the rollback revision is supplied its historical required `CORS_ORIGIN` configuration so the rehearsal tests persistent-state compatibility rather than an intentionally invalid old configuration.

CodeQL run `31434458742` completed successfully on the same runtime verification head.

## TDD / Regression Evidence for Remaining Iterations

### Iteration 4 — Outbound Policy Decoupling

Review found the planned acceptance criteria had already been implemented during the earlier typed-error work: outbound policy produces typed application errors and does not own HTTP status mappings. No duplicate refactor was added merely to satisfy the checklist.

### Iteration 5 — WhatsApp Runtime and Lifecycle Split

RED CI `31432130876` failed only because the new `modules/whatsapp/sender` and `modules/whatsapp/lifecycle` boundaries did not yet exist while the pre-existing suites stayed green.

Implemented:

- private WhatsApp runtime state/generation owner;
- lifecycle owner for socket creation, reconnect, QR/open/close, rebind, credentials, shutdown, and audit transitions;
- sender owner for connected-state enforcement, phone normalization, outbound policy, Baileys send, message cache/status, and accepted-state persistence;
- dedicated sanitized observability/health adapter;
- typed message-rejection mapping;
- compatibility `whatsapp/client.ts` facade only; raw socket remains private.

GREEN CI `31432667063` passed formatting/lint, tests, production builds, and Docker build after formatter-only cleanup.

### Iteration 6 — Persistence and Transaction Ownership

Valid RED head `11cc7db549909cf2a6996720cef6b895089d6136`, CI `31432938378`:

- migration test failed because `database/migrations.ts` did not exist;
- transaction test failed because `database/transaction.ts` did not exist;
- forced recipient persistence failure proved accepted-state persistence still resolved instead of failing closed;
- existing suites remained green.

Implemented:

- extracted migration runner containing released migrations 1–3 without changing their versions or SQL semantics;
- extracted nested-safe SQLite transaction helper;
- kept the old database public transaction wrapper for callers while centralizing transaction mechanics;
- accepted outbound state now raises typed `OUTBOUND_STATE_PERSIST_FAILED` when durable safety state cannot be committed;
- the transaction rollback regression verifies no partial idempotency state remains after forced failure.

### Iteration 7 — HTTP, Application Lifecycle, and Readiness

Valid RED CI `31433647723` had 189 existing tests passing and exactly three missing-boundary suites failing: shared async/error middleware, application lifecycle, and gateway readiness.

Implemented:

- shared Express `asyncHandler`;
- one final shared error middleware for malformed JSON, oversized payloads, typed application errors, and sanitized unknown 500s;
- existing public unknown-error contract remains `INTERNAL_ERROR` rather than introducing an undocumented breaking code change;
- asynchronous message, recipient, and WhatsApp routes use the shared async boundary while endpoint-specific public error contracts remain intact;
- explicit idempotent application start/stop owner;
- shutdown order is WhatsApp shutdown → outbound policy flush → database checkpoint → database close, after HTTP intake is closed;
- duplicate legacy `server-lifecycle` implementation/tests were retired;
- `/ready` now delegates to a gateway readiness module while its public response shape remains unchanged.

### Iteration 8 — Production Engineering Rules

`AGENTS.md` was replaced with production-grade repository rules matching the actual single-instance modular-monolith architecture. It now explicitly defines correctness/security/data-integrity priorities, typed expected errors, regression testing, transactions, append-only released migrations, lifecycle ownership, sanitized logging, Baileys containment, and anti-over-engineering constraints.

A repository search found no stale MVP framing in the public Architecture/Development docs, so those public files were not rewritten unnecessarily.

### Iteration 9 — Release Verification

`scripts/smoke-container.sh` provides deterministic fresh-start, restart-persistence, migration-idempotency, dashboard, and rollback compatibility checks without external WhatsApp connectivity.

CI now executes that smoke against the hardening image and a separately built known-good `main` image using the same named persistent volume.

## Physical WhatsApp Validation Boundary

A physical-device WhatsApp scan cannot be executed by the GitHub connector or GitHub-hosted CI environment. Therefore this checkpoint does **not** claim a human phone QR scan was performed in this session.

The following behaviors are covered by automated Baileys/Wago lifecycle regressions rather than a physical handset in this run:

- first pairing lifecycle;
- QR state transition without persisting the QR payload;
- connected state and binding behavior;
- session resume behavior;
- recoverable reconnect;
- terminal invalidation;
- rebind reset and fresh lifecycle creation;
- graceful shutdown and credential-write ordering.

This is the only remaining external-environment validation limitation. It is recorded explicitly rather than represented as completed.

## Rollback Result

Rollback rehearsal result: **PASS** for the durable application state that can be validated without a physical WhatsApp account.

The known-good `main` revision starts against the persistent volume written by the hardening revision, returns healthy/readiness/dashboard responses, and reads the unchanged migration set. No new database migration was introduced by this hardening series, so the previous revision is not blocked by schema incompatibility.

## Final Gate Rule

This checkpoint itself is a record-only commit after runtime head `03f6c0f...`. Before merge, GitHub CI and CodeQL must pass again on the exact final PR head containing this record and ledger closeout. No runtime success claim should be based only on an earlier SHA.
