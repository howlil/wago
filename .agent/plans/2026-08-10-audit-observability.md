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

Frontend rendering of unavailable health remains part of Iteration 19.

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

**Status:** pending.

**Goal:** move operational history out of Control and build a readable `/audit` page.

Planned scope:

- remove Activity Log from Control;
- add `/audit` route;
- data-driven Control/Audit Log navigation;
- source/category/level/search filters;
- expandable technical details;
- refresh + cursor `Load more`;
- operator-friendly default view;
- Account Health/Outbound cards must not show optimistic normal state when disconnected/unavailable;
- frontend route/status/pagination regression tests.

Acceptance:

- sidebar exposes intended workspace pages without duplicated activity panel;
- audit page supports current backend filtering/pagination contract;
- technical metadata remains opt-in;
- outbound normal/healthy presentation requires backend reachable + WhatsApp connected + account health available + no active restriction.

Verification:

```bash
pnpm --dir frontend test
pnpm --dir frontend run build
pnpm check
```

## Iteration 20: Integration Hardening, Public Docs, and Release Gate

**Status:** pending.

**Goal:** verify session invalidation + audit behavior end-to-end and leave runtime/public docs internally consistent.

Planned scope:

- audit all status derivations for stale/optimistic values;
- audit Baileys logging paths for sensitive persistence;
- update public architecture/operations/security documentation with released behavior only;
- test malformed cursor, unknown disconnect reason, health fetch failure, rebind, shutdown, restart, equal timestamps;
- manual linked-device-removal smoke procedure;
- full check/test/build, Docker, Docs CI, CodeQL, release validation.

Acceptance:

- removing Wago from Linked Devices moves Wago to disconnected/pairing-required state without stale healthy outbound indicators;
- audit history explains the transition with sanitized evidence;
- no raw secret/message/session payload is persisted by audit logging;
- core, frontend, Docker, public docs, and CodeQL gates are green.

## Milestone Rules

- Prefer explicit failure/unknown state over optimistic status.
- Test Wago classifiers/adapters/state transitions, not Baileys internals.
- Keep one WhatsApp account per process.
- Treat `/app/data/wago.db`, WAL/SHM, and `/app/data/auth` as secret-bearing state.
- Never persist QR/auth/API keys/cookies/tokens/full phone/JID/message text/raw protocol payloads.
- Avoid unrelated refactors.
