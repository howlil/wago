# Production Readiness Iteration Plan

## Target

Make this repository a production-ready, single-account, self-hosted WhatsApp gateway:

- one process
- one WhatsApp account
- one persistent data volume
- Docker-first deployment
- conservative outbound behavior
- no bulk/campaign/anti-detection features

Production-ready here does not mean zero WhatsApp enforcement risk. The transport is Baileys, an unofficial WhatsApp Web client, so the app must fail closed, avoid accidental abuse, and surface account health clearly.

## Current Assessment

The codebase is a clean MVP, but not production-ready yet.

Strong points:

- Shallow TypeScript architecture.
- API key and auth-cookie foundation exist.
- Docker setup is already close to usable.
- Message status endpoint exists.
- `outbound-policy.ts` now enforces idempotency, in-memory flood limits, known-recipient new-chat limits, and outbound pause.
- `POST /messages/send` now returns `202 pending` without waiting for delivery updates.
- WhatsApp account health now tracks reachout timelock and new-chat cap with defensive caching.
- reconnect now uses bounded scheduled backoff instead of immediate recursion.
- Baileys socket config defaults to the bundled version, supports cached live version mode, and provides `getMessage`.
- `whatsapp.ts` is now a thin compatibility layer over focused WhatsApp modules.

Critical gaps:

- reconnect uses bounded scheduled backoff after transient close.
- Baileys version is no longer fetched on every initialize/reconnect.
- 463 reachout restriction now marks account-level health, with the old per-recipient cooldown kept only as a fallback guard.
- recipient consent/opt-out is persisted in `backend/data/recipients.json`.
- `onWhatsApp()` now uses a bounded in-memory lookup cache after a recipient is allowed.
- socket config has bounded recent-message `getMessage` support.
- security hardening, structured logs, release pipeline, and OSS governance are incomplete.

## Non-Goals

Do not add:

- Redis, BullMQ, Kafka, PostgreSQL, or a worker queue.
- multi-session or multi-tenant architecture.
- Kubernetes manifests.
- bulk sender/campaign scheduler.
- fake typing, random human delays, fingerprint rotation, proxy rotation, text mutation, or other anti-detection behavior.
- custom WhatsApp protocol hacks.

## Milestone 1: Core Correctness and Baileys Safety

This milestone fixes P0 runtime behavior without adding infrastructure.

### Iteration 1: Real Outbound Policy

Goal: make `outbound-policy.ts` enforce safety instead of returning allow-all.

Tasks:

- [x] Replace no-op `checkOutboundPolicy()` with ordered checks.
- [x] Add in-memory state for idempotency, account limits, recipient limits, known recipients, and outbound pause.
- [x] Implement `recordOutboundAccepted()` and `recordOutboundRejected()`.
- [x] Keep public decision reasons stable: `RECIPIENT_NOT_ALLOWED`, `RECIPIENT_OPTED_OUT`, `DUPLICATE_MESSAGE`, `RECIPIENT_RATE_LIMITED`, `ACCOUNT_RATE_LIMITED`, `NEW_CHAT_RATE_LIMITED`, `WA_REACHOUT_RESTRICTED`, `WA_NEW_CHAT_CAPPED`, `OUTBOUND_PAUSED`.
- [x] Add focused unit tests for each decision branch.

Acceptance:

- [x] A send cannot bypass `OutboundPolicy`.
- [x] Duplicate idempotency keys are blocked.
- [x] Account and recipient flood limits are enforced.
- [x] Policy tests prove allowed and blocked paths.

Verification:

- [x] `pnpm test` in `backend`.
- [x] `pnpm run build` in `backend`.

### Iteration 2: Honest Async Message Semantics

Goal: make send latency low and status truthful.

Tasks:

- [x] Change `sendTextMessage()` to return after `socket.sendMessage()` obtains a `messageId`.
- [x] Return `202` with `status: "pending"` instead of waiting for ACK.
- [x] Remove `waitForMessageOutcome()` from the HTTP request path.
- [x] Keep `messages.update` responsible for `pending -> accepted` or `pending -> rejected`.
- [x] Never convert timeout/no event into `accepted`.
- [x] Keep immediate send failures mapped to stable HTTP errors.

Acceptance:

- [x] `POST /messages/send` does not wait up to 8 seconds for delivery updates.
- [x] New message status starts as `pending`.
- [x] `GET /messages/:id/status` is the source of durable status.

Verification:

- [x] Backend unit test for async `pending` send semantics.
- [x] Backend test proves message status is updated by `messages.update`.
- [x] `pnpm test` in `backend`.
- [x] `pnpm run build` in `backend`.
- [x] `pnpm test` in `frontend`.
- [x] `pnpm run build` in `frontend`.

### Iteration 3: Recipient Consent, Opt-Out, and Lookup Cache

Goal: prevent arbitrary cold outreach and reduce repeated `onWhatsApp()` calls.

Tasks:

- [x] Add file-backed recipient store at `backend/data/recipients.json`.
- [x] Store normalized JID, resolved JID, label, allowed flag, opted-out flag, and timestamps.
- [x] Add protected routes: `GET /recipients`, `POST /recipients/allow`, `POST /recipients/:phone/opt-out`.
- [x] Block unknown recipients by default.
- [x] Cache positive `onWhatsApp()` result with longer TTL.
- [x] Cache negative result with shorter TTL.
- [x] Use canonical/resolved JID internally after lookup.
- [x] Document that lookup cache must not be used for phone-number enumeration.

Acceptance:

- [x] Unknown recipient returns `403 RECIPIENT_NOT_ALLOWED`.
- [x] Opted-out recipient returns `403 RECIPIENT_OPTED_OUT`.
- [x] Allowed recipient can be sent without repeated network lookup while cache is valid.
- [x] Recipient store persists across restart.

Verification:

- [x] Unit tests for recipient store.
- [x] HTTP tests for allow, opt-out, and recipient listing.
- [x] Policy tests for unknown and opted-out recipients.
- [x] WhatsApp unit test proves successful lookup is cached.
- [x] `pnpm test` in `backend`.
- [x] `pnpm run build` in `backend`.

### Iteration 4: WhatsApp Account Health State

Goal: respect Baileys reachout timelock and new-chat cap as account-level health.

Tasks:

- [x] Add account health state with cached reachout timelock and new-chat cap.
- [x] Integrate `socket.fetchAccountReachoutTimelock()` with TTL.
- [x] Integrate `socket.fetchNewChatMessageCap()` with TTL and defensive error handling.
- [x] Read `connection.update.reachoutTimeLock` when Baileys emits it.
- [x] On 463, mark account restricted and refresh health state.
- [x] Replace per-JID 30-minute restriction as the primary enforcement.
- [x] Block active timelock with `WA_REACHOUT_RESTRICTED` and `retryAt`.
- [x] Block `CAPPED` new-chat state with `WA_NEW_CHAT_CAPPED`.
- [x] Treat warning states conservatively for new recipients.
- [x] Expose health state through protected `/whatsapp/status`.

Acceptance:

- [x] 463 pauses account-level outbound instead of only one JID.
- [x] Policy does not retry/flood health fetches when Baileys health calls fail.
- [x] Operators can see restriction/cap status.

Verification:

- [x] Unit tests using narrow mocked Baileys health responses.
- [x] Policy tests for timelock and new-chat cap mapping.
- [x] WhatsApp test for `connection.update.reachoutTimeLock`.
- [x] `pnpm test` in `backend`.
- [x] `pnpm run build` in `backend`.

### Iteration 5: Reconnect State Machine

Goal: remove immediate reconnect loops and avoid accidental unlink/pairing churn.

Tasks:

- [x] Replace recursive immediate reconnect with scheduled backoff.
- [x] Use bounded delays: 2s, 5s, 15s, 30s, 60s max.
- [x] Add small jitter.
- [x] Reset attempts after stable `open`.
- [x] Do not reconnect after logged-out until operator rebinds.
- [x] Ensure `rebindWhatsApp()` still uses generation guards.
- [x] Add shutdown flag so SIGTERM does not schedule reconnect.

Acceptance:

- [x] Transient close does not create a tight reconnect loop.
- [x] logged-out state becomes pairing-needed, not aggressive reconnect.
- [x] rebind still clears current session intentionally.

Verification:

- [x] Unit tests for backoff calculation.
- [x] Unit tests for reconnect decisions.
- [x] WhatsApp tests for scheduled reconnect and logged-out close.
- [x] `pnpm test` in `backend`.
- [x] `pnpm run build` in `backend`.

### Iteration 6: Baileys Socket Configuration

Goal: align socket setup with production guidance while staying simple.

Tasks:

- [x] Stop calling `fetchLatestBaileysVersion()` on every initialize.
- [x] Add `WA_VERSION_MODE=default|live`, defaulting to `default`.
- [x] If `live`, fetch once per process and cache the value for reconnects.
- [x] Pin Baileys dependency exactly: `7.0.0-rc14`.
- [x] Add bounded recent message store for outbound proto messages.
- [x] Configure Baileys `getMessage` using the recent message store.
- [x] Keep `useMultiFileAuthState` for single-account deployment and document the scope.

Acceptance:

- [x] Reconnect does not fetch WA version repeatedly.
- [x] Message retry can retrieve recent outbound messages.
- [x] Dependency upgrades are explicit and testable.

Verification:

- [x] Backend build.
- [x] Tests for version strategy and recent message store.
- [x] WhatsApp tests for default bundled version and cached live version.
- [x] Lockfile updated after dependency pin.

### Iteration 7: Split `whatsapp.ts` by Concern

Goal: reduce risk in the largest backend module without adding heavy architecture.

Target structure:

```text
backend/src/whatsapp/
|-- client.ts
|-- connection-state.ts
|-- message-status-store.ts
`-- recipient-cache.ts

backend/src/
|-- account-health.ts
`-- recent-message-store.ts
```

Tasks:

- [x] Move connection lifecycle into `whatsapp/client.ts`.
- [x] Move QR/status generation state into `connection-state.ts`.
- [x] Move message status map into `message-status-store.ts`.
- [x] Move lookup cache into `recipient-cache.ts`.
- [x] Move Baileys `getMessage` cache into `recent-message-store.ts`.
- [x] Keep route imports stable through a small barrel or compatibility exports.

Acceptance:

- [x] Behavior remains unchanged after split.
- [x] Each module has focused tests where practical.
- [x] `whatsapp.ts` is either removed or becomes a thin compatibility layer.

Verification:

- [x] Backend tests.
- [x] Backend build.

## Milestone 2: Production and Security Hardening

This milestone makes the app safer to run on a public server behind a reverse proxy.

### Iteration 8: API Key, Cookie, CSRF, and Headers

Goal: reduce credential exposure and browser-origin risk.

Tasks:

- [x] Persist generated API key as SHA-256 digest only.
- [x] Return generated raw key only once during bootstrap.
- [x] Keep env `API_KEY` as preferred production path.
- [x] Make admin UI use HttpOnly cookie auth instead of storing raw API key in `sessionStorage`.
- [x] Keep Bearer API key for machine clients.
- [x] Add Origin validation for cookie-authenticated state-changing requests.
- [x] Add `helmet` with conservative defaults.
- [x] Add minimal CSP that supports the frontend build.

Acceptance:

- [x] Raw generated API key is not persisted.
- [x] Admin UI can operate without JavaScript-readable secret.
- [x] Cross-site cookie-authenticated POST is rejected.

Verification:

- [x] Backend auth tests.
- [x] Frontend auth tests.
- [x] Backend and frontend builds.

### Iteration 9: Config Validation and Runtime Safety

Goal: make unsafe production config visible or fail fast.

Tasks:

- [x] Add config validation for `NODE_ENV=production`.
- [x] Make `TRUST_PROXY` explicit; default false.
- [x] Warn or fail on production `CORS_ORIGIN=*`.
- [x] Warn or fail on production `AUTH_COOKIE_SECURE=false`.
- [x] Warn or fail on missing `API_KEY` when web bootstrap is disabled.
- [x] Add `DEFAULT_COUNTRY_CODE` or require international phone format explicitly.
- [x] Bound in-memory HTTP rate-limit storage cleanup.
- [x] Keep `/health` as process health and `/ready` as app readiness.

Acceptance:

- [x] Production starts only with deliberate security choices.
- [x] IP-based middleware does not trust proxy headers unless configured.
- [x] Rate-limit memory does not grow without cleanup.

Verification:

- [x] Config unit tests.
- [x] HTTP tests for ready/health semantics.

### Iteration 10: Structured Redacted Logging

Goal: make production behavior diagnosable without leaking secrets.

Tasks:

- [x] Introduce `pino` logger.
- [x] Add request IDs.
- [x] Log HTTP method, route, status, duration, and request ID.
- [x] Log WhatsApp connection state changes.
- [x] Log outbound policy blocks by reason.
- [x] Redact API keys, cookies, QR payloads, auth paths, full phone numbers, JIDs, and message text.
- [x] Add helper for masked phone/JID or hash.

Acceptance:

- [x] Logs are structured JSON in production.
- [x] Sensitive values are not printed.
- [x] Policy/reconnect/restriction events are visible.

Verification:

- [x] Unit tests for redaction helpers.
- [x] HTTP smoke test confirms request ID output.

### Iteration 11: Startup and Graceful Shutdown

Goal: keep HTTP visible during WhatsApp startup and shut down without unlinking device.

Tasks:

- [x] Start HTTP server before WhatsApp initialization finishes.
- [x] Initialize WhatsApp asynchronously.
- [x] Add SIGTERM/SIGINT handling.
- [x] Stop accepting HTTP on shutdown.
- [x] Disable reconnect scheduling during shutdown.
- [x] Close socket without `logout()` on ordinary shutdown.
- [x] Preserve rebind as the only intentional unlink path.

Acceptance:

- [x] Container can expose dashboard while WhatsApp is connecting.
- [x] `docker stop` does not unlink WhatsApp.
- [x] Shutdown exits cleanly.

Verification:

- [x] Unit tests for lifecycle flags where possible.
- [x] Manual Docker stop/start smoke test.

### Iteration 12: Production Docker Compose

Goal: make self-hosting secure-by-default.

Tasks:

- [x] Add production compose file using an image, not build context.
- [x] Default bind address to `127.0.0.1`.
- [x] Use named volume `wago_data`.
- [x] Set `restart: unless-stopped`.
- [x] Add `read_only: true`, `/tmp` tmpfs, `cap_drop: [ALL]`, and `no-new-privileges`.
- [x] Keep development compose/build path separate.
- [x] Document backup/restore for `wago_data`.
- [x] Warn never to use `docker compose down -v` for upgrade.

Acceptance:

- [x] A production operator can deploy with `docker compose pull && docker compose up -d`.
- [x] Data persists through container replacement.
- [x] Public exposure requires deliberate bind/reverse-proxy config.

Verification:

- [x] Docker build.
- [x] Compose config validation.
- [x] Local smoke test for `/health`.

## Milestone 3: OSS, CI, and Release Engineering

This milestone makes the repository maintainable and distributable.

### Iteration 13: Code Quality Tooling

Goal: add one practical formatter/linter without tool sprawl.

Tasks:

- [x] Add Biome.
- [x] Add root scripts: `pnpm check`, `pnpm check:fix`, `pnpm test`, `pnpm build`.
- [x] Ensure backend and frontend use pnpm consistently.
- [x] Run Biome and fix only relevant formatting issues.
- [x] Document local quality commands in `AGENTS.md` and README.

Acceptance:

- [x] One command verifies formatting/lint basics.
- [x] CI can run the same commands locally.

Verification:

- [x] `pnpm check`.
- [x] `pnpm test`.
- [x] `pnpm build`.

### Iteration 14: CI and Dependency Updates

Goal: prevent regressions before merge.

Tasks:

- [x] Add GitHub Actions CI for backend test/build and frontend test/build.
- [x] Add Docker image build check without push.
- [x] Add CodeQL workflow.
- [x] Add Dependabot for pnpm, Docker, and GitHub Actions.
- [x] Ensure Baileys upgrades open PRs but are not auto-deployed.

Acceptance:

- [x] PRs fail if tests/build/Docker build fail.
- [x] Security/dependency updates are visible and reviewable.

Verification:

- [x] Validate workflows syntax.
- [ ] First CI run passes.

### Iteration 15: GHCR Release Pipeline

Goal: publish versioned Docker images for production installs.

Tasks:

- [x] Add release workflow triggered by `v*` tags.
- [x] Build multi-arch images: `linux/amd64` and `linux/arm64`.
- [x] Push to `ghcr.io/howlil/wago-simple`.
- [x] Add OCI labels for source, revision, version, and license.
- [x] Generate SBOM and provenance.
- [x] Tag images as full semver, minor, and latest.
- [x] Document rollback by changing `WAGO_VERSION`.

Acceptance:

- [x] Tagging `v0.x.y` produces GHCR images.
- [x] Users do not need to clone the repo to deploy production.

Verification:

- [x] Dry-run workflow review.
- [ ] First tagged release smoke test.

### Iteration 16: OSS Governance and Docs

Goal: make repository boundaries clear for contributors and users.

Tasks:

- [x] Add MIT `LICENSE`.
- [x] Add `SECURITY.md` with private vulnerability reporting guidance.
- [x] Add `CONTRIBUTING.md`.
- [x] Add `CODE_OF_CONDUCT.md`.
- [x] Add `CHANGELOG.md`.
- [x] Add issue templates for bug and feature requests.
- [x] Add pull request template.
- [x] Update README support boundary.
- [x] Document supported and unsupported deployment modes.
- [x] Document upgrade, backup, restore, and rollback.
- [x] Document that Baileys transport is unofficial and not guaranteed ban-safe.

Acceptance:

- [x] Users know what the project supports.
- [x] Users know not to paste auth state, QR payloads, API keys, or full logs into issues.
- [x] Contributors have clear test/build expectations.

Verification:

- [x] Docs review.
- [x] Link checks where practical.

## Final Definition of Done

The project can be called production-ready for single-account self-hosting when:

- [ ] Outbound policy enforces consent, opt-out, idempotency, rate limits, pause, reachout timelock, and new-chat cap.
- [ ] Send API returns quickly with truthful `pending` status.
- [ ] Account restriction is account-level, not only per recipient.
- [ ] Reconnect uses bounded backoff and never logs out unless rebind is requested.
- [ ] Baileys version strategy is explicit.
- [ ] `getMessage` has a bounded recent-message store.
- [ ] `whatsapp.ts` is split into focused modules.
- [ ] API key persistence, admin cookie flow, Origin checks, Helmet, and config validation are implemented.
- [ ] Logs are structured and redacted.
- [ ] Startup and shutdown lifecycle are safe.
- [ ] Production compose is secure-by-default.
- [ ] CI, CodeQL, Dependabot, GHCR release, SBOM, and provenance exist.
- [ ] OSS docs and security policy are present.
- [ ] Backend tests pass.
- [ ] Frontend tests pass.
- [ ] Backend and frontend builds pass.
- [ ] Docker build passes.
- [ ] Manual Docker volume persistence smoke test passes.
- [ ] Manual WhatsApp pairing/send smoke test passes before release.

## Implementation Rules

- Prefer explicit failure over retry loops.
- Do not unit-test Baileys internals; test wrapper decisions.
- Keep all state in memory or `backend/data` files unless scope changes.
- Keep one WhatsApp account per process.
- Treat `backend/data/auth` as a private key.
- Do not log QR data, auth data, API keys, full phone numbers, JIDs, or message text.
- Do not deploy uninitialized public instances with `ALLOW_WEB_BOOTSTRAP=true`.
- Do not run multiple replicas against the same auth directory.
