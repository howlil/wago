# Webhook Reliability Hardening Implementation Plan

**Goal:** Upgrade Wago delivery webhooks from transient best-effort callbacks to durable, replay-resistant, versioned delivery suitable for production self-hosted integrations.

**Architecture:** Keep the single-instance modular monolith and existing SQLite store. Message status transitions enqueue immutable webhook deliveries into SQLite. A small in-process worker claims due rows, signs `id.timestamp.rawBody`, posts them asynchronously, persists attempt/result state, retries with bounded exponential backoff + jitter for up to 24 hours, and supports explicit redelivery from the authenticated API. Existing `/messages/:id/status` remains backward-compatible; webhook `message.accepted` is renamed to `message.server_accepted` to reflect server ACK semantics.

**Constraints:** No Redis/RabbitMQ/BullMQ. No raw phone/JID/message body in payload/logs. Keep webhook optional. Preserve existing `accepted` message status API. Fail fast on partial/invalid webhook config. Support current + previous signing secrets during rotation.

## Tasks

1. Add append-only SQLite migration for `webhook_deliveries` and persistence helpers with atomic due-claim/update/redelivery semantics.
2. Add replay-safe webhook envelope/signature (`version`, stable delivery id, timestamp; HMAC-SHA256 over `id.timestamp.rawBody`) and dual-secret signatures.
3. Add durable delivery worker with timeout, retry classification, exponential backoff+jitter, 24h expiry, restart recovery, structured sanitized logs.
4. Wire message status transitions to enqueue `message.server_accepted` / `message.rejected` once per transition without blocking Baileys.
5. Add authenticated API endpoints to list/get webhook deliveries and manually redeliver failed/expired deliveries.
6. Add config validation and lifecycle start/stop integration.
7. Add regression tests for persistence, signing, retry/recovery, duplicate transitions, redelivery, and config validation.
8. Update README/public docs and verify CI, Docker smoke, CodeQL, and release container.
