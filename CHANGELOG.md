# Changelog

All notable Wago changes are documented here. Wago uses SemVer and is still pre-1.0.

## Unreleased

### Breaking / compatibility

- Removed the legacy `SETUP_TOKEN` / setup-code bootstrap path. Production first-run setup now requires `WAGO_ADMIN_PASSWORD` -> browser session -> machine API-key bootstrap.
- Removed legacy API-key-to-dashboard-session authentication. Machine API keys are now server-to-server Bearer credentials only.
- Removed legacy raw API-key browser cookie/session-storage cleanup shims.
- Removed runtime import of pre-SQLite JSON state and legacy webhook environment configuration. Existing released SQLite migrations remain append-only for upgrade safety.
- Consolidated pnpm workspace state around the root lockfile; package-local workspace lockfiles are removed.

These compatibility removals require the next stable release to be at least a **minor** version while Wago is pre-1.0.

### Engineering workflow

- Replaced the historical plan/spec/checkpoint workflow with a lean default: acceptance criteria -> RED -> GREEN -> REFACTOR -> focused verification -> PR/CI -> merge -> observe.
- `.agent/` is now an exception workspace: normal changes create no planning artifact; high-risk changes may use one short decision note.
- Added explicit anti-over-engineering, WIP, small-batch, XP, and YAGNI rules.
- Reduced `plan.md` to current engineering direction; completed execution history lives in Git and pull requests.

### Release policy

- Added `RELEASING.md` as the canonical release policy.
- Green `main` publishes `edge` and immutable SHA images for integration testing.
- Stable `latest` is published only from an immutable `vMAJOR.MINOR.PATCH` tag on green `main`.
- Stable tags are immutable; failed releases are fixed on `main` and published as a new version rather than retagged.

### Existing product baseline

- Separate admin-password dashboard authentication and machine Bearer API credentials.
- Opaque HttpOnly dashboard sessions with revocation and independent generated API-key rotation.
- Durable SQLite state, Baileys auth persistence, single-instance ownership, truthful readiness, signed durable webhooks, sanitized audit events, recipient controls, outbound safety guardrails, and multi-architecture container verification.
