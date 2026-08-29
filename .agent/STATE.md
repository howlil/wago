# Wago Current State

This file is the short committed snapshot of durable current Wago state. It is not a roadmap, sprint plan, task tracker, or authorization mechanism by itself.

## Current baseline

Wago is a production-grade, single-instance, self-hosted WhatsApp gateway with:

- one WhatsApp account per deployed instance;
- Express + TypeScript backend;
- React + Vite control dashboard;
- Baileys protocol integration contained by the WhatsApp module;
- SQLite durable application state under `/app/data/wago.db`;
- filesystem-backed Baileys auth under `/app/data/auth`;
- Docker-first deployment with persistent-state and rollback verification for runtime-relevant changes;
- structured sanitized logging/audit behavior;
- health/readiness semantics that distinguish degraded/unavailable state;
- admin-password/HttpOnly browser-session dashboard access separated from machine Bearer API-key access;
- recipient permission, concurrency-safe idempotency, and bounded outbound safeguards;
- outbound success state aligned with WhatsApp server acknowledgement and asynchronous reach-out rejection feedback;
- persisted webhook configuration/delivery with signed at-least-once semantics;
- public documentation under `docs/`.

## Current code organization

Backend capability owners:

```text
access
activity
gateway
messages
recipients
webhooks
whatsapp
```

Frontend feature owners:

```text
activity
dashboard
gateway
messages
recipients
settings
whatsapp
```

Architecture/dependency regression tests exist under `backend/src/architecture/` for boundaries worth preserving.

## Current engineering model

- `AGENTS.md` is the canonical execution adapter and lifecycle.
- `.agent/PROJECT.md` owns product/system shape, source structure, ownership, and hard constraints.
- `.agent/ENGINEERING.md` owns detailed implementation, testing/verification, and Git rules.
- `.agent/OPERATIONS.md` owns persistence/deployment/readiness/backup/release constraints.
- `.agent/DECISIONS.md` owns durable rationale.
- this file owns only concise durable current state.
- historical task plans/specs/checkpoints are not part of the current project model.

## Integration state

- the semantic `.agent` project model is the active repository context model;
- outbound correctness is integrated: concurrent same-key sends are serialized through dispatch state, successful-recipient state follows WhatsApp acknowledgement, and asynchronous reach-out rejection feeds recipient cooldown state;
- obsolete runtime compatibility paths for `SETUP_TOKEN`, machine-API-key dashboard sign-in, legacy raw-key browser storage/cookies, legacy webhook environment import, and legacy JSON-state import are removed;
- historical SQLite migration history is retained as applied-history compatibility and is not rewritten merely to remove dormant columns;
- the older broad draft PR #67 is closed as superseded and none of its unmerged changes are implicitly authorized;
- there is no known current blocker.

## Current authorized direction

No additional engineering direction is implicitly authorized after the compatibility cleanup. Preserve the existing single-process, SQLite, and Baileys ownership boundaries until a concrete next product or maintenance requirement is selected.

Detailed execution order, acceptance criteria, verification evidence, and task status belong in the active task conversation or substantive PR rather than this file.
