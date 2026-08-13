# API Key Rotation Design

## Goal

Add a safe API-key rotation flow for Wago so an operator can recover from a lost or compromised machine credential without touching the WhatsApp/Baileys session.

## Chosen approach

Use explicit server-side rotation. Wago generates a new cryptographically random `wa_...` API key, persists only its SHA-256 hash in `app_settings`, returns the raw key exactly once to the authenticated dashboard, and immediately invalidates the previous API key.

This is preferred over storing the raw key in SQLite because plaintext storage would make database disclosure equivalent to API compromise. It is also preferred over client-only regeneration because a random key generated only in the browser would not match the hash held by Wago until the backend explicitly rotates the credential.

Rotation is intentionally restricted to an authenticated Wago browser session. A Bearer API key cannot rotate itself. This prevents a leaked machine credential from being used remotely to replace the legitimate credential and lock out existing clients.

## Scope

- Add a dashboard-session-only API-key rotation endpoint.
- Keep the current browser-session authentication model.
- Do not modify or recreate Baileys credentials, WhatsApp binding, recipient state, or webhook settings.
- Return the newly generated raw API key once in the rotation response.
- Persist only the replacement hash and rotation timestamp.
- Invalidate the previous API key immediately after a successful rotation.
- Keep existing browser sessions valid so rotating the machine credential does not log the operator out mid-action.
- Add a dashboard action under Gateway credentials with an explicit destructive confirmation.
- Show the replacement key in memory only and make it copyable until page refresh/navigation clears component state.
- Update public documentation to explain rotation and the requirement to update external clients such as SOPFlow after rotation.

## Data model

Reuse `app_settings.api_key_hash`. Add no plaintext API-key column.

Use the existing `generated_at` field as the timestamp of the currently active generated credential. Rotation overwrites both `api_key_hash` and `generated_at` in the existing single-row settings write.

For Wago instances configured through the `API_KEY` environment variable, rotation is not available because the environment remains the source of truth. The endpoint returns a typed conflict explaining that the operator must change the deployment secret instead.

## Backend API

Add `POST /app/api-key/rotate`.

Requirements:

- Request must have a valid Wago browser session; Bearer-only authentication is rejected.
- In production, rotation must originate from the Wago dashboard origin.
- Reject when `apiKeySource === "env"`.
- Generate a new high-entropy key using the same server-side generator used by bootstrap.
- Hash and persist it before returning success.
- Update in-memory config only after the SQLite write succeeds so a persistence failure cannot partially switch the active credential.
- Return `{ success, apiKey, generatedAt, message }`.
- Do not log the raw key.
- Record a security audit event without secret material.

The old key must fail authentication immediately after the successful response. The browser session used for rotation remains valid.

## Frontend flow

Gateway credentials gets a `Rotate API key` action only when the credential source is `generated` and the dashboard is authenticated.

Interaction:

1. Operator clicks Rotate API key.
2. Confirmation clearly states that existing external clients will stop authenticating until updated.
3. Frontend calls the rotation endpoint using its HttpOnly browser session.
4. Raw replacement key is placed only in React state and shown with copy/reveal controls.
5. UI warns the operator to save it now and update external applications such as SOPFlow.
6. Refreshing or leaving the page clears the raw key from browser memory; `/app/info` never returns it later.

## Error handling

- `401 BROWSER_SESSION_REQUIRED`: rotation was attempted without an authenticated Wago dashboard session.
- `403 INVALID_ROTATION_ORIGIN`: production rotation did not come from the dashboard origin.
- `409 API_KEY_MANAGED_BY_ENV`: deployment environment is the credential source and must be changed externally.
- Persistence failure: return 5xx and retain the previous in-memory active hash; never report success unless the replacement hash is committed.

## Security properties

- Raw API keys are never persisted in SQLite, logs, localStorage, or sessionStorage.
- A leaked Bearer key alone cannot rotate the active credential.
- Rotation does not affect WhatsApp/Baileys auth state.
- Old API key becomes invalid immediately after committed rotation.
- Browser sessions remain separate opaque credentials stored as hashes server-side.
- No automatic propagation to SOPFlow is attempted; deployment secrets remain an explicit external responsibility.

## Tests

Backend tests prove:

- generated-key rotation returns a fresh raw key and replaces the stored active hash;
- Bearer-only rotation is rejected;
- old key is rejected after rotation;
- new key authenticates after rotation;
- active browser session remains valid;
- env-managed key cannot be rotated from the dashboard;
- `/app/info` does not recover or expose the raw key.

Frontend tests prove:

- rotate action is shown only for authenticated generated credentials;
- confirmation is required before rotation;
- successful rotation shows the new key only in current component state;
- env-managed credentials do not expose rotation.

## Acceptance criteria

Rotation can be performed from the authenticated Wago dashboard without re-pairing WhatsApp. Bearer-only rotation is rejected. After rotation, the old API key receives `401`, the new API key can authenticate machine requests, the current dashboard session remains active, and the dashboard tells the operator to update dependent applications. No plaintext API key is persisted server-side or in browser storage.
