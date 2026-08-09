# Changelog

All notable changes to this project will be documented here.

This project uses semantic versioning while the public API is still stabilizing.

## Unreleased

- Added production-readiness planning and contributor guidance.
- Added outbound policy guardrails for consent, opt-out, idempotency, rate limits, reachout timelock, and new-chat cap.
- Changed message send responses to return truthful `pending` status with status polling.
- Added production Docker, secure compose defaults, structured logging, CI, CodeQL, Dependabot, and GHCR release workflow.
