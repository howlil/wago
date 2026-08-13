# API Key Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe regeneration/rotation of Wago-generated API keys without changing WhatsApp/Baileys session state.

**Architecture:** Keep generated machine credentials one-way: Wago persists only SHA-256 hashes in `app_settings`. Rotation is a dashboard-session operation, server-generated, replaces the active generated-key hash, returns the raw replacement exactly once, and leaves browser sessions and WhatsApp state untouched. The dashboard exposes a confirmation-gated action and keeps the replacement key only in React memory.

**Tech Stack:** Node.js, TypeScript, Express, node:sqlite, React, Vitest, Testing Library, Astro, pnpm.

## Global Constraints

- Raw API keys are never persisted in SQLite, logs, localStorage, or sessionStorage.
- Rotation must not touch Baileys credentials, WhatsApp binding, recipient state, or webhook settings.
- Existing browser sessions remain valid after rotation.
- The old generated API key becomes invalid immediately after committed rotation.
- Environment-managed `API_KEY` remains deployment-owned and cannot be rotated from the dashboard.
- Direct Bearer-only requests cannot invoke the rotation endpoint.
- Production rotation requests must pass the existing same-origin dashboard boundary.
- Follow repository-local `.agent/` documentation boundaries and existing UI patterns.
- Use TDD: add failing behavior tests before implementation.

---

### Task 1: Backend credential rotation

**Files:**
- Modify: `backend/src/config/index.ts`
- Modify: `backend/src/config/bootstrap.test.ts`
- Modify: `backend/src/routes/app.routes.ts`
- Create: `backend/src/api-key-rotation.test.ts`

**Interfaces:**
- Produces: `rotateGeneratedApiKey(): ApiKeyRotationResult` in config layer.
- Produces: dashboard-session-only `POST /app/api-key/rotate` returning `{ success: true, apiKey, generatedAt, message }`.
- Existing `isApiKeyValid()` validates the new hash immediately after rotation.

- [x] **Step 1: Write failing config tests**

Added tests proving `rotateGeneratedApiKey()` returns a fresh `wa_...` key, replaces `config.apiKeyHash`, preserves generated source, and rejects `env` credentials.

- [x] **Step 2: Verify RED**

CI failed at the expected missing rotation primitive/route before production code was added.

- [x] **Step 3: Implement minimal config rotation primitive**

Implemented server-side generation, persisted only `hashApiKey(newKey)` plus a fresh `generated_at`, and updated in-memory config only after the SQLite write succeeds.

- [x] **Step 4: Add HTTP security contract tests**

Covered dashboard-session requirement, direct Bearer rejection, old Bearer rejection after rotation, new Bearer acceptance, browser-session continuity, env-managed rejection, and absence of raw secret from `/app/info`.

- [x] **Step 5: Implement route and audit event**

Added `POST /app/api-key/rotate`, required a valid browser session, enforced production same-origin, returned typed conflicts for unsupported sources, and recorded a security activity event without raw key material.

- [x] **Step 6: Run backend tests to GREEN**

Covered by repository CI `Check, Test, Build Core and Docs`.

### Task 2: Dashboard rotation UX

**Files:**
- Create: `frontend/src/features/gateway/RotateApiKeyDialog.tsx`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/features/dashboard/useDashboardController.ts`
- Modify: `frontend/src/features/gateway/GatewayCredentialsCard.tsx`
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx`
- Modify: `frontend/src/App.test.tsx`
- Create: `frontend/src/features/gateway/ApiKeyRotation.test.tsx`

**Interfaces:**
- Produces: `rotateApiKey(): Promise<ApiKeyRotationResponse>` in `frontend/src/api.ts`.
- Produces controller state/actions `isApiKeyRotationDialogOpen`, `isRotatingApiKey`, `openApiKeyRotationDialog`, `closeApiKeyRotationDialog`, `handleRotateApiKey`.
- `GatewayCredentialsCard` shows Rotate only for authenticated `generated` credentials.

- [x] **Step 1: Write failing frontend tests**

Added tests proving generated credentials expose Rotate, rotation requires confirmation, success renders the new key in the API-key input, and env-managed credentials hide the action.

- [x] **Step 2: Verify RED**

CI failed at the expected missing rotation API/UI before implementation.

- [x] **Step 3: Implement API client and confirmation dialog**

Added typed rotation response and the dashboard-session request. Built a focused confirmation dialog matching existing dashboard patterns and warning that external clients stop authenticating until updated.

- [x] **Step 4: Wire controller and credential card**

Successful rotation places only `result.apiKey` into current React state, reveals it through existing copy/reveal controls, and never writes it to browser storage. The current browser session remains active.

- [x] **Step 5: Run frontend tests to GREEN**

Covered by repository CI `Check, Test, Build Core and Docs`.

### Task 3: Documentation and release verification

**Files:**
- Create: `docs/src/components/docs/ApiKeyRotationDoc.astro`
- Modify: `docs/src/pages/en/docs/[slug].astro`
- Create: `docs/src/pages/id/docs/api-key-rotation.astro`
- Modify: `docs/src/layouts/DocsLayout.astro`

**Interfaces:**
- Public English and Indonesian docs explain that generated keys are shown once and can be rotated without re-pairing WhatsApp.
- Public docs explicitly state dependent clients must replace the old Bearer key.

- [x] **Step 1: Update public credential documentation**

Published a bilingual rotation guide and linked it from the documentation navigation.

- [x] **Step 2: Run repository verification**

CI runs formatting/lint, the full test suite, core builds, documentation build, Docker persistence/rollback smoke, native ARM64 Docker build, and CodeQL.

- [x] **Step 3: Review diff for secret-safety and scope**

Changed-file review confirms no plaintext-key persistence, no replacement-key logging, no local/session storage use, no unrelated refactor, and no WhatsApp auth/binding mutation.

- [ ] **Step 4: Merge after mandatory CI is green**

Review final CI on the latest head, update the PR summary, squash merge to `main`, and delete the task branch when tooling permits.
