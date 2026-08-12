# Browser Session Authentication Design

## Decision
Separate machine API credentials from browser authentication. The long-lived Wago API key remains a Bearer credential for server-to-server integrations and is persisted only as a SHA-256 hash. The dashboard authenticates with an opaque random browser-session token delivered only in an HttpOnly cookie; SQLite stores only the session-token hash and lifecycle metadata.

## First-run flow
The dashboard generates the API-key candidate in memory and submits it to `POST /app/bootstrap`. Wago persists only the API-key hash, creates a browser session, sets the session cookie, and returns the raw API key once so the operator can copy it. The frontend never writes the API key to `sessionStorage` or `localStorage`.

## Returning-browser flow
If the session cookie is still valid, dashboard requests authenticate automatically. If browser storage is cleared, the dashboard shows a sign-in prompt. `POST /app/session` accepts the existing API key once, verifies it against the configured/raw or persisted-hash credential, creates a fresh browser session, sets the HttpOnly cookie, and never persists the submitted raw API key in browser storage.

## Logout and expiry
`POST /app/session/logout` revokes the current persisted browser session and clears the cookie. Sessions expire after 30 days. Expired or revoked session tokens are rejected. Bearer API-key authentication remains independent, so dashboard logout does not break SOPFlow, curl, Postman, or other integrations.

## Security boundary
SQLite stores `api_key_hash` and `browser_sessions.token_hash`, never raw API keys or raw session tokens. Browser-session cookies are HttpOnly, SameSite=Lax, Secure in production, and subject to the existing same-origin check for state-changing cookie-authenticated requests. Session tokens carry at least 256 bits of entropy.

## Compatibility
Existing Bearer API-key clients keep working. Existing raw-API-key cookies intentionally stop authenticating after the migration; an operator with a cleared/old cookie signs in once with the API key to receive a new browser session. WhatsApp/Baileys persistence and webhook behavior are unchanged.
