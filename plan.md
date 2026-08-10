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

Already implemented and treated as baseline:

- outbound consent/opt-out, idempotency, account/recipient/new-chat limits, pause state
- async `202 pending` send semantics
- account reach-out/new-chat-cap checks
- bounded reconnect backoff
- redacted structured logging
- API key/cookie/Origin hardening
- graceful shutdown
- Docker/GHCR/CI/CodeQL/OSS documentation
- frontend feature boundaries and shared layout
- durable application state in `/app/data/wago.db`
- SQLite WAL, migrations, normalized outbound-safety tables, transactional accepted-send bookkeeping

## Non-Goals

Do not add Redis, PostgreSQL, Kafka, queues, multi-session/multi-tenant architecture, message-history persistence, raw protocol payload persistence, bulk/campaign features, anti-detection behavior, or unrelated refactors.

## Execution Protocol

This milestone is intentionally not one-shot. For every iteration:

1. mark only that iteration `in progress`
2. write a failing regression test
3. verify the RED failure is for the intended missing behavior
4. implement the smallest coherent change
5. run focused tests and relevant build/check
6. review the diff for lifecycle/security races
7. update this ledger with RED/GREEN evidence and commit SHA
8. merge only after the iteration quality gate is green
9. stop before the next iteration

---

## Operational Incident: GHCR Release Queue

**Status:** root cause identified; workflow change intentionally kept separate from Iteration 18.

Evidence:

- Release Container run `31377431025` / run #42 remains `in_progress` from commit `75f6531909c16960a806b6285eb9f9fcf8525224`.
- Its `Publish Core GHCR Image` job is stuck at `Build and push core image`.
- `.github/workflows/release-container.yml` uses `concurrency: release-container-${{ github.ref }}` with `cancel-in-progress: false`.
- Therefore newer `main` release runs wait in `pending`; when another pending run arrives, GitHub can replace/cancel the older pending run while the stale in-progress run continues holding the concurrency slot.

Recommended remediation, as a separate release-workflow hotfix:

- cancel stale run #42 once from GitHub Actions to release the current lock;
- change release concurrency to `cancel-in-progress: true` because only the newest `main/latest` image matters;
- add bounded `timeout-minutes` to the publish job so a hung build cannot block releases indefinitely;
- verify the next `main` release publishes `ghcr.io/howlil/wago-simple:latest`.

---

## Milestone 4: Audit Observability and Honest Session State

### Iteration 17: Session-State Correctness

**Status:** completed and merged as `ca75e9e206ea7582ea50068c94e1d8a2af19dae4`.

Completed:

- central terminal/recoverable disconnect classifier;
- explicit account-health `unavailable | checking | available` state;
- health invalidation on disconnect/rebind/shutdown/missing auth/init failure;
- logged-out sessions clear binding and stop reconnect;
- recoverable disconnect keeps binding but health becomes unavailable;
- stale socket references are cleared;
- obsolete in-flight account-health refreshes cannot restore stale `available` state;
- CI, Docker build, and CodeQL green.

Frontend rendering of unavailable health remains deferred to Iteration 19.

### Iteration 18: Structured Low-Level Baileys Audit Backend

**Status:** completed — backend checkpoint reached on `feature/audit-log-backend-iteration18`.

Goal: persist useful Baileys lifecycle evidence without storing raw sensitive protocol payloads.

#### 18A — SQLite Audit Model and Query Layer

- [x] RED migration/query/store regressions before production changes.
- [x] Add migration v3 with `source TEXT NOT NULL DEFAULT 'wago'`.
- [x] Add source/category/level + newest-first audit indexes.
- [x] Move audit event/source/metadata types into `activity/audit-event.ts` while keeping existing call sites compatible.
- [x] Raise bounded retention from 300 to 2,000.
- [x] Add server-side `listAudit()` filtering and keyset cursor pagination.
- [x] Search only `code`, `title`, and `description`; cap search text to 100 chars.
- [x] Invalid cursor fails with stable `INVALID_AUDIT_CURSOR`.
- [x] Equal-timestamp pagination is tested with a fixed clock and row identity tie-breaker.

Acceptance:

- [x] existing activity writes default to `source=wago`;
- [x] filtering/pagination happens in SQLite, not by loading all rows into application memory;
- [x] equal timestamps paginate deterministically using row identity;
- [x] only newest 2,000 events remain.

Evidence:

- RED head `e9e36a6d7d27d438beda2a78002d2e9d3b3f874a`; CI `31414388145` failed on missing query module, migration/source contract, and 2,000-row retention as intended.
- GREEN CI `31414932289` passed check, tests, core build, and Docker build.

#### 18B — Strict Baileys Audit Sanitizer

- [x] RED tests for secret dropping, identifier masking, and nested object/array rejection.
- [x] Add `activity/baileys-audit.ts`.
- [x] Allow primitive metadata only.
- [x] Drop secret/protocol keys including QR, credential/key material, tokens, cookies, authorization, password, message/text, and arbitrary payloads.
- [x] Mask JID/phone values with existing `maskIdentifier()`.
- [x] `recordBaileysAudit()` always persists `source=baileys`.

Acceptance:

- [x] raw protocol objects never enter SQLite metadata through the Baileys adapter;
- [x] full phone/JID/message/QR/auth data cannot be persisted by this adapter.

Evidence:

- RED head `d1add1e1a55dc010f0165b14905686edda70d468`; CI `31415124314` failed because the sanitizer/adapter did not yet exist.
- GREEN CI `31415218064` passed sanitizer tests, project tests/builds, and Docker build.

#### 18C — Baileys Lifecycle Instrumentation

- [x] RED lifecycle/audit regressions first.
- [x] Record socket creation, QR-ready without QR value, connection open/close, disconnect classification, reconnect scheduling, terminal session invalidation, and shutdown.
- [x] Record credential persistence failures and bounded/coalesced credential update success.
- [x] Record message server ACK/rejection without message body or recipient/message identity leakage in audit metadata.
- [x] Record reach-out timelock/new-chat-cap checks/changes and account-health fetch failures using safe primitive metadata.
- [x] Reuse Iteration 17 disconnect classification; reconnect/session semantics are not re-derived.
- [x] Audit persistence failure is isolated from the WhatsApp lifecycle.

Acceptance:

- [x] terminal logout can be diagnosed after the fact from audit rows;
- [x] close event exposes status code/reason/terminal/reconnect/socket generation without raw protocol payload;
- [x] no raw Baileys packet/frame persistence is enabled.

Evidence:

- RED head `97670655d7dc9e333eabe9374f4166519a1b20e0`; CI `31415527250` failed only because the four expected lifecycle audit records did not exist yet.
- GREEN CI `31415984687` passed lifecycle regressions, full tests/build, and Docker build.

#### 18D — Filtered Cursor-Based Audit API

- [x] RED authenticated route tests.
- [x] `GET /activity` accepts `limit`, `before`, `source`, `category`, `level`, and `q`.
- [x] Whitelist enum filters; invalid filter returns `400 INVALID_AUDIT_FILTER`.
- [x] Invalid cursor returns `400 INVALID_AUDIT_CURSOR`.
- [x] Default limit 100; query layer clamps to 1..200.
- [x] Response is `{ success, events, nextCursor? }`.
- [x] Existing API-key authentication behavior remains unchanged.

Evidence:

- RED head `3dfd7bd3d9621b4cc6f109754eb02fd1c24f579e`; CI `31416257346` kept auth green while filter/cursor contracts failed as intended.
- GREEN CI `31416505166` passed route tests, full tests/build, and Docker build.

Iteration 18 final verification:

- [x] focused activity/database/audit/lifecycle/route regressions
- [x] backend + frontend tests through root CI
- [x] backend + frontend/core build through root CI
- [x] `pnpm check` through root CI
- [x] production Docker build
- [x] diff review for pagination/test determinism and lifecycle/privacy boundaries
- [x] reviewed code head `4ac04fdf4e8a1c3766863e2affbecea2dc3b05f6`
- [x] fresh reviewed-code CI `31416724276` success
- [x] fresh reviewed-code CodeQL `31416724242` success

Checkpoint: stop here after final PR-head verification and merge. Do not start frontend `/audit` work in this iteration.

### Iteration 19: Dedicated Audit Log Page and Navigation

**Status:** pending.

Goal: move operational history out of Control and build a readable `/audit` page.

Planned scope:

- remove Activity Log from Control;
- add `/audit` route and data-driven Control/Audit Log navigation;
- build source/category/level/search filters, expandable technical detail, refresh and cursor `Load more`;
- keep default view operator-friendly;
- update Account Health/Outbound cards so unavailable/disconnected state is explicit;
- add frontend route/status/pagination regression tests.

### Iteration 20: Integration Hardening, Docs, and Release Gate

**Status:** pending.

Goal: verify session invalidation + audit behavior end-to-end and leave repository/docs internally consistent.

Planned scope:

- audit status derivations and sensitive logging paths;
- update architecture/operations/security docs;
- test malformed cursor, unknown disconnect reason, fetch failure, rebind, shutdown, restart, and equal timestamps;
- manual linked-device-removal smoke procedure;
- full check/test/build, Docker, Docs CI, CodeQL, and release validation.

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
- Test Wago classifiers/adapters/state transitions, not Baileys internals.
- Keep one WhatsApp account per process.
- Treat `/app/data/wago.db`, WAL/SHM files, and `/app/data/auth` as secret-bearing state.
- Never persist QR data, auth data, API keys, cookies, tokens, full phone/JID, message text, or arbitrary raw protocol payloads.
- Do not run multiple replicas against the same SQLite/auth volume.
- Keep transient state transient unless durability is required for safety or diagnosis.
- Avoid unrelated refactors during each iteration.
