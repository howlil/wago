# Audit Observability and Honest Session State — Execution Ledger

**Purpose:** Preserve the detailed engineering plan/evidence for Milestone 4 outside the public `docs/` tree and outside the concise root roadmap.

**Runtime scope:** single Wago process, one WhatsApp account, SQLite durable state, Baileys lifecycle instrumentation, React operator UI.

## Iteration 17: Session-State Correctness

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

## Iteration 18: Structured Low-Level Baileys Audit Backend

**Status:** completed and merged to `main` in commit `c55e25fa6f68ee8ff853b12fbc4a8968fc021a90`.

### 18A — SQLite Audit Model and Query Layer

Completed:

- migration v3 with `source TEXT NOT NULL DEFAULT 'wago'`;
- source/category/level + newest-first audit indexes;
- audit event/source/metadata types moved into `activity/audit-event.ts`;
- retention raised from 300 to 2,000;
- server-side `listAudit()` filtering and keyset cursor pagination;
- search limited to `code`, `title`, `description`, max query 100 chars;
- stable `INVALID_AUDIT_CURSOR` behavior;
- deterministic equal-timestamp pagination using row identity.

Acceptance met:

- existing activity writes default to `source=wago`;
- filtering/pagination happens in SQLite;
- equal timestamps paginate deterministically;
- only newest 2,000 events remain.

Evidence:

- RED head `e9e36a6d7d27d438beda2a78002d2e9d3b3f874a`; CI `31414388145` failed on missing query/migration/source/retention behavior as intended.
- GREEN CI `31414932289` passed check, tests, core build, and Docker build.

### 18B — Strict Baileys Audit Sanitizer

Completed:

- secret-dropping, identifier-masking, nested object/array RED tests;
- `activity/baileys-audit.ts`;
- primitive metadata only;
- secret/protocol key dropping for QR, credential/key material, tokens, cookies, authorization, password, message/text, arbitrary payloads;
- JID/phone masking through existing `maskIdentifier()`;
- `recordBaileysAudit()` always uses `source=baileys`.

Acceptance met:

- raw protocol objects do not enter SQLite through the adapter;
- full phone/JID/message/QR/auth values are not persisted by this adapter.

Evidence:

- RED `d1add1e1a55dc010f0165b14905686edda70d468`;
- GREEN CI `31415218064`.

### 18C — Baileys Lifecycle Instrumentation

Completed:

- socket creation;
- QR-ready event without QR value;
- connection open/close;
- disconnect classification;
- reconnect scheduling;
- terminal session invalidation;
- shutdown;
- credential persistence failure + bounded/coalesced success;
- message server ACK/rejection without content/recipient leakage;
- reach-out timelock/new-chat-cap checks/changes;
- account-health fetch failure;
- audit persistence failure isolated from lifecycle.

Acceptance met:

- terminal logout can be diagnosed from persisted audit history;
- close events expose safe status/reason/terminal/reconnect/socket-generation metadata;
- no raw Baileys packet/frame persistence.

Evidence:

- RED `97670655d7dc9e333eabe9374f4166519a1b20e0`;
- GREEN CI `31415984687`.

### 18D — Filtered Cursor-Based Audit API

Completed:

- authenticated RED route tests;
- `GET /activity` supports `limit`, `before`, `source`, `category`, `level`, `q`;
- enum whitelist filters;
- `400 INVALID_AUDIT_FILTER`;
- `400 INVALID_AUDIT_CURSOR`;
- default limit 100, clamped 1..200;
- response `{ success, events, nextCursor? }`;
- existing API-key auth unchanged.

Evidence:

- RED `3dfd7bd3d9621b4cc6f109754eb02fd1c24f579e`;
- GREEN CI `31416505166`.

Iteration 18 final verification:

- focused activity/database/audit/lifecycle/route regressions;
- backend + frontend tests;
- backend + frontend/core builds;
- `pnpm check`;
- production Docker build;
- diff review for pagination determinism and lifecycle/privacy boundaries;
- reviewed code head `4ac04fdf4e8a1c3766863e2affbecea2dc3b05f6`;
- reviewed-code CI `31416724276` success;
- CodeQL `31416724242` success.

## Iteration 19: Dedicated Audit Log Page and Navigation

**Status:** completed and merged as `a7bfd2c176ef5dad81c216529f90b0aaf696cb3c` through PR `#20`.

### 19A — Workspace Routing, Shell, and Navigation

Completed:

- Activity Log removed from Control;
- dedicated `/audit` workspace added;
- dashboard shell generalized into page-aware `AppShell`;
- data-driven Control/Audit navigation shared across desktop/mobile sidebar;
- minimal route selection added without a router/state dependency;
- active-page `aria-current`, sidebar collapse, and mobile behavior preserved.

Evidence:

- RED head `7ce456f9dde2259d736215d9ee825c9d8e938c08`; CI `31418440302` failed on the intended route/navigation contracts.
- GREEN CI `31418985218` passed check, tests, core build, and Docker build.

### 19B — Server-Driven Audit Page

Completed:

- source/category/level/search filters are sent to the backend;
- 50-row cursor pages use `before` + `nextCursor` and append unique events;
- source, category, and severity are labeled explicitly;
- technical metadata stays closed by default;
- browser does not load and filter the full 2,000-row history;
- frontend consumes only the sanitized audit contract.

Evidence:

- RED head `71be79e094001a8518a430d86487b564ec1a7f6c`; CI `31419185311` failed on missing source filtering, cursor load-more, and labels.
- GREEN CI `31420026751` passed page regressions, full tests/build, and Docker build.

### 19C — Truthful Health and Outbound Status

Completed:

- frontend account-health type aligned to `unavailable | checking | available`;
- `Outbound: Normal` requires backend reachable + WhatsApp connected + health available + no active restriction;
- disconnected/unavailable/checking are rendered explicitly;
- `session_invalid` provides pairing recovery guidance;
- missing/fetch-failed health no longer defaults optimistically to healthy.

Evidence:

- behavioral RED head `beffdb7884bea97a03e69ac1accee5cc44a8f126`; CI `31420235630` showed the four intended optimistic-state failures.
- GREEN CI `31420756261` passed tests/build/check/Docker.
- reviewed code head `a8b01716178a6548a253a42984b3c29bffb3e42f`: CI `31421193134` success and CodeQL `31421193125` success.
- final ledger head `9bdfbc68efd2513088190bee10b6abfccb3bd52f`: CI `31421528880` success and CodeQL `31421527223` success.

## Iteration 20: Integration Hardening, Public Docs, and Release Gate

**Status:** implementation and post-PR-21 reconciliation complete on PR `#22`; final ledger-head verification pending.

Goal: verify session invalidation + audit behavior end-to-end and leave runtime/public docs internally consistent without reintroducing the obsolete `docs/superpowers` planning layout.

Completed integration scope:

- `baileys.session.rebind_ready` records that old auth/binding cleanup completed and a fresh socket lifecycle started; it does not claim the new session is connected;
- rebind regression verifies `rebind_started` and `rebind_ready` checkpoints, logout, and fresh socket creation;
- unknown disconnect status `599` is persisted as explicit `status_599`, remains non-terminal, and follows the recoverable reconnect path;
- restart with missing persisted auth remains disconnected/unbound, marks account health `session_invalid`, avoids socket creation, and records `baileys.session.auth_missing`;
- existing regressions continue to cover terminal logout, recoverable reconnect, shutdown ordering, health-fetch failure, malformed audit cursor, equal timestamps, QR privacy, credential-write failure privacy, ACK privacy, and logger redaction;
- public architecture, operations, security guidance, and PlantUML are aligned with the structured/sanitized audit boundary;
- a manual Linked Devices unlink smoke procedure is documented for a disposable/test account.

TDD and pre-reconciliation evidence:

- valid RED head `724151d5...`; Core CI `31423146163` failed because the expected rebind completion audit checkpoint did not yet exist;
- implementation checkpoint `2041b7205b2ad2635c82b3efb9e7d3e030705fd0`: Core CI `31423998191` success, Docs CI `31423998495` success, CodeQL `31423998455` success;
- old final ledger head `c609e099fe70df717099563e2a3d6023fa359474`: Core CI `31424345137` success, Docs CI `31424343755` success, CodeQL `31424343286` success.

Reconciliation:

- PR `#21` merged afterward and moved internal planning artifacts under `.agent/`, so the old PR `#22` head was backed up at `backup/iteration20-pre-reconcile` and rebuilt from `cdba31b03b2ff0bc59c11f34590baef2591fe218` instead of merging obsolete root-plan/public-doc versions;
- current public Architecture/Operations docs from PR `#21` remained the base; only still-valid Iteration 20 lifecycle/runbook additions were applied;
- first fresh reconciliation head `25c40a39204337b4e1507e6904bc53065d6e4df8` passed Core CI `31428778185`, Docs CI `31428778351`, and CodeQL `31428778748`; Core CI includes the production Docker build.

Final ledger-head verification required before merge:

- [ ] Core CI success on the commit containing this evidence
- [ ] Docs CI success on the commit containing this evidence
- [ ] CodeQL success on the commit containing this evidence
- [ ] production Docker build success through Core CI
- [x] no `docs/superpowers` planning artifacts reintroduced by PR `#22`
- [x] no raw QR/message/auth/protocol payload persistence added

Manual validation boundary:

- the Linked Devices unlink procedure is documented but a physical-device unlink is not claimed as executed by automated CI.

Release validation boundary:

- GHCR publication remains a separate operational incident. Iteration 20 does not claim container publication healthy while the stale release concurrency lock remains unresolved.

## Milestone Rules

- Prefer explicit failure/unknown state over optimistic status.
- Test Wago classifiers/adapters/state transitions, not Baileys internals.
- Keep one WhatsApp account per process.
- Treat `/app/data/wago.db`, WAL/SHM, and `/app/data/auth` as secret-bearing state.
- Never persist QR/auth/API keys/cookies/tokens/full phone/JID/message text/raw protocol payloads.
- Avoid unrelated refactors.
