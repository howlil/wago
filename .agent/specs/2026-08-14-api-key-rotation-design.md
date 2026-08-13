# API Key Rotation Design

## Goal

Add a safe API-key rotation flow for Wago so an operator can recover from a lost or compromised machine credential without touching the WhatsApp/Baileys session.

## Chosen approach

Use explicit server-side rotation. Wago generates a new cryptographically random `wa_...` API key, persists only its SHA-256 hash in `app_settings`, returns the raw key exactly once to the authenticated dashboard, and immediately invalidates the previous API key.

This is preferred over storing the raw key in SQLite because plaintext storage would make database disclosure equivalent to API compromise. It is also preferred over client-only regeneration because a random key generated only in the browser would not match the hash held by Wago until the backend explicitly rotates the credential.

## Scope

- Add an authenticated API-key rotation endpoint.
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

Use the existing `generated_at` field as the timestamp of the currently active generated credential. Rotation overwrites both `api_key_hash` and `generated_at` atomically.

For Wago instances configured through the `API_KEY` environment variable, rotation is not available because the environment remains the source of truth. The API should return a typed conflict/error explaining that the operator must change the deployment secret instead.

## Backend API

Add `POST /app/api-key/rotate`.

Requirements:

- Request must already be authenticated through the secure browser session or current Bearer API key.
- Reject when `apiKeySource === "env"`.
- Generate a new high-entropy key using the same server-side generator used by bootstrap.
- Hash and persist it before returning success.
- Update in-memory config immediately so subsequent requests validate against the new hash.
- Return `{ success, apiKey, generatedAt, message }`.
- Do not log the raw key.
- Record a security audit event without secret material.

The old key must fail authentication immediately after the successful response.

## Frontend flow

Gateway credentials gets a `Rotate API key` action only when the credential source is `generated` and the dashboard is authenticated.

Interaction:

1. Operator clicks Rotate API key.
2. Confirmation clearly states that existing external clients will stop authenticating until updated.
3. Frontend calls the rotation endpoint.
4. Raw replacement key is placed only in React state and shown with copy/reveal controls.
5. UI warns the operator to save it now and update external applications such as SOPFlow.
6. Refreshing or leaving the page clears the raw key from browser memory; `/app/info` never returns it later.

## Error handling

- `401 UNAUTHORIZED`: browser session is no longer valid.
- `409 API_KEY_MANAGED_BY_ENV`: deployment environment is the credential source and must be changed externally.
- Persistence failure: return 5xx and retain the previous active hash; never report success unless the replacement hash is committed.

## Security properties

- Raw API keys are never persisted in SQLite, logs, localStorage, or sessionStorage.
- Rotation does not affect WhatsApp/Baileys auth state.
- Old API key becomes invalid immediately after committed rotation.
- Browser sessions remain separate opaque credentials stored as hashes server-side.
- No automatic propagation to SOPFlow is attempted; deployment secrets remain an explicit external responsibility.

## Tests

Backend tests must prove:

- generated-key rotation returns a new raw key and persists only its hash;
- old key is rejected after rotation;
- new key authenticates after rotation;
- active browser session remains valid;
- env-managed key cannot be rotated;
- rotation does not modify WhatsApp binding data;
- failed persistence does not partially switch credentials;
- raw key is absent from audit records and `/app/info`.

Frontend tests must prove:

- rotate action is shown only for authenticated generated credentials;
- confirmation is required;
- successful rotation shows the new key once and copy action works;
- refresh does not recover the raw key;
- env-managed credentials do not expose rotation.

## Acceptance criteria

Rotation can be performed from the Wago dashboard without re-pairing WhatsApp. After rotation, the old API key receives `401`, the new API key can authenticate machine requests, and the dashboard tells the operator to update dependent applications. No plaintext API key is persisted anywhere server-side or in browser storage.
