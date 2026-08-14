# Production State Reliability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Wago fail safely around persistent storage, preserve operator access when WhatsApp state is damaged, prevent concurrent gateway ownership, harden first-run/API-key/session security, and make container release/health behavior truthful.

**Architecture:** Keep the existing single-process, single-account, SQLite + Baileys filesystem design. Harden the boundaries instead of adding distributed infrastructure: production requires a real mount backing `/app/data`; SQLite owns a short-lived single-instance lease; WhatsApp resume failures degrade the WhatsApp subsystem instead of killing the HTTP control plane; API/session mutations remain local and SQLite-backed; release tags become deterministic. Do not add Redis, PostgreSQL, external queues, multi-session support, or a second persistence system.

**Tech Stack:** Node.js 26, TypeScript, Express 5, `node:sqlite`, Baileys 7 RC, React/Vite, Vitest, Docker/Compose, GitHub Actions/GHCR.

## Global Constraints

- Wago remains single-account and single-active-instance.
- `/app/data/wago.db`, SQLite WAL/SHM files, `/app/data/auth`, webhook signing secrets, and browser-session hashes are secret-bearing state.
- Production must not silently run with `/app/data` on the container writable layer.
- Never persist QR values, raw API keys, browser tokens, message bodies, or arbitrary Baileys protocol payloads.
- Generated machine API keys remain hash-only in SQLite.
- Browser authentication remains an opaque HttpOnly cookie and stays separate from machine Bearer credentials.
- A damaged/missing Baileys session must not make the dashboard unavailable.
- Preserve the existing one-task/one-working-branch discipline and squash-merge normal tasks.
- Use TDD for behavior changes: regression RED first, minimal GREEN implementation, then focused/full verification.
- Avoid unrelated refactors and new runtime dependencies unless a task explicitly requires one.

---

## File Structure

### New focused modules

- `backend/src/infrastructure/data-mount.ts` — determine whether the production data directory is backed by a non-root mount and fail closed when it is ephemeral.
- `backend/src/infrastructure/data-mount.test.ts` — mountinfo parser and production policy regressions.
- `backend/src/infrastructure/instance-lease.ts` — SQLite-backed single-active-instance ownership with acquire/heartbeat/release.
- `backend/src/infrastructure/instance-lease.test.ts` — lease contention, expiry, heartbeat, and release regressions.
- `backend/src/whatsapp/credential-persistence-health.ts` — in-memory health state for Baileys credential writes.
- `backend/src/whatsapp/credential-persistence-health.test.ts` — failure/recovery state regressions.

### Existing files expected to change

- `backend/src/infrastructure/database.ts` — enforce production mount policy before opening SQLite.
- `backend/src/infrastructure/database/migrations.ts` — add the instance-lease migration.
- `backend/src/app/lifecycle.ts` and `backend/src/app/lifecycle.test.ts` — acquire/release instance ownership and keep startup/shutdown ordering deterministic.
- `backend/src/modules/whatsapp/lifecycle.ts` and its tests — degrade startup on broken persisted auth and publish credential-write health.
- `backend/src/auth/browser-session-store.ts` — revoke other/all browser sessions safely.
- `backend/src/config/index.ts` — production setup-token policy and generated-key/session security helpers without persisting raw secrets.
- `backend/src/middleware/auth.ts` — preserve DB-backed credential validation contract.
- `backend/src/routes/app.routes.ts` and browser-session/API-key tests — secure bootstrap, rotation, and session invalidation behavior.
- `backend/src/modules/gateway/readiness.ts` and tests — truthful `ok`/`degraded`/`not_ready` state.
- `backend/src/app.ts` — return 503 only for a genuinely unusable control plane while keeping `/health` as liveness.
- `frontend/src/api.ts`, dashboard controller/snapshot components and tests — render degraded operational state without exposing secrets.
- `.github/workflows/release-container.yml` — deterministic `latest`, `main`, SHA, and semver publication.
- `scripts/smoke-container.sh` — ephemeral-storage rejection, replacement persistence, and shared-volume single-instance tests.
- `README.md`, `docs/src/components/docs/DeploymentDoc.astro`, `OperationsDoc.astro`, `ConfigurationDoc.astro`, `ApiKeyRotationDoc.astro`, and API docs where needed — deployment, security, webhook delivery, backup/restore contracts.

---

### Task 1: Fail Closed on Ephemeral Production Storage

**Files:**
- Create: `backend/src/infrastructure/data-mount.ts`
- Create: `backend/src/infrastructure/data-mount.test.ts`
- Modify: `backend/src/infrastructure/database.ts`
- Modify: `scripts/smoke-container.sh`
- Modify: `docs/src/components/docs/DeploymentDoc.astro`
- Modify: `docs/src/components/docs/OperationsDoc.astro`

**Interfaces:**
- Produces: `inspectDataMount(mountInfo: string, dataDirectory: string): DataMountInspection`
- Produces: `assertPersistentDataMount(options?: { nodeEnv?: string; dataDirectory?: string; mountInfoPath?: string }): DataMountInspection`
- `DataMountInspection` exposes `{ persistent: boolean; mountPoint: string; fsType: string | null }` and contains no secret data.

- [ ] **Step 1: Write parser/policy regressions.** Cover Linux mountinfo where `/app/data` is its own volume, where a persistent parent mount contains `/app/data`, where only `/` overlay backs it, and where non-production skips the fatal policy.

```ts
expect(inspectDataMount(volumeMountInfo, "/app/data")).toMatchObject({
  persistent: true,
  mountPoint: "/app/data",
});
expect(inspectDataMount(overlayOnlyMountInfo, "/app/data")).toMatchObject({
  persistent: false,
  mountPoint: "/",
});
```

- [ ] **Step 2: Run the focused test and verify RED.**

Run: `pnpm --dir backend test -- src/infrastructure/data-mount.test.ts`

Expected: FAIL because the module/policy does not exist.

- [ ] **Step 3: Implement the minimal mountinfo parser.** Decode mountpoint escapes, select the longest mountpoint that contains the configured data directory, and treat the root filesystem as ephemeral for production Wago state. No shelling out and no new package.

- [ ] **Step 4: Enforce the guard before `new DatabaseSync(...)`.** `database.ts` must call the production policy before `mkdirSync(dataDirectory)` or opening `wago.db`, so an image-mode deployment without a real mount cannot silently initialize disposable state.

- [ ] **Step 5: Extend container smoke coverage.** Add one negative container run without `-v ...:/app/data`; assert it exits non-zero and logs an actionable `PERSISTENT_DATA_REQUIRED` message. Keep the existing positive named-volume run unchanged.

- [ ] **Step 6: Add replacement persistence smoke coverage.** Stop and remove the first container, recreate a new container from the same image and named volume, and assert the same application identity/migrations survive. This must exercise container replacement, not just `docker restart`.

- [ ] **Step 7: Run focused and container tests.**

Run: `pnpm --dir backend test -- src/infrastructure/data-mount.test.ts src/infrastructure/database.test.ts`

Run: `bash scripts/smoke-container.sh`

Expected: production without a mount fails; named-volume replacement preserves state.

- [ ] **Step 8: Document the hard requirement.** State explicitly that GHCR/image deploys must mount durable storage at `/app/data`; `VOLUME` in an image is not accepted as a substitute for platform-managed stable storage identity.

**Acceptance criteria:**
- Production cannot boot on root overlay storage.
- Compose/named-volume deployment boots normally.
- Replacing the container while reusing the same volume retains Wago identity/state.
- Development/test environments remain easy to run.

---

### Task 2: Enforce One Active Wago Process per Persistent Volume

**Files:**
- Modify: `backend/src/infrastructure/database/migrations.ts`
- Create: `backend/src/infrastructure/instance-lease.ts`
- Create: `backend/src/infrastructure/instance-lease.test.ts`
- Modify: `backend/src/app/lifecycle.ts`
- Modify: `backend/src/app/lifecycle.test.ts`
- Modify: `backend/src/index.ts`
- Modify: `scripts/smoke-container.sh`
- Modify: `docs/src/components/docs/DeploymentDoc.astro`

**Interfaces:**
- Migration 7 creates singleton table `gateway_instance_lease(id, owner_id, acquired_at, heartbeat_at, expires_at)` with `CHECK (id = 1)`.
- Produces: `createInstanceLeaseManager(database, options)` with `acquire()`, `heartbeat()`, `release()`, `isOwner()`, `startHeartbeat()`, and `stopHeartbeat()`.
- Default lease TTL: 15 seconds. Default heartbeat: 5 seconds.

- [ ] **Step 1: Write lease RED tests.** Cover first acquisition, rejection while another unexpired owner exists, acquisition after expiry, heartbeat extension by the owner only, and release followed by immediate acquisition by another owner.

```ts
expect(first.acquire()).toEqual({ acquired: true });
expect(second.acquire()).toMatchObject({ acquired: false, reason: "LEASE_HELD" });
```

- [ ] **Step 2: Run focused test and verify RED.**

Run: `pnpm --dir backend test -- src/infrastructure/instance-lease.test.ts`

Expected: FAIL because the lease table/manager does not exist.

- [ ] **Step 3: Add migration 7.** Use SQLite transactions and integer epoch milliseconds. Do not create a general distributed-lock abstraction; this table exists only to protect the single Wago account/volume.

- [ ] **Step 4: Implement transactional acquire/heartbeat/release.** Acquisition must use an immediate transaction so two contenders cannot both observe an expired/free lease and win. Generate one owner UUID per process.

- [ ] **Step 5: Integrate lifecycle ordering.** Startup order becomes: acquire instance lease → start lease heartbeat → start webhook worker → resume WhatsApp. Shutdown order becomes: stop webhook worker → shutdown WhatsApp → flush policy → stop heartbeat → release lease → checkpoint/close DB.

- [ ] **Step 6: Fail startup with a typed/actionable error when the lease is held.** The process must exit before creating a Baileys socket or running webhook delivery. Log `WAGO_INSTANCE_ALREADY_ACTIVE` with no secrets.

- [ ] **Step 7: Add two-container smoke regression.** Start container A with the volume, then container B with the same volume. Assert A remains healthy and B exits/refuses activation with the instance-active error. Then stop A and assert a fresh B can start immediately after graceful lease release.

- [ ] **Step 8: Document deployment strategy.** Stateful Wago deployments must use single-replica/recreate semantics. Platforms that require overlapping old/new containers must be configured to stop the old Wago instance before the replacement becomes active.

**Acceptance criteria:**
- Two Wago processes cannot simultaneously own the same `/app/data` state.
- Graceful shutdown releases ownership immediately.
- Crash recovery is bounded by the 15-second lease TTL.
- No Redis/file-lock dependency is introduced.

---

### Task 3: Keep the Control Plane Available When Baileys Auth Is Broken

**Files:**
- Modify: `backend/src/modules/whatsapp/lifecycle.ts`
- Modify: `backend/src/modules/whatsapp/lifecycle.test.ts`
- Modify: `backend/src/whatsapp/lifecycle.contract.test.ts`
- Modify: `backend/src/app/lifecycle.test.ts`

**Interfaces:**
- `resumeWhatsAppSession(): Promise<void>` remains callable by application lifecycle but must absorb persisted-session initialization failures after recording a degraded state.
- Broken auth remains on disk until an explicit rebind; Wago must not auto-delete potentially diagnosable credentials.

- [ ] **Step 1: Add a RED regression for corrupt persisted auth.** Simulate `creds.json` being present while Baileys initialization throws a parse/auth-state error. Assert application startup resolves, WhatsApp is disconnected, active socket is absent, and an audit event `baileys.session.resume_failed` is recorded.

- [ ] **Step 2: Run focused tests and verify RED.**

Run: `pnpm --dir backend test -- src/modules/whatsapp/lifecycle.test.ts src/whatsapp/lifecycle.contract.test.ts src/app/lifecycle.test.ts`

- [ ] **Step 3: Separate startup resume failure from explicit pair/rebind failure.** `initializeWhatsApp()` may still throw to direct callers; only `resumeWhatsAppSession()` converts startup failure into degraded WhatsApp state. This keeps real pairing errors visible to API callers.

- [ ] **Step 4: Preserve auth files and operator recovery path.** Do not call `rm(authDirectory)` on resume failure. The existing explicit rebind operation remains the destructive reset mechanism.

- [ ] **Step 5: Verify server startup semantics.** Add/adjust lifecycle regression proving a failed resume no longer prevents the HTTP application lifecycle from reaching the listening phase.

**Acceptance criteria:**
- Corrupt Baileys credentials cannot boot-loop the entire Wago container.
- Dashboard and authenticated control APIs remain accessible.
- Operator can explicitly rebind to replace broken auth state.
- Pair/rebind errors are still returned when invoked explicitly.

---

### Task 4: Track Baileys Credential Persistence Health

**Files:**
- Create: `backend/src/whatsapp/credential-persistence-health.ts`
- Create: `backend/src/whatsapp/credential-persistence-health.test.ts`
- Modify: `backend/src/modules/whatsapp/lifecycle.ts`
- Modify: `backend/src/modules/whatsapp/lifecycle.test.ts`

**Interfaces:**
- Produces: `getCredentialPersistenceHealth()` returning `{ status: "unknown" | "healthy" | "degraded"; consecutiveFailures: number; lastSuccessAt: string | null; lastFailureAt: string | null }`.
- Produces: `markCredentialPersistenceSuccess(now?)` and `markCredentialPersistenceFailure(now?)`.

- [ ] **Step 1: Write state-machine RED tests.** Initial state is unknown; first failure becomes degraded; repeated failures increment count; next successful save resets failure count and returns healthy.

- [ ] **Step 2: Run focused test and verify RED.**

Run: `pnpm --dir backend test -- src/whatsapp/credential-persistence-health.test.ts`

- [ ] **Step 3: Implement the small in-memory health module.** Do not persist this health state; the durable truth is the auth files themselves. State is diagnostic for the running process.

- [ ] **Step 4: Wire the existing serialized `saveCreds()` queue.** Mark success only after `saveCreds()` resolves. Mark failure inside the existing catch path before audit/log emission.

- [ ] **Step 5: Add lifecycle regression.** Mock one failed credential write followed by a successful write and assert readiness-facing health can recover without restart.

**Acceptance criteria:**
- A connected socket with failing credential writes is no longer reported as fully healthy.
- Health automatically recovers after a successful persisted credential update.
- Credential values/errors are not exposed.

---

### Task 5: Secure First-Run Bootstrap Against Public Takeover

**Files:**
- Modify: `backend/src/config/index.ts`
- Modify: `backend/src/routes/app.routes.ts`
- Modify: `backend/src/app.browser-session.test.ts`
- Modify: `backend/src/app.test.ts`
- Modify: `frontend/src/api.ts`
- Modify: dashboard first-run controller/UI tests and components that currently trigger bootstrap
- Modify: `docs/src/components/docs/ConfigurationDoc.astro`
- Modify: `docs/src/components/docs/GettingStartedDoc.astro`
- Modify: `SECURITY.md`

**Interfaces:**
- Production-only environment input: `SETUP_TOKEN`.
- `POST /app/bootstrap` in production requires same-origin plus `X-Wago-Setup-Token` matching `SETUP_TOKEN` in constant time.
- `/app/info` may expose boolean `setupTokenRequired`; it must never expose the token itself.
- Development keeps the current low-friction first-run behavior.

- [ ] **Step 1: Write RED HTTP regressions.** In production first-run: missing token → 403 `SETUP_TOKEN_REQUIRED`; wrong token → 403; correct same-origin token → 201 and generated API key; after initialization, bootstrap remains closed even with the setup token.

- [ ] **Step 2: Verify RED.**

Run: `pnpm --dir backend test -- src/app.browser-session.test.ts src/app.test.ts`

- [ ] **Step 3: Add validated setup-token configuration.** Require at least 32 characters/bytes of operator-provided entropy in production if web bootstrap is desired. If production is uninitialized and no `SETUP_TOKEN` exists, return a clear setup-disabled state instead of allowing first visitor ownership.

- [ ] **Step 4: Validate token in constant time.** Reuse a secret-comparison helper or extract one focused helper; do not log header/body contents.

- [ ] **Step 5: Update frontend first-run UI.** When `setupTokenRequired` is true, request the deployment setup token before bootstrap. Keep it only in component memory for the request; never localStorage/sessionStorage/cookie it.

- [ ] **Step 6: Update operator docs.** Explain that `SETUP_TOKEN` is temporary bootstrap authorization, distinct from the generated machine API key, and can be removed from deployment configuration after successful initialization.

**Acceptance criteria:**
- Opening a fresh public Wago URL is not enough to claim the gateway.
- Raw setup token is never persisted by Wago or returned by an endpoint.
- Generated API key flow remains available after authorized bootstrap.

---

### Task 6: Harden API-Key Rotation and Browser-Session Revocation

**Files:**
- Modify: `backend/src/auth/browser-session-store.ts`
- Modify: `backend/src/api-key-rotation.test.ts`
- Modify: `backend/src/app.browser-session.test.ts`
- Modify: `backend/src/routes/app.routes.ts`
- Modify: `frontend/src/features/gateway/RotateApiKeyDialog.tsx`
- Modify: `frontend/src/features/gateway/ApiKeyRotation.test.tsx`
- Modify: `docs/src/components/docs/ApiKeyRotationDoc.astro`

**Interfaces:**
- Produces: `revokeOtherBrowserSessions(currentToken: string, now?: number): number`.
- Produces: `revokeAllBrowserSessions(now?: number): number`.
- Successful generated-key rotation revokes every other dashboard session while preserving the current session so a lost key-response does not create immediate total lockout.
- Add authenticated same-origin `POST /app/session/logout-all` that revokes all browser sessions, including current, and clears the cookie.

- [ ] **Step 1: Write RED regressions.** Create two browser sessions, rotate from session A, assert A remains valid and B is revoked; assert old Bearer key fails and new key succeeds. Separately, call logout-all and assert both sessions are invalid.

- [ ] **Step 2: Verify RED.**

Run: `pnpm --dir backend test -- src/api-key-rotation.test.ts src/app.browser-session.test.ts`

- [ ] **Step 3: Implement targeted session revocation SQL.** Compare token hashes, not raw tokens; perform one bounded UPDATE rather than reading all sessions into memory.

- [ ] **Step 4: Wire rotation ordering.** Persist the new API-key hash first, revoke other sessions second, keep the current browser session active, and return the new key once. If activity logging fails it must not roll back credential changes.

- [ ] **Step 5: Add logout-all endpoint and frontend affordance.** The UI copy must warn that the user must have saved the current machine API key before signing every dashboard session out.

- [ ] **Step 6: Update security docs.** Clearly distinguish API-key rotation from dashboard-session invalidation and explain the recommended compromise response: rotate key → save it → sign out all dashboard sessions → sign in again with the new key.

**Acceptance criteria:**
- Old API key is immediately invalid after successful rotation.
- Other browser sessions are invalidated by rotation.
- Operator retains one recovery session until explicitly choosing logout-all.
- A complete compromise-response workflow exists without touching WhatsApp/Baileys auth.

---

### Task 7: Make Readiness Truthful Without Turning Recoverable WhatsApp Problems into Restart Loops

**Files:**
- Modify: `backend/src/modules/gateway/readiness.ts`
- Modify: `backend/src/modules/gateway/readiness.test.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/app.test.ts`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/features/dashboard/useDashboardSnapshot.ts`
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx`
- Modify/add relevant frontend tests

**Interfaces:**
- `ReadinessSnapshot.status`: `"ok" | "degraded" | "not_ready"`.
- Snapshot checks include at minimum `storage`, `instanceLease`, `credentialPersistence`, `apiKey`, `webhook`, and `whatsapp` with non-secret status/reason fields.
- `/health` remains pure liveness and returns 200 while the Node process can serve HTTP.
- `/ready` returns 503 only for `not_ready` core conditions such as lost instance ownership or unusable durable storage/database; recoverable WhatsApp disconnection/credential-write issues return 200 with `degraded`.

- [ ] **Step 1: Write readiness RED tests.** Cover healthy initialized state, unpaired-but-usable state, credential-persistence degradation, disconnected bound WhatsApp, and core ownership/storage failure.

- [ ] **Step 2: Verify RED.**

Run: `pnpm --dir backend test -- src/modules/gateway/readiness.test.ts src/app.test.ts`

- [ ] **Step 3: Implement readiness aggregation.** Keep checks cheap: use already-known mount/lease/credential state and a simple SQLite availability probe. Do not run expensive integrity checks on every request.

- [ ] **Step 4: Set route status code from readiness status.** `ok`/`degraded` → 200; `not_ready` → 503. Keep response JSON stable and explicit.

- [ ] **Step 5: Surface degraded state in dashboard.** Show one operational warning banner with the failing check and recovery action; do not dump low-level exception strings or secrets.

- [ ] **Step 6: Verify full backend/frontend behavior.**

Run: `pnpm test`

Expected: all backend and frontend tests pass.

**Acceptance criteria:**
- Health endpoints stop claiming everything is healthy when credential persistence/session state is degraded.
- Recoverable WhatsApp problems do not cause orchestrator restart loops.
- Fatal core-storage/ownership conditions are distinguishable by automation.

---

### Task 8: Remove GHCR `latest`/SHA Publication Races

**Files:**
- Modify: `.github/workflows/release-container.yml`
- Modify: `.agent/plans/2026-08-11-ghcr-release-queue-hotfix.md` only if its historical wording incorrectly implies tag runs also own `latest`
- Modify: `docs/src/components/docs/DeploymentDoc.astro`

**Interfaces:**
- Push to default branch publishes `main`, `latest`, and `sha-<commit>`.
- Push of `v*` publishes semver tags only (`vX.Y.Z`/metadata-generated version family as intentionally supported) and must not mutate `latest` or the branch-owned SHA tag.
- Manual dispatch follows the ref-specific behavior; it must not invent a stable `latest` from a version-tag ref.

- [ ] **Step 1: Add explicit release-tag expectations to workflow comments/documentation before changing behavior.** The source of truth must state which event owns each mutable tag.

- [ ] **Step 2: Adjust `docker/metadata-action` tag rules.** Gate `latest`, `main`, and SHA tags to the default branch. Gate semver tags to tag events. Remove cross-ref mutable-tag collisions.

- [ ] **Step 3: Preserve parallel native amd64/arm64 builds and provenance.** Do not regress the existing digest-based multi-arch publication design.

- [ ] **Step 4: Validate workflow syntax and local repository checks.**

Run: `pnpm check`

Then inspect the resulting workflow diff to confirm branch and tag runs cannot publish the same mutable tag set.

- [ ] **Step 5: Verify in GitHub Actions after merge.** A main push must produce `latest`; a version tag must leave the existing `latest` digest unchanged while publishing the semver tag.

**Acceptance criteria:**
- `latest` has exactly one owner: default-branch release.
- Version-tag releases cannot roll `latest` backward.
- Same commit published by branch and tag cannot race on `sha-*` with different image metadata.

---

### Task 9: Document and Test At-Least-Once Webhook Delivery

**Files:**
- Modify: `backend/src/webhooks/delivery-store.test.ts`
- Modify: `backend/src/webhooks/delivery-worker.test.ts`
- Modify: public API/webhook documentation under `docs/src/components/docs/ApiDoc.astro` and/or `OperationsDoc.astro`
- Modify: `README.md` if the top-level webhook contract is summarized there

**Interfaces:**
- Webhook envelope `id` is the receiver deduplication key.
- Retries/redelivery of the same stored delivery keep the same envelope/delivery ID.
- Delivery semantics are explicitly at-least-once; Wago does not promise exactly-once delivery.

- [ ] **Step 1: Add regression proving stable ID across retry/redelivery.** Enqueue one event, fail/retry it, manually redeliver it, and assert the stored/enveloped delivery ID is unchanged.

- [ ] **Step 2: Run focused tests.**

Run: `pnpm --dir backend test -- src/webhooks/delivery-store.test.ts src/webhooks/delivery-worker.test.ts`

- [ ] **Step 3: Fix code only if the regression exposes ID replacement.** If current behavior already passes, keep implementation unchanged and treat this as a contract-locking test.

- [ ] **Step 4: Document receiver responsibility.** Consumers must persist/process delivery IDs idempotently because a network/process crash after the receiver accepts an event but before Wago marks it delivered can legitimately produce a duplicate attempt.

**Acceptance criteria:**
- Webhook duplicate behavior is explicit and test-locked.
- No false exactly-once guarantee appears in public docs.

---

### Task 10: Define Safe Backup/Restore and Final Release Gate

**Files:**
- Modify: `docs/src/components/docs/OperationsDoc.astro`
- Modify: `docs/src/components/docs/DeploymentDoc.astro`
- Modify: `SECURITY.md`
- Modify: `scripts/smoke-container.sh` if restore/replacement assertions from Task 1 need final consolidation

**Interfaces:**
- Supported simple backup procedure is a controlled stop/checkpoint followed by backup of the entire persistent Wago data volume, not a live copy of `wago.db` alone.
- Restore requires the database, WAL/SHM if present in an unclean snapshot, and Baileys auth directory to remain a coherent state set; the recommended procedure avoids this ambiguity by stopping Wago first.

- [ ] **Step 1: Document controlled backup.** Procedure: stop Wago cleanly → copy/archive the complete `/app/data` volume with restrictive permissions → restart Wago. Explain why copying only `wago.db` during WAL activity is insufficient.

- [ ] **Step 2: Document restore rehearsal.** Restore a backup into a new empty persistent volume on an isolated host/container, start exactly one Wago instance, verify app identity/API-key configuration/session state, then cut over only after validation.

- [ ] **Step 3: Document secret handling.** Backups contain WhatsApp credentials, webhook secrets, application state, and session hashes; encrypt/protect backups and never attach them to public bug reports.

- [ ] **Step 4: Run repository-wide quality gate.**

Run: `pnpm check`

Run: `pnpm test`

Run: `pnpm build`

Run: `pnpm build:docs`

Run: `bash scripts/smoke-container.sh`

Expected: all commands exit 0.

- [ ] **Step 5: Perform final scenario matrix before merge.** Verify: fresh production without volume refuses boot; fresh production with volume + setup token initializes; restart preserves key/session; container replacement preserves state; second instance sharing volume is rejected; corrupt Baileys auth leaves dashboard alive; credential save failure appears degraded; API-key rotation invalidates old key and other sessions; logout-all revokes current session; version tag does not move `latest`; webhook redelivery keeps delivery ID.

- [ ] **Step 6: Merge only after mandatory CI/CodeQL/container release checks are green.** Use squash merge for the implementation task and delete the task branch when tooling permits.

**Acceptance criteria:**
- Operators have a deterministic backup/restore procedure.
- The full reliability/security scenario matrix is verified before release.
- No implementation task is considered complete based only on unit tests.

---

## Recommended Execution Order

1. Task 1 — persistent storage guard.
2. Task 2 — single-instance lease.
3. Task 3 — degraded Baileys resume.
4. Task 4 — credential persistence health.
5. Task 5 — secure first-run bootstrap.
6. Task 6 — API-key/session revocation hardening.
7. Task 7 — truthful readiness/UI.
8. Task 8 — deterministic GHCR tags.
9. Task 9 — webhook delivery contract.
10. Task 10 — backup/restore + complete verification.

Tasks 1–4 are the first production-safety release. Tasks 5–7 are the authentication/operability release. Tasks 8–10 close deployment and operational correctness. Do not start unrelated feature work between these phases unless an urgent production regression requires it.

## Rollback Strategy

- Schema migration 7 is additive. Older builds that do not know the lease table can still read the database; however rolling back to a build without the runtime mount/lease protections removes those safety guarantees and therefore requires an explicit operator decision.
- Do not roll back by replacing the persistent volume with an older copy unless performing a deliberate full restore; code rollback and data rollback are separate operations.
- If bootstrap-token UI/backend changes must be reverted, preserve already-generated API-key hashes and browser-session tables; no credential reset is required.
- If readiness changes create deployment incompatibility, `/health` remains the liveness fallback while the readiness contract is corrected.
- GHCR rollback should pin a known semver or digest rather than retagging an older build as `latest` manually.

## Plan Self-Review

- Coverage: all audit findings are mapped to Tasks 1–10: storage durability, single-instance/session contention, corrupt auth boot behavior, credential-write failures, bootstrap takeover, API-key/session compromise, readiness truthfulness, GHCR tag races, webhook duplicate semantics, and backup/WAL handling.
- Scope: no new datastore, queue, multi-tenant/session architecture, or unrelated refactor is introduced.
- Type/interface consistency: lease ownership, readiness states, session revocation helpers, and credential-persistence health have one defined source of truth each.
- Placeholder scan: no deferred implementation placeholders are intentionally left in this plan.
