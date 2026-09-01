# Wago Current State

This file records only durable current Wago state that is useful to future work. It is not a roadmap, sprint plan, iteration log, task tracker, change history, or authorization mechanism.

## Baseline

Wago is a production-grade, single-instance, self-hosted WhatsApp gateway with:

- one WhatsApp account per deployed instance;
- Express + TypeScript backend;
- React + Vite operator dashboard;
- Baileys contained behind the WhatsApp module;
- SQLite application state at `/app/data/wago.db`;
- filesystem-backed Baileys auth at `/app/data/auth`;
- Docker-first deployment using one persistent `/app/data` volume;
- structured sanitized logging and audit evidence;
- public liveness/readiness plus authenticated low-cardinality operational metrics;
- admin-password/HttpOnly browser-session dashboard access separated from machine Bearer API-key access;
- recipient permission, concurrency-safe idempotency, and bounded outbound safeguards;
- durable bounded outbound diagnostics using Wago-owned canonical message IDs;
- signed at-least-once webhook delivery with durable bounded attempt diagnostics and manual redelivery support;
- public documentation under `docs/`.

## Operator UX

The dashboard is organized around operator intent:

```text
Control   = observe + operate
Settings  = configure
Audit Log = investigate
```

Current behavior:

- Control represents gateway readiness, WhatsApp connection/account operation, health, and compact diagnostics.
- Settings owns machine API credentials, recipient policy, webhook configuration/delivery diagnostics, and operator browser-session management.
- Audit Log owns searchable operational evidence and technical detail disclosure.
- Global Control status follows gateway readiness rather than treating WhatsApp connectivity alone as overall gateway health.
- Degraded/not-ready states can hand off into Audit investigation with editable filters.
- Application integration is optional after WhatsApp becomes operational; it is not a pairing prerequisite.
- User-facing terminology prefers gateway/WhatsApp transport concepts over Baileys internals unless diagnosis requires provider detail.
- Workspace navigation is client-side and should remain smooth without full-page loading behavior.
- The visual language remains compact, border-led, information-dense, and consistent with `frontend/DESIGN.md`.

## Current architecture ownership

Backend capability owners:

```text
access
activity
gateway
messages
metrics
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

Frontend route/workspace composition lives under `frontend/src/pages/`. Architecture/dependency regression tests protect boundaries that are intentionally stable.

## Current reliability model

Outbound behavior currently provides:

- concurrency-safe same-key dispatch;
- durable intent/idempotency reservation before WhatsApp transport submission;
- explicit `prepared`, `submitting`, `submitted`, and `indeterminate` transport diagnostics;
- no automatic resend for indeterminate outcomes because WhatsApp may already have accepted the message;
- deliberate retry support for known definitive rejections by releasing the relevant reservation;
- WhatsApp acknowledgement-aligned success plus asynchronous reach-out rejection feedback;
- bounded outbound diagnostic retention without persisting message bodies;
- canonical Wago message IDs for correlation across request, transport, audit, and webhook evidence.

Webhook behavior currently provides:

- persisted configuration and signed at-least-once delivery;
- append-only bounded attempt evidence;
- explicit `in_progress`, `succeeded`, `retryable_failure`, `permanent_failure`, and `interrupted` outcomes;
- restart recovery before normal worker delivery resumes;
- operator redelivery without deleting prior attempts;
- no persisted callback payloads, signing secrets, recipient identifiers, or message bodies in attempt diagnostics.

Operational metrics expose bounded gauges for readiness, WhatsApp connection, retained outbound/webhook state, pending dispatch state, idempotency reservations, and process uptime without recipient/message identifiers.

## Current direction

Preserve the single-process/SQLite/Baileys architecture and the Control/Settings/Audit control-plane boundary until a concrete requirement changes them.

Do not move configuration back into Control, turn the dashboard into a CRM/general WhatsApp client, expose provider internals as primary product vocabulary, or add distributed/multi-session infrastructure without an explicit requirement.

There is no known current blocker.

Update this file only when one of these durable current facts materially changes. Task plans, acceptance criteria, sprint/iteration status, PR references, verification transcripts, and historical implementation notes do not belong here.
