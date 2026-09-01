# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** Inbound Events / Incoming Message Webhooks.

Goal: deliver incoming private-chat text messages to the configured backend through Wago's existing signed, durable, at-least-once webhook path without turning Wago into a chat-history store or dashboard inbox.

## Current baseline

- workspace layout is `apps/gateway`, `apps/dashboard`, and `apps/docs`;
- pnpm uses one root workspace and lockfile;
- root `Taskfile.yml` is the canonical developer command surface;
- gateway remains a single-instance Express/TypeScript + SQLite + Baileys application;
- dashboard remains the Control / Settings / Audit Log operator control plane;
- outbound message delivery webhooks already provide HMAC signing, durable retry, restart recovery, attempt diagnostics, and manual redelivery;
- webhook deliveries are uniquely keyed by logical message/event and already persist retry payloads;
- current WhatsApp event wiring handles outbound `messages.update` but not inbound `messages.upsert`;
- repository feature-delivery contract requires backend/API/operator diagnostics/docs to remain coherent.

## Active slice

Milestone: Inbound Events / Incoming Message Webhooks
Goal: receive direct incoming text and emit `message.received` through the existing webhook engine.
Current slice: inbound contract + privacy-safe durable delivery.
Acceptance boundary:
- direct private-chat text only; ignore `fromMe`, groups, status/broadcast/newsletter, non-text payloads, and history/append events;
- stable Wago inbound message ID makes duplicate Baileys notifications idempotent;
- same configured webhook URL/signing secret/retry worker is reused;
- inbound text/sender data may be persisted only while an active delivery still needs its payload, for at most the existing 24-hour retry horizon; terminal inbound deliveries retain diagnostics but not message content or sender data;
- terminal inbound deliveries cannot be manually redelivered after payload redaction;
- Settings and delivery diagnostics explain incoming + delivery events without presenting an inbox or message body;
- Audit Log records sanitized receive/queue/failure evidence only;
- public docs describe payload, signature, at-least-once semantics, dedupe, and bounded temporary content retention.
Evidence: branch `feat/inbound-message-webhooks` created from the clean main baseline.
Blockers: none known.
Next action: implement inbound normalization/envelope and genericize the existing webhook store/worker boundary.

## Completion rule

When a slice completes, record only evidence needed to leave truthful resumable state, advance to the next already-authorized slice, and remove stale blockers/next actions.

When the milestone completes, mark its gate complete and return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
