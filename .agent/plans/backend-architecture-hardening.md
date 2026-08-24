# Backend Architecture Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for every production behavior change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Wago backend structure around lifecycle cleanup, HTTP boundary validation, and module dependency rules without changing the production architecture shape.

**Architecture:** Keep the current Express + TypeScript + SQLite modular monolith. Make small vertical changes at existing seams: lifecycle orchestration in `app/lifecycle.ts`, HTTP boundary parsing in existing middleware/routes, and architecture tests under `src/architecture`.

**Tech Stack:** TypeScript, Express 5, Vitest, Node SQLite, pnpm.

**Spec:** Derived from the backend architecture audit in this session and repository `AGENTS.md`.

## Global Constraints

- Do not work directly on `main`.
- Use TDD for behavior changes: RED -> GREEN -> REFACTOR.
- Validate external input at HTTP boundaries.
- Keep HTTP status mapping at HTTP boundary.
- Do not introduce new infrastructure, new state library, or broad abstractions.
- Preserve the single-instance modular monolith shape.
- Do not commit unless explicitly requested by the user.

---

### Iteration 1: Lifecycle Startup Cleanup

**Files:**
- Modify: `backend/src/app/lifecycle.test.ts`
- Modify: `backend/src/app/lifecycle.ts`

**Interfaces:**
- Consumes: `createApplicationLifecycle(deps).start()`
- Produces: startup cleanup behavior where a failed `resumeWhatsAppSession()` stops the webhook worker before releasing lease state.

- [ ] **Step 1: Write the failing test**

Add a test to `backend/src/app/lifecycle.test.ts`:

```ts
it("stops the webhook worker when WhatsApp resume fails during startup", async () => {
  const events: string[] = [];
  const lifecycle = createApplicationLifecycle(
    leaseDeps({
      startWebhookDeliveryWorker: () => events.push("start-worker"),
      stopWebhookDeliveryWorker: async () => {
        events.push("stop-worker");
      },
      startInstanceLeaseHeartbeat: () => events.push("start-heartbeat"),
      stopInstanceLeaseHeartbeat: () => events.push("stop-heartbeat"),
      releaseInstanceLease: () => {
        events.push("release-lease");
        return true;
      },
      resumeWhatsAppSession: async () => {
        events.push("resume-whatsapp");
        throw new Error("resume failed");
      },
    }),
  );

  await expect(lifecycle.start()).rejects.toThrow("resume failed");
  expect(events).toEqual([
    "start-heartbeat",
    "start-worker",
    "resume-whatsapp",
    "stop-worker",
    "stop-heartbeat",
    "release-lease",
  ]);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --dir backend test src/app/lifecycle.test.ts
```

Expected: FAIL because `stopWebhookDeliveryWorker` is not called in the startup failure path.

- [ ] **Step 3: Minimal GREEN implementation**

In `backend/src/app/lifecycle.ts`, update the `catch` block in `start()`:

```ts
} catch (error) {
  await deps.stopWebhookDeliveryWorker();
  deps.stopInstanceLeaseHeartbeat();
  deps.releaseInstanceLease();
  throw error;
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm --dir backend test src/app/lifecycle.test.ts
```

Expected: PASS.

---

### Iteration 2: HTTP Boundary Hardening

**Files:**
- Modify: `backend/src/http/middleware/auth.ts`
- Modify: `backend/src/http/middleware/auth.test.ts` if present, otherwise create `backend/src/http/middleware/auth.test.ts`
- Modify: `backend/src/modules/webhooks/routes.ts`
- Modify: `backend/src/modules/webhooks/routes.test.ts`

**Interfaces:**
- Consumes: `getBrowserSessionToken(req)` and `/webhooks/deliveries?limit=...`
- Produces: malformed cookie values are fail-closed, and webhook delivery list rejects invalid `limit` values.

- [ ] **Step 1: Write failing cookie parser test**

Add or update `backend/src/http/middleware/auth.test.ts`:

```ts
it("treats malformed browser session cookie values as unauthenticated", () => {
  const req = {
    header: (name: string) => (name === "cookie" ? `${config.authCookieName}=%E0%A4%A` : undefined),
  } as Request;

  expect(() => getBrowserSessionToken(req)).not.toThrow();
  expect(getBrowserSessionToken(req)).toBeNull();
  expect(requestHasValidBrowserSession(req)).toBe(false);
});
```

- [ ] **Step 2: Verify cookie RED**

Run:

```bash
pnpm --dir backend test src/http/middleware/auth.test.ts
```

Expected: FAIL because `decodeURIComponent` throws on malformed percent encoding.

- [ ] **Step 3: Minimal cookie GREEN**

Wrap `decodeURIComponent` in a small helper:

```ts
function decodeCookieValue(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}
```

Skip entries where decoded value is `undefined`.

- [ ] **Step 4: Write failing webhook limit tests**

Add tests to `backend/src/modules/webhooks/routes.test.ts`:

```ts
it("rejects non-positive delivery list limits", async () => {
  const response = await request(app)
    .get("/webhooks/deliveries?limit=0")
    .set("Authorization", `Bearer ${apiKey}`);

  expect(response.status).toBe(400);
  expect(response.body).toMatchObject({
    success: false,
    error: "INVALID_WEBHOOK_DELIVERY_LIMIT",
  });
});

it("rejects excessive delivery list limits", async () => {
  const response = await request(app)
    .get("/webhooks/deliveries?limit=1000")
    .set("Authorization", `Bearer ${apiKey}`);

  expect(response.status).toBe(400);
  expect(response.body).toMatchObject({
    success: false,
    error: "INVALID_WEBHOOK_DELIVERY_LIMIT",
  });
});
```

- [ ] **Step 5: Verify webhook RED**

Run:

```bash
pnpm --dir backend test src/modules/webhooks/routes.test.ts
```

Expected: FAIL because the route currently accepts finite but unbounded limits.

- [ ] **Step 6: Minimal webhook GREEN**

In `backend/src/modules/webhooks/routes.ts`, add:

```ts
const MIN_WEBHOOK_DELIVERY_LIMIT = 1;
const MAX_WEBHOOK_DELIVERY_LIMIT = 100;
```

Then reject limits outside the range before calling `listWebhookDeliveries`.

- [ ] **Step 7: Verify GREEN**

Run:

```bash
pnpm --dir backend test src/http/middleware/auth.test.ts src/modules/webhooks/routes.test.ts
```

Expected: PASS.

---

### Iteration 3: Module Dependency Guard

**Files:**
- Modify: `backend/src/architecture/module-dependency-boundary.test.ts`

**Interfaces:**
- Consumes: production `.ts` file import graph.
- Produces: executable architecture rule for module ownership.

- [ ] **Step 1: Write failing architecture rule**

Add a test to `backend/src/architecture/module-dependency-boundary.test.ts`:

```ts
it("keeps production WhatsApp independent from Messages internals except the documented outbound policy bridge", () => {
  const allowedMessagesImports = new Set(["../messages/outbound-policy.js"]);
  const violations: string[] = [];

  for (const file of productionTypeScriptFiles(whatsappDirectory)) {
    const relativeFile = relative(sourceDirectory, file).replaceAll("\\", "/");

    for (const specifier of moduleSpecifiers(readFileSync(file, "utf8"))) {
      if (specifier.startsWith("../messages/") && !allowedMessagesImports.has(specifier)) {
        violations.push(`${relativeFile} -> ${specifier}`);
      }
    }
  }

  expect(violations).toEqual([]);
});
```

This codifies the current tolerated bridge and prevents broader drift. A full inversion of the bridge is a separate refactor.

- [ ] **Step 2: Verify architecture test**

Run:

```bash
pnpm --dir backend test src/architecture/module-dependency-boundary.test.ts
```

Expected: PASS if no extra imports exist. If it fails, remove unintended imports or narrow the allowed bridge only after reviewing source.

---

### Final Verification

- [ ] Run focused backend tests touched by the work:

```bash
pnpm --dir backend test src/app/lifecycle.test.ts src/http/middleware/auth.test.ts src/modules/webhooks/routes.test.ts src/architecture/module-dependency-boundary.test.ts
```

- [ ] Run full backend test suite:

```bash
pnpm --dir backend test
```

- [ ] Run backend build:

```bash
pnpm --dir backend run build
```

- [ ] Run repo status:

```bash
git status --short --branch
```
