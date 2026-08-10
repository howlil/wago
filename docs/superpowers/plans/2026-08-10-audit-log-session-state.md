# Audit Log and WhatsApp Session State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated, operator-friendly `/audit` page with sanitized low-level Baileys diagnostics and fix WhatsApp/outbound/account-health state so disconnected or invalid sessions can never appear healthy.

**Architecture:** Keep one structured audit timeline in SQLite. Selected Baileys lifecycle events are mapped through a sanitizer into friendly audit events with safe technical metadata; raw Baileys payloads remain disabled. WhatsApp connection state, persistent binding validity, account-health availability, and outbound availability are modeled separately, with a central disconnect classifier and explicit health invalidation. Frontend routing becomes a two-page SPA using a global `AppShell` and data-driven sidebar navigation.

**Tech Stack:** Node.js 26, TypeScript 7, Express 5, built-in `node:sqlite`, Baileys `7.0.0-rc14`, React 19, Vite 8, Tailwind CSS 4, Vitest, Testing Library, pnpm 11.21.0.

## Global Constraints

- Keep Wago single-process, single-account, self-hosted, and SQLite-backed.
- Do not add Redis, PostgreSQL, an external log service, message queue, or ORM.
- Do not persist message bodies, raw QR values, auth credentials, Signal keys, cookies, tokens, API keys, full phone numbers/JIDs, or arbitrary raw Baileys payloads.
- Raw `baileysLogger` remains disabled by default.
- Audit event metadata contains primitives only and is sanitized before persistence; global redaction remains a second defensive layer.
- Retain at most 2,000 audit events.
- Audit filtering and cursor pagination are server-side; do not load the entire audit table and filter it in the browser.
- `Outbound: Normal` is legal only when the backend is reachable, WhatsApp is connected, account health is available, and no active restriction is reported.
- Terminal logout invalidates binding and account health and requires pairing; recoverable disconnect keeps binding but makes health unavailable until reconnection and a successful refresh.
- Control page contains no Activity Log panel. Audit history lives only at `/audit`.
- Existing HTTP send safety check (`socket` exists and status is `connected`) remains in place.
- Use TDD for every behavior change: failing test first, minimal implementation second, regression suite third.

---

## File Structure Locked by This Plan

### Backend

- Create `backend/src/activity/audit-event.ts` — audit event/source types and primitive metadata contract.
- Create `backend/src/activity/baileys-audit.ts` — selected Baileys lifecycle-to-audit mapping and sanitization.
- Create `backend/src/activity/query.ts` — server-side filters, cursor encode/decode, prepared audit queries.
- Modify `backend/src/activity/store.ts` — persistence only, 2,000-row retention, source column.
- Modify `backend/src/infrastructure/database.ts` — schema migration for audit source/indexes.
- Create `backend/src/whatsapp/disconnect-classifier.ts` — one source of truth for terminal/recoverable disconnect semantics.
- Modify `backend/src/whatsapp/account-health.ts` — availability state and explicit invalidation.
- Modify `backend/src/whatsapp/connection-state.ts` — connection/QR only; no optimistic health semantics.
- Modify `backend/src/whatsapp/client.ts` — delegate disconnect classification/audit mapping and invalidate health at lifecycle boundaries.
- Modify `backend/src/routes/activity.routes.ts` — authenticated query parsing and cursor pagination.

### Frontend

- Create `frontend/src/app/routes.tsx` — `/` and `/audit` route composition.
- Create `frontend/src/shared/layout/AppShell.tsx` — generic shell replacing domain-specific `DashboardShell`.
- Modify `frontend/src/shared/layout/AppSidebar.tsx` — data-driven `Control` and `Audit Log` navigation.
- Modify `frontend/src/shared/layout/AppHeader.tsx` — page-generic title/status/action contract.
- Delete `frontend/src/shared/components/DashboardShell.tsx` after all imports move.
- Create `frontend/src/features/audit/AuditLogPage.tsx`.
- Create `frontend/src/features/audit/AuditFilters.tsx`.
- Move/replace `frontend/src/features/activity/ActivityEventList.tsx` with `frontend/src/features/audit/AuditEventList.tsx`.
- Create `frontend/src/features/audit/AuditEventDetails.tsx`.
- Replace `frontend/src/features/activity/useActivityLog.ts` with `frontend/src/features/audit/useAuditLogQuery.ts`.
- Remove `frontend/src/features/activity/ActivityLogPanel.tsx` after the Audit page is complete.
- Modify `frontend/src/features/dashboard/DashboardPage.tsx` — no audit panel; correct status semantics.
- Modify `frontend/src/features/dashboard/OverviewCards.tsx` — outbound depends on gateway + WhatsApp + health availability.
- Modify `frontend/src/features/whatsapp/AccountHealthCard.tsx` — unavailable/checking states instead of optimistic `Available/Normal`.
- Modify `frontend/src/api.ts` — audit query parameters/cursor types and account-health availability.
- Modify `frontend/src/App.tsx` — render router.
- Modify `frontend/package.json` and `pnpm-lock.yaml` — add `react-router-dom`.

---

### Task 1: Centralize Disconnect Classification and Account-Health Availability

**Files:**
- Create: `backend/src/whatsapp/disconnect-classifier.ts`
- Create: `backend/src/whatsapp/disconnect-classifier.test.ts`
- Modify: `backend/src/whatsapp/account-health.ts`
- Modify: `backend/src/whatsapp/account-health.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type DisconnectClassification = {
    statusCode?: number;
    reason: string;
    terminal: boolean;
    shouldReconnect: boolean;
  };

  export function classifyDisconnect(input: {
    statusCode?: number;
    rebindInProgress: boolean;
    shuttingDown: boolean;
  }): DisconnectClassification;

  export type AccountHealthAvailability = "unavailable" | "checking" | "available";

  export function invalidateAccountHealth(
    reason: "not_connected" | "session_invalid" | "fetch_failed",
  ): void;
  ```
- Consumers: Task 3 `client.ts`, Task 6 frontend status rendering through `/whatsapp/status`.

- [ ] **Step 1: Write disconnect-classifier failing tests**

```ts
import { DisconnectReason } from "@whiskeysockets/baileys";
import { describe, expect, it } from "vitest";
import { classifyDisconnect } from "./disconnect-classifier.js";

describe("classifyDisconnect", () => {
  it("treats logged out as terminal and non-reconnectable", () => {
    expect(
      classifyDisconnect({
        statusCode: DisconnectReason.loggedOut,
        rebindInProgress: false,
        shuttingDown: false,
      }),
    ).toEqual({
      statusCode: DisconnectReason.loggedOut,
      reason: "logged_out",
      terminal: true,
      shouldReconnect: false,
    });
  });

  it("keeps ordinary connection loss recoverable", () => {
    const result = classifyDisconnect({
      statusCode: DisconnectReason.connectionClosed,
      rebindInProgress: false,
      shuttingDown: false,
    });
    expect(result.terminal).toBe(false);
    expect(result.shouldReconnect).toBe(true);
  });

  it("never reconnects during rebind or shutdown", () => {
    expect(
      classifyDisconnect({ statusCode: undefined, rebindInProgress: true, shuttingDown: false }).shouldReconnect,
    ).toBe(false);
    expect(
      classifyDisconnect({ statusCode: undefined, rebindInProgress: false, shuttingDown: true }).shouldReconnect,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the classifier test and verify RED**

Run:
```bash
pnpm --dir backend test -- src/whatsapp/disconnect-classifier.test.ts
```
Expected: FAIL because `disconnect-classifier.ts` does not exist.

- [ ] **Step 3: Implement the minimal classifier**

```ts
import { DisconnectReason } from "@whiskeysockets/baileys";

export type DisconnectClassification = {
  statusCode?: number;
  reason: string;
  terminal: boolean;
  shouldReconnect: boolean;
};

const reasonByCode = new Map<number, string>([
  [DisconnectReason.loggedOut, "logged_out"],
  [DisconnectReason.connectionClosed, "connection_closed"],
  [DisconnectReason.connectionLost, "connection_lost"],
  [DisconnectReason.restartRequired, "restart_required"],
  [DisconnectReason.timedOut, "timed_out"],
  [DisconnectReason.badSession, "bad_session"],
]);

export function classifyDisconnect(input: {
  statusCode?: number;
  rebindInProgress: boolean;
  shuttingDown: boolean;
}): DisconnectClassification {
  const terminal = input.statusCode === DisconnectReason.loggedOut;
  return {
    statusCode: input.statusCode,
    reason: input.statusCode == null ? "unknown" : (reasonByCode.get(input.statusCode) ?? `status_${input.statusCode}`),
    terminal,
    shouldReconnect: !terminal && !input.rebindInProgress && !input.shuttingDown,
  };
}
```

If the installed Baileys enum does not expose one of the named constants above, remove only that unsupported mapping; do not invent numeric codes.

- [ ] **Step 4: Run classifier tests and verify GREEN**

Run:
```bash
pnpm --dir backend test -- src/whatsapp/disconnect-classifier.test.ts
```
Expected: PASS.

- [ ] **Step 5: Add failing account-health availability tests**

Add tests proving:

```ts
it("starts unavailable before a connected-session fetch", () => {
  resetAccountHealthForTest();
  expect(getAccountHealthSnapshot()).toMatchObject({
    availability: "unavailable",
    unavailableReason: "not_connected",
  });
});

it("becomes available after a successful forced refresh", async () => {
  resetAccountHealthForTest();
  await refreshAccountHealth(
    {
      fetchAccountReachoutTimelock: async () => ({ isActive: false }),
      fetchNewChatMessageCap: async () => ({ capping_status: "NONE" }),
    },
    { force: true },
  );
  expect(getAccountHealthSnapshot().availability).toBe("available");
});

it("clears stale restriction fields when the session disconnects", async () => {
  await refreshAccountHealth(
    {
      fetchAccountReachoutTimelock: async () => ({ isActive: false }),
      fetchNewChatMessageCap: async () => ({ capping_status: "NONE", total_quota: 250 }),
    },
    { force: true },
  );
  invalidateAccountHealth("not_connected");
  expect(getAccountHealthSnapshot()).toMatchObject({
    availability: "unavailable",
    unavailableReason: "not_connected",
    reachoutTimeLock: undefined,
    newChatCap: undefined,
  });
});
```

- [ ] **Step 6: Run account-health tests and verify RED**

Run:
```bash
pnpm --dir backend test -- src/whatsapp/account-health.test.ts
```
Expected: FAIL because availability/invalidation is not implemented.

- [ ] **Step 7: Implement account-health availability state**

Extend the snapshot with:

```ts
export type AccountHealthAvailability = "unavailable" | "checking" | "available";

export type AccountHealthSnapshot = {
  availability: AccountHealthAvailability;
  unavailableReason?: "not_connected" | "session_invalid" | "fetch_failed";
  // existing reachout/newChat/timestamps remain
};
```

Behavior:
- module/reset default: `unavailable/not_connected`;
- before a fetch starts: `checking`, clear `unavailableReason`;
- successful fetch: `available`, clear error reason;
- fetch failure while connected: `unavailable/fetch_failed` and clear operator-visible reachout/cap values;
- `invalidateAccountHealth(reason)`: clear reachout/cap/fetch timestamps and set `unavailable/reason`.

Do not make `checkAccountHealth()` infer `Normal` from missing values. When `availability !== "available"`, it may allow known-recipient/local policy evaluation, but it must not manufacture a positive account-health statement.

- [ ] **Step 8: Run focused backend tests**

Run:
```bash
pnpm --dir backend test -- src/whatsapp/account-health.test.ts src/whatsapp/disconnect-classifier.test.ts
```
Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add backend/src/whatsapp/disconnect-classifier.ts backend/src/whatsapp/disconnect-classifier.test.ts backend/src/whatsapp/account-health.ts backend/src/whatsapp/account-health.test.ts
git commit -m "fix(whatsapp): model disconnect and health availability"
```

---

### Task 2: Upgrade SQLite Audit Persistence and Server-Side Querying

**Files:**
- Create: `backend/src/activity/audit-event.ts`
- Create: `backend/src/activity/query.ts`
- Create: `backend/src/activity/query.test.ts`
- Modify: `backend/src/activity/store.ts`
- Modify: `backend/src/activity/store.test.ts`
- Modify: `backend/src/infrastructure/database.ts`
- Modify: `backend/src/infrastructure/database.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AuditSource = "wago" | "baileys";
  export type AuditMetadata = Record<string, string | number | boolean | null | undefined>;
  export type AuditEvent = {
    id: string;
    timestamp: string;
    level: ActivityLevel;
    category: ActivityCategory;
    source: AuditSource;
    code: string;
    title: string;
    description: string;
    metadata?: AuditMetadata;
  };

  export type AuditQuery = {
    limit: number;
    before?: string;
    source?: AuditSource;
    category?: ActivityCategory;
    level?: ActivityLevel;
    q?: string;
  };

  export type AuditPage = {
    events: AuditEvent[];
    nextCursor?: string;
  };

  export function listAudit(query: AuditQuery): Promise<AuditPage>;
  ```
- Consumers: Task 4 API route, Task 6 frontend API types.

- [ ] **Step 1: Write migration failing test**

Add a database test that asserts after migrations:

```sql
PRAGMA table_info(activity_events)
```

contains `source`, and that these indexes exist:

```text
idx_activity_timestamp
idx_activity_source_timestamp
idx_activity_category_timestamp
idx_activity_level_timestamp
```

- [ ] **Step 2: Run database test and verify RED**

Run:
```bash
pnpm --dir backend test -- src/infrastructure/database.test.ts
```
Expected: FAIL because `source`/indexes are absent.

- [ ] **Step 3: Add a new schema migration**

In `backend/src/infrastructure/database.ts`, add the next migration version after the current latest version:

```sql
ALTER TABLE activity_events ADD COLUMN source TEXT NOT NULL DEFAULT 'wago';
CREATE INDEX IF NOT EXISTS idx_activity_source_timestamp
  ON activity_events(source, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_level_timestamp
  ON activity_events(level, timestamp DESC);
```

Keep the existing category/timestamp index. Existing events inherit `source='wago'`.

- [ ] **Step 4: Run database test and verify GREEN**

Run:
```bash
pnpm --dir backend test -- src/infrastructure/database.test.ts
```
Expected: PASS.

- [ ] **Step 5: Write store/query failing tests**

Tests must prove all of the following:

```ts
it("defaults source to wago for existing call sites", async () => {
  const event = await recordActivity({
    level: "info",
    category: "system",
    code: "test.default_source",
    title: "Default source",
    description: "Compatibility event",
  });
  expect(event.source).toBe("wago");
});

it("retains only the newest 2000 events", async () => {
  // insert 2001 deterministic events, then expect count/list <= 2000
});

it("filters by source/category/level and bounded search", async () => {
  // insert wago + baileys fixtures, query each filter, assert only matches
});

it("paginates newest-first without duplicate rows", async () => {
  const first = await listAudit({ limit: 2 });
  const second = await listAudit({ limit: 2, before: first.nextCursor });
  expect(new Set([...first.events, ...second.events].map((event) => event.id)).size).toBe(4);
});

it("rejects an invalid cursor", async () => {
  await expect(listAudit({ limit: 20, before: "not-a-valid-cursor" })).rejects.toThrow("INVALID_AUDIT_CURSOR");
});
```

- [ ] **Step 6: Run activity tests and verify RED**

Run:
```bash
pnpm --dir backend test -- src/activity/store.test.ts src/activity/query.test.ts
```
Expected: FAIL because source/query/cursor/2,000 retention are not implemented.

- [ ] **Step 7: Implement typed event model and query layer**

`audit-event.ts` owns event types. Keep compatibility aliases if necessary so existing `ActivityEvent` imports can migrate incrementally.

Use an opaque base64url cursor encoding both timestamp and row identity:

```ts
type AuditCursor = { timestamp: string; rowid: number };

function encodeCursor(cursor: AuditCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}
```

Decode with strict object/type checks. Invalid input throws an Error named `INVALID_AUDIT_CURSOR`.

Use newest-first keyset pagination:

```sql
WHERE (? IS NULL)
   OR timestamp < ?
   OR (timestamp = ? AND rowid < ?)
ORDER BY timestamp DESC, rowid DESC
LIMIT ?
```

Build only whitelisted filters. `q` is trimmed and capped at 100 characters; search only `code`, `title`, and `description` using `LIKE`.

- [ ] **Step 8: Change retention from 300 to 2,000**

In persistence pruning:

```ts
const MAX_ACTIVITY_EVENTS = 2_000;
```

Do not place arbitrary raw metadata into JSON. Preserve the primitive metadata contract and existing redaction.

- [ ] **Step 9: Run activity tests and verify GREEN**

Run:
```bash
pnpm --dir backend test -- src/activity/store.test.ts src/activity/query.test.ts src/infrastructure/database.test.ts
```
Expected: PASS.

- [ ] **Step 10: Commit Task 2**

```bash
git add backend/src/activity backend/src/infrastructure/database.ts backend/src/infrastructure/database.test.ts
git commit -m "feat(audit): add structured sqlite audit queries"
```

---

### Task 3: Capture Sanitized Low-Level Baileys Lifecycle Events and Fix Session Invalidation

**Files:**
- Create: `backend/src/activity/baileys-audit.ts`
- Create: `backend/src/activity/baileys-audit.test.ts`
- Modify: `backend/src/whatsapp/client.ts`
- Modify: `backend/src/whatsapp/connection-state.ts`
- Modify: relevant WhatsApp/client tests; if no direct client test harness exists, create `backend/src/whatsapp/client-lifecycle.test.ts` around extracted pure lifecycle helpers instead of mocking an entire Baileys socket.

**Interfaces:**
- Consumes: `classifyDisconnect()`, `invalidateAccountHealth()`, `recordActivity()`.
- Produces:
  ```ts
  export function recordBaileysAudit(input: {
    level: ActivityLevel;
    category: ActivityCategory;
    code: string;
    title: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditEvent>;

  export function sanitizeBaileysMetadata(input: Record<string, unknown>): AuditMetadata;
  ```

- [ ] **Step 1: Write sanitizer failing tests**

```ts
it("drops or redacts protocol secrets and masks identifiers", () => {
  expect(
    sanitizeBaileysMetadata({
      socketGeneration: 4,
      statusCode: 401,
      terminal: true,
      accountJid: "6281234567890@s.whatsapp.net",
      qr: "secret-qr",
      text: "secret-message",
      token: "secret-token",
      payload: { nested: "raw" },
    }),
  ).toEqual({
    socketGeneration: 4,
    statusCode: 401,
    terminal: true,
    accountJid: "62812***890@s.whatsapp.net",
  });
});
```

Add a test that nested objects/arrays are omitted rather than serialized into audit metadata.

- [ ] **Step 2: Run sanitizer test and verify RED**

Run:
```bash
pnpm --dir backend test -- src/activity/baileys-audit.test.ts
```
Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement strict Baileys sanitizer**

Allowed metadata values are primitives only. Explicitly deny keys containing or equal to:

```text
qr
key
secret
token
cookie
authorization
credential
password
message
text
payload
```

Keys containing `jid` or `phone` use `maskIdentifier()`. Do not recursively serialize unknown protocol objects.

`recordBaileysAudit()` must always call `recordActivity({ source: "baileys", ... })`.

- [ ] **Step 4: Run sanitizer tests and verify GREEN**

Run:
```bash
pnpm --dir backend test -- src/activity/baileys-audit.test.ts
```
Expected: PASS.

- [ ] **Step 5: Write lifecycle regression tests for terminal logout**

Create a focused helper test proving the close path produces:

```text
classification.reason = logged_out
classification.terminal = true
classification.shouldReconnect = false
binding cleared
account health invalidated with session_invalid
```

Also prove recoverable disconnect produces:

```text
binding preserved
account health invalidated with not_connected
reconnect allowed
```

- [ ] **Step 6: Run lifecycle test and verify RED**

Run:
```bash
pnpm --dir backend test -- src/whatsapp/client-lifecycle.test.ts
```
Expected: FAIL until lifecycle logic is centralized/extracted.

- [ ] **Step 7: Instrument socket creation, QR, open, close, reconnect, shutdown**

Record these structured events through the adapter:

```text
baileys.socket.created
baileys.connection.qr_ready
baileys.connection.open
baileys.connection.close
baileys.reconnect.scheduled
baileys.session.invalidated
baileys.socket.shutdown
```

For close events include only safe metadata:

```ts
{
  socketGeneration: generation,
  statusCode: classification.statusCode ?? null,
  reason: classification.reason,
  terminal: classification.terminal,
  reconnect: classification.shouldReconnect,
  reconnectAttempt,
}
```

Use `classification.shouldReconnect` rather than separately re-deriving reconnect behavior in `client.ts`.

- [ ] **Step 8: Correct close/rebind/shutdown health behavior**

On `connection.update` close:

```ts
const classification = classifyDisconnect(...);
markDisconnected();
invalidateAccountHealth(classification.terminal ? "session_invalid" : "not_connected");

if (classification.terminal && !rebindInProgress) {
  clearWhatsAppBinding();
}

if (classification.shouldReconnect) {
  scheduleReconnect(classification.reason);
}
```

At the start of `rebindWhatsApp()` and during shutdown call `invalidateAccountHealth("not_connected")` before exposing the next snapshot.

On `connection=open`, mark health `checking` and force `refreshAccountHealth()`; only a successful refresh makes it `available`.

- [ ] **Step 9: Capture safe credentials/message/account-health diagnostics**

Record:

```text
baileys.credentials.updated        // coalesced success
baileys.credentials.persist_failed // every failure
baileys.message.server_ack
baileys.message.rejected
baileys.account.reachout_timelock
baileys.account.new_chat_cap
baileys.account.health_fetch_failed
```

Coalescing rule for successful `creds.update`: persist at most one success event per socket generation per 60 seconds. Credential persistence failures are never coalesced.

Do not log incoming message content or raw `messages.upsert`.

- [ ] **Step 10: Run focused lifecycle/audit tests**

Run:
```bash
pnpm --dir backend test -- src/activity/baileys-audit.test.ts src/whatsapp/client-lifecycle.test.ts src/whatsapp/account-health.test.ts
```
Expected: PASS.

- [ ] **Step 11: Run full backend tests**

Run:
```bash
pnpm --dir backend test
```
Expected: all backend suites PASS.

- [ ] **Step 12: Commit Task 3**

```bash
git add backend/src/activity/baileys-audit.ts backend/src/activity/baileys-audit.test.ts backend/src/whatsapp
git commit -m "feat(audit): capture sanitized baileys lifecycle events"
```

---

### Task 4: Expose Filtered Cursor-Based Audit API

**Files:**
- Modify: `backend/src/routes/activity.routes.ts`
- Modify/Create route tests in the repository's existing API test location; if activity route assertions live in `backend/src/app.test.ts`, extend that file rather than creating duplicate server setup.

**Interfaces:**
- Consumes: `listAudit(AuditQuery)` from Task 2.
- Produces response:
  ```ts
  {
    success: true,
    events: AuditEvent[],
    nextCursor?: string,
  }
  ```

- [ ] **Step 1: Write authenticated route failing tests**

Cover:

```text
GET /activity?limit=20&source=baileys&category=connection&level=warning&q=logout -> 200
invalid source -> 400 INVALID_AUDIT_FILTER
invalid level -> 400 INVALID_AUDIT_FILTER
limit > 200 -> clamped to 200
invalid cursor -> 400 INVALID_AUDIT_CURSOR
without API auth -> existing 401 behavior
```

- [ ] **Step 2: Run route tests and verify RED**

Run the exact test file used by the project, for example:
```bash
pnpm --dir backend test -- src/app.test.ts
```
Expected: new filter/cursor assertions FAIL.

- [ ] **Step 3: Add strict query parsing**

Whitelist values rather than passing arbitrary strings:

```ts
const auditSources = new Set(["wago", "baileys"]);
const auditCategories = new Set(["system", "security", "connection", "recipient", "messaging"]);
const auditLevels = new Set(["info", "success", "warning", "error"]);
```

Rules:
- default `limit=100`;
- clamp `limit` to `1..200`;
- `q` max 100 chars after trim;
- invalid enum/cursor -> JSON `400` with stable error name;
- successful response includes `nextCursor` only when present.

- [ ] **Step 4: Run route tests and verify GREEN**

Run:
```bash
pnpm --dir backend test -- src/app.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add backend/src/routes/activity.routes.ts backend/src/app.test.ts
git commit -m "feat(audit): add filtered cursor api"
```

---

### Task 5: Introduce Real Frontend Routing and a Global App Shell

**Files:**
- Modify: `frontend/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `frontend/src/app/routes.tsx`
- Create: `frontend/src/shared/layout/AppShell.tsx`
- Modify: `frontend/src/shared/layout/AppSidebar.tsx`
- Modify: `frontend/src/shared/layout/AppHeader.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx`
- Delete: `frontend/src/shared/components/DashboardShell.tsx` after imports are migrated.
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  type AppShellProps = {
    title: string;
    children: ReactNode;
    headerStatus?: {
      label: string;
      tone: "positive" | "warning" | "danger" | "neutral";
    };
    headerAction?: ReactNode;
  };
  ```
- Consumers: Dashboard page and Audit page.

- [ ] **Step 1: Add routing dependency**

Run:
```bash
pnpm --dir frontend add react-router-dom
```
Expected: `frontend/package.json` and root `pnpm-lock.yaml` change; no other dependency is added.

- [ ] **Step 2: Rewrite navigation tests first**

Replace the old assertion that there is a single-page Control nav with tests such as:

```ts
it("renders Control and Audit Log navigation", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Control" })).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Control" })).toHaveLength(1);
  expect(screen.getAllByRole("link", { name: "Audit Log" })).toHaveLength(1);
  expect(screen.queryByRole("heading", { name: "Activity Log" })).toBeNull();
});

it("navigates to the Audit Log page without a full page reload", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("link", { name: "Audit Log" }));
  expect(await screen.findByRole("heading", { name: "Audit Log" })).toBeTruthy();
});
```

Use `window.history.replaceState({}, "", "/")` in `beforeEach` so tests do not leak route state.

- [ ] **Step 3: Run frontend test and verify RED**

Run:
```bash
pnpm --dir frontend test -- src/App.test.tsx
```
Expected: FAIL because `/audit` routing/nav does not exist.

- [ ] **Step 4: Implement `AppShell` and data-driven navigation**

Navigation config:

```ts
const navItems = [
  { to: "/", label: "Control", icon: Gauge, end: true },
  { to: "/audit", label: "Audit Log", icon: ScrollText },
];
```

Use `NavLink` so active state derives from the route. Desktop and mobile sidebar render from the same `navItems` array. Collapsed nav uses accessible `aria-label`/`title`.

`AppShell` owns only sidebar collapse/mobile drawer and page layout; it does not import `WhatsAppStatus` or any feature-domain type.

- [ ] **Step 5: Implement route composition**

`frontend/src/app/routes.tsx`:

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuditLogPage } from "../features/audit/AuditLogPage.js";
import { DashboardPage } from "../features/dashboard/DashboardPage.js";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

During Task 5, create a minimal `AuditLogPage` shell if Task 6 has not yet added its content:

```tsx
export function AuditLogPage() {
  return <AppShell title="Audit Log"><p>Operational audit history</p></AppShell>;
}
```

This placeholder is only a temporary implementation inside the task and is replaced completely in Task 6; do not leave it after Task 6.

- [ ] **Step 6: Migrate Dashboard to `AppShell`**

Dashboard passes:

```tsx
<AppShell
  title="Control"
  headerStatus={headerStatus}
  headerAction={/* existing Refresh button rendered as page action */}
>
  {...}
</AppShell>
```

Remove `ActivityLogPanel` import/render now. Do not move it elsewhere in Control.

- [ ] **Step 7: Run navigation/sidebar regression tests**

Run:
```bash
pnpm --dir frontend test -- src/App.test.tsx
```
Expected: route/nav tests and existing collapse/rebind/pairing/send tests PASS.

- [ ] **Step 8: Build frontend**

Run:
```bash
pnpm --dir frontend build
```
Expected: TypeScript and Vite build PASS.

- [ ] **Step 9: Commit Task 5**

```bash
git add frontend/package.json pnpm-lock.yaml frontend/src
git commit -m "refactor(frontend): add routed global app shell"
```

---

### Task 6: Build Friendly Audit Log Page and Correct Operator Status Semantics

**Files:**
- Create: `frontend/src/features/audit/AuditLogPage.tsx`
- Create: `frontend/src/features/audit/AuditFilters.tsx`
- Create: `frontend/src/features/audit/AuditEventList.tsx`
- Create: `frontend/src/features/audit/AuditEventDetails.tsx`
- Create: `frontend/src/features/audit/useAuditLogQuery.ts`
- Delete after migration: `frontend/src/features/activity/ActivityLogPanel.tsx`
- Delete after migration: `frontend/src/features/activity/ActivityEventList.tsx`
- Delete after migration: `frontend/src/features/activity/useActivityLog.ts`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/features/dashboard/OverviewCards.tsx`
- Modify: `frontend/src/features/whatsapp/AccountHealthCard.tsx`
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes backend response from Task 4.
- Frontend API:
  ```ts
  export type AuditQuery = {
    limit?: number;
    before?: string;
    source?: "wago" | "baileys";
    category?: ActivityCategory;
    level?: ActivityLevel;
    q?: string;
  };

  export async function listActivity(query: AuditQuery = {}): Promise<{
    success: true;
    events: ActivityEvent[];
    nextCursor?: string;
  }>;
  ```

- [ ] **Step 1: Write Audit page behavior tests**

Add tests for:

```text
Audit page has Search, Source, Category, Level filters
Baileys event shows source badge and friendly title
Technical details are collapsed by default
Technical details expand on click and show safe metadata
Refresh calls listActivity with current filters
Load more sends nextCursor and appends older events
Control page does not render Activity Log
```

Example fixture:

```ts
vi.mocked(listActivity).mockResolvedValueOnce({
  success: true,
  events: [
    {
      id: "audit-1",
      timestamp: "2026-08-10T16:11:42.000Z",
      level: "warning",
      category: "connection",
      source: "baileys",
      code: "baileys.connection.close",
      title: "Connection closed",
      description: "WhatsApp ended the linked-device session. Pairing is required again.",
      metadata: {
        statusCode: 401,
        reason: "logged_out",
        terminal: true,
        reconnect: false,
        socketGeneration: 7,
      },
    },
  ],
});
```

- [ ] **Step 2: Run frontend tests and verify RED**

Run:
```bash
pnpm --dir frontend test -- src/App.test.tsx
```
Expected: new Audit page behavior assertions FAIL.

- [ ] **Step 3: Harden frontend API query serialization**

Construct query params only for defined values:

```ts
const params = new URLSearchParams();
if (query.limit) params.set("limit", String(query.limit));
if (query.before) params.set("before", query.before);
if (query.source) params.set("source", query.source);
if (query.category) params.set("category", query.category);
if (query.level) params.set("level", query.level);
if (query.q?.trim()) params.set("q", query.q.trim());
```

Update `ActivityEvent` with `source` and account-health type with `availability`/`unavailableReason`.

- [ ] **Step 4: Implement `useAuditLogQuery`**

State:

```ts
{
  events,
  loading,
  loadingMore,
  error,
  nextCursor,
  filters: { q, source, category, level }
}
```

Behavior:
- fetch on `/audit` mount;
- 10-second refresh only while route is mounted and `document.visibilityState === "visible"`;
- manual refresh replaces the first page but preserves filters;
- filter changes reset cursor/events and fetch first page;
- `loadMore()` appends and de-duplicates by event ID;
- malformed API response becomes a friendly error and never sets `events` to `undefined`.

- [ ] **Step 5: Implement friendly Audit page components**

Top layout:

```text
Audit Log                                      Refresh
Operational and Baileys events. Sensitive values are masked.

Search events...
All sources | All categories | All levels
```

Each row displays:
- local timestamp;
- severity dot/label;
- friendly title;
- one-sentence description;
- `Wago` or `Baileys` source badge;
- category badge;
- collapsed `Technical details`.

`AuditEventDetails` renders primitive metadata only, humanizes keys, and uses monospace for values. Do not surface raw JSON.

Use a natural-height page list rather than the old 390px card scroll container. `Load more` appears at the bottom when `nextCursor` exists.

- [ ] **Step 6: Write outbound/account-health status regression tests**

Add tests equivalent to:

```ts
it("never reports outbound Normal while WhatsApp is disconnected", async () => {
  // mock getWhatsAppStatus with status disconnected + health unavailable
  render(<App />);
  expect(await screen.findByText("Unavailable")).toBeTruthy();
  expect(screen.queryByText("No active restriction")).toBeNull();
});

it("shows account health unavailable when there is no connected session", async () => {
  // status disconnected
  render(<App />);
  expect(await screen.findByText(/available after whatsapp reconnects/i)).toBeTruthy();
});

it("shows Normal only for connected + available health with no restriction", async () => {
  // status connected, health availability available, capping NONE
  render(<App />);
  expect(await screen.findByText("Normal")).toBeTruthy();
});
```

- [ ] **Step 7: Run status tests and verify RED**

Run:
```bash
pnpm --dir frontend test -- src/App.test.tsx
```
Expected: disconnected status tests FAIL before component changes.

- [ ] **Step 8: Fix overview outbound priority**

Change `OverviewCards` so the policy metric consumes all required context:

```ts
function policyMetric(
  backendHealth: BackendHealthState,
  whatsappStatus: WhatsAppStatus,
  accountHealth?: AccountHealthSnapshot,
): Metric
```

Priority exactly:

```text
backend error -> Unknown / Gateway unavailable
WhatsApp != connected -> Unavailable / WhatsApp session is not connected
health checking -> Checking / Reading WhatsApp restrictions
health unavailable -> Unknown / Restriction status is unavailable
reachout active -> New chats limited
cap CAPPED -> New chats capped
cap FIRST_WARNING/SECOND_WARNING -> Warning
otherwise -> Normal / No active restriction reported
```

Do not use missing health fields as proof of normality.

- [ ] **Step 9: Fix AccountHealthCard states**

Accept `status: WhatsAppStatus` or derive an explicit `connected` prop from Dashboard. Render:

```text
disconnected -> Account health unavailable / Connect or pair WhatsApp to read restrictions
checking -> Checking WhatsApp account health...
unavailable(fetch_failed) -> Account health unavailable / Last check failed
available -> show Reach-out + New chats rows
```

Only the `available` branch may render `Reach-out: Available` or `New chats: Normal`.

- [ ] **Step 10: Run frontend suite and build**

Run:
```bash
pnpm --dir frontend test
pnpm --dir frontend build
```
Expected: all frontend tests PASS; build PASS.

- [ ] **Step 11: Commit Task 6**

```bash
git add frontend/src
git commit -m "feat(frontend): add dedicated friendly audit log"
```

---

### Task 7: End-to-End Regression Coverage, Documentation, and Final Quality Gate

**Files:**
- Modify: backend tests as needed for integrated `/whatsapp/status` lifecycle snapshots.
- Modify: `frontend/DESIGN.md` — add multi-page navigation, Audit Log visual/interaction rules, source/severity semantics.
- Modify: `docs/architecture.md` or the repository's existing architecture document — show Baileys audit adapter and session-state separation.
- Modify: `docs/deployment.md` / operations documentation if those are the current filenames — document 2,000-event retention and SQLite impact.
- Modify: `README.md` only if it currently claims Activity Log is embedded in Control.

**Interfaces:** No new runtime interfaces. This task verifies the approved design end to end.

- [ ] **Step 1: Add backend lifecycle integration regression**

Test the public status snapshot semantics after explicit state transitions:

```text
initial/disconnected -> accountHealth.availability = unavailable
connected + successful refresh -> available
recoverable disconnect -> binding remains bound, accountHealth unavailable/not_connected
terminal logout helper -> binding becomes unbound, accountHealth unavailable/session_invalid
```

Do not fake `Outbound: Normal` in backend; the backend exposes factual connection/binding/health data and frontend derives the operator label.

- [ ] **Step 2: Run full backend tests**

Run:
```bash
pnpm --dir backend test
```
Expected: all backend tests PASS.

- [ ] **Step 3: Run full frontend tests**

Run:
```bash
pnpm --dir frontend test
```
Expected: all frontend tests PASS, including navigation, Audit page, sidebar collapse, pairing/rebind, hidden-tab polling, send flow, and disconnected status regression.

- [ ] **Step 4: Update frontend design contract**

Add these explicit rules to `frontend/DESIGN.md`:

```text
Global navigation is route-driven and data-driven.
Control contains operational controls only.
Audit Log owns historical diagnostics.
Friendly explanation is primary; technical metadata is opt-in.
Baileys source is visually distinct but not alarming by default.
Status colors reflect factual availability, never absence of data.
"Normal" requires a positively known connected/available state.
```

- [ ] **Step 5: Update architecture/operations documentation**

Document:

```text
Baileys events -> sanitizer/adapter -> SQLite activity_events -> /activity -> /audit
```

State retention: 2,000 rows, no message bodies/raw protocol payloads.

Document terminal vs recoverable session behavior and that removing Wago from WhatsApp Linked Devices should result in pairing-required state once Baileys reports terminal logout.

- [ ] **Step 6: Run formatter/linter**

Run:
```bash
pnpm check
```
Expected: exit 0 with no Biome errors.

If Biome reports formatting-only changes, run:
```bash
pnpm check:fix
pnpm check
```
Then inspect the diff before proceeding.

- [ ] **Step 7: Run complete repository test/build gate**

Run:
```bash
pnpm test
pnpm build:core
```
Expected: all tests PASS and backend/frontend builds exit 0.

- [ ] **Step 8: Build production Docker image**

Run the same Docker command used by `.github/workflows/ci.yml`. If executing locally from repository root and the workflow uses the root Dockerfile, use:

```bash
docker build -t wago:audit-session-state .
```

Expected: image build exits 0.

- [ ] **Step 9: Manual behavior verification against a real paired account**

With a disposable/test WhatsApp account:

```text
1. Pair successfully.
2. Confirm Control shows WhatsApp Connected.
3. Confirm outbound can become Normal only after health is available.
4. Open /audit and confirm friendly Baileys open/health events appear.
5. On the phone, remove Wago from Linked Devices.
6. Wait for Baileys close event.
7. Confirm Control does not show Outbound Normal.
8. Confirm Account health is unavailable.
9. If Baileys reports loggedOut, confirm binding becomes unbound and UI requires pairing.
10. Confirm /audit shows a sanitized connection-close/session-invalidated event with status/reason/reconnect decision, but no QR, token, message text, credentials, or full JID.
```

If the protocol emits a non-terminal reason for this exact manual action, record that observed reason in the audit log and do not hard-code an undocumented numeric status. Correct classification must follow the actual Baileys reason seen at runtime.

- [ ] **Step 10: Inspect persistence for sensitive leakage**

On the running container, inspect only schema/field names and a sample of sanitized audit rows. Search for known test message text/API key/QR fragments and require zero matches. Do not print live credentials into CI output.

- [ ] **Step 11: Commit docs and final regression changes**

```bash
git add README.md frontend/DESIGN.md docs backend/src frontend/src
git commit -m "docs: document audit and whatsapp session semantics"
```

- [ ] **Step 12: Push branch and open PR**

PR title:
```text
feat(audit): add baileys diagnostics and correct session state
```

PR body must summarize:
- dedicated `/audit` page;
- sanitized Baileys diagnostics;
- server-side cursor filtering;
- terminal/recoverable disconnect classifier;
- health invalidation and Outbound correctness;
- Control Activity Log removal;
- tests and manual linked-device-removal verification.

- [ ] **Step 13: Verify GitHub quality gates before merge**

Require success for:

```text
CI: formatting/lint
CI: backend/frontend tests
CI: core build
CI: Docker Build Core
Docs CI, if triggered by documentation changes
CodeQL
```

Do not merge while any required gate is red or still running.

---

## Plan Self-Review

### Spec coverage

- Dedicated `/audit` page: Tasks 5-6.
- Remove Activity Log from Control: Tasks 5-6.
- Friendly human-first UI with expandable technical details: Task 6.
- `Wago` vs `Baileys` source: Tasks 2-3 and 6.
- Sanitized low-level connection/credentials/message/restriction diagnostics: Task 3.
- No raw Baileys/Pino persistence: Global Constraints + Task 3.
- 2,000-event bounded retention: Task 2.
- Server-side source/category/level/search/cursor filtering: Tasks 2 and 4.
- Central disconnect classifier: Tasks 1 and 3.
- Terminal logout invalidates binding and requires pairing: Task 3.
- Recoverable disconnect preserves binding but invalidates health: Task 3.
- Account-health availability model: Task 1.
- Outbound cannot be Normal while disconnected/unknown: Task 6.
- Multi-page global shell/sidebar: Task 5.
- Real linked-device-removal verification: Task 7.
- Security/persistence leakage verification: Task 7.

### Placeholder scan

The plan contains no `TBD` or `TODO` steps. The temporary minimal Audit page created in Task 5 has a defined replacement in Task 6 and must not survive Task 6.

### Type consistency

- Audit source is consistently `"wago" | "baileys"`.
- Health availability is consistently `"unavailable" | "checking" | "available"`.
- Disconnect classifier consistently returns `statusCode`, `reason`, `terminal`, and `shouldReconnect`.
- Cursor is consistently exposed as opaque `before` input and `nextCursor` output.
- `ActivityEvent`/`AuditEvent` compatibility is explicitly handled during Task 2 and frontend API update in Task 6.
