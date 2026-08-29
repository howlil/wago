# Wago Current State

This file is the short committed snapshot of where Wago is now. It is not a roadmap archive and does not authorize new product scope by itself.

## Current baseline

Wago is a production-grade, single-instance, self-hosted WhatsApp gateway with:

- one WhatsApp account per deployed instance;
- Express + TypeScript backend;
- React + Vite control dashboard;
- Baileys protocol integration contained by the WhatsApp module;
- SQLite durable application state under `/app/data/wago.db`;
- filesystem-backed Baileys auth under `/app/data/auth`;
- Docker-first deployment with persistent-state and rollback verification in repository CI;
- structured sanitized logging/audit behavior;
- health/readiness semantics that distinguish degraded/unavailable state;
- API/browser-session access controls and machine API-key lifecycle;
- recipient permission, idempotency, and bounded outbound safeguards;
- webhook configuration/delivery with signed at-least-once semantics;
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
- this file owns only the concise committed state.
- historical task plans/specs/checkpoints are not part of the current project model.

## Current integration baseline

The latest completed engineering work before this project-model cleanup established:

- canonical operating/process rules in `AGENTS.md`;
- deterministic isolation for the previously failing dashboard access tests;
- stronger codebase-quality guidance around ownership, locality, state ownership, dependency direction, and evidence-based CI failure classification.

## Active work and next direction

No product feature is authorized by this file. The current task is complete when the semantic `.agent` model replaces the historical task archive, references to the old model are removed, mandatory gates pass, and the change is merged.

Future product or architecture work starts from explicit user intent, not from old milestone entries or deleted planning artifacts.
