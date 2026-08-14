# Production State Reliability Hardening Checkpoint

Date: 2026-08-14
Branch: `fix/production-state-reliability`
PR: `#36`
Verified head before ledger commit: `70d87c671f63d67c74346fce1c4fb77822950d8f`

## Implemented

- Production mount guard rejects container-root overlay, `tmpfs`, `ramfs`, and unverifiable `/app/data` storage before SQLite opens.
- Verified production mount information is cached at startup; `/ready` does not perform request-time filesystem reads.
- Container smoke includes the negative ephemeral-storage case and verifies graceful replacement-container persistence.
- SQLite migration 7 adds a singleton gateway-instance lease.
- One owner acquires and heartbeats the lease; overlapping contenders fail with `WAGO_INSTANCE_ALREADY_ACTIVE`.
- Heartbeat persistence errors fail closed and ownership-loss triggers graceful termination.
- Startup failures after lease acquisition release ownership immediately.
- Persisted Baileys auth resume failure degrades only the WhatsApp subsystem; the HTTP control plane remains available for recovery.
- Baileys credential-write failures are tracked as degraded health and recover after a later successful write.
- Fresh production web bootstrap requires an HTTPS same-origin request plus a deployment `SETUP_TOKEN` of at least 32 bytes; without a token, web bootstrap is disabled. `API_KEY` remains the pre-provisioned alternative.
- Stock Compose forwards optional `SETUP_TOKEN` and `API_KEY` values while retaining the persistent volume and hardened runtime settings.
- Generated API-key rotation invalidates the old machine key, revokes every other browser session, preserves the initiating recovery session, and does not touch WhatsApp auth.
- `POST /app/session/logout-all` revokes all dashboard sessions without rotating the machine key or resetting WhatsApp.
- `/health` remains process liveness. `/ready` reports `ok`, `degraded`, or `not_ready`; only `not_ready` returns HTTP 503.
- Dashboard polls readiness and shows an actionable operational warning for degraded/not-ready state without dumping internal exception text.
- GHCR mutable tag ownership is deterministic: only `main` can publish `latest`, `main`, and branch SHA tags; `v*` runs publish only version/semver tags.
- Webhook at-least-once behavior is locked by regression coverage: retry/manual redelivery preserve the same delivery ID and signed payload identity.
- Public deployment/configuration/operations docs and `SECURITY.md` document persistent storage, single-instance deployment, setup-token bootstrap, browser-session compromise response, webhook deduplication, and controlled whole-`/app/data` backup/restore.

## Pre-Merge Verification Evidence

All mandatory checks completed successfully on `70d87c671f63d67c74346fce1c4fb77822950d8f`:

- CI run `31800966215` / run #528: success.
  - formatting/lint: success;
  - backend + frontend test suites: success;
  - core build + documentation build: success;
  - amd64 Docker build and production persistence smoke: success;
  - native ARM64 Docker build: success.
- Docs CI run `31800966199` / run #199: success.
- CodeQL run `31800966209` / run #529: success.
- GitHub Advanced Security review finding about request-time filesystem access on `/ready` was fixed by moving mount inspection to startup-only cached state, then resolved after CodeQL passed.

## Final Gate

This ledger update intentionally triggers one final PR verification run. Squash merge PR `#36` only if that final head remains green for CI, Docs CI, and CodeQL and no unresolved review blocker remains. After merge, verify `main` CI plus Release Container, then delete `fix/production-state-reliability`.
