# Modular Monolith Refactor Implementation Plan

> **Execution mode:** inline in this ChatGPT session. One branch only: `refactor/modular-monolith-structure`. Never merge until the user explicitly requests merge.

**Goal:** Refactor Wago incrementally into a pragmatic feature-first modular monolith with clear ownership, lower coupling, and smaller hotspots while preserving runtime behavior and avoiding enterprise-layer ceremony.

**Architecture:** Keep Express + TypeScript + SQLite + Baileys + React/Vite. Refactor one module at a time using architecture tests as structural RED gates plus existing behavior tests as contract characterization. A phase must be green before the next phase starts.

**Tech Stack:** Node.js 26, TypeScript, Express 5, `node:sqlite`, Baileys, React, Vite, Vitest, Biome, pnpm, Docker.

## Global Constraints

- Use only `refactor/modular-monolith-structure` for the full refactor.
- Never merge until the user explicitly says to merge.
- TDD is mandatory: RED -> verify intended failure -> minimal GREEN -> verify focused/full relevant tests -> refactor while green.
- Refactor per module; do not perform a big-bang tree move.
- Preserve public HTTP contracts, persistence semantics, security controls, and Baileys auth compatibility.
- Prefer direct imports and small factories over DI frameworks or generic repository/service hierarchies.
- Do not add new architecture/state-management infrastructure unless current code proves it necessary.
- Do not combine unrelated product behavior changes with this branch.

---

### Task 1: Establish architecture boundary tests and untangle access/config core

**Files:**
- Create: `backend/src/architecture/config-boundary.test.ts`
- Create: `backend/src/config/env.ts`
- Create: `backend/src/modules/access/app-settings-store.ts`
- Create: `backend/src/modules/access/api-key.ts`
- Move/replace incrementally: `backend/src/auth/browser-session-store.ts` -> `backend/src/modules/access/browser-session-store.ts`
- Modify: `backend/src/config/index.ts`
- Modify consumers currently importing access state through `config/index.ts`, especially `backend/src/middleware/auth.ts`, `backend/src/routes/app.routes.ts`, and `backend/src/infrastructure/logger.ts`
- Modify relevant tests: `backend/src/config/bootstrap.test.ts`, `backend/src/api-key-rotation.test.ts`, `backend/src/app.browser-session.test.ts`, `backend/src/app.test.ts`

**Interfaces:**
- `config/env.ts` produces pure runtime/environment values and must not import `infrastructure`, `modules`, `webhooks`, or SQLite.
- `modules/access/app-settings-store.ts` owns persisted `app_settings` reads/writes.
- `modules/access/api-key.ts` produces `getAccessState()`, `isSetupTokenValid(candidate)`, `bootstrapApiKey(requestedApiKey?)`, `rotateGeneratedApiKey()`, and API-key validation/hash behavior.
- Existing HTTP response shapes and API-key persistence format remain unchanged.

- [ ] **Step 1.1: RED — add config purity architecture test**

Create a Vitest test that recursively reads production `.ts` files under `src/config` and fails when a config file imports feature/persistence code. The forbidden import fragments are `../infrastructure`, `../modules`, `../webhooks`, and `node:sqlite`.

The test must report offending file/import pairs so the failure is diagnostic.

- [ ] **Step 1.2: Verify RED**

Run `pnpm --dir backend test -- src/architecture/config-boundary.test.ts`.

Expected failure: current `src/config/index.ts` imports `../infrastructure/database.js` and `../webhooks/settings-store.js`.

When using GitHub-only execution, create/update the draft PR solely to trigger CI and verify the RED failure before writing production refactor code.

- [ ] **Step 1.3: GREEN — extract pure env/runtime config**

Move environment-only values from `config/index.ts` to `config/env.ts`: node environment, setup-token raw validation, cookie names/security, session max age, body limit, runtime directories, frontend directory, request logging, proxy flag, country code, and log level.

Do not import SQLite or feature stores from `env.ts`.

- [ ] **Step 1.4: GREEN — extract persisted app settings and API-key lifecycle**

Move `app_settings` SQL and API-key bootstrap/rotation state into `modules/access`. Keep SHA-256 persistence format and generated key format unchanged. Keep setup-token constant-time validation.

Update auth/routes consumers to depend on the access module instead of mutating `config` as a state bag.

- [ ] **Step 1.5: GREEN — move browser-session store into access ownership**

Relocate the browser-session store to `modules/access/browser-session-store.ts`, update imports, and preserve current session TTL/revocation behavior.

- [ ] **Step 1.6: Verify focused GREEN**

Run access/config/auth focused tests including config bootstrap, API-key rotation, browser sessions, app routes, and the architecture boundary test.

- [ ] **Step 1.7: Verify phase GREEN**

Run backend full tests and backend build. Do not start Task 2 while either fails.

- [ ] **Step 1.8: Commit a meaningful Phase 1 checkpoint**

Commit only after the access/config boundary is green.

---

### Task 2: Normalize HTTP middleware ownership

**Files:**
- Create/move into: `backend/src/http/middleware/auth.ts`
- Create/move into: `backend/src/http/middleware/origin.ts`
- Create/move into: `backend/src/http/middleware/rate-limit.ts`
- Create/move into: `backend/src/http/middleware/request-logger.ts`
- Keep: `backend/src/http/middleware/async-handler.ts`
- Keep: `backend/src/http/middleware/error-handler.ts`
- Remove after consumers migrate: `backend/src/http/error-handler.ts`
- Remove after consumers migrate: legacy `backend/src/middleware/*`
- Create/update: `backend/src/architecture/http-boundary.test.ts`

**Interfaces:**
- HTTP middleware owns request transport/auth/origin/rate limiting only.
- Business policy and persistence must not move into `http`.

- [ ] **Step 2.1: RED — assert one middleware namespace**

Add an architecture test that fails while production imports still reference `src/middleware/*` or the compatibility alias `src/http/error-handler.ts` exists as an active production surface.

- [ ] **Step 2.2: Verify RED**

Run the focused architecture test and confirm the failure names real legacy imports.

- [ ] **Step 2.3: GREEN — move middleware one file at a time**

Move auth, origin, rate-limit, then request-logger, updating consumers after each move and running focused tests after each file.

- [ ] **Step 2.4: GREEN — remove dead error-handler alias**

Delete the alias only after search confirms no production/test consumer requires it.

- [ ] **Step 2.5: Verify phase GREEN**

Run middleware tests, HTTP contract tests, full backend tests, and backend build.

---

### Task 3: Consolidate and split WhatsApp core

**Files:**
- Create: `backend/src/architecture/whatsapp-boundary.test.ts`
- Consolidate under: `backend/src/modules/whatsapp/`
- Create: `backend/src/modules/whatsapp/index.ts`
- Create: `backend/src/modules/whatsapp/socket-events.ts`
- Create: `backend/src/modules/whatsapp/credential-writer.ts`
- Keep focused: `backend/src/modules/whatsapp/lifecycle.ts`
- Move existing WhatsApp-owned stores/helpers from `backend/src/whatsapp/*`
- Remove after migration: root `backend/src/whatsapp.ts`

**Interfaces:**
- `modules/whatsapp/index.ts` is the narrow public backend API for WhatsApp behavior.
- `lifecycle.ts` owns initialize/resume/pair/rebind/shutdown orchestration.
- `socket-events.ts` wires Baileys socket events and delegates state transitions.
- `credential-writer.ts` serializes `saveCreds` calls and updates credential-persistence health.

- [ ] **Step 3.1: RED — enforce one WhatsApp ownership root**

Add an architecture test that fails while production files outside `modules/whatsapp` import from the legacy `whatsapp/` directory or root `whatsapp.ts` facade.

- [ ] **Step 3.2: Verify RED**

Confirm the test fails on current legacy imports.

- [ ] **Step 3.3: GREEN — move low-risk state/store helpers first**

Move binding, connection state, credential persistence health, disconnect classifier, message status, recent message, recipient cache, reconnect state, account health, rejection mapping, and version resolution under the module without changing behavior.

Run their existing focused tests after each coherent move group.

- [ ] **Step 3.4: RED — characterize lifecycle event responsibilities before extraction**

Extend lifecycle tests so credential update serialization, message status transitions, terminal disconnect handling, and reconnect behavior are covered before extracting event wiring.

- [ ] **Step 3.5: GREEN — extract credential writer**

Move the credential write queue/audit-health behavior into `credential-writer.ts`; preserve queue ordering and degraded/healthy transitions.

- [ ] **Step 3.6: GREEN — extract socket event wiring**

Move Baileys `creds.update`, `messages.update`, and `connection.update` registration/handling into `socket-events.ts`. Keep lifecycle orchestration readable and explicit.

- [ ] **Step 3.7: GREEN — replace root facade with module index**

Update consumers to import the narrow public module API and remove `src/whatsapp.ts` only after search confirms no remaining consumer.

- [ ] **Step 3.8: Verify phase GREEN**

Run all WhatsApp tests, message-service tests, HTTP WhatsApp route tests, full backend tests, backend build, and relevant container smoke if lifecycle semantics changed materially.

---

### Task 4: Consolidate messages and outbound policy

**Files:**
- Create/update: `backend/src/architecture/messages-boundary.test.ts`
- Move: `backend/src/routes/message.routes.ts` -> `backend/src/modules/messages/routes.ts`
- Keep: `backend/src/modules/messages/message.service.ts` (rename to `service.ts` only if it reduces naming noise without breaking clarity)
- Move: `backend/src/policy/outbound-policy.ts` -> `backend/src/modules/messages/outbound-policy.ts`
- Move: `backend/src/policy/outbound-policy-store.ts` -> `backend/src/modules/messages/outbound-policy-store.ts`

**Interfaces:**
- Messages module owns outbound send orchestration and outbound safety policy.
- Do not split the policy into additional layers unless tests reveal a concrete independent responsibility.

- [ ] **Step 4.1: RED — assert message/policy ownership**
- [ ] **Step 4.2: Verify RED**
- [ ] **Step 4.3: GREEN — move routes/service imports**
- [ ] **Step 4.4: GREEN — move cohesive outbound policy/store together**
- [ ] **Step 4.5: Verify policy, sender, route, full backend tests/build**

---

### Task 5: Consolidate webhooks

**Files:**
- Create/update: `backend/src/architecture/webhooks-boundary.test.ts`
- Move: `backend/src/routes/webhook.routes.ts` -> `backend/src/modules/webhooks/routes.ts`
- Move existing `backend/src/webhooks/*` into `backend/src/modules/webhooks/*`

**Interfaces:**
- Preserve `createWebhookDeliveryStore(database)` and `createWebhookSettingsStore(database)` where explicit database injection provides useful test isolation.
- Preserve delivery IDs, retry semantics, redelivery semantics, signatures, and at-least-once contract.

- [ ] **Step 5.1: RED — assert one webhook module ownership root**
- [ ] **Step 5.2: Verify RED**
- [ ] **Step 5.3: GREEN — move settings/store/core first**
- [ ] **Step 5.4: GREEN — move worker/delivery facade/routes**
- [ ] **Step 5.5: Verify webhook focused tests, full backend tests/build**

---

### Task 6: Consolidate activity and recipients

**Files:**
- Move `backend/src/activity/*` -> `backend/src/modules/activity/*`
- Move `backend/src/routes/activity.routes.ts` -> `backend/src/modules/activity/routes.ts`
- Move `backend/src/recipients/*` -> `backend/src/modules/recipients/*`
- Move `backend/src/routes/recipient.routes.ts` -> `backend/src/modules/recipients/routes.ts`
- Create/update architecture tests for both module ownership boundaries.

- [ ] **Step 6.1: RED — assert activity ownership**
- [ ] **Step 6.2: GREEN — migrate activity and verify focused tests**
- [ ] **Step 6.3: RED — assert recipients ownership**
- [ ] **Step 6.4: GREEN — migrate recipients and verify focused tests**
- [ ] **Step 6.5: Verify full backend tests/build and remove empty legacy directories**

---

### Task 7: Refactor frontend API and dashboard orchestration incrementally

**Files:**
- Create: `frontend/src/shared/api/client.ts`
- Create feature API files under `frontend/src/features/{gateway,whatsapp,messages,recipients,activity,settings}/api.ts`
- Move feature-owned response/input types beside their feature APIs
- Modify: `frontend/src/features/dashboard/readiness-state.ts`
- Modify: `frontend/src/features/dashboard/useDashboardSnapshot.ts`
- Split focused controller concerns from `frontend/src/features/dashboard/useDashboardController.ts`
- Remove root `frontend/src/api.ts` only after all consumers migrate

**Interfaces:**
- Shared API client owns base URL, credentials, JSON/text transport, and normalized HTTP error behavior only.
- Feature APIs own endpoint paths and feature contracts.
- Dashboard owns one polling scheduler.
- Keep local React state and focused hooks; add no state/query library.

- [ ] **Step 7.1: RED — architecture test asserts feature code no longer depends on root god API after migration target is declared**
- [ ] **Step 7.2: GREEN — extract shared HTTP client without changing endpoint behavior**
- [ ] **Step 7.3: GREEN — migrate one feature API at a time, running its tests after each move**
- [ ] **Step 7.4: RED — add dashboard test proving readiness refresh follows dashboard refresh lifecycle rather than an independent interval**
- [ ] **Step 7.5: GREEN — fold readiness into snapshot polling and simplify banner to render supplied/current snapshot state**
- [ ] **Step 7.6: RED/GREEN — split access and pairing actions from the dashboard controller while preserving UI behavior tests**
- [ ] **Step 7.7: Verify full frontend tests/build**

---

### Task 8: Remove proven dead compatibility and repository noise

**Files:**
- Evaluate/remove: `backend/src/infrastructure/persistence.ts`
- Remove no-op compatibility exports only when search proves they have no required consumers
- Modify: `.gitignore`
- Untrack generated `docs/.astro/*` files if they are confirmed generated-only
- Evaluate package-local pnpm workspace/lockfiles and Dockerfile together; perform only if the branch remains simpler and container build semantics stay deterministic

- [ ] **Step 8.1: RED — add only meaningful guard tests for dead compatibility that could regress architecture; do not test file-count aesthetics**
- [ ] **Step 8.2: GREEN — delete confirmed dead aliases/no-op surfaces**
- [ ] **Step 8.3: GREEN — ignore/untrack generated Astro state**
- [ ] **Step 8.4: Decide package-manager cleanup using measured dependency/install behavior; skip if payoff is not clear**
- [ ] **Step 8.5: Final verification**

Final commands/gates before asking the user what to do with the branch:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm --dir backend test
pnpm --dir backend run build
pnpm --dir frontend test
pnpm --dir frontend run build
pnpm run build:docs
docker build .
bash scripts/smoke-container.sh
```

The branch must remain unmerged after all gates pass. Final response must report branch/head status and wait for explicit merge authorization.
