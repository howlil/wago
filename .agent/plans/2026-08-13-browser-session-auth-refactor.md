# Browser Session Authentication Refactor Plan

**Goal:** Remove raw API-key persistence from browser storage and separate dashboard browser sessions from external Bearer API credentials.

**Architecture:** Keep the existing API-key hash as the machine credential. Add a SQLite-backed `browser_sessions` table and an auth module that creates, validates, expires, and revokes opaque session tokens. Bootstrap/login exchange an API key for a browser session cookie; protected routes accept either a valid Bearer API key or a valid browser session.

**Constraints:** No localStorage/sessionStorage secrets. No plaintext API key or session token in SQLite. Keep existing Bearer integrations backward-compatible. Keep SameSite/origin protections for cookie-authenticated mutations. No new external datastore or auth dependency.

## Tasks

1. Add regression tests for first-run cookie separation, API-key-to-session login, logout/revocation, raw-key-cookie rejection, and frontend non-persistence.
2. Add SQLite migration v5 for browser sessions plus focused persistence helpers.
3. Refactor auth middleware to distinguish Bearer API keys from browser sessions while preserving protected-route behavior.
4. Refactor `/app/bootstrap` to issue a session cookie and add `/app/session` plus `/app/session/logout`.
5. Remove `sessionStorage` API-key handling from the React API client/controller and update credentials UX for sign-in/sign-out and one-time key display.
6. Update security/README/public documentation and migration/container smoke expectations.
7. Run formatter/lint, backend/frontend tests, builds, docs tests/build, Docker persistence/rollback smoke, ARM64 build, CodeQL, and release-container checks; then squash-merge to `main`.
