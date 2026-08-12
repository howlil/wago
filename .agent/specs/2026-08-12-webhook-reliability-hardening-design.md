# Webhook Reliability Hardening Design

## Decision
Use a durable SQLite outbox rather than an external queue. Webhook callbacks are application delivery state, not WhatsApp socket state, so they survive Wago restarts independently of transient Baileys caches.

## Event contract
Payload schema version is `1`. Existing message status `accepted` remains unchanged for API compatibility, while webhook events use `message.server_accepted` and `message.rejected`. Payloads contain only delivery id, version, event, createdAt, messageId, status, and stable rejection code when present.

## Signing and replay protection
Each attempt includes a Unix timestamp and signature over `<delivery-id>.<timestamp>.<raw-json-body>`. Headers expose `Webhook-Id`, `Webhook-Timestamp`, `Webhook-Signature`, and `X-Wago-Event`. During secret rotation Wago signs with the current secret and, if configured, the previous secret. Receiver guidance requires constant-time verification, a five-minute timestamp tolerance, and deduplication by signed delivery id.

## Reliability
A delivery row is inserted before network delivery. The worker atomically claims due rows, performs one HTTP attempt with a five-second timeout, and persists the result. Retryable failures are network errors, 408, 429, and 5xx. Backoff grows with jitter and never exceeds the 24-hour delivery horizon. Non-retryable 4xx become failed immediately. Exhausted deliveries become expired/failed but remain queryable and manually redeliverable.

## Lifecycle
The worker starts with the application and stops gracefully before the database closes. Restart recovery simply finds due persisted rows. Webhook failure never mutates an already-final WhatsApp message status.

## API and operations
Authenticated webhook-delivery endpoints expose sanitized delivery metadata and manual redelivery. They never expose the signing secret, recipient JID, message body, or raw authorization data. Partial or invalid webhook config fails startup rather than silently disabling a configured integration.
