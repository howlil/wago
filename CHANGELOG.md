# Changelog

All notable changes to this project will be documented here.

This project uses semantic versioning while the public API is still stabilizing.

## Unreleased

- Added production-readiness planning and contributor guidance.
- Added outbound policy guardrails for consent, opt-out, idempotency, rate limits, reachout timelock, and new-chat cap.
- Changed message send responses to return truthful `pending` status with status polling.
- Added durable delivery webhooks with replay-resistant HMAC signing, schema versioning, SQLite retry/restart recovery, secret rotation, delivery history, and manual redelivery.
- Separated dashboard browser sessions from machine API keys: opaque HttpOnly sessions are hash-backed in SQLite, API keys are no longer stored in browser storage, and legacy raw-key browser state is cleared on upgrade.
- Added production Docker, secure compose defaults, structured logging, CI, CodeQL, Dependabot, and GHCR release workflow.
