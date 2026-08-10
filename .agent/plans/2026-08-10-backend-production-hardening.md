# Backend Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Wago's backend from its MVP-era internal structure into a production-grade single-instance modular monolith without introducing distributed infrastructure or unnecessary framework layers.

**Architecture:** Keep one Express process, one Baileys WhatsApp session, SQLite for Wago-owned application state, and filesystem-backed Baileys credentials. Refactor incrementally behind characterization tests: HTTP routes become thin transport adapters, application services own orchestration, policy code owns business decisions, SQLite stores own persistence, and Baileys details remain inside the WhatsApp module.

**Tech Stack:** Node.js, TypeScript, Express 5, Baileys 7 RC, Node `node:sqlite`, Vitest, Supertest, Pino, Docker, pnpm 11.

## Global Constraints

- Wago remains a production-grade **single-instance modular monolith**.
- One Wago instance owns one WhatsApp account.
- SQLite remains the authoritative application database.
- Baileys authentication state remains filesystem-backed on the persistent volume.
- Do not add PostgreSQL, MySQL, Redis, Kafka, RabbitMQ, BullMQ, Kubernetes assumptions, microservices, CQRS, event sourcing, or a dependency-injection framework without a demonstrated requirement.
- Released SQLite migrations are append-only.
- Refactoring must not accidentally change public HTTP behavior; deliberate API changes require explicit tests and documentation.
- Raw Baileys socket objects must not leak into HTTP routes or unrelated modules.
- Expected application failures use stable typed errors; HTTP status mapping stays in the HTTP layer.
- Every bug fix or behavior-preserving refactor must have regression coverage.
- Multi-write durable invariants use explicit SQLite transaction boundaries.
- Logs and public responses must not expose API keys, Baileys credentials, tokens, or sensitive payloads.
- CI must not require a real WhatsApp account.
- Every task leaves the staging branch buildable and testable.
- Do not merge partial hardening work directly into `main`.

---

## File Structure Locked by This Plan

The refactor is incremental. Existing files may remain temporarily as compatibility facades while ownership moves into feature modules.

```text
backend/src/
  app/
    lifecycle.ts                 # application startup/shutdown orchestration

  http/
    errors/
      application-error.ts       # stable application error type
      error-response.ts          # application error -> HTTP mapping
    middleware/
      async-handler.ts           # Express async error forwarding
      error-handler.ts           # final JSON error middleware

  modules/
    messages/
      message.service.ts         # send/status application orchestration
      message.service.test.ts
    outbound-policy/
      outbound-policy.ts         # business policy only; no HTTP mapping
      outbound-policy.test.ts
    whatsapp/
      lifecycle.ts               # socket/reconnect/pair/rebind lifecycle
      lifecycle.test.ts
      sender.ts                  # outbound Baileys send boundary
      sender.test.ts
      runtime.ts                 # private active socket ownership

  infrastructure/
    database.ts                  # compatibility facade during refactor
    database/
      migrations.ts              # schema migration definitions + runner
      transaction.ts             # transaction helper

  routes/
    ...                          # kept during migration; become thin adapters
```

Do not mechanically move every existing file into the target tree. Move a file only when a task establishes a clearer owner.

---

### Task 0: Reconcile the Zero-Config Authentication Baseline Before Refactoring

**Files:**
- Existing PR/branch: `feat/zero-config-pairing`
- Existing staging branch: `staging/backend-production-hardening`
- Verify: `backend/src/app.test.ts`
- Verify: `backend/src/config/index.ts`
- Verify: `backend/src/middleware/origin.ts`
- Verify: `docker-compose.yml`

**Interfaces:**
- Consumes: approved zero-config behavior: no required runtime `.env`, first Pair flow bootstraps credentials, production browser mutation protection derives same-origin from request host.
- Produces: one accepted `main` baseline containing zero-config authentication; staging is then refreshed on top of that exact `main` revision before backend code refactoring starts.

- [ ] **Step 1: Update the zero-config branch with current `main` and resolve conflicts without changing intended auth behavior**

```bash
git fetch origin
git switch feat/zero-config-pairing
git rebase origin/main
```

Conflict resolution must preserve these assertions from the zero-config characterization tests:

```ts
expect(response.headers["access-control-allow-origin"]).toBeUndefined();
expect(response.status).toBe(201); // same-origin production bootstrap
expect(config.apiKeySource).toBe("generated");
expect(config.allowWebBootstrap).toBe(false);
```

- [ ] **Step 2: Run the zero-config regression suite**

Run:

```bash
pnpm --dir backend test -- src/app.test.ts src/config/bootstrap.test.ts
pnpm --dir backend run build
pnpm --dir frontend test
pnpm run check
```

Expected: all commands exit `0`.

- [ ] **Step 3: Merge the accepted zero-config PR only after its exact head SHA is green**

Use GitHub's expected-head protection when merging. If the head changes after CI, re-run verification before merge.

- [ ] **Step 4: Rebase staging onto the new `main` and preserve the approved design/plan documents**

```bash
git switch staging/backend-production-hardening
git rebase origin/main
```

Expected: the staging branch contains the zero-config runtime model plus:

```text
docs/superpowers/specs/2026-08-10-backend-production-hardening-design.md
docs/superpowers/plans/2026-08-10-backend-production-hardening.md
```

- [ ] **Step 5: Run a clean baseline before any refactor commit**

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm --dir backend test
pnpm --dir backend run build
pnpm --dir frontend test
pnpm --dir frontend run build
docker build -t wago-hardening-baseline .
```

Expected: all checks pass. If baseline is red, stop and fix/reconcile baseline first; do not begin refactoring on a failing branch.

- [ ] **Step 6: Commit only conflict-resolution changes if needed**

```bash
git add -A
git commit -m "chore: reconcile hardening staging baseline"
```

Skip the commit if the rebase is clean and creates no new changes.

---

### Task 1: Lock Existing HTTP Behavior With Characterization Tests

**Files:**
- Modify: `backend/src/app.test.ts`
- Create: `backend/src/routes/message.routes.contract.test.ts`
- Read-only baseline: `backend/src/routes/message.routes.ts`

**Interfaces:**
- Consumes: current HTTP routes and zero-config authentication behavior.
- Produces: characterization coverage that later tasks must keep green.

- [ ] **Step 1: Add a failing contract test for unauthenticated, invalid-input, and unavailable-WhatsApp message responses**

Add a table-driven contract test that captures stable public responses:

```ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../app.js";
import { config } from "../config/index.js";

const apiKey = "contract-test-key";

describe("message HTTP contract", () => {
  beforeEach(() => {
    config.apiKey = apiKey;
    config.apiKeyHash = null;
    config.apiKeySource = "env";
  });

  it("keeps INVALID_REQUEST stable", async () => {
    const response = await request(app)
      .post("/messages/send")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ to: "", text: "" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "INVALID_REQUEST",
      message: "to and text are required",
    });
  });
});
```

Extend the same file with current stable cases for `401/403` auth behavior, `404 PHONE_NOT_ON_WHATSAPP`, `409 DUPLICATE_MESSAGE`, `429` policy limits, `503 WHATSAPP_NOT_CONNECTED`, and `502 MESSAGE_REJECTED` using existing test seams/mocks rather than real WhatsApp.

- [ ] **Step 2: Run the new contract test before refactoring**

```bash
pnpm --dir backend test -- src/routes/message.routes.contract.test.ts
```

Expected: PASS against current intended behavior. If a case cannot be induced deterministically with current seams, first add only the smallest test seam without changing behavior.

- [ ] **Step 3: Add characterization tests for health/readiness and malformed/oversized JSON if any are not already explicit**

The assertions must include:

```ts
expect((await request(app).get("/health")).body).toEqual({ status: "ok" });
expect(malformed.status).toBe(400);
expect(malformed.body.error).toBe("INVALID_JSON");
expect(oversized.status).toBe(413);
expect(oversized.body.error).toBe("PAYLOAD_TOO_LARGE");
```

- [ ] **Step 4: Run all backend tests**

```bash
pnpm --dir backend test
```

Expected: PASS.

- [ ] **Step 5: Commit characterization coverage**

```bash
git add backend/src/app.test.ts backend/src/routes/message.routes.contract.test.ts
git commit -m "test: lock backend HTTP contracts before hardening"
```

---

### Task 2: Introduce Stable Application Errors and One HTTP Error Mapper

**Files:**
- Create: `backend/src/http/errors/application-error.ts`
- Create: `backend/src/http/errors/error-response.ts`
- Create: `backend/src/http/errors/error-response.test.ts`
- Modify later in this task: `backend/src/routes/message.routes.ts`

**Interfaces:**
- Produces:

```ts
export type ApplicationErrorCode =
  | "WHATSAPP_NOT_CONNECTED"
  | "RECIPIENT_NOT_ALLOWED"
  | "RECIPIENT_OPTED_OUT"
  | "DUPLICATE_MESSAGE"
  | "RECIPIENT_RATE_LIMITED"
  | "ACCOUNT_RATE_LIMITED"
  | "NEW_CHAT_RATE_LIMITED"
  | "WA_REACHOUT_RESTRICTED"
  | "WA_NEW_CHAT_CAPPED"
  | "OUTBOUND_PAUSED"
  | "PHONE_NOT_ON_WHATSAPP"
  | "MESSAGE_REJECTED"
  | "INVALID_PHONE";

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly retryAt?: Date;
}

export function toHttpErrorResponse(error: unknown): {
  status: number;
  body: { success: false; error: string; message: string; retryAt?: string };
} | null;
```

- [ ] **Step 1: Write failing mapper tests**

```ts
import { describe, expect, it } from "vitest";
import { ApplicationError } from "./application-error.js";
import { toHttpErrorResponse } from "./error-response.js";

describe("toHttpErrorResponse", () => {
  it("maps duplicate messages to 409", () => {
    const result = toHttpErrorResponse(
      new ApplicationError("DUPLICATE_MESSAGE", "Message already accepted"),
    );

    expect(result).toEqual({
      status: 409,
      body: { success: false, error: "DUPLICATE_MESSAGE", message: "Message already accepted" },
    });
  });

  it("keeps retry metadata serializable", () => {
    const retryAt = new Date("2026-08-10T12:00:00.000Z");
    const result = toHttpErrorResponse(
      new ApplicationError("ACCOUNT_RATE_LIMITED", "Rate limit exceeded", { retryAt }),
    );

    expect(result?.body.retryAt).toBe(retryAt.toISOString());
  });
});
```

- [ ] **Step 2: Run mapper tests and verify failure**

```bash
pnpm --dir backend test -- src/http/errors/error-response.test.ts
```

Expected: FAIL because the new modules do not exist yet.

- [ ] **Step 3: Implement the minimal typed error**

```ts
export type ApplicationErrorCode =
  | "WHATSAPP_NOT_CONNECTED"
  | "RECIPIENT_NOT_ALLOWED"
  | "RECIPIENT_OPTED_OUT"
  | "DUPLICATE_MESSAGE"
  | "RECIPIENT_RATE_LIMITED"
  | "ACCOUNT_RATE_LIMITED"
  | "NEW_CHAT_RATE_LIMITED"
  | "WA_REACHOUT_RESTRICTED"
  | "WA_NEW_CHAT_CAPPED"
  | "OUTBOUND_PAUSED"
  | "PHONE_NOT_ON_WHATSAPP"
  | "MESSAGE_REJECTED"
  | "INVALID_PHONE";

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly retryAt?: Date;

  constructor(code: ApplicationErrorCode, message: string, options: { retryAt?: Date; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ApplicationError";
    this.code = code;
    this.retryAt = options.retryAt;
  }
}
```

- [ ] **Step 4: Implement one HTTP mapping table**

```ts
import { ApplicationError } from "./application-error.js";

const statusByCode = {
  WHATSAPP_NOT_CONNECTED: 503,
  RECIPIENT_NOT_ALLOWED: 403,
  RECIPIENT_OPTED_OUT: 403,
  DUPLICATE_MESSAGE: 409,
  RECIPIENT_RATE_LIMITED: 429,
  ACCOUNT_RATE_LIMITED: 429,
  NEW_CHAT_RATE_LIMITED: 429,
  WA_REACHOUT_RESTRICTED: 429,
  WA_NEW_CHAT_CAPPED: 429,
  OUTBOUND_PAUSED: 503,
  PHONE_NOT_ON_WHATSAPP: 404,
  MESSAGE_REJECTED: 502,
  INVALID_PHONE: 400,
} satisfies Record<ApplicationError["code"], number>;

export function toHttpErrorResponse(error: unknown) {
  if (!(error instanceof ApplicationError)) return null;

  return {
    status: statusByCode[error.code],
    body: {
      success: false as const,
      error: error.code,
      message: error.message,
      ...(error.retryAt ? { retryAt: error.retryAt.toISOString() } : {}),
    },
  };
}
```

- [ ] **Step 5: Run mapper tests**

```bash
pnpm --dir backend test -- src/http/errors/error-response.test.ts
```

Expected: PASS.

- [ ] **Step 6: Replace only expected-error response duplication in `message.routes.ts` with the mapper**

At the route catch boundary, use:

```ts
const mapped = toHttpErrorResponse(error);
if (mapped) {
  return res.status(mapped.status).json(mapped.body);
}
```

Keep activity logging behavior unchanged in this task. Do not remove the fallback sanitized `500 SEND_MESSAGE_FAILED` response.

- [ ] **Step 7: Run characterization + mapper tests**

```bash
pnpm --dir backend test -- src/http/errors/error-response.test.ts src/routes/message.routes.contract.test.ts src/app.test.ts
```

Expected: PASS with unchanged public error codes/statuses.

- [ ] **Step 8: Commit**

```bash
git add backend/src/http/errors backend/src/routes/message.routes.ts
git commit -m "refactor: centralize application error HTTP mapping"
```

---

### Task 3: Extract Message Application Orchestration From the Route

**Files:**
- Create: `backend/src/modules/messages/message.service.ts`
- Create: `backend/src/modules/messages/message.service.test.ts`
- Modify: `backend/src/routes/message.routes.ts`
- Read: `backend/src/whatsapp.ts`

**Interfaces:**
- Consumes:

```ts
sendTextMessage(to: string, text: string, options?: { idempotencyKey?: string }): Promise<{ messageId: string | null; status: "pending" }>;
getMessageStatus(id: string): MessageStatus | undefined;
```

- Produces:

```ts
export type SendMessageCommand = { to: string; text: string; idempotencyKey?: string };
export async function sendMessage(command: SendMessageCommand): Promise<{ messageId: string | null; status: "pending" }>;
export function findMessageStatus(messageId: string): ReturnType<typeof getMessageStatus>;
```

- [ ] **Step 1: Write failing service tests with the WhatsApp dependency injected as a narrow function**

```ts
import { describe, expect, it, vi } from "vitest";
import { createMessageService } from "./message.service.js";

describe("message service", () => {
  it("forwards a normalized application command to the WhatsApp sender", async () => {
    const sendText = vi.fn().mockResolvedValue({ messageId: "m-1", status: "pending" });
    const service = createMessageService({ sendText, getStatus: vi.fn() });

    await expect(service.send({ to: "6281234567890", text: "Hello", idempotencyKey: "idem-1" }))
      .resolves.toEqual({ messageId: "m-1", status: "pending" });

    expect(sendText).toHaveBeenCalledWith("6281234567890", "Hello", { idempotencyKey: "idem-1" });
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

```bash
pnpm --dir backend test -- src/modules/messages/message.service.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement a minimal service factory**

```ts
export function createMessageService(deps: {
  sendText: typeof sendTextMessage;
  getStatus: typeof getMessageStatus;
}) {
  return {
    send(command: SendMessageCommand) {
      return deps.sendText(command.to, command.text, { idempotencyKey: command.idempotencyKey });
    },
    findStatus(messageId: string) {
      return deps.getStatus(messageId);
    },
  };
}

export const messageService = createMessageService({
  sendText: sendTextMessage,
  getStatus: getMessageStatus,
});
```

This is manual dependency injection at one meaningful external boundary; do not add a DI container.

- [ ] **Step 4: Run the service test**

```bash
pnpm --dir backend test -- src/modules/messages/message.service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Make `message.routes.ts` a transport adapter**

The route should retain authentication, HTTP rate limiting, transport syntax validation, extracting `Idempotency-Key`, activity recording, and response status. Replace the direct WhatsApp call with:

```ts
const result = await messageService.send({ to, text, idempotencyKey });
```

and replace direct status store access with:

```ts
const result = messageService.findStatus(messageId);
```

- [ ] **Step 6: Run route contract tests and the backend suite**

```bash
pnpm --dir backend test -- src/modules/messages/message.service.test.ts src/routes/message.routes.contract.test.ts
pnpm --dir backend test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/messages backend/src/routes/message.routes.ts
git commit -m "refactor: extract message application service"
```

---

### Task 4: Remove HTTP Semantics From Outbound Policy

**Files:**
- Modify: `backend/src/policy/outbound-policy.ts`
- Modify: `backend/src/policy/outbound-policy.test.ts`
- Modify: `backend/src/http/errors/application-error.ts`
- Modify: `backend/src/routes/message.routes.ts`

**Interfaces:**
- Consumes: `OutboundPolicyDecision` from existing policy checks.
- Produces: policy failures as `ApplicationError` with stable codes; policy module no longer exports HTTP status mapping.

- [ ] **Step 1: Add a failing policy test asserting policy code, message, and retry metadata without HTTP status knowledge**

```ts
it("returns a retryable account limit decision without transport semantics", async () => {
  const decision = await checkOutboundPolicy(inputThatExceedsAccountWindow);
  expect(decision).toMatchObject({
    allowed: false,
    reason: "ACCOUNT_RATE_LIMITED",
  });
  if (!decision.allowed) expect(decision.retryAt).toBeInstanceOf(Date);
});
```

- [ ] **Step 2: Run targeted policy tests**

```bash
pnpm --dir backend test -- src/policy/outbound-policy.test.ts
```

Expected: PASS for behavior; this establishes what must survive cleanup.

- [ ] **Step 3: Change `createOutboundPolicyError` to return `ApplicationError`**

```ts
export function createOutboundPolicyError(
  decision: Exclude<OutboundPolicyDecision, { allowed: true }>,
): ApplicationError {
  return new ApplicationError(decision.reason, decision.message, { retryAt: decision.retryAt });
}
```

Extend `ApplicationErrorCode` with the complete `OutboundPolicyBlockReason` union if TypeScript reports any missing code.

- [ ] **Step 4: Delete `getOutboundPolicyHttpStatus` from policy code and remove route imports of it**

HTTP status remains owned by `toHttpErrorResponse` from Task 2.

- [ ] **Step 5: Update `isOutboundPolicyError` to recognize typed application errors**

```ts
export function isOutboundPolicyError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError && outboundPolicyErrorNames.has(error.code as OutboundPolicyBlockReason);
}
```

- [ ] **Step 6: Run policy + message contract tests**

```bash
pnpm --dir backend test -- src/policy/outbound-policy.test.ts src/routes/message.routes.contract.test.ts src/http/errors/error-response.test.ts
```

Expected: PASS; no public HTTP contract changes.

- [ ] **Step 7: Commit**

```bash
git add backend/src/policy/outbound-policy.ts backend/src/policy/outbound-policy.test.ts backend/src/http/errors backend/src/routes/message.routes.ts
git commit -m "refactor: decouple outbound policy from HTTP"
```

---

### Task 5: Convert String/Name-Based Expected WhatsApp Failures to Typed Errors

**Files:**
- Modify: `backend/src/whatsapp/client.ts`
- Modify: `backend/src/whatsapp/message-rejection.ts`
- Modify: `backend/src/http/errors/application-error.ts`
- Modify: `backend/src/routes/message.routes.ts`
- Test: `backend/src/whatsapp.test.ts`
- Test: `backend/src/routes/message.routes.contract.test.ts`

**Interfaces:**
- Produces: expected send failures are `ApplicationError` instances rather than arbitrary `Error.name` / substring checks.

- [ ] **Step 1: Add failing tests for typed disconnected and invalid-phone errors**

```ts
await expect(sendTextMessage("6281234567890", "hello")).rejects.toMatchObject({
  name: "ApplicationError",
  code: "WHATSAPP_NOT_CONNECTED",
});
```

For invalid phone input, assert `code: "INVALID_PHONE"` rather than checking that an error message contains `"Phone number"`.

- [ ] **Step 2: Run targeted WhatsApp tests and verify the new typed assertions fail**

```bash
pnpm --dir backend test -- src/whatsapp.test.ts
```

Expected: FAIL on the new typed assertions.

- [ ] **Step 3: Replace `createNamedError` expected failures with `ApplicationError`**

Example:

```ts
if (!socket || getConnectionStatus() !== "connected") {
  throw new ApplicationError("WHATSAPP_NOT_CONNECTED", "WhatsApp is not connected");
}
```

Wrap phone normalization errors at the WhatsApp module boundary:

```ts
let jid: string;
try {
  jid = toWhatsAppJid(to);
} catch (error) {
  throw new ApplicationError("INVALID_PHONE", error instanceof Error ? error.message : "Invalid phone number", {
    cause: error,
  });
}
```

- [ ] **Step 4: Make message rejection mapping return stable application error codes**

`message-rejection.ts` should return a typed result such as:

```ts
export type MessageRejection = {
  code: "MESSAGE_REJECTED" | "WA_REACHOUT_RESTRICTED";
  message: string;
};
```

and `client.ts` converts that result to `ApplicationError` at the application boundary.

- [ ] **Step 5: Remove route checks based on `error.name` and `error.message.includes(...)` where the mapper now covers them**

Do not remove activity records; key activity category/code off `ApplicationError.code` instead.

- [ ] **Step 6: Run targeted and full backend tests**

```bash
pnpm --dir backend test -- src/whatsapp.test.ts src/routes/message.routes.contract.test.ts src/http/errors/error-response.test.ts
pnpm --dir backend test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/whatsapp backend/src/whatsapp.test.ts backend/src/http/errors backend/src/routes/message.routes.ts
git commit -m "refactor: use typed WhatsApp application errors"
```

---

### Task 6: Split WhatsApp Runtime Lifecycle From Outbound Sending

**Files:**
- Create: `backend/src/modules/whatsapp/runtime.ts`
- Create: `backend/src/modules/whatsapp/lifecycle.ts`
- Create: `backend/src/modules/whatsapp/lifecycle.test.ts`
- Create: `backend/src/modules/whatsapp/sender.ts`
- Create: `backend/src/modules/whatsapp/sender.test.ts`
- Modify: `backend/src/whatsapp/client.ts`
- Modify: `backend/src/whatsapp.ts`

**Interfaces:**
- Produces internal runtime API:

```ts
export type ActiveWhatsAppRuntime = {
  socket: WASocket | undefined;
  generation: number;
  reconnecting: boolean;
  rebindInProgress: boolean;
  shuttingDown: boolean;
};

export function getActiveSocket(): WASocket | undefined;
export function replaceActiveSocket(socket: WASocket | undefined): number;
export function isCurrentGeneration(generation: number): boolean;
```

- Produces lifecycle API:

```ts
initializeWhatsApp(): Promise<void>;
resumeWhatsAppSession(): Promise<void>;
pairWhatsApp(): Promise<{ status: WhatsAppStatus }>;
rebindWhatsApp(): Promise<{ status: WhatsAppStatus }>;
shutdownWhatsApp(): Promise<void>;
```

- Produces sender API:

```ts
sendTextMessage(to: string, text: string, options?: SendTextMessageOptions): Promise<SendTextMessageResult>;
```

- [ ] **Step 1: Write lifecycle tests for duplicate-init suppression and stale socket generation**

Use injected fake socket creation rather than real Baileys networking. The lifecycle seam should allow:

```ts
const createSocket = vi.fn().mockResolvedValue(fakeSocket);
const lifecycle = createWhatsAppLifecycle({ createSocket, credentialStore: fakeCredentialStore });

await Promise.all([lifecycle.initialize(), lifecycle.initialize()]);
expect(createSocket).toHaveBeenCalledTimes(1);
```

Add a stale-generation test proving events from an old socket do not mutate current connection state.

- [ ] **Step 2: Run lifecycle tests and verify failure**

```bash
pnpm --dir backend test -- src/modules/whatsapp/lifecycle.test.ts
```

Expected: FAIL because lifecycle seam does not exist.

- [ ] **Step 3: Move only mutable socket ownership and generation helpers into `runtime.ts`**

Keep the module private to WhatsApp. Do not export `WASocket` through `backend/src/whatsapp.ts`.

- [ ] **Step 4: Move reconnect/pair/rebind/shutdown orchestration into `lifecycle.ts`**

Preserve existing safeguards:

```text
one reconnect timer
one active connection attempt
stale generation ignored
logged-out session does not reconnect forever
credential writes flush before destructive rebind/shutdown
```

- [ ] **Step 5: Run lifecycle tests**

```bash
pnpm --dir backend test -- src/modules/whatsapp/lifecycle.test.ts src/whatsapp.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write sender tests that inject a narrow active-socket getter**

```ts
const sender = createWhatsAppSender({
  getSocket: () => fakeSocket,
  getConnectionStatus: () => "connected",
});

await expect(sender.sendText("6281234567890", "hello", { idempotencyKey: "k-1" }))
  .resolves.toMatchObject({ status: "pending" });
```

Test disconnected behavior and policy-block behavior without opening a real WhatsApp connection.

- [ ] **Step 7: Move send-only orchestration into `sender.ts`**

The sender owns:

```text
connected check
phone -> JID conversion
outbound policy check
recipient JID resolution
socket.sendMessage
recent message/status recording
accepted/rejected policy recording
reach-out restriction refresh
```

It does not own reconnect, pairing, rebind, or shutdown.

- [ ] **Step 8: Turn `backend/src/whatsapp/client.ts` into a temporary compatibility facade or delete it if all imports are migrated in the same commit**

Preferred compatibility facade during transition:

```ts
export * from "../modules/whatsapp/lifecycle.js";
export * from "../modules/whatsapp/sender.js";
```

Do not leave duplicated implementations.

- [ ] **Step 9: Run the complete backend suite and build**

```bash
pnpm --dir backend test
pnpm --dir backend run build
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/src/modules/whatsapp backend/src/whatsapp backend/src/whatsapp.ts backend/src/whatsapp.test.ts
git commit -m "refactor: separate WhatsApp lifecycle from sending"
```

---

### Task 7: Make SQLite Migration and Transaction Ownership Explicit

**Files:**
- Create: `backend/src/infrastructure/database/migrations.ts`
- Create: `backend/src/infrastructure/database/migrations.test.ts`
- Create: `backend/src/infrastructure/database/transaction.ts`
- Modify: `backend/src/infrastructure/database.ts`
- Modify: `backend/src/infrastructure/database.test.ts`

**Interfaces:**
- Produces:

```ts
export type Migration = { version: number; sql: string };
export function runMigrations(database: DatabaseSync, migrations: readonly Migration[]): void;
export function withTransaction<T>(database: DatabaseSync, operation: () => T): T;
```

- [ ] **Step 1: Write a clean-database migration test**

Create a temporary SQLite database and assert versions `1` and `2` are recorded exactly once after two runs:

```ts
runMigrations(db, migrations);
runMigrations(db, migrations);
const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
expect(rows).toEqual([{ version: 1 }, { version: 2 }]);
```

- [ ] **Step 2: Write a transaction rollback test**

```ts
expect(() =>
  withTransaction(db, () => {
    db.prepare("INSERT INTO application_meta (key, value) VALUES (?, ?)").run("x", "1");
    throw new Error("boom");
  }),
).toThrow("boom");

expect(db.prepare("SELECT value FROM application_meta WHERE key = ?").get("x")).toBeUndefined();
```

- [ ] **Step 3: Run the new tests and verify failure because the extracted modules do not exist**

```bash
pnpm --dir backend test -- src/infrastructure/database/migrations.test.ts src/infrastructure/database.test.ts
```

- [ ] **Step 4: Move migration definitions and runner unchanged into `migrations.ts`**

Do not alter existing migration SQL. Versions `1` and `2` remain byte-for-byte semantically equivalent; do not rewrite already released schemas during a structural refactor.

- [ ] **Step 5: Extract `withTransaction(database, operation)` into `transaction.ts`**

```ts
export function withTransaction<T>(database: DatabaseSync, operation: () => T): T {
  if (database.isTransaction) return operation();
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
```

- [ ] **Step 6: Keep `database.ts` as the configured singleton/facade**

It should initialize pragmas, call `runMigrations`, run legacy import, and re-export a bound transaction helper for existing callers:

```ts
export function withTransaction<T>(operation: () => T): T {
  return runInTransaction(database, operation);
}
```

- [ ] **Step 7: Run database tests + full backend suite**

```bash
pnpm --dir backend test -- src/infrastructure/database.test.ts src/infrastructure/database/migrations.test.ts src/infrastructure/legacy-json-import.test.ts
pnpm --dir backend test
```

Expected: PASS; no schema version changes.

- [ ] **Step 8: Commit**

```bash
git add backend/src/infrastructure/database.ts backend/src/infrastructure/database backend/src/infrastructure/database.test.ts
git commit -m "refactor: isolate SQLite migrations and transactions"
```

---

### Task 8: Make Multi-Write Outbound Safety Transactions Fail Closed

**Files:**
- Modify: `backend/src/policy/outbound-policy.ts`
- Modify: `backend/src/policy/outbound-policy-persistence.test.ts`
- Modify if needed: `backend/src/policy/outbound-policy-store.ts`
- Modify if needed: `backend/src/recipients/store.ts`

**Interfaces:**
- Consumes: `withTransaction` and existing accepted-outbound persistence operations.
- Produces: a documented invariant that rate-limit/idempotency/recipient-success writes for an accepted message are one durable transaction and persistence failure is not silently treated as a fully successful application state.

- [ ] **Step 1: Add a failing regression test for transaction failure**

Inject or simulate a persistence failure after one of the accepted-outbound writes and assert no partial durable state remains:

```ts
await expect(recordOutboundAccepted(input, "message-1", resolvedJid)).rejects.toThrow();
expect(isIdempotencyKeyActive("idem-1", Date.now())).toBe(false);
expect(getRecipientByJidSync(input.jid)?.lastSuccessfulOutboundAt).toBeFalsy();
```

- [ ] **Step 2: Run the targeted persistence test and confirm current behavior exposes the weakness**

```bash
pnpm --dir backend test -- src/policy/outbound-policy-persistence.test.ts
```

Expected: the new assertion fails if the current code logs-and-continues on a transaction failure.

- [ ] **Step 3: Change `recordOutboundAccepted` to propagate durable-state failure**

Do not swallow the transaction exception after WhatsApp has already accepted a message. Convert it into a typed internal/application failure that clearly states the message may have been accepted upstream but Wago failed to persist safety state.

Use a stable code such as:

```ts
"OUTBOUND_STATE_PERSIST_FAILED"
```

Add it to `ApplicationErrorCode`. Map it to HTTP `500` with a sanitized message; log the original cause and `messageId` internally.

- [ ] **Step 4: Keep all accepted-state writes inside one SQLite transaction**

```ts
withTransaction(() => {
  recordAcceptedOutbound(...);
  rememberSuccessfulOutboundSync(...);
  pruneOutboundSafety(...);
});
```

- [ ] **Step 5: Run policy persistence + message contract tests**

```bash
pnpm --dir backend test -- src/policy/outbound-policy-persistence.test.ts src/routes/message.routes.contract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/policy backend/src/recipients backend/src/http/errors
git commit -m "fix: fail closed when outbound safety persistence fails"
```

---

### Task 9: Consolidate Express Async/Error Handling Without Hiding Failures

**Files:**
- Create: `backend/src/http/middleware/async-handler.ts`
- Create: `backend/src/http/middleware/error-handler.ts`
- Create: `backend/src/http/middleware/error-handler.test.ts`
- Modify: `backend/src/app.ts`
- Modify incrementally: `backend/src/routes/message.routes.ts`, `backend/src/routes/recipient.routes.ts`, `backend/src/routes/whatsapp.routes.ts`, `backend/src/routes/app.routes.ts`

**Interfaces:**
- Produces:

```ts
export function asyncHandler(handler: RequestHandler): RequestHandler;
export const errorHandler: ErrorRequestHandler;
```

- [ ] **Step 1: Write failing middleware tests for invalid JSON, oversized body, typed application error, and unknown error**

Unknown errors must produce:

```json
{
  "success": false,
  "error": "INTERNAL_SERVER_ERROR",
  "message": "Internal server error"
}
```

and must not include stack/cause details.

- [ ] **Step 2: Run the middleware tests and verify failure**

```bash
pnpm --dir backend test -- src/http/middleware/error-handler.test.ts
```

- [ ] **Step 3: Implement `asyncHandler`**

```ts
export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
```

- [ ] **Step 4: Implement the final JSON error middleware**

Order handling as:

```text
malformed JSON
payload too large
ApplicationError via toHttpErrorResponse
unknown error -> structured logger + sanitized 500
```

Do not log request authorization headers, cookies, API keys, or full bodies.

- [ ] **Step 5: Replace `jsonErrorHandler` in `app.ts` with the shared final handler**

`app.use(errorHandler)` must be the final API error middleware after route registration.

- [ ] **Step 6: Wrap asynchronous route handlers as they are touched; do not create a controller/service class hierarchy**

Example:

```ts
messageRouter.post(
  "/send",
  requireApiKey,
  createRateLimit({ limit: 30, windowMs: 60_000 }),
  asyncHandler(async (req, res) => {
    // transport validation + messageService call
  }),
);
```

- [ ] **Step 7: Run HTTP characterization and full tests**

```bash
pnpm --dir backend test -- src/http/middleware/error-handler.test.ts src/app.test.ts src/routes/message.routes.contract.test.ts
pnpm --dir backend test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/http/middleware backend/src/app.ts backend/src/routes
git commit -m "refactor: centralize Express error handling"
```

---

### Task 10: Refactor Application Lifecycle Into an Explicit Startup/Shutdown Owner

**Files:**
- Create: `backend/src/app/lifecycle.ts`
- Create: `backend/src/app/lifecycle.test.ts`
- Modify: `backend/src/index.ts`
- Modify or retire: `backend/src/infrastructure/server-lifecycle.ts`
- Test: `backend/src/infrastructure/server-lifecycle.test.ts`

**Interfaces:**
- Produces:

```ts
export type ApplicationLifecycleDeps = {
  resumeWhatsAppSession: () => Promise<void>;
  shutdownWhatsApp: () => Promise<void>;
  flushOutboundPolicyPersistence: () => Promise<void>;
  checkpointDatabase: () => void;
  closeDatabase: () => void;
};

export function createApplicationLifecycle(deps: ApplicationLifecycleDeps): {
  start(): Promise<void>;
  stop(signal: NodeJS.Signals | "test"): Promise<void>;
};
```

- [ ] **Step 1: Write failing lifecycle ordering tests**

Assert shutdown order:

```ts
expect(events).toEqual([
  "whatsapp.shutdown",
  "policy.flush",
  "database.checkpoint",
  "database.close",
]);
```

Also assert two concurrent `stop()` calls execute cleanup only once.

- [ ] **Step 2: Run lifecycle tests and verify failure**

```bash
pnpm --dir backend test -- src/app/lifecycle.test.ts
```

- [ ] **Step 3: Implement the minimal lifecycle owner with idempotent stop**

Use one private `stopPromise` rather than multiple shutdown booleans scattered across the HTTP bootstrap.

- [ ] **Step 4: Make `index.ts` only wire app, lifecycle, HTTP server, and OS signals**

Target responsibility:

```ts
await lifecycle.start();
const server = app.listen(port, host, ...);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void lifecycle.stop(signal).finally(() => server.close()));
}
```

Preserve current startup failure logging and non-zero exit behavior.

- [ ] **Step 5: Remove or convert old `server-lifecycle.ts` into a compatibility re-export only if needed**

Do not keep two lifecycle implementations.

- [ ] **Step 6: Run lifecycle + backend tests and build**

```bash
pnpm --dir backend test -- src/app/lifecycle.test.ts src/infrastructure/server-lifecycle.test.ts
pnpm --dir backend test
pnpm --dir backend run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/app backend/src/index.ts backend/src/infrastructure/server-lifecycle*
git commit -m "refactor: make application lifecycle explicit"
```

---

### Task 11: Clarify Health/Readiness Internally Without Breaking the Existing Public Contract

**Files:**
- Create: `backend/src/modules/gateway/readiness.ts`
- Create: `backend/src/modules/gateway/readiness.test.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/app.test.ts`

**Interfaces:**
- Produces:

```ts
export type ReadinessSnapshot = {
  status: "ok";
  appId: string;
  apiKeyConfigured: boolean;
};

export function getReadinessSnapshot(): ReadinessSnapshot;
```

- [ ] **Step 1: Write a failing unit test that derives readiness from app credential state**

```ts
expect(getReadinessSnapshot()).toEqual({
  status: "ok",
  appId: config.appId,
  apiKeyConfigured: false,
});
```

The public shape remains intentionally unchanged in this refactor. A future semantic change to readiness is a separate API design decision.

- [ ] **Step 2: Run and verify failure**

```bash
pnpm --dir backend test -- src/modules/gateway/readiness.test.ts
```

- [ ] **Step 3: Implement the snapshot and call it from `/ready`**

```ts
app.get("/ready", (_req, res) => {
  res.json(getReadinessSnapshot());
});
```

- [ ] **Step 4: Run readiness/app characterization tests**

```bash
pnpm --dir backend test -- src/modules/gateway/readiness.test.ts src/app.test.ts
```

Expected: PASS with identical `/ready` response body.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/gateway backend/src/app.ts backend/src/app.test.ts
git commit -m "refactor: isolate gateway readiness state"
```

---

### Task 12: Replace MVP Engineering Rules With Production-Grade Backend Rules

**Files:**
- Modify: `AGENTS.md`
- Modify if architecture documentation references MVP-only structure: `docs/src/components/docs/ArchitectureDoc.astro`
- Modify if development docs reference MVP constraints: `docs/src/components/docs/DevelopmentDoc.astro`

**Interfaces:**
- Produces: repository-wide engineering guidance matching the approved production architecture.

- [ ] **Step 1: Remove obsolete project-state declarations**

Delete statements equivalent to:

```text
This is an MVP.
Do not design this project as a large SaaS platform unless requirements explicitly change.
```

Replace the project state with exactly this architectural intent:

```text
Wago is a production-grade, single-instance modular monolith for one self-hosted WhatsApp account per instance.
```

- [ ] **Step 2: Replace the engineering priority order**

Use:

```text
1. Correctness
2. Security
3. Data integrity
4. Reliability
5. Maintainability
6. Observability
7. Simplicity
8. Performance
9. Extensibility
```

- [ ] **Step 3: Add mandatory backend rules from the approved design**

The rules must explicitly require:

```text
clear module ownership
external-input validation
stable typed expected errors
bug-fix regression tests
explicit multi-write transaction boundaries
append-only released migrations
explicit lifecycle/state transitions
idempotency where retries can duplicate side effects
structured sanitized logs
graceful startup/shutdown
documented deliberate API contract changes
Baileys internals contained inside WhatsApp module
```

- [ ] **Step 4: Add anti-over-engineering rules**

Explicitly prohibit adding by default:

```text
microservices
Redis/queues as decoration
generic repository/service/controller layers for every feature
ports/adapters/factories/mappers/DTO layers without a concrete need
SQL inside routes
HTTP status decisions inside business policy
```

- [ ] **Step 5: Update architecture/development docs only where they contradict the new state**

Do not rewrite unrelated product documentation.

- [ ] **Step 6: Run docs and repository checks**

```bash
pnpm run check
pnpm run build:docs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md docs/src/components/docs/ArchitectureDoc.astro docs/src/components/docs/DevelopmentDoc.astro
git commit -m "docs: define production-grade backend engineering rules"
```

---

### Task 13: Full Regression, Container, Persistence, and Rollback Verification

**Files:**
- Create: `scripts/smoke-container.sh`
- Modify: `.github/workflows/ci.yml` only if the smoke test can run reliably in GitHub-hosted CI without external WhatsApp connectivity.
- Create: `docs/superpowers/plans/2026-08-10-backend-production-hardening-verification.md` as the executed verification record when this task is run.

**Interfaces:**
- Consumes: all refactored modules.
- Produces: evidence that staging is safe to review/merge and an explicit rollback rehearsal.

- [ ] **Step 1: Create a deterministic container smoke script**

The script must:

```bash
#!/usr/bin/env bash
set -euo pipefail

IMAGE="wago-hardening-smoke"
NAME="wago-hardening-smoke-$RANDOM"
VOLUME="wago-hardening-smoke-$RANDOM"
PORT="39030"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker build -t "$IMAGE" .
docker volume create "$VOLUME" >/dev/null
docker run -d --name "$NAME" -p "127.0.0.1:${PORT}:3000" -v "$VOLUME:/app/data" "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null; then
    break
  fi
  sleep 1
done

curl -fsS "http://127.0.0.1:${PORT}/health" | grep -q '"status":"ok"'
curl -fsS "http://127.0.0.1:${PORT}/ready" | grep -q '"apiKeyConfigured":false'

docker restart "$NAME" >/dev/null
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null; then
    break
  fi
  sleep 1
done
curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null
```

No real WhatsApp account is required.

- [ ] **Step 2: Run all static/test/build checks**

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm --dir backend test
pnpm --dir backend run build
pnpm --dir frontend test
pnpm --dir frontend run build
pnpm run build:docs
bash scripts/smoke-container.sh
```

Expected: every command exits `0`.

- [ ] **Step 3: Verify clean SQLite creation and restart persistence**

Start the container with a named volume, stop it, restart the same image with the same volume, and confirm:

```text
schema_migrations remains populated once per migration
app identity remains stable
no migration is re-applied destructively
container remains healthy
```

Record exact commands and observed results in the verification document.

- [ ] **Step 4: Perform manual staging WhatsApp smoke test with a dedicated test account**

Verify in order:

```text
fresh dashboard opens
Pair WhatsApp bootstraps credentials without .env
QR appears
scan succeeds
status becomes connected
send to an explicitly allowed test recipient succeeds
restart container
session resumes without QR
rebind produces a fresh pairing flow
graceful stop exits without credential corruption
```

Never place the generated API key or Baileys session content in the verification document.

- [ ] **Step 5: Rehearse rollback against persistent data**

With a copy/snapshot of the staging persistent volume:

```text
run hardening revision B
stop B
start previously known-good revision A against the same copied persistent state
verify /health
verify /ready
verify dashboard loads
verify session state is readable
```

If a hardening change introduces a migration that prevents revision A from starting, stop the release and redesign that migration for backward compatibility before merge.

- [ ] **Step 6: Record verification results without secrets**

The verification document must include:

```text
Git SHA tested
unit/integration test result
Docker build result
container smoke result
SQLite persistence result
manual pairing result
restart/session-resume result
rebind result
rollback rehearsal result
known limitations, if any
```

No `TBD` items are allowed before requesting final review.

- [ ] **Step 7: Commit smoke tooling and verification record**

```bash
git add scripts/smoke-container.sh docs/superpowers/plans/2026-08-10-backend-production-hardening-verification.md .github/workflows/ci.yml
git commit -m "test: verify backend production hardening"
```

Only include `.github/workflows/ci.yml` if it was actually changed.

---

### Task 14: Final Staging Review and Pull Request — Do Not Auto-Merge

**Files:**
- Review all changes between `main` and `staging/backend-production-hardening`.
- No production code should be added in this task.

**Interfaces:**
- Produces: one reviewable hardening PR with immutable head SHA and verification evidence.

- [ ] **Step 1: Re-run the final branch diff and check scope**

```bash
git fetch origin
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

Expected: no whitespace errors; changes are confined to approved backend hardening, tests, and directly relevant docs/tooling.

- [ ] **Step 2: Run the exact final verification suite on the PR head**

```bash
pnpm run check
pnpm --dir backend test
pnpm --dir backend run build
pnpm --dir frontend test
pnpm --dir frontend run build
pnpm run build:docs
bash scripts/smoke-container.sh
```

Expected: PASS.

- [ ] **Step 3: Open a PR from staging to `main` with a production-hardening summary**

The PR body must state:

```text
architecture remains single-instance modular monolith
no Redis/queue/database-server dependency added
public HTTP contract preserved except explicitly documented changes
SQLite migrations remain append-only
Baileys auth remains filesystem-backed
manual WhatsApp staging smoke completed
rollback rehearsal completed
```

- [ ] **Step 4: Wait for GitHub CI/CodeQL on the exact PR head SHA**

Do not claim the branch is green until the workflow runs associated with the exact head SHA are completed successfully.

- [ ] **Step 5: Review the PR diff for accidental architecture ceremony**

Reject or simplify any change that added a layer with no concrete responsibility, such as a repository interface with one implementation and no test seam benefit, an empty controller wrapper, or a generic internal framework.

- [ ] **Step 6: Stop at review-ready state**

Do **not** merge the production-hardening PR automatically. Present the PR, exact head SHA, CI results, verification record, and rollback result to the user for explicit merge approval.
