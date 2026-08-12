# Changelog

All notable changes to this project will be documented here.

This project uses semantic versioning while the public API is still stabilizing.

## Unreleased

- Added production-readiness planning and contributor guidance.
- Added outbound policy guardrails for consent, opt-out, idempotency, rate limits, reachout timelock, and new-chat cap.
- Changed message send responses to return truthful `pending` status with status polling.
- Added durable delivery webhooks with replay-resistant HMAC signing, schema versioning, SQLite retry/restart recovery, secret rotation, delivery history, and manual redelivery.
- Moved webhook callback configuration and signing-secret rotation into authenticated Wago Settings with SQLite persistence and runtime reload; legacy webhook environment variables now act only as one-time compatibility imports.
- Simplified the operator UI into flatter admin/infra surfaces with consistent radii, square collapsed navigation controls, and automatic Audit Log filters without an Apply button.
- Refined the operator console into a fluid compact layout with a 56/196px responsive sidebar, 56px header, stable Control utility rail, responsive forms/log filters, and consistent 16px card density; removed redundant `Gateway` and `Self-hosted` shell copy.
- Separated dashboard browser sessions from machine API keys: opaque HttpOnly sessions are hash-backed in SQLite, API keys are no longer stored in browser storage, and legacy raw-key browser state is cleared on upgrade.
- Added production Docker, secure compose defaults, structured logging, CI, CodeQL, Dependabot, and GHCR release workflow.
