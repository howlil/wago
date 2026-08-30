# Wago Current State

This file is the short committed snapshot of durable current Wago state. It is not a roadmap, sprint plan, task tracker, or authorization mechanism by itself.

## Current baseline

Wago is a production-grade, single-instance, self-hosted WhatsApp gateway with:

- one WhatsApp account per deployed instance;
- Express + TypeScript backend;
- React + Vite operator dashboard;
- Baileys protocol integration contained by the WhatsApp module;
- SQLite durable application state under `/app/data/wago.db`;
- filesystem-backed Baileys auth under `/app/data/auth`;
- Docker-first deployment with persistent-state and rollback verification for runtime-relevant changes;
- structured sanitized logging/audit behavior;
- health/readiness semantics that distinguish degraded/unavailable state;
- admin-password/HttpOnly browser-session dashboard access separated from machine Bearer API-key access;
- recipient permission, concurrency-safe idempotency, and bounded outbound safeguards;
- outbound success aligned with WhatsApp server acknowledgement and asynchronous reach-out rejection feedback;
- persisted webhook configuration/delivery with signed at-least-once semantics;
- public documentation under `docs/`.

## Current operator UX baseline

The dashboard is now organized as a control plane around operator intent:

```text
Control   = observe + operate
Settings  = configure
Audit Log = investigate
```

Current ownership:

- Control shows gateway readiness, WhatsApp connection/account operation, account health, and collapsed end-to-end diagnostics;
- Settings owns machine API credentials, recipient policy, webhook/delivery integration, and operator browser-session management;
- Audit Log owns searchable operational evidence and progressively disclosed technical details;
- global Control status follows gateway readiness rather than reporting WhatsApp connectivity as overall gateway health;
- after WhatsApp is operational, application integration is an optional next step rather than a pairing prerequisite;
- user-facing audit vocabulary prefers gateway/WhatsApp transport concepts instead of exposing Baileys as the primary operator abstraction.

The visual language remains compact, border-led, information-dense, and intentionally consistent with the existing Wago design system.

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
access
activity
dashboard
gateway
messages
recipients
settings
whatsapp
```

Route/page composition lives under `frontend/src/pages/`. Architecture/dependency regression tests protect boundaries worth preserving.

## Current engineering model

- `AGENTS.md` is the canonical execution adapter and lifecycle;
- `.agent/PROJECT.md` owns product/system shape, source structure, ownership, and hard constraints;
- `frontend/DESIGN.md` owns frontend information architecture, interaction model, responsive layout, and visual rules;
- `.agent/ENGINEERING.md` owns detailed implementation, testing/verification, and Git rules;
- `.agent/OPERATIONS.md` owns persistence/deployment/readiness/backup/release constraints;
- `.agent/DECISIONS.md` owns durable rationale;
- this file owns only concise durable current state;
- historical task plans/specs/checkpoints are not part of the current project model.

## Integration state

- the semantic `.agent` project model is the active repository context model;
- the control-plane UX baseline is integrated on `main` through PR #85 / merge commit `cdf2c63d62c23b0341db814f79e8bf6381a19bcc`;
- CI, CodeQL, ARM64 Docker build, persistence/rollback smoke, and the container release for that UX baseline completed successfully;
- outbound correctness is integrated: concurrent same-key sends are serialized through dispatch state, successful-recipient state follows WhatsApp acknowledgement, and asynchronous reach-out rejection feeds recipient cooldown state;
- obsolete runtime compatibility paths for `SETUP_TOKEN`, machine-API-key dashboard sign-in, legacy raw-key browser storage/cookies, legacy webhook environment import, and legacy JSON-state import are removed;
- historical SQLite migration history is retained as applied-history compatibility and is not rewritten merely to remove dormant columns;
- the older broad draft PR #67 remains superseded and none of its unmerged changes are implicitly authorized;
- there is no known current blocker.

## Current authorized direction

Preserve the current control-plane UX boundary and existing single-process/SQLite/Baileys architecture until a concrete next product or maintenance requirement is selected.

Do not move configuration back into Control, do not turn the dashboard into a CRM/WhatsApp client, and do not expose provider internals as primary product vocabulary without a concrete diagnostic reason.

Detailed sprint plans, acceptance criteria, verification evidence, and task status belong in the active task conversation or substantive PR rather than this file.
