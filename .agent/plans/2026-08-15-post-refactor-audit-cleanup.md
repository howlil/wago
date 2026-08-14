# Post-Refactor Audit Cleanup Implementation Plan

> **Execution mode:** inline in this ChatGPT session on the existing branch `refactor/modular-monolith-structure`. Use TDD for every task. Do not create another branch. Do not merge PR #37 until the user explicitly authorizes merge.

**Goal:** Close the four issues found by the post-refactor audit so the modular-monolith refactor actually satisfies its own ownership boundaries, preserves readiness behavior under infrastructure failures, keeps dashboard polling non-blocking, and removes the remaining Messages ↔ WhatsApp production dependency cycle.

**Architecture:** Keep the current Express + TypeScript + SQLite + Baileys + React/Vite modular monolith. Make four narrow follow-up changes in sequence. Each task starts with a RED regression/architecture test, reaches GREEN independently, and is verified before the next task starts. No new runtime dependency, DI framework, state library, generic repository layer, or broad rewrite is allowed.

**Tech Stack:** Node.js 26, TypeScript, Express 5, `node:sqlite`, Baileys, React, Vite, Vitest, Biome, pnpm, Docker, GitHub Actions.

## Global Constraints

- Continue only on `refactor/modular-monolith-structure`.
- Keep PR #37 draft and unmerged until explicit user authorization.
- TDD is mandatory: RED -> verify intended failure -> minimal GREEN -> focused verification -> phase verification.
- Work one task at a time. Do not combine the four fixes into one large transform.
- Preserve public HTTP endpoints, response contracts, API-key persistence format, browser-session semantics, Baileys auth compatibility, webhook semantics, and SQLite durability.
- No new runtime dependencies.
- Do not introduce a DI container, repository/service hierarchy, Redux/Zustand/TanStack Query, generic event bus, or microservice boundary.
- Prefer one meaningful checkpoint commit per task after its tests are green.
- If a task exposes an unrelated bug, stop that task and add a focused regression test before fixing it. Do not widen scope silently.

---

### Task 1: Finish backend route ownership for Access and WhatsApp

**Problem:** `backend/src/routes` now contains only `app.routes.ts` and `whatsapp.routes.ts`, so Access and WhatsApp are the only backend domains that still do not own their HTTP routes. Existing architecture guards do not fully catch this.

**Files:**
- Create: `backend/src/architecture/access-boundary.test.ts`
- Modify: `backend/src/architecture/whatsapp-boundary.test.ts`
- Move: `backend/src/routes/app.routes.ts` -> `backend/src/modules/access/routes.ts`
- Move: `backend/src/routes/whatsapp.routes.ts` -> `backend/src/modules/whatsapp/routes.ts`
- Modify: `backend/src/app.ts`
- Modify imports inside the two moved route files only as required by their new location.
- Verify existing access tests: `backend/src/app.test.ts`, `backend/src/app.browser-session.test.ts`, `backend/src/api-key-rotation.test.ts`, `backend/src/config/bootstrap.test.ts`
- Verify existing HTTP/WhatsApp tests: `backend/src/http-contract.test.ts`, `backend/src/http-typed-error-contract.test.ts`, `backend/src/modules/whatsapp/*.test.ts`

**Interfaces:**
- `modules/access/routes.ts` continues exporting `appRouter` with exactly the current `/app/*` behavior.
- `modules/whatsapp/routes.ts` continues exporting `whatsappRouter` with exactly the current `/whatsapp/*` behavior.
- `backend/src/app.ts` remains the composition root and mounts the same route prefixes.
- No compatibility re-export is added under `src/routes`.

- [ ] **Step 1.1: RED — add Access route ownership guard**

Create `backend/src/architecture/access-boundary.test.ts` that fails while `src/routes/app.routes.ts` exists or any production/test import resolves to that legacy route.

The assertion must report diagnostic strings such as:

```ts
expect(violations).toEqual([]);
```

with violations shaped like:

```ts
"routes/app.routes.ts legacy access route still exists"
"app.ts -> ./routes/app.routes.js"
```

- [ ] **Step 1.2: RED — extend WhatsApp ownership guard to include its route**

Extend `backend/src/architecture/whatsapp-boundary.test.ts` so `src/routes/whatsapp.routes.ts` is explicitly forbidden in addition to the already-forbidden `src/whatsapp/*` and root `src/whatsapp.ts` facade.

- [ ] **Step 1.3: Verify RED**

Run focused architecture tests:

```bash
pnpm --dir backend test -- src/architecture/access-boundary.test.ts src/architecture/whatsapp-boundary.test.ts
```

Expected: both guards fail only because the two legacy route files/imports still exist.

- [ ] **Step 1.4: GREEN — move Access route without behavioral edits**

Move `app.routes.ts` to `modules/access/routes.ts`. Update only relative import paths. Preserve all route methods, status codes, cookies, origin validation, setup-token behavior, activity records, and response bodies byte-for-byte where formatting permits.

Update `backend/src/app.ts` to:

```ts
import { appRouter } from "./modules/access/routes.js";
```

- [ ] **Step 1.5: Verify Access GREEN**

Run:

```bash
pnpm --dir backend test -- src/architecture/access-boundary.test.ts src/app.test.ts src/app.browser-session.test.ts src/api-key-rotation.test.ts src/config/bootstrap.test.ts
pnpm --dir backend run build
```

Expected: PASS.

- [ ] **Step 1.6: GREEN — move WhatsApp route without behavioral edits**

Move `whatsapp.routes.ts` to `modules/whatsapp/routes.ts`. Update relative imports to HTTP middleware, Activity, and local WhatsApp exports. Do not rewrite pairing/rebind behavior in this task.

Update `backend/src/app.ts` to:

```ts
import { whatsappRouter } from "./modules/whatsapp/routes.js";
```

- [ ] **Step 1.7: Verify route ownership GREEN**

Run:

```bash
pnpm --dir backend test -- src/architecture/access-boundary.test.ts src/architecture/whatsapp-boundary.test.ts src/http-contract.test.ts src/http-typed-error-contract.test.ts
pnpm --dir backend test
pnpm --dir backend run build
```

Expected: PASS, and `backend/src/routes` disappears from the Git tree because it has no remaining files.

- [ ] **Step 1.8: Checkpoint commit**

Commit only after Task 1 is fully green, with one meaningful route-ownership commit.

---

### Task 2: Make readiness response handling safe for non-JSON and malformed 503 responses

**Problem:** `requestJson()` currently permits an explicitly allowed status such as 503 even when the response body is not JSON. `getReadiness()` therefore can return a synthetic non-JSON error object typed as `GatewayReadinessSnapshot`, and the readiness renderer can later dereference missing `checks`.

**Files:**
- Modify: `frontend/tests/shared-api-client.test.ts`
- Modify: `frontend/tests/gateway-api.test.ts`
- Modify: `frontend/src/shared/api/client.ts`
- Modify: `frontend/src/features/gateway/api.ts`
- No dashboard scheduling changes in this task.

**Interfaces:**
- Keep `requestJson<T>(path, init?, options?)` signature unchanged.
- `allowedStatuses` means “an allowed HTTP status carrying the expected JSON contract,” not “accept any payload at this status.”
- `getReadiness()` continues accepting backend 503 as a valid readiness response only when the payload has the minimal readiness shape.

- [ ] **Step 2.1: RED — non-JSON 503 must reject even when 503 is allowed**

Add this regression case to `frontend/tests/shared-api-client.test.ts`:

```ts
it("rejects a non-JSON response even when its status is explicitly allowed", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("Service Unavailable", {
      status: 503,
      headers: { "Content-Type": "text/html" },
    })),
  );

  const { requestJson } = await import("../src/shared/api/client.js");

  await expect(
    requestJson("/ready", undefined, { allowedStatuses: [503] }),
  ).rejects.toEqual({
    success: false,
    error: "NON_JSON_RESPONSE",
    message: "Service Unavailable",
  });
});
```

- [ ] **Step 2.2: Verify RED**

Run:

```bash
pnpm --dir frontend test -- tests/shared-api-client.test.ts
```

Expected: the new test fails because current code resolves the synthetic error object.

- [ ] **Step 2.3: GREEN — make `requestJson` enforce JSON before status allowance**

Change `requestJson()` so a non-JSON payload always rejects when the caller requested JSON. The minimal behavior is:

```ts
const contentType = response.headers.get("content-type") ?? "";
if (!contentType.includes("application/json")) {
  throw {
    success: false,
    error: "NON_JSON_RESPONSE",
    message: await response.text(),
  };
}

const data = (await response.json()) as T;
if (!response.ok && !options.allowedStatuses?.includes(response.status)) {
  throw data;
}
return data;
```

Do not add a new error class or dependency.

- [ ] **Step 2.4: RED — malformed JSON 503 must also be rejected by Gateway API**

Add a focused `getReadiness()` test in `frontend/tests/gateway-api.test.ts` where fetch returns:

```json
{ "error": "upstream_unavailable" }
```

with status 503 and JSON content type.

Expected: `getReadiness()` rejects instead of returning that object as `GatewayReadinessSnapshot`.

- [ ] **Step 2.5: GREEN — add minimal readiness shape validation**

Inside `frontend/src/features/gateway/api.ts`, add a small private type guard, not a schema library:

```ts
function isGatewayReadinessSnapshot(value: unknown): value is GatewayReadinessSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { status?: unknown; checks?: unknown };
  return (
    (candidate.status === "ok" || candidate.status === "degraded" || candidate.status === "not_ready") &&
    Boolean(candidate.checks) &&
    typeof candidate.checks === "object" &&
    !Array.isArray(candidate.checks)
  );
}
```

Then make `getReadiness()` fetch `unknown`, validate it, and throw a stable plain API error when malformed:

```ts
{
  success: false,
  error: "INVALID_READINESS_RESPONSE",
  message: "Readiness endpoint returned an invalid JSON payload",
}
```

- [ ] **Step 2.6: Verify Task 2 GREEN**

Run:

```bash
pnpm --dir frontend test -- tests/shared-api-client.test.ts tests/gateway-api.test.ts tests/operational-readiness-banner.test.tsx
pnpm --dir frontend run build
```

Expected: PASS.

- [ ] **Step 2.7: Checkpoint commit**

Commit only after response-contract tests and frontend build are green.

---

### Task 3: Keep readiness best-effort and non-blocking inside the single dashboard scheduler

**Problem:** `useDashboardSnapshot.refresh()` awaits readiness before app/session/WhatsApp data. A slow or hanging `/ready` request can hold `isRefreshInFlight` and block the rest of the dashboard even though `/health` is fine.

**Files:**
- Modify: `frontend/tests/dashboard-readiness-snapshot.test.tsx`
- Modify: `frontend/src/features/dashboard/useDashboardSnapshot.ts`
- Keep: `frontend/src/features/dashboard/OperationalReadinessBanner.tsx` presentation-only.
- No second interval/timer may be added.

**Interfaces:**
- The existing dashboard scheduler remains the only polling scheduler.
- Every normal dashboard refresh triggers a best-effort readiness refresh.
- Readiness failure or slowness must not block `getAppInfo`, WhatsApp status, QR, or the next main dashboard refresh.
- At most one readiness request should be in flight at a time to avoid request pile-up.
- A stale readiness request must not overwrite `readiness = null` after a later health failure invalidates that request.

- [ ] **Step 3.1: RED — prove a hanging readiness request does not block the main snapshot**

Extend `frontend/tests/dashboard-readiness-snapshot.test.tsx` with a deferred readiness promise:

```ts
let resolveReadiness!: (value: GatewayReadinessSnapshot) => void;
const readinessPromise = new Promise<GatewayReadinessSnapshot>((resolve) => {
  resolveReadiness = resolve;
});
gatewayApi.getReadiness.mockReturnValueOnce(readinessPromise);
```

After mounting `useDashboardSnapshot()`, assert—without resolving readiness—that the normal snapshot still reaches authenticated/connected state and `getAppInfo()` / `getWhatsAppStatus()` have been called.

Also call `result.current.refresh({ showLoading: false })` while readiness is still unresolved and assert `getReadiness` has not spawned an additional overlapping request.

- [ ] **Step 3.2: RED — prove stale readiness cannot overwrite a later health failure**

While the first readiness promise is unresolved, make the next `getHealth()` call fail and call `refresh({ showLoading: false })`. Assert `readiness` is `null`. Resolve the old readiness promise afterward and assert `readiness` remains `null`.

- [ ] **Step 3.3: Verify RED**

Run:

```bash
pnpm --dir frontend test -- tests/dashboard-readiness-snapshot.test.tsx
```

Expected: current implementation fails because the main refresh waits on the unresolved readiness promise and has no stale-result guard.

- [ ] **Step 3.4: GREEN — extract a best-effort readiness refresh with in-flight and generation guards**

Add refs:

```ts
const isReadinessRefreshInFlight = useRef(false);
const readinessGeneration = useRef(0);
```

Add an invalidation helper:

```ts
const invalidateReadiness = useCallback(() => {
  readinessGeneration.current += 1;
  setReadiness(null);
}, []);
```

Add a focused callback:

```ts
const refreshReadiness = useCallback(async () => {
  if (isReadinessRefreshInFlight.current) return;

  const generation = ++readinessGeneration.current;
  isReadinessRefreshInFlight.current = true;

  try {
    const nextReadiness = await getReadiness();
    if (generation === readinessGeneration.current) {
      setReadiness(nextReadiness);
    }
  } catch {
    if (generation === readinessGeneration.current) {
      setReadiness(null);
    }
  } finally {
    isReadinessRefreshInFlight.current = false;
  }
}, []);
```

After `/health` succeeds, trigger it without awaiting it:

```ts
void refreshReadiness();
```

Then continue immediately to `loadAppInfo()` and WhatsApp snapshot work.

When backend health is unhealthy or throws, call `invalidateReadiness()` before clearing the WhatsApp view. This invalidates completion from an older readiness request.

- [ ] **Step 3.5: Verify scheduling semantics**

Run:

```bash
pnpm --dir frontend test -- tests/dashboard-readiness-snapshot.test.tsx tests/operational-readiness-banner.test.tsx src/App.test.tsx
pnpm --dir frontend run build
```

Expected:
- no `setInterval` owned by readiness/banner;
- main dashboard state progresses while readiness is unresolved;
- only one readiness request is in flight;
- readiness eventually updates when a current request resolves;
- stale readiness completion cannot overwrite a later health failure.

- [ ] **Step 3.6: Checkpoint commit**

Commit only after focused dashboard tests and build are green.

---

### Task 4: Remove the production Messages -> WhatsApp dependency and make the feature graph acyclic

**Problem:** `modules/whatsapp/sender.ts` depends on `modules/messages/outbound-policy.ts`, while `modules/messages/outbound-policy.ts` imports `modules/whatsapp/account-health.ts`. This leaves a production feature cycle `WhatsApp -> Messages -> WhatsApp`.

**Chosen direction:** Keep `WhatsApp -> Messages` because WhatsApp sender consumes outbound messaging policy. Remove the reverse dependency by making Messages accept a small account-health policy callback. WhatsApp owns Baileys/account-health details and supplies that callback at the sender boundary.

**Files:**
- Create: `backend/src/architecture/module-dependency-boundary.test.ts`
- Modify: `backend/src/modules/messages/outbound-policy.ts`
- Modify: `backend/src/modules/messages/outbound-policy.test.ts`
- Modify related outbound-policy persistence tests only if their setup references account-health reset behavior.
- Modify: `backend/src/modules/whatsapp/sender.ts`
- Verify: `backend/src/modules/whatsapp/whatsapp.test.ts`, `backend/src/modules/whatsapp/account-health.test.ts`, message service/route tests.

**Interfaces:**

Introduce in `modules/messages/outbound-policy.ts`:

```ts
export type OutboundAccountHealthCheck = (options: {
  isNewRecipient: boolean;
}) => Promise<OutboundPolicyDecision>;
```

Change `OutboundPolicyInput` from the WhatsApp-specific fetcher field to:

```ts
accountHealthCheck?: OutboundAccountHealthCheck;
```

Messages must not import any production file under `modules/whatsapp` after this task.

- [ ] **Step 4.1: RED — add module dependency guard**

Create `backend/src/architecture/module-dependency-boundary.test.ts` that recursively scans production `.ts` files under `src/modules/messages` and fails when a relative import resolves under `src/modules/whatsapp`.

Expected current violation:

```text
modules/messages/outbound-policy.ts -> ../whatsapp/account-health.js
```

Do not ban `modules/whatsapp -> modules/messages`; that is the intended one-way dependency after cleanup.

- [ ] **Step 4.2: Verify RED**

Run:

```bash
pnpm --dir backend test -- src/architecture/module-dependency-boundary.test.ts
```

Expected: FAIL only on the current Messages -> WhatsApp import.

- [ ] **Step 4.3: RED — characterize policy callback behavior**

In `outbound-policy.test.ts`, add a focused test proving `checkOutboundPolicy()` passes `{ isNewRecipient: true }` to an injected `accountHealthCheck` for a new allowed recipient and propagates its blocked decision unchanged.

Example decision:

```ts
{
  allowed: false,
  reason: "WA_NEW_CHAT_CAPPED",
  message: "WhatsApp reports this account has reached its new-chat cap",
}
```

- [ ] **Step 4.4: GREEN — remove WhatsApp imports from Messages policy**

Remove:

```ts
import {
  type AccountHealthFetcher,
  checkAccountHealth,
  resetAccountHealthForTest,
} from "../whatsapp/account-health.js";
```

Replace the health portion of `checkOutboundPolicy()` with:

```ts
const healthDecision = input.accountHealthCheck
  ? await input.accountHealthCheck({ isNewRecipient: recipientContext.isNewRecipient })
  : { allowed: true as const };

if (!healthDecision.allowed) return healthDecision;
```

`resetOutboundPolicyState()` and `forgetOutboundPolicyStateForTest()` must reset only Messages policy state. They must no longer reset WhatsApp account-health state as a hidden side effect.

- [ ] **Step 4.5: GREEN — adapt WhatsApp sender at the boundary**

In `modules/whatsapp/sender.ts`, import `checkAccountHealth` locally from `./account-health.js` and create the current fetcher once per send:

```ts
const accountHealthFetcher = createAccountHealthFetcher(activeSocket, generation);
```

Pass Messages a callback:

```ts
accountHealthCheck: (options) => checkAccountHealth(accountHealthFetcher, options),
```

Keep existing behavior after a `REACHOUT_RESTRICTED` send failure: mark the WhatsApp health state, force-refresh account health, and set recipient cooldown.

- [ ] **Step 4.6: Verify Task 4 GREEN**

Run:

```bash
pnpm --dir backend test -- src/architecture/module-dependency-boundary.test.ts src/modules/messages/outbound-policy.test.ts src/modules/messages/outbound-policy-persistence.test.ts src/modules/messages/outbound-policy-persistence-failure.test.ts src/modules/whatsapp/account-health.test.ts src/modules/whatsapp/whatsapp.test.ts
pnpm --dir backend test
pnpm --dir backend run build
```

Expected: PASS and zero production imports from `modules/messages/**` into `modules/whatsapp/**`.

- [ ] **Step 4.7: Checkpoint commit**

Commit only after full backend tests/build are green.

---

## Final verification after all four tasks

Do not update the completion checkpoint before all four tasks are green.

- [ ] Run repository checks:

```bash
pnpm run check
pnpm --dir backend test
pnpm --dir backend run build
pnpm --dir frontend test
pnpm --dir frontend run build
pnpm run build:docs
```

- [ ] Run release-relevant container verification:

```bash
docker build .
bash scripts/smoke-container.sh
```

- [ ] Verify GitHub Actions on the final branch head:
  - CI: success
  - Docs CI: success
  - CodeQL: success
  - native ARM64/container jobs: success
  - persistence/rollback smoke: success

- [ ] Verify PR #37 has no unresolved review threads or security blockers.

- [ ] Create a new checkpoint file rather than rewriting history:

`.agent/checkpoints/2026-08-15-post-refactor-audit-cleanup-verification.md`

The checkpoint must record the actual final SHA and explicitly state:
- Access and WhatsApp routes now have canonical module ownership;
- readiness rejects non-JSON/malformed allowed-status responses;
- readiness refresh is best-effort and cannot block the main dashboard snapshot;
- stale readiness responses cannot overwrite a later health failure;
- production dependency direction is one-way `WhatsApp -> Messages`, with no `Messages -> WhatsApp` import;
- full tests/build/container/CodeQL are green;
- PR #37 remains draft/unmerged until explicit user authorization.

## Stop conditions

Stop before moving to the next task if any of the following occurs:

- a behavior test outside the intended task fails;
- a public HTTP response/status changes unexpectedly;
- persistent SQLite or Baileys auth semantics change;
- the proposed cycle fix requires a DI framework/shared event bus/new runtime dependency;
- container smoke or CodeQL regresses.

Fix the current task on the same branch using a focused RED regression test. Do not open another branch and do not merge.
