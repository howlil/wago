# Webhook Settings and Operator UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move webhook configuration into SQLite-backed runtime settings exposed in the Wago dashboard, and simplify the operator UI/design system including automatic Audit Log filters.

**Architecture:** Add a singleton webhook-settings store on top of SQLite migration v6, import legacy webhook env values once when no persisted row exists, and have webhook delivery resolve current settings dynamically per attempt. Add authenticated settings endpoints and a Settings page, then normalize shared UI classes/radius/elevation and redesign Audit Log into an operational table/list with immediate filters and debounced search.

**Tech Stack:** Node.js/TypeScript, Express, node:sqlite, Vitest/Supertest, React, Tailwind CSS v4, Testing Library, pnpm, Docker/GitHub Actions.

## Global Constraints

- SQLite is the authoritative webhook configuration after first persisted configuration.
- Raw webhook secrets are never returned by normal GET endpoints.
- First configuration and rotation may return a newly generated secret exactly in that mutation response.
- Bearer API-key integrations and browser-session authentication must remain compatible.
- Existing webhook outbox/retry/redelivery semantics must not regress.
- Base cards/buttons have no shadows, no hover lift, and no gradient navigation state.
- Standard card radius is 8 px; standard control radius is 6 px.
- Audit filters have no Apply button; selects update immediately and search uses ~300 ms debounce.
- Agent-only design/plan artifacts stay under `.agent/`.

---

### Task 1: Persist webhook settings and import legacy env

**Files:**
- Modify: `backend/src/infrastructure/database/migrations.ts`
- Create: `backend/src/webhooks/settings-store.ts`
- Create: `backend/src/webhooks/settings-store.test.ts`
- Modify: `backend/src/config/index.ts`
- Modify: `backend/src/config/webhook-config.ts`
- Modify: existing migration tests/smoke expectations for v6

**Interfaces:**
- Produces `WebhookSettings` and `createWebhookSettingsStore(database)` with `get()`, `save()`, `rotateSecret()`, `completeRotation()`, and `importLegacyIfEmpty()`.
- Persists singleton row `id=1` with enabled/url/secret/previous_secret timestamps.

- [ ] Write failing tests proving migration v6 creates storage, normal reads return persisted values, first legacy import occurs only with empty storage, and persisted settings win over env.
- [ ] Run focused backend tests and confirm RED because migration/store do not exist.
- [ ] Add migration v6 and minimal settings store with URL/secret validation reuse.
- [ ] Refactor startup config so webhook env values are parsed only for legacy import and runtime webhook config is no longer frozen in `config`.
- [ ] Run focused tests and migration smoke expectations; confirm GREEN.

### Task 2: Make webhook delivery runtime-configurable

**Files:**
- Modify: `backend/src/webhooks/delivery-webhook.ts`
- Modify: `backend/src/webhooks/delivery-worker.ts` only if dependency boundary needs dynamic sender resolution
- Create/modify: webhook delivery unit tests

**Interfaces:**
- Delivery processing obtains current persisted settings for each attempt/batch.
- Existing delivery store and retry state remain unchanged.

- [ ] Write failing test: configure URL A, create worker, update persisted settings to URL B, then assert the subsequent attempt uses B without recreating the process/worker.
- [ ] Write failing test: disabling persisted webhook settings prevents new webhook enqueue/delivery work.
- [ ] Run focused tests and confirm RED against startup-frozen sender behavior.
- [ ] Refactor sender resolution to use the current settings store while preserving worker retry logic.
- [ ] Run webhook test suite and confirm GREEN.

### Task 3: Add authenticated webhook settings API

**Files:**
- Modify: `backend/src/routes/webhook.routes.ts`
- Create/modify: `backend/src/webhook-settings.test.ts` or route-focused tests

**Interfaces:**
- `GET /webhooks/settings`
- `PUT /webhooks/settings`
- `POST /webhooks/settings/rotate-secret`
- `POST /webhooks/settings/complete-rotation`

- [ ] Write failing Supertest cases for safe GET response, first-enable secret generation, invalid URL rejection, non-rotating URL edit, rotate, and complete rotation.
- [ ] Run tests and confirm RED because routes are missing.
- [ ] Implement route handlers using existing `requireApiKey` middleware and same-origin protection already applied globally.
- [ ] Ensure GET omits `secret` and `previousSecret`; mutations expose `generatedSecret` only when newly created.
- [ ] Run route tests and full backend tests; confirm GREEN.

### Task 4: Add frontend settings API and Settings workspace

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/shared/layout/AppSidebar.tsx`
- Create: `frontend/src/features/settings/SettingsPage.tsx`
- Create: `frontend/src/features/settings/WebhookSettingsCard.tsx`
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx`
- Modify: relevant frontend tests

**Interfaces:**
- `getWebhookSettings()`
- `updateWebhookSettings({enabled,url})`
- `rotateWebhookSecret()`
- `completeWebhookSecretRotation()`

- [ ] Write failing UI tests that `/settings` renders credentials + webhook configuration, Control no longer renders credentials, and sidebar contains Settings.
- [ ] Write failing webhook card tests for save, one-time generated secret display/copy, rotate, and complete rotation state.
- [ ] Run frontend tests and confirm RED.
- [ ] Add API types/functions, Settings route/page/card, and move `GatewayCredentialsCard` out of Control.
- [ ] Run focused frontend tests and confirm GREEN.

### Task 5: Normalize design system and sidebar geometry

**Files:**
- Modify: `frontend/src/shared/ui/classes.ts`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/shared/layout/AppBrand.tsx`
- Modify: `frontend/src/shared/layout/AppHeader.tsx`
- Modify: `frontend/src/shared/layout/AppSidebar.tsx`
- Modify: dashboard/WhatsApp/message/recipient cards that still hardcode inconsistent radius/shadow classes
- Modify/create: design-system regression tests

**Interfaces:**
- Shared `cardClass`, `inputClass`, `primaryButtonClass`, `secondaryButtonClass`, `dangerButtonClass` become the source of truth for standard geometry/elevation.

- [ ] Write regression tests/assertions that base classes contain `rounded-lg` for cards, `rounded-md` for controls, and no `shadow`, `translate-y`, or gradient classes.
- [ ] Add collapsed sidebar test that navigation anchors have fixed `h-10 w-10` centered geometry.
- [ ] Run tests and confirm RED against current decorative styles.
- [ ] Remove canvas radial gradients, card/button shadows, hover lift, gradient navigation state, excessive radius variants, and gradient/shadow brand mark.
- [ ] Keep shadow only for overlays/mobile drawer/modal.
- [ ] Run frontend tests and build; confirm GREEN.

### Task 6: Redesign Audit Log and automatic filters

**Files:**
- Modify: `frontend/src/features/activity/useActivityLog.ts`
- Modify: `frontend/src/features/activity/ActivityLogPanel.tsx`
- Modify: `frontend/src/features/activity/ActivityEventList.tsx`
- Modify: `frontend/src/features/activity/AuditPage.test.tsx`

**Interfaces:**
- Select filters update query immediately.
- Search query updates after ~300 ms debounce.
- No `applyFilters()` public hook method and no Apply button.

- [ ] Write failing tests that changing Source/Category/Level triggers filtering without submit and that no `Apply filters` button exists.
- [ ] Write fake-timer test proving search does not request immediately but does after ~300 ms.
- [ ] Run focused tests and confirm RED.
- [ ] Refactor hook to derive/update query from filter state with debounced search and reset pagination on changes.
- [ ] Replace event mini-card feed with compact row/table semantics and one restrained severity treatment.
- [ ] Run activity tests and confirm GREEN.

### Task 7: Documentation and release verification

**Files:**
- Modify: `README.md`
- Modify: `SECURITY.md`
- Modify: public docs configuration/API files referencing webhook env configuration
- Modify: CI/container expected migration versions from `[1,2,3,4,5]` to `[1,2,3,4,5,6]`
- Modify: changelog if applicable

- [ ] Update documentation: dashboard Settings is primary webhook workflow; env variables are legacy/bootstrap compatibility.
- [ ] Update endpoint catalog/API explorer with webhook settings endpoints.
- [ ] Run `pnpm check`, `pnpm test`, `pnpm build:core`, and docs build/tests.
- [ ] Run Docker persistence/rollback smoke with migration v6 and verify native ARM64 build through CI.
- [ ] Run CodeQL and Release Container checks on the exact final PR head.
- [ ] Squash merge the single task PR into `main` only after mandatory checks are green, then verify `main` CI/Docs/CodeQL/Release Container on the squash SHA.
