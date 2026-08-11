# Wago Engineering Roadmap

## Target

Build a production-ready, single-account, self-hosted WhatsApp gateway that stays small and understandable:

- one process
- one WhatsApp account
- one persistent `/app/data` volume
- SQLite for durable application state
- Baileys auth under `/app/data/auth`
- transient protocol/UI caches in memory
- Docker-first deployment
- conservative outbound behavior
- no bulk/campaign/anti-detection features

Production-ready does not mean zero WhatsApp enforcement risk. Baileys is an unofficial WhatsApp Web client, so Wago must expose uncertainty truthfully and must not describe local safety controls as ban prevention.

## Planning and Documentation Boundary

```text
docs/       public Astro documentation read by Wago users
.agent/     internal agent specs, implementation plans, audit/checkpoint notes
plan.md     concise engineering roadmap and milestone ledger
```

Rules:

- `docs/` is exclusively for public product documentation.
- Put approved designs in `.agent/specs/`.
- Put detailed implementation plans and execution/checkpoint notes in `.agent/plans/`.
- Do not put agent workflow text, speculative requirements, or internal execution notes under `docs/`.
- Keep this root `plan.md` concise; link to `.agent/` instead of duplicating task-by-task plans.
- Runtime/backend/frontend code remains the source of truth for actual product behavior.

Current agent workspace index: `.agent/README.md`.

## Current Foundation

Already implemented and treated as baseline:

- protected API-key/cookie authentication and first-run bootstrap;
- QR pairing, durable WhatsApp binding, reconnect handling, rebind flow;
- text-only outbound messaging with async `202 pending` semantics;
- recipient allow/opt-out controls;
- idempotency plus account/recipient/new-chat outbound limits;
- account reach-out/new-chat-cap checks;
- redacted structured logging;
- structured Wago/Baileys audit backend with sanitization, filters, cursor pagination, and bounded retention;
- dedicated frontend `/audit` workspace with server-driven filters/pagination and truthful account-health rendering;
- durable application state in `/app/data/wago.db` with SQLite WAL/migrations;
- React control dashboard;
- graceful shutdown;
- Docker/GHCR/CI/CodeQL/OSS documentation baseline.

## Non-Goals

Unless requirements explicitly change, do not add Redis, PostgreSQL, Kafka, BullMQ, multi-session/multi-tenant architecture, message-history persistence, raw protocol-payload persistence, bulk/campaign features, anti-detection behavior, or unrelated enterprise abstractions.

## Execution Protocol

For each implementation iteration:

1. work from the approved `.agent/specs/` / `.agent/plans/` artifact;
2. mark only the active iteration in progress;
3. write the intended regression/test first when behavior changes;
4. verify the RED failure is for the intended missing behavior;
5. implement the smallest coherent change;
6. run focused tests plus relevant build/check;
7. review lifecycle/security/privacy effects;
8. record useful checkpoint evidence in the relevant `.agent/plans/` file;
9. merge only after the iteration quality gate is green.

---

## Operational: GHCR Release Queue Hotfix

**Status:** completed and verified on `main` — final Release Container run #54 (`31461762889`) succeeded from `b3a0145bc8b2acaff30605a7444227ecda1b2aa1` in approximately 1 minute 53 seconds.

Detailed execution ledger: `.agent/plans/2026-08-11-ghcr-release-queue-hotfix.md`

Completed scope:

- newer same-ref releases cancel stale in-progress release work;
- `linux/amd64` and `linux/arm64` build natively in parallel instead of through QEMU;
- platform builds and final publication have bounded timeouts;
- ARM64 pnpm runtime is covered by a native Docker regression job in CI;
- platform images publish by digest and are combined into one OCI multi-architecture index;
- `main`, `latest`, and SHA tags publish successfully;
- final manifest verification confirms `linux/amd64` and `linux/arm64`;
- build-provenance attestation remains enabled.

---

## Milestone 4: Audit Observability and Honest Session State

**Status:** completed and merged — Iterations 17–20 are on `main`; Iteration 20 landed through PR `#22` as `752d456628eb3b6805f0eadc8f751830ca6c276c`.

Detailed execution ledger: `.agent/plans/2026-08-10-audit-observability.md`

Completed scope:

- truthful terminal/recoverable disconnect classification;
- explicit account-health availability and stale-health race protection;
- SQLite-backed structured Wago/Baileys audit events;
- strict audit sanitization and lifecycle instrumentation;
- `GET /activity` filters and cursor pagination;
- dedicated `/audit` frontend workspace with source/category/level/search filters, load-more cursor pagination, and truthful disconnected/unavailable health state;
- integration regressions for rebind completion, unknown disconnect status, and missing-auth restart behavior;
- public architecture/operations/security guidance aligned with the sanitized audit and session-invalidation model.

---

## Milestone 5: Outbound Safety Hardening

**Status:** planned from the 2026-08-11 Baileys/Wago audit.

Detailed implementation plan: `.agent/plans/2026-08-11-outbound-safety-hardening.md`

Priority scope:

- **P0:** fail closed for new/cold recipients when WhatsApp account health is unavailable;
- **P0:** update recipient success only after WhatsApp `SERVER_ACK`;
- **P0:** apply recipient cooldown for asynchronous `463` rejection;
- **P1:** serialize the single-account critical outbound path to remove the check/record race;
- **P1:** add a bounded reason-aware persistent rejection circuit breaker;
- **P2:** record inbound interaction context without storing content or granting consent;
- **P2:** make Wago-local account/recipient/new-chat limits configurable while retaining current defaults.

Boundary: no fake typing/humanization, proxy/fingerprint/device-spoofing strategy, distributed queue/service, or claim of guaranteed ban prevention.

---

## Milestone 6: Public Documentation and Hybrid API Explorer

**Status:** completed and merged through PR `#21` as `cdba31b03b2ff0bc59c11f34590baef2591fe218`.

Design: `.agent/specs/2026-08-11-api-documentation-refresh-design.md`

Detailed implementation plan: `.agent/plans/2026-08-11-api-documentation-refresh.md`

Verification checkpoint: `.agent/checkpoints/2026-08-11-api-docs-implementation.md`

Completed scope:

- README and public Astro docs resynced against current frontend/backend contracts;
- external server-to-server integration made explicit;
- Bearer authentication, first-run bootstrap, QR/pair/rebind, recipient permission lifecycle, send/idempotency, message status, account health, audit filters/cursors, errors, and local safety limits documented;
- fixed code playground replaced with a bilingual Hybrid API Explorer;
- cURL, JavaScript, Python, and Node.js examples generated from one typed endpoint catalog;
- optional live browser → user-supplied Wago requests supported without a docs proxy;
- entered API keys stay in component memory and are never exposed in generated snippets;
- all POST live actions require explicit confirmation, with stronger warning for `/whatsapp/rebind`;
- all 15 current public routes are covered exactly once by the endpoint catalog regression;
- dedicated frontend `/audit` workspace and structured audit API are reflected in public docs;
- stale JSON persistence and 300-event audit references were corrected to the current SQLite/2,000-event model;
- `docs/` is public-only and agent artifacts were moved under `.agent/`.

Final merge verification evidence:

- RED Docs CI: run `31421737961` failed on missing explorer helpers as intended;
- final docs-changing head `e9d9c27c9d3f6ba91941e391ded925b0cce2bf94` passed Docs CI `31424297193`, Core CI `31424297321`, and CodeQL `31424296878`;
- PR `#21` merged to `main` as `cdba31b03b2ff0bc59c11f34590baef2591fe218`.

---

## Repository-Wide Implementation Rules

- Prefer explicit failure/unknown state over optimistic status.
- Test Wago classifiers/adapters/state transitions instead of Baileys internals.
- Keep one WhatsApp account per process.
- Treat `/app/data/wago.db`, WAL/SHM files, and `/app/data/auth` as secret-bearing state.
- Never persist QR data, auth data, API keys, cookies, tokens, full phone/JID, message text, or arbitrary raw protocol payloads unless an explicitly reviewed future requirement changes the boundary.
- Do not run multiple replicas against the same SQLite/auth volume.
- Keep transient state transient unless durability is required for safety or diagnosis.
- Avoid unrelated refactors during each milestone.
