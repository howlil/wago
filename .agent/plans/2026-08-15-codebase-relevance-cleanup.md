# Codebase Relevance Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove proven obsolete Wago code and stale current-state documentation while preserving upgrade compatibility and production persistence guarantees.

**Architecture:** Keep Wago as the existing single-process modular monolith. Remove only wrappers that no longer perform work after the SQLite migration, keep real compatibility import/cleanup boundaries, and keep liveness/readiness separate. Persistence deployment metadata must not turn anonymous Docker volumes into an accidental substitute for orchestrator-owned durable storage.

**Tech Stack:** Node.js 26, TypeScript, Express 5, `node:sqlite`, Baileys 7 RC, React/Vite, Vitest, Docker/Compose, GitHub Actions/GHCR.

## Global Constraints

- Wago remains single-account and single-active-instance.
- Production must fail closed when `/app/data` is not backed by a deliberate persistent mount.
- Do not delete legacy JSON import, legacy webhook environment import, or legacy cookie cleanup.
- Do not collapse `/health` and `/ready`; they have distinct liveness/readiness semantics.
- Released SQLite migrations remain append-only.
- No new runtime dependency, datastore, worker framework, or abstraction layer.
- Behavior changes follow TDD: regression first, minimal implementation, then focused/full verification.
- One task branch, one PR, squash merge after gates are green.

---

### Task 1: Remove No-op Shutdown Persistence Plumbing

**Files:**
- Modify: `backend/src/app/lifecycle.ts`
- Modify: `backend/src/app/lifecycle.test.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/policy/outbound-policy.ts`
- Modify: `backend/src/policy/outbound-policy-store.ts`
- Modify: `backend/src/activity/store.ts`
- Modify: `backend/src/recipients/store.ts`
- Delete: `backend/src/infrastructure/persistence.ts`

**Interfaces:**
- `ApplicationLifecycleDeps` no longer exposes `flushOutboundPolicyPersistence`.
- Shutdown order becomes webhook stop → WhatsApp shutdown → lease heartbeat stop → lease release → SQLite checkpoint → SQLite close.
- SQLite-backed stores expose only operations with real behavior.

- [ ] **Step 1: Change the lifecycle test first.** Remove the fake `policy.flush` dependency/event and assert the new deterministic shutdown sequence.

```ts
expect(events).toEqual([
  "webhook.stop",
  "whatsapp.shutdown",
  "lease.heartbeat.stop",
  "lease.release",
  "database.checkpoint",
  "database.close",
]);
```

- [ ] **Step 2: Verify the focused test would fail against the old lifecycle contract.**

Run: `pnpm --dir backend test -- src/app/lifecycle.test.ts`

Expected before implementation: TypeScript/test mismatch because the implementation still expects `flushOutboundPolicyPersistence` and emits the old step.

- [ ] **Step 3: Remove the lifecycle flush dependency and call.** Keep all real shutdown operations and ordering unchanged.

- [ ] **Step 4: Remove dead SQLite flush wrappers.** Delete `flushActivityStore`, `flushRecipientStore`, `flushOutboundPolicyStore`, `flushOutboundPolicyPersistence`, and the unreferenced `backend/src/infrastructure/persistence.ts` aggregator when repository search confirms no remaining consumer.

- [ ] **Step 5: Simplify test-only outbound restart helper.** Remove the no-op `forgetOutboundPolicyMemoryForTest` store proxy; retain the public test helper only if tests still need it for account-health reset semantics.

- [ ] **Step 6: Run focused backend tests.**

Run: `pnpm --dir backend test -- src/app/lifecycle.test.ts src/policy/outbound-policy-persistence.test.ts src/policy/outbound-policy.test.ts`

Expected: PASS.

---

### Task 2: Keep Real Compatibility Boundaries Explicit

**Files:**
- Review only unless a naming/comment correction is required: `backend/src/infrastructure/legacy-json-import.ts`
- Review only unless a naming/comment correction is required: `backend/src/config/webhook-config.ts`
- Review only unless a naming/comment correction is required: `backend/src/routes/app.routes.ts`
- Modify current-state docs only where wording incorrectly calls these paths primary behavior.

**Interfaces:**
- Legacy JSON import remains a one-time SQLite migration path.
- `WEBHOOK_URL`, `WEBHOOK_SECRET`, and `WEBHOOK_SECRET_PREVIOUS` remain one-time compatibility inputs when persisted webhook settings are absent.
- `wa_gateway_api_key` remains cleanup-only and is never used as current authentication state.

- [ ] **Step 1: Confirm consumers with repository search.** Do not delete any compatibility path that still has a startup/browser migration consumer.

- [ ] **Step 2: Update comments/docs only if needed.** Label compatibility behavior explicitly as migration/cleanup so future cleanup passes do not mistake it for dead code.

- [ ] **Step 3: Run bootstrap/session/webhook regressions.**

Run: `pnpm --dir backend test -- src/app.browser-session.test.ts src/config/webhook-config.test.ts src/webhooks/settings-store.test.ts src/infrastructure/legacy-json-import.test.ts`

Expected: PASS.

---

### Task 3: Preserve Liveness/Readiness Separation and Remove Only Proven Frontend Duplication

**Files:**
- Review: `frontend/src/features/dashboard/useDashboardSnapshot.ts`
- Review: `frontend/src/features/dashboard/OperationalReadinessBanner.tsx`
- Review: `frontend/src/features/dashboard/readiness-state.ts`
- Modify only if a branch has no distinct behavior/consumer.

**Interfaces:**
- `/health` answers process/backend reachability.
- `/ready` answers `ok | degraded | not_ready` operational state.

- [ ] **Step 1: Characterize current behavior through existing frontend/backend tests.** Keep two requests if they drive distinct UI states.

- [ ] **Step 2: Remove no code unless search/tests prove it is redundant.** This task is allowed to finish with no runtime diff.

- [ ] **Step 3: Run dashboard/readiness tests.**

Run: `pnpm --dir frontend test`

Run: `pnpm --dir backend test -- src/modules/gateway/readiness.test.ts src/app.test.ts`

Expected: PASS.

---

### Task 4: Align Current Documentation and Roadmap

**Files:**
- Modify: `plan.md`
- Modify: `README.md` only if current top-level deployment wording is stale.
- Modify: `docs/src/components/docs/DeploymentDoc.astro`
- Modify: `docs/src/components/docs/ConfigurationDoc.astro` only where current behavior differs.

**Interfaces:**
- Current docs must say shutdown relies on SQLite checkpoint/close, not fake store flushes.
- Historical `.agent` plans/checkpoints remain historical records.
- Production deployment must explicitly attach stable `/app/data` storage.

- [ ] **Step 1: Remove stale roadmap items already completed.** In particular, Milestone 5 must not remain `planned` if the actual codebase already contains the listed outbound controls; replace it with an accurate completed/remaining status supported by current code.

- [ ] **Step 2: Clarify compatibility wording.** Legacy webhook env and JSON import are upgrade paths, not primary configuration/storage paths.

- [ ] **Step 3: Keep persistence warning explicit.** Do not recommend disabling `PERSISTENT_DATA_REQUIRED` or relying on disposable container state.

- [ ] **Step 4: Build docs.**

Run: `pnpm run build:docs`

Expected: PASS.

---

### Task 5: Verify Deployment Contract Without Weakening the Guard

**Files:**
- Review: `Dockerfile`
- Review: `docker-compose.yml`
- Review: `scripts/smoke-container.sh`
- External follow-up if required: MyPaaS image persistence discovery.

**Interfaces:**
- Stock Compose continues to mount `wago_data:/app/data`.
- Generic production `docker run` without an explicit mount must still fail.
- Any MyPaaS auto-persistence integration must attach a deterministic stable volume without changing that generic negative guarantee.

- [ ] **Step 1: Keep the existing negative smoke contract.** Do not add a Dockerfile `VOLUME /app/data` if it makes bare `docker run` silently receive an anonymous volume and pass the guard.

- [ ] **Step 2: If MyPaaS still discovers only Docker `Config.Volumes`, treat that as a platform integration gap rather than weakening Wago.** Implement the platform-side metadata extension in its own repository/PR if write access and tests support it.

- [ ] **Step 3: Run container smoke in CI.**

Run: `bash scripts/smoke-container.sh`

Expected: no-mount production run fails; explicit named-volume runs pass and persist state.

---

### Task 6: Full Verification and Merge

**Files:**
- No new scope; fixes remain on this branch.

- [ ] **Step 1: Run repository gates.**

Run: `pnpm run check`

Run: `pnpm test`

Run: `pnpm build`

Run: `pnpm run build:docs`

Run: `bash scripts/smoke-container.sh`

- [ ] **Step 2: Open one PR and inspect the complete diff.** Ensure only proven cleanup/current-state corrections are present.

- [ ] **Step 3: Verify GitHub Actions/CodeQL on the current head.** Re-run/fix on the same branch if required.

- [ ] **Step 4: Squash merge only after the current PR head is green.**

## Plan Self-Review

- Coverage: obsolete no-op persistence plumbing, compatibility boundaries, liveness/readiness, current docs/roadmap, and persistence deployment contract are all explicitly covered.
- Scope: no speculative architecture change or dependency update is included.
- Compatibility: JSON import, webhook env import, and legacy cookie cleanup are explicitly protected from deletion.
- Persistence: the plan explicitly forbids weakening the generic no-mount production failure.
- Placeholder scan: no deferred implementation placeholders remain.
