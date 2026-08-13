# API Key Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe regeneration/rotation of Wago-generated API keys without changing WhatsApp/Baileys session state.

**Architecture:** Keep generated machine credentials one-way: Wago persists only SHA-256 hashes in `app_settings`. Rotation is authenticated, server-generated, atomically replaces the active generated-key hash, returns the raw replacement exactly once, and leaves browser sessions and WhatsApp state untouched. The dashboard exposes a confirmation-gated action and keeps the replacement key only in React memory.

**Tech Stack:** Node.js, TypeScript, Express, node:sqlite, React, Vitest, Testing Library, pnpm.

## Global Constraints

- Raw API keys are never persisted in SQLite, logs, localStorage, or sessionStorage.
- Rotation must not touch Baileys credentials, WhatsApp binding, recipient state, or webhook settings.
- Existing browser sessions remain valid after rotation.
- The old generated API key becomes invalid immediately after committed rotation.
- Environment-managed `API_KEY` remains deployment-owned and cannot be rotated from the dashboard.
- Follow repository-local `.agent/` documentation boundaries and existing UI patterns.
- Use TDD: add failing behavior tests before implementation.

---

### Task 1: Backend credential rotation

**Files:**
- Modify: `backend/src/config/index.ts`
- Modify: `backend/src/config/bootstrap.test.ts`
- Modify: `backend/src/routes/app.routes.ts`
- Modify: `backend/src/app.test.ts`

**Interfaces:**
- Produces: `rotateGeneratedApiKey(): ApiKeyRotationResult` in config layer.
- Produces: authenticated `POST /app/api-key/rotate` returning `{ success: true, apiKey, generatedAt, message }`.
- Existing `isApiKeyValid()` must validate the new hash immediately after rotation.

- [ ] **Step 1: Write failing config tests**

Add tests proving `rotateGeneratedApiKey()` returns a fresh `wa_...` key, replaces `config.apiKeyHash`, preserves generated source, and rejects `env` credentials.

- [ ] **Step 2: Run backend test to verify RED**

Run: `pnpm --dir backend test -- src/config/bootstrap.test.ts`
Expected: FAIL because `rotateGeneratedApiKey` does not exist.

- [ ] **Step 3: Implement minimal config rotation primitive**

Implement a server-side generator shared with bootstrap, persist only `hashApiKey(newKey)` plus a fresh `generated_at`, and update in-memory config only after the SQLite write succeeds. Return a typed `API_KEY_MANAGED_BY_ENV` error when source is `env`.

- [ ] **Step 4: Add failing HTTP contract tests**

Cover authenticated browser-session rotation, old Bearer rejection, new Bearer acceptance, browser-session continuity, env-managed rejection, and absence of raw secret from `/app/info`.

- [ ] **Step 5: Run HTTP tests to verify RED**

Run: `pnpm --dir backend test -- src/app.test.ts`
Expected: FAIL because `/app/api-key/rotate` is not implemented.

- [ ] **Step 6: Implement route and audit event**

Add `POST /app/api-key/rotate`, require existing authentication, preserve same-origin protection for cookie-authenticated state changes through existing middleware, call the rotation primitive, return `409 API_KEY_MANAGED_BY_ENV` for env-managed credentials, and record a security activity event without the raw key.

- [ ] **Step 7: Run backend tests to GREEN**

Run: `pnpm --dir backend test`
Expected: PASS.

### Task 2: Dashboard rotation UX

**Files:**
- Create: `frontend/src/features/gateway/RotateApiKeyDialog.tsx`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/features/dashboard/useDashboardController.ts`
- Modify: `frontend/src/features/gateway/GatewayCredentialsCard.tsx`
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Produces: `rotateApiKey(): Promise<ApiKeyRotationResponse>` in `frontend/src/api.ts`.
- Produces controller state/actions `isApiKeyRotationDialogOpen`, `isRotatingApiKey`, `openApiKeyRotationDialog`, `closeApiKeyRotationDialog`, `handleRotateApiKey`.
- `GatewayCredentialsCard` shows Rotate only for authenticated `generated` credentials.

- [ ] **Step 1: Write failing frontend tests**

Add tests proving generated credentials expose Rotate, rotation requires confirmation, success renders the new key in the API-key input, and env-managed credentials hide the action.

- [ ] **Step 2: Run frontend tests to verify RED**

Run: `pnpm --dir frontend test -- src/App.test.tsx`
Expected: FAIL because rotation API/UI do not exist.

- [ ] **Step 3: Implement API client and confirmation dialog**

Add typed rotation response and `POST /app/api-key/rotate`. Build a focused confirmation dialog matching `RebindSessionDialog` patterns and warning that external clients stop authenticating until updated.

- [ ] **Step 4: Wire controller and credential card**

On successful rotation, put only `result.apiKey` into component state, reveal/copy it through existing controls, update the notice/hint, and never write it to browser storage. Keep the current browser session active.

- [ ] **Step 5: Run frontend tests to GREEN**

Run: `pnpm --dir frontend test`
Expected: PASS.

### Task 3: Documentation and release verification

**Files:**
- Modify: `README.md`
- Modify: public API documentation only where current credential lifecycle is described.

**Interfaces:**
- Public docs explain that generated keys are shown once and can be rotated without re-pairing WhatsApp.
- Public docs explicitly state dependent clients must replace the old Bearer key.

- [ ] **Step 1: Update public credential documentation**

Document dashboard rotation, immediate invalidation of the old key, no effect on Baileys/WhatsApp binding, and the need to update external clients such as SOPFlow.

- [ ] **Step 2: Run repository verification**

Run: `pnpm test`
Run: `pnpm check`
Run: `pnpm build`
Run: `pnpm build:docs`
Expected: all commands PASS.

- [ ] **Step 3: Review diff for secret-safety and scope**

Verify no plaintext-key persistence, no logging of the replacement key, no local/session storage use, no unrelated refactor, and no WhatsApp auth/binding mutation.

- [ ] **Step 4: Open PR and merge after mandatory CI is green**

Create one PR from `feat/api-key-rotation` to `main`, review changed files and CI, then squash merge and delete the task branch when tooling permits.
