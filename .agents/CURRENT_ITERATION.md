# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** none.

Wago is at an idle, resumable baseline. No new product milestone is authorized by this file.

## Current baseline

- workspace layout is `apps/gateway`, `apps/dashboard`, and `apps/docs`;
- pnpm uses one root workspace and lockfile;
- root `Taskfile.yml` is the canonical developer command surface;
- gateway remains a single-instance Express/TypeScript + SQLite + Baileys application;
- dashboard remains the Control / Settings / Audit Log operator control plane;
- outbound message delivery webhooks provide HMAC signing, durable retry, restart recovery, attempt diagnostics, and manual redelivery;
- live direct/private incoming text from Baileys `messages.upsert` notify events is normalized and emitted as signed `message.received` webhooks through the same durable delivery engine;
- incoming `fromMe` echoes, history append events, groups, status/broadcast/newsletter traffic, and non-text/media payloads remain outside the inbound milestone scope;
- stable Wago inbound message IDs and the existing logical message/event uniqueness boundary make duplicate incoming notifications idempotent;
- inbound sender/text is retained only while active durable delivery needs it, for at most the 24-hour retry horizon, and is atomically redacted when the delivery becomes delivered, failed, or expired;
- terminal incoming deliveries preserve sanitized delivery/attempt diagnostics but cannot be manually redelivered after payload redaction;
- Settings and delivery diagnostics expose the inbound webhook capability without turning the dashboard into an inbox or chat client;
- README, public Configuration docs, security guidance, product contracts, and durable decisions describe the inbound webhook behavior and privacy boundary;
- PR #113 was squash-merged to `main` after CI, Docs CI, CodeQL, core build/tests, and Docker persistence/rollback smoke passed.

## Active slice

None.

Blockers: none known.

Next action: none until the user authorizes the next milestone.

## Completion rule

When a slice completes, record only evidence needed to leave truthful resumable state, advance to the next already-authorized slice, and remove stale blockers/next actions.

When the milestone completes, mark its gate complete and return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
