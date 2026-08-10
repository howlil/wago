# Wago Engineering Iteration Plan

## Target

Build a production-ready, single-account, self-hosted WhatsApp gateway that stays small and understandable:

- one process
- one WhatsApp account
- one persistent `/app/data` volume
- SQLite for application durable state
- Baileys auth under `/app/data/auth`
- transient protocol/UI caches in memory
- Docker-first deployment
- conservative outbound behavior
- no bulk/campaign/anti-detection features

Production-ready does not mean zero WhatsApp enforcement risk. Baileys is an unofficial WhatsApp Web client, so Wago must fail closed, expose session health truthfully, and never disguise protocol uncertainty as a healthy state.

## Current Foundation

The previous production-readiness work is already implemented and should be treated as baseline rather than reworked in this milestone:

- outbound consent/opt-out, idempotency, account/recipient/new-chat limits, pause state
- async `202 pending` send semantics
- account reach-out/new-chat-cap checks
- bounded reconnect backoff
- focused WhatsApp modules
- redacted structured logging
- API key/cookie/Origin hardening
- graceful shutdown
- Docker/GHCR/CI/CodeQL/OSS documentation
- frontend feature boundaries and shared layout
- application durable state consolidated into `/app/data/wago.db`
- SQLite WAL, migrations, normalized outbound-safety tables, transactional accepted-send bookkeeping

Open release validation such as tagged-release smoke tests remains separate from the work below.

## Non-Goals

Do not add:

- Redis, PostgreSQL, Kafka, BullMQ, or another database service
- multi-session or multi-tenant architecture
- raw Baileys packet/frame persistence
- message-history persistence
- raw QR/auth/Signal-key persistence outside Baileys' existing auth store
- bulk sender/campaign scheduler
- fake typing, random delays, proxy/fingerprint rotation, or anti-detection behavior
- a custom frontend router unless the small routing dependency proves unnecessary

## Execution Protocol

This milestone is intentionally **not one-shot**.

For every iteration:

1. mark only that iteration `in progress`
2. write a failing regression test for the behavior being changed
3. implement the smallest coherent change
4. run focused tests
5. run the relevant package build/check
6. update this file with the actual result and commit SHA
7. merge that iteration only after its own quality gate is green
8. stop at a checkpoint before starting the next iteration

Each iteration is independently reviewable and may merge to `main` once green. Never merge a RED test checkpoint or an unverified implementation merely to preserve sequence.

---

## Milestone 4: Audit Observability and Honest Session State

### Iteration 17: Session-State Correctness

**Status:** completed — checkpoint reached

Goal: make the backend session/health model truthful when WhatsApp disconnects or the linked-device session becomes invalid. Frontend presentation of these new states remains intentionally deferred to Iteration 19.

Tasks:

- [x] Add one central disconnect classifier for terminal vs recoverable Baileys disconnects.
- [x] Explicitly model account-health availability (`unavailable`, `checking`, `available`).
- [x] Invalidate operator-visible account health when connection closes, rebind starts, or shutdown clears the active socket.
- [x] Treat `DisconnectReason.loggedOut` as terminal: clear binding, do not reconnect, require pairing.
- [x] Keep binding for recoverable disconnects, but never expose cached health as currently available.
- [x] Force health refresh after a successful `connection=open`.
- [x] Make backend status snapshots truthful when health is unavailable.
- [x] Add regression tests for linked-device removal/logged-out behavior and recoverable disconnect behavior.

Acceptance:

- [x] Backend `/whatsapp/status` data cannot expose stale reach-out/new-chat health as currently available after disconnect.
- [x] Terminal logout requires a new pairing and does not schedule reconnect.
- [x] Recoverable disconnect keeps the binding but exposes health as unavailable until restored.
- [x] Existing send hard-check still rejects when socket/status is not connected.
- [ ] Frontend must stop rendering `Outbound: Normal` for disconnected/unavailable state — deferred to Iteration 19.

Verification:

- [x] disconnect/account-health/lifecycle regressions execute in the backend suite
- [x] `pnpm --dir backend test` via core CI
- [x] `pnpm --dir backend run build` via core CI
- [x] `pnpm check` via core CI
- [x] production Docker build via core CI
- [x] CodeQL on the reviewed code head

Result:

- Initial RED evidence: `a36f130d08ce7007291b143ee7cda7b81994fec0` failed because `disconnect-classifier` did not yet exist.
- First implementation head: `2a0be4562e7ad4a1551f337309716d32ccba7c4c`; core CI run `31411469734` passed.
- Review found an async race where a health refresh started while connected could resolve after disconnect invalidation and restore stale `available` state.
- Race RED evidence: `b69765c79589865b9df31a5650bb239ead4a3b56`; CI run `31411860794` failed exactly on the in-flight refresh regression.
- Race fix: `3511ef39fb26c17c4996530dcd1b0b50d49f2c59` discards refresh results from an obsolete lifecycle/request generation.
- Reviewed code CI run `31412009674` passed check, tests, core builds, and Docker build.
- Reviewed code CodeQL run `31412009670` passed.
- PR checkpoint: #17.

Checkpoint: stop here. Iteration 18 must not begin until this checkpoint is merged and `main` is green.

### Iteration 18: Structured Low-Level Baileys Audit Backend

**Status:** pending

Goal: persist useful Baileys lifecycle evidence without storing raw sensitive protocol payloads.

Tasks:

- [ ] Add `source: wago | baileys` to the audit event model and SQLite schema.
- [ ] Add a dedicated Baileys audit adapter/sanitizer.
- [ ] Record selected lifecycle events: socket creation, QR availability without QR value, connection open/close, disconnect classification, reconnect scheduling, terminal session invalidation, credential persistence failures, message ACK/rejection, reach-out timelock/new-chat-cap changes.
- [ ] Never persist message body, QR value, credentials, Signal keys, tokens, cookies, API keys, full JIDs/phones, or arbitrary nested Baileys payloads.
- [ ] Increase bounded audit retention to 2,000 events.
- [ ] Add server-side filters and cursor pagination to `GET /activity`.
- [ ] Add indexes for newest-first pagination and common filters.
- [ ] Add backend security/regression tests for sanitization, retention, filters, and pagination.

Acceptance:

- [ ] A terminal disconnect can be diagnosed from audit history after the event.
- [ ] Technical detail is useful enough to identify status code/reason/reconnect decision/socket generation.
- [ ] Sensitive fields never enter SQLite audit metadata.
- [ ] The API does not load/filter the whole 2,000-row timeline in application memory.

Verification:

- [ ] focused activity/audit tests
- [ ] `pnpm --dir backend test`
- [ ] `pnpm --dir backend run build`
- [ ] `pnpm check`

Checkpoint: stop here and inspect real audit payload shape before building UI.

### Iteration 19: Dedicated Audit Log Page and Navigation

**Status:** pending

Goal: move operational history out of Control and make low-level diagnostics friendly to ordinary users.

Tasks:

- [ ] Remove Activity Log completely from the Control page.
- [ ] Add a real `/audit` page.
- [ ] Generalize `DashboardShell` into an application shell with page title/action slots.
- [ ] Make sidebar navigation data-driven with `Control` and `Audit Log` on desktop/mobile.
- [ ] Add routing with the smallest maintainable solution; prefer `react-router-dom` if a dependency is needed.
- [ ] Build Audit Log UI with search, source/category/level filters, newest-first timeline, source/severity/category labels, friendly descriptions, expandable technical details, refresh, and `Load more` cursor pagination.
- [ ] Keep technical metadata opt-in; default view must be readable without knowing Baileys internals.
- [ ] Update Account Health/Outbound cards so disconnected/unavailable state is visually explicit rather than optimistic.
- [ ] Add frontend regression tests for routes, sidebar active state, no Activity Log on Control, audit filtering/pagination, and disconnected status semantics.

Acceptance:

- [ ] Sidebar contains exactly the intended workspace pages: `Control` and `Audit Log`.
- [ ] Control has no Activity Log panel.
- [ ] Audit Log is useful to both an operator and a developer debugging Baileys.
- [ ] `Outbound: Normal` is shown only when backend is reachable, WhatsApp is connected, account health is available, and no active restriction is reported.

Verification:

- [ ] `pnpm --dir frontend test`
- [ ] `pnpm --dir frontend run build`
- [ ] `pnpm check`

Checkpoint: stop here for UX review before final hardening.

### Iteration 20: Integration Hardening, Docs, and Release Gate

**Status:** pending

Goal: prove the whole behavior end-to-end and leave the repository internally consistent.

Tasks:

- [ ] Audit all status derivations for stale/optimistic values.
- [ ] Audit all Baileys logging paths for accidental sensitive persistence.
- [ ] Update architecture/operations/security documentation for Audit Log, session invalidation, retention, and privacy boundaries.
- [ ] Add/adjust tests for equal timestamps, malformed cursors, unknown disconnect reason, health fetch failure, rebind, shutdown, and restart.
- [ ] Perform manual linked-device-removal smoke procedure and document expected state transitions.
- [ ] Run full root check/test/build, Docker build, Docs CI, and CodeQL.
- [ ] Open/finalize the iteration PR only after the branch is internally green; squash-merge only after all checks pass.

Acceptance:

- [ ] Removing Wago from WhatsApp Linked Devices changes Wago to disconnected/pairing-required state without stale healthy outbound indicators.
- [ ] Audit Log contains enough sanitized evidence to explain the transition.
- [ ] No raw secret/message/session payload is persisted by Audit Log.
- [ ] Core, frontend, Docker, docs, and CodeQL gates are green.

Verification:

- [ ] `pnpm check`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] production Docker build
- [ ] Docs CI
- [ ] CodeQL

---

## Milestone 5: Outbound Safety Hardening

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this milestone task-by-task.

**Status:** planned from the 2026-08-11 Baileys outbound-safety audit.

**Goal:** close the remaining failure modes where Wago can incorrectly treat an uncertain/rejected outbound as safe, exceed its own local pacing under concurrency, or continue cold outbound when WhatsApp account-health information is unavailable.

**Architecture:** keep the single-process/single-account model. Add a small in-process serial outbound dispatcher instead of Redis/BullMQ/background workers; separate gateway dispatch bookkeeping from WhatsApp `SERVER_ACK`; make cold/new-chat policy fail closed when account health is unknown; and make asynchronous `463` rejection feed back into recipient/account safety state.

**Tech Stack:** Node.js, TypeScript, Express, `@whiskeysockets/baileys`, Node SQLite, Vitest.

### Audit Findings and Priority

The current implementation already has meaningful defensive controls: explicit recipient allowlisting, opt-out enforcement, idempotency, account/per-recipient/new-chat rate limits, persistent cooldown/pause state, Baileys Reachout Timelock and New Chat Message Cap checks, `463` mapping, bounded reconnect backoff, session persistence, and message ACK/rejection tracking.

The remaining gaps are:

- **P0 — health fetch failure is fail-open for new recipients.** `account-health.ts` marks health unavailable but `checkAccountHealth()` still returns `{ allowed: true }` after a fetch error.
- **P0 — `lastSuccessfulOutboundAt` is written before WhatsApp `SERVER_ACK`.** A message that later receives asynchronous `463` can incorrectly turn a cold recipient into a known recipient.
- **P0 — asynchronous `463` does not apply the per-recipient reach-out cooldown.** The synchronous throw path does, the `messages.update` path does not.
- **P1 — policy check and outbound bookkeeping are not serialized.** Concurrent `/messages/send` requests can all observe the same pre-send counters before any request records its event.
- **P1 — there is no automatic reason-aware circuit breaker for repeated protocol rejections.** The persistent outbound pause exists, but it is primarily manual.
- **P2 — inbound conversation context is not recorded.** Wago cannot distinguish a cold contact from a contact that recently initiated a conversation.
- **P2 — outbound limits are hard-coded.** They are Wago guardrails, not official WhatsApp safe limits, and should be optional configuration with conservative defaults.

### Global Constraints

- Never describe this milestone as guaranteeing an account will not be banned or restricted.
- Do not add fake typing, randomized humanization, proxy/fingerprint rotation, device spoofing, or anti-detection behavior.
- Do not add Redis, BullMQ, Kafka, RabbitMQ, background workers, distributed locks, or another service.
- Keep one WhatsApp account per process and rely on that invariant for the in-process dispatcher.
- Continue requiring explicit recipient `allowed=true`; inbound traffic must never silently grant outbound consent.
- Keep message bodies, QR values, credentials, Signal keys, tokens, cookies, API keys, and full identifiers out of new safety/audit logs.
- Treat Wago's numeric rate/circuit-breaker thresholds as local safety guardrails, never as documented WhatsApp anti-ban thresholds.

### Iteration 21: Fail-Closed New-Chat Health

**Status:** pending — P0

Goal: never start a new/cold outbound conversation when Wago cannot determine current WhatsApp reach-out/new-chat health.

**Files:**

- Modify: `backend/src/whatsapp/account-health.ts`
- Modify: `backend/src/whatsapp/account-health.test.ts`
- Modify: `backend/src/policy/outbound-policy.ts`
- Modify: `backend/src/policy/outbound-policy.test.ts`
- Modify: `backend/src/routes/message.routes.ts`
- Test: existing backend Vitest suites above

**Interfaces:**

- `AccountHealthDecision` adds reason `WA_HEALTH_UNAVAILABLE`.
- `checkAccountHealth(fetcher, { isNewRecipient })` returns `WA_HEALTH_UNAVAILABLE` for a new recipient when health availability is `checking` or `unavailable` after a fetch attempt, unless a stronger known restriction already blocks the send.
- Known recipients remain eligible for the existing policy path when health fetch fails; the hard socket/connection check still applies before policy evaluation.
- `getOutboundPolicyHttpStatus("WA_HEALTH_UNAVAILABLE")` returns `503`.

Tasks:

- [ ] Change the existing fetch-error regression from fail-open to fail-closed for `isNewRecipient: true`:

```ts
it("fails closed for new recipients when account health cannot be fetched", async () => {
  const fetcher = makeFetcher({
    fetchAccountReachoutTimelock: vi.fn(async () => {
      throw new Error("boom");
    }),
  });

  await expect(checkAccountHealth(fetcher, { isNewRecipient: true })).resolves.toMatchObject({
    allowed: false,
    reason: "WA_HEALTH_UNAVAILABLE",
  });
});
```

- [ ] Add a companion regression proving a known recipient remains allowed when only the optional account-health fetch is unavailable and the socket itself is connected.
- [ ] Preserve the last known `reachoutTimeLock` and `newChatCap` values when a refresh fails; update `availability`, `unavailableReason`, and `lastFetchErrorAt` without clearing known restriction data.
- [ ] Evaluate active known restrictions before the unknown-health fallback so an existing `WA_REACHOUT_RESTRICTED`/`WA_NEW_CHAT_CAPPED` reason is not hidden by `WA_HEALTH_UNAVAILABLE`.
- [ ] Add `WA_HEALTH_UNAVAILABLE` to `OutboundPolicyBlockReason`, `outboundPolicyErrorNames`, and HTTP status mapping.
- [ ] Add route regression verifying `/messages/send` returns `503` with `error: "WA_HEALTH_UNAVAILABLE"` for a cold recipient when the health fetch fails.
- [ ] Run focused tests:

```bash
pnpm --dir backend test -- account-health.test.ts outbound-policy.test.ts app.test.ts
```

Expected: all focused regressions pass.

- [ ] Run backend quality gate:

```bash
pnpm --dir backend test
pnpm --dir backend run build
pnpm check
```

- [ ] Commit only this iteration:

```bash
git add backend/src/whatsapp/account-health.ts backend/src/whatsapp/account-health.test.ts backend/src/policy/outbound-policy.ts backend/src/policy/outbound-policy.test.ts backend/src/routes/message.routes.ts plan.md
git commit -m "fix(whatsapp): fail closed when new-chat health is unknown"
```

Acceptance:

- [ ] A health-fetch failure cannot silently permit a cold/new recipient send.
- [ ] Existing known restriction data survives a transient health-fetch error.
- [ ] Known-recipient behavior remains explicit and covered by tests.
- [ ] No new external dependency is introduced.

Checkpoint: stop and review the policy semantics before changing send bookkeeping.

### Iteration 22: ACK-Correct Recipient Success and Async `463` Cooldown

**Status:** pending — P0

Goal: only classify a recipient as successfully reached after WhatsApp acknowledges the message, and make delayed `463` rejections update recipient/account protection state.

**Files:**

- Modify: `backend/src/whatsapp/client.ts`
- Modify: `backend/src/whatsapp/message-status-store.ts`
- Modify: `backend/src/whatsapp/message-status-store.test.ts` if present; otherwise add focused coverage in `backend/src/whatsapp.test.ts`
- Modify: `backend/src/policy/outbound-policy.ts`
- Modify: `backend/src/policy/outbound-policy-store.ts`
- Modify: `backend/src/policy/outbound-policy.test.ts`
- Modify: `backend/src/recipients/store.ts`
- Modify: `backend/src/recipients/store.test.ts`
- Test: `backend/src/whatsapp.test.ts`

**Interfaces:**

Replace the overloaded success bookkeeping with two explicit phases:

```ts
export async function recordOutboundDispatched(
  input: OutboundPolicyInput,
  messageId: string | null,
): Promise<void>;

export function rememberPendingMessageStatus(input: {
  id: string;
  policyJid: string;
  resolvedJid: string;
}): void;

export function markRecipientOutboundAcknowledged(
  policyJid: string,
  resolvedJid?: string,
): void;
```

`recordOutboundDispatched()` records rate-limit/idempotency state after `socket.sendMessage()` resolves locally, but **must not** update `lastSuccessfulOutboundAt`.

Tasks:

- [ ] Add a regression proving a locally dispatched message does not set `lastSuccessfulOutboundAt` before `SERVER_ACK`.
- [ ] Extend pending message status to keep both the policy/original JID and resolved WhatsApp JID for the one-hour transient status lifetime.
- [ ] Rename/refactor `recordOutboundAccepted()` to `recordOutboundDispatched()` and keep outbound-event/idempotency recording there.
- [ ] Remove `rememberSuccessfulOutboundSync()` from the dispatch bookkeeping path.
- [ ] On `messages.update` where `status >= WAMessageStatus.SERVER_ACK`, resolve the stored pending status and call `markRecipientOutboundAcknowledged(policyJid, resolvedJid)` before/with status transition to `accepted`.
- [ ] Add regression proving `SERVER_ACK` sets `lastSuccessfulOutboundAt` exactly once and preserves resolved JID.
- [ ] On asynchronous `WAMessageStatus.ERROR` mapped as `REACHOUT_RESTRICTED`, read the pending message's `policyJid` and call:

```ts
markReachoutRestricted();
await markRecipientReachoutRestricted(
  policyJid,
  Date.now() + REACHOUT_RESTRICTION_COOLDOWN_MS,
);
```

The event callback may use a small internal async handler invoked with `void` so the Baileys emitter is not blocked by unrelated persistence latency.

- [ ] Add regression proving asynchronous `463` keeps `lastSuccessfulOutboundAt` unset and creates the recipient cooldown.
- [ ] Keep the current synchronous `REACHOUT_RESTRICTED` path as a fallback for errors thrown directly by `sendMessage()`.
- [ ] Run focused tests:

```bash
pnpm --dir backend test -- whatsapp.test.ts outbound-policy.test.ts store.test.ts
```

- [ ] Run backend quality gate:

```bash
pnpm --dir backend test
pnpm --dir backend run build
pnpm check
```

- [ ] Commit only this iteration:

```bash
git add backend/src/whatsapp backend/src/policy backend/src/recipients plan.md
git commit -m "fix(whatsapp): mark outbound success only after server ack"
```

Acceptance:

- [ ] `sendMessage()` resolving locally cannot make a cold recipient look successfully reached.
- [ ] `SERVER_ACK` is the transition that updates `lastSuccessfulOutboundAt`.
- [ ] A delayed `463` applies both account-level reach-out state and per-recipient cooldown.
- [ ] Rate-limit/idempotency bookkeeping still happens before the next serialized outbound job in Iteration 23.

Checkpoint: stop and inspect real Baileys `messages.update` payload behavior against the test doubles before introducing serialization.

### Iteration 23: Single-Account Serial Outbound Dispatcher

**Status:** pending — P1

Goal: remove the check-then-record concurrency race without adding a distributed queue or background worker.

**Files:**

- Create: `backend/src/whatsapp/outbound-dispatcher.ts`
- Create: `backend/src/whatsapp/outbound-dispatcher.test.ts`
- Modify: `backend/src/whatsapp/client.ts`
- Modify: `backend/src/whatsapp.test.ts`

**Interfaces:**

```ts
export function dispatchOutbound<T>(job: () => Promise<T>): Promise<T>;
export function resetOutboundDispatcherForTest(): void;
```

The implementation is an in-process promise tail with concurrency `1`. A rejected job must not poison the tail; the next queued job must still execute.

Minimal intended shape:

```ts
let tail: Promise<void> = Promise.resolve();

export function dispatchOutbound<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job, job);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
```

Tasks:

- [ ] Write dispatcher tests proving two concurrent jobs execute in submission order and never overlap.
- [ ] Write a dispatcher test proving a rejected first job does not prevent the second job from running.
- [ ] Move the complete critical outbound sequence inside `dispatchOutbound()`:

```text
connection re-check
→ checkOutboundPolicy
→ resolveRecipientJid
→ socket.sendMessage
→ remember pending status
→ recordOutboundDispatched
```

- [ ] Re-check `socket` and `getConnectionStatus()` **inside** the queued job, because the session may disconnect while the request waits.
- [ ] Add a concurrency regression that launches more simultaneous sends than the remaining account window and proves later jobs observe the updated persistent counter rather than the same stale count.
- [ ] Do not add sleeps/random jitter to message sending; pacing comes from serialization plus existing policy windows.
- [ ] Run focused tests:

```bash
pnpm --dir backend test -- outbound-dispatcher.test.ts whatsapp.test.ts outbound-policy.test.ts
```

- [ ] Run backend quality gate:

```bash
pnpm --dir backend test
pnpm --dir backend run build
pnpm check
```

- [ ] Commit only this iteration:

```bash
git add backend/src/whatsapp/outbound-dispatcher.ts backend/src/whatsapp/outbound-dispatcher.test.ts backend/src/whatsapp/client.ts backend/src/whatsapp.test.ts plan.md
git commit -m "fix(whatsapp): serialize single-account outbound sends"
```

Acceptance:

- [ ] Policy evaluation and dispatch bookkeeping are ordered for the single-account process.
- [ ] Concurrent HTTP requests cannot all consume the same stale outbound counter snapshot.
- [ ] A failed job cannot deadlock or permanently poison outbound dispatch.
- [ ] No Redis/BullMQ/background-worker dependency is added.

Checkpoint: stop here. P0/P1 core correctness is now reviewable as one safety foundation.

### Iteration 24: Reason-Aware Automatic Circuit Breaker

**Status:** pending — P1

Goal: stop repeated protocol rejection storms automatically while preserving explicit operator visibility and manual recovery controls.

**Files:**

- Modify: `backend/src/infrastructure/database.ts`
- Modify: `backend/src/policy/outbound-policy-store.ts`
- Modify: `backend/src/policy/outbound-policy.ts`
- Modify: `backend/src/policy/outbound-policy-persistence.test.ts`
- Create: `backend/src/policy/outbound-circuit-breaker.ts`
- Create: `backend/src/policy/outbound-circuit-breaker.test.ts`
- Modify: `backend/src/whatsapp/client.ts`
- Modify: `backend/src/routes/whatsapp.routes.ts` only if operator-visible pause metadata needs to be exposed through the existing status response

**Interfaces and defaults:**

```ts
const REJECTION_BREAKER_WINDOW_MS = 5 * 60_000;
const REJECTION_BREAKER_THRESHOLD = 3;
const REJECTION_BREAKER_PAUSE_MS = 30 * 60_000;

export function recordProtocolRejection(input: {
  reason: "REACHOUT_RESTRICTED" | "MESSAGE_REJECTED";
  now?: number;
}): { tripped: boolean; retryAt?: Date };
```

These values are **Wago-local guardrails**, not claimed WhatsApp limits.

Tasks:

- [ ] Add a SQLite migration for bounded protocol-rejection timestamps and automatic pause metadata (`outbound_pause_until`, `outbound_pause_reason`) while preserving existing manual `outbound_paused` behavior.
- [ ] Implement pruning so only the active five-minute breaker window is retained.
- [ ] Trip the automatic breaker after the third relevant protocol rejection in five minutes and set a 30-minute pause.
- [ ] Make `checkPauseState()` automatically clear an expired automatic pause while leaving a manual pause active until explicitly resumed.
- [ ] Feed both synchronous and asynchronous `REACHOUT_RESTRICTED`/`MESSAGE_REJECTED` paths into the breaker exactly once per message rejection.
- [ ] Add tests for threshold-1/threshold-2 not tripping, threshold-3 tripping, expiry, restart persistence, and manual pause taking precedence over auto-expiry.
- [ ] Expose pause reason/retry time in the existing policy error/status metadata without exposing recipient identifiers.
- [ ] Run focused tests:

```bash
pnpm --dir backend test -- outbound-circuit-breaker.test.ts outbound-policy-persistence.test.ts whatsapp.test.ts
```

- [ ] Run backend quality gate:

```bash
pnpm --dir backend test
pnpm --dir backend run build
pnpm check
```

- [ ] Commit only this iteration:

```bash
git add backend/src/infrastructure/database.ts backend/src/policy backend/src/whatsapp/client.ts backend/src/routes/whatsapp.routes.ts plan.md
git commit -m "feat(whatsapp): add protocol rejection circuit breaker"
```

Acceptance:

- [ ] Repeated protocol rejection cannot cause an unbounded immediate retry storm through Wago.
- [ ] Automatic pause survives process restart and expires predictably.
- [ ] Manual pause remains manual and is never silently auto-resumed.
- [ ] The UI/API can explain why outbound is paused without exposing sensitive data.

Checkpoint: review real-world false-positive risk before changing the default breaker values.

### Iteration 25: Inbound Context and Configurable Guardrails

**Status:** pending — P2

Goal: record enough conversation context to distinguish cold vs recipient-initiated contacts later, and make Wago's local safety limits adjustable without code edits.

**Files:**

- Modify: `backend/src/infrastructure/database.ts`
- Modify: `backend/src/recipients/store.ts`
- Modify: `backend/src/recipients/store.test.ts`
- Modify: `backend/src/whatsapp/client.ts`
- Modify: `backend/src/config/index.ts`
- Modify: `backend/src/config/validation.ts`
- Modify: `backend/src/config/validation.test.ts`
- Modify: `backend/.env.example`
- Modify: `backend/src/policy/outbound-policy.ts`
- Modify: `backend/src/policy/outbound-policy.test.ts`

**Interfaces and defaults:**

Add nullable recipient field:

```ts
lastInboundAt?: string;
```

Add optional configuration with current behavior as defaults:

```text
WA_ACCOUNT_MAX_PER_MINUTE=30
WA_RECIPIENT_MAX_PER_MINUTE=5
WA_NEW_CHAT_MAX_PER_HOUR=10
```

These settings are optional; they must not become new required environment variables.

Tasks:

- [ ] Add a SQLite migration for `recipients.last_inbound_at`.
- [ ] Add `rememberInboundMessage(jid: string): void` that upserts/updates recipient context but defaults a newly observed recipient to `allowed=false` and `optedOut=false`.
- [ ] Handle Baileys `messages.upsert` only for real inbound messages needed for recipient context; ignore own outbound echoes and do not persist message text/content.
- [ ] Add tests proving inbound observation updates `lastInboundAt` but does **not** grant outbound permission.
- [ ] Expose `lastInboundAt` through the existing recipient model/API only if already consistent with current API privacy expectations; otherwise keep it internal for policy/diagnostics.
- [ ] Move the three hard-coded policy limits into typed configuration with positive-integer validation and the existing values as defaults.
- [ ] Add tests proving omitted environment values retain `30/5/10`, invalid/non-positive values fail validation, and explicit valid values are used by policy decisions.
- [ ] Do **not** automatically weaken Reachout Timelock/New Chat Cap checks solely because `lastInboundAt` exists. Any future inbound-first exemption requires separate protocol evidence and tests.
- [ ] Run focused tests:

```bash
pnpm --dir backend test -- store.test.ts validation.test.ts outbound-policy.test.ts whatsapp.test.ts
```

- [ ] Run full quality gate:

```bash
pnpm check
pnpm test
pnpm build
```

- [ ] Commit only this iteration:

```bash
git add backend/src/infrastructure/database.ts backend/src/recipients backend/src/whatsapp/client.ts backend/src/config backend/.env.example backend/src/policy plan.md
git commit -m "feat(whatsapp): record inbound context and configure safety limits"
```

Acceptance:

- [ ] Wago can tell whether it has observed inbound activity for a recipient without storing the message body.
- [ ] Inbound observation never grants `allowed=true` automatically.
- [ ] Existing default pacing behavior is unchanged when new optional environment variables are omitted.
- [ ] Documentation states that configurable limits are local Wago guardrails, not WhatsApp-approved safe thresholds.

Checkpoint: stop here for the final outbound-safety review.

### Milestone 5 Final Verification

Before calling the safety milestone complete:

- [ ] Verify cold-recipient send is blocked on account-health fetch failure.
- [ ] Verify a locally resolved send remains `pending` and does not update recipient success until `SERVER_ACK`.
- [ ] Verify asynchronous `463` leaves recipient success unset, adds recipient cooldown, updates account restriction state, and contributes to the circuit breaker once.
- [ ] Verify 30+ concurrent HTTP sends cannot bypass the configured single-account window through a check/record race.
- [ ] Verify a dispatcher job failure does not block later jobs forever.
- [ ] Verify repeated protocol rejection trips the persistent automatic pause and that expiry/manual pause semantics are correct.
- [ ] Verify inbound messages update context without creating outbound consent.
- [ ] Verify all new safety state survives process restart where durability is required.
- [ ] Verify no message body, QR value, credential, Signal key, token, API key, cookie, or raw protocol payload is introduced into persistent safety state.
- [ ] Run:

```bash
pnpm check
pnpm test
pnpm build
docker build -t wago:safety-audit .
```

- [ ] Review the resolved Baileys package/version before release and confirm the pinned version includes the Reachout Timelock/New Chat Cap/`463` behavior on which Wago relies.

Definition of done:

- Wago remains an unofficial-client gateway with non-zero enforcement risk, but its own application behavior is conservative, deterministic, observable, and resistant to the concrete failure modes identified in the 2026-08-11 audit.
- No feature in this milestone claims to bypass WhatsApp enforcement or hide automation.

---

## Implementation Rules

- Prefer explicit failure/unknown state over optimistic status.
- Do not unit-test Baileys internals; test Wago's classifiers, adapters, and state transitions.
- Keep one WhatsApp account per process.
- Treat `/app/data/wago.db`, WAL/SHM files, and `/app/data/auth` as secret-bearing state.
- Do not log or persist QR data, auth data, API keys, cookies, tokens, full phone numbers/JIDs, or message text.
- Do not run multiple replicas against the same SQLite/auth volume.
- Keep transient state transient unless durability is required for safety or diagnosis.
- Avoid unrelated refactors during these iterations.
