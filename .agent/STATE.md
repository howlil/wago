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

## Integration state

- current `main` includes the semantic `.agent` project-model cleanup from PR #74 and the post-cleanup state refresh from PR #75;
- the older broad draft PR #67 is closed as superseded and is not active scope;
- none of PR #67's unmerged runtime changes are implicitly authorized by its history;
- there is no known current blocker.

## Active iteration

### Outbound correctness

Outcome: make outbound safety state match the actual WhatsApp side effect and remain correct under concurrent sends, without changing Wago's single-process SQLite architecture.

In scope:

- make same-idempotency-key concurrent sends safe before the external Baileys send side effect;
- keep rate-limit/idempotency state transitions coherent around the outbound critical section;
- stop treating `sendMessage()` return as confirmed recipient success;
- record recipient successful-outbound state only when WhatsApp reports an accepted/server-acknowledged outcome;
- propagate asynchronous reach-out rejection into recipient-specific outbound cooldown state;
- add only the deterministic tests needed to prove these invariants and regressions.

Execution order:

1. Close the concurrent idempotency/reservation gap around outbound send admission.
2. Align recipient success state with actual WhatsApp acknowledgement.
3. Feed asynchronous reach-out rejection back into recipient policy state.
4. Run focused verification, then mandatory repository CI/CodeQL before merge.

Acceptance criteria:

- two materially concurrent requests using the same active idempotency key cannot cause two Baileys send side effects;
- a pending send does not update `lastSuccessfulOutboundAt`;
- a WhatsApp server acknowledgement updates the successful-recipient state exactly through the owned outcome path;
- an asynchronous `REACHOUT_RESTRICTED` outcome establishes recipient cooldown state that later outbound policy checks enforce;
- existing public HTTP behavior and the single-process/SQLite/Baileys ownership boundaries remain unchanged unless a material incompatibility is discovered and explicitly approved;
- no Redis, queue infrastructure, distributed lock, new service boundary, or speculative abstraction is introduced;
- mandatory repository gates pass on the final change.

Out of scope:

- removing `SETUP_TOKEN`, legacy dashboard API-key login, legacy cookie/session-storage cleanup, legacy JSON import, or legacy webhook environment import;
- unrelated frontend cleanup;
- broad module restructuring;
- delivery semantics beyond the current outbound correctness gaps.

## Next authorized work

Complete the active outbound-correctness iteration. After it is closed, reassess legacy compatibility cleanup as a separate bounded iteration; do not start it automatically.
