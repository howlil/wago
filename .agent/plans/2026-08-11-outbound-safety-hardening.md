# Outbound Safety Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the concrete outbound-safety failure modes found in the 2026-08-11 Baileys/Wago audit without adding distributed infrastructure or anti-detection behavior.

**Architecture:** Keep one Wago process and one WhatsApp account. Add conservative fail-closed health handling for cold recipients, separate local dispatch from WhatsApp `SERVER_ACK`, serialize the single-account critical send path in-process, add a bounded persistent rejection circuit breaker, record inbound context without granting consent, and make Wago-local pacing values configurable with current defaults.

**Tech Stack:** Node.js, TypeScript, Express, `@whiskeysockets/baileys`, Node SQLite, Vitest.

## Global Constraints

- Wago remains an unofficial-client gateway with non-zero enforcement risk.
- Never claim any change guarantees an account will not be banned/restricted.
- Do not add fake typing, random humanization, proxy/fingerprint rotation, device spoofing, or anti-detection behavior.
- Do not add Redis, BullMQ, Kafka, RabbitMQ, background workers, distributed locks, or another service.
- Keep one WhatsApp account per process.
- Explicit recipient `allowed=true` remains required; inbound observation never grants consent.
- Never persist message bodies, QR values, credentials, Signal keys, tokens, cookies, API keys, full identifiers, or raw protocol payloads in new safety state.
- Wago numeric thresholds are local guardrails, not official WhatsApp safe limits.

## Audit Findings

P0:

1. health fetch failure currently fails open for new/cold recipients;
2. `lastSuccessfulOutboundAt` is written before WhatsApp `SERVER_ACK`;
3. asynchronous `463` rejection does not apply recipient-specific cooldown.

P1:

4. policy check → send → bookkeeping is not serialized, allowing concurrent requests to observe the same counter snapshot;
5. repeated protocol rejection has no reason-aware automatic circuit breaker.

P2:

6. inbound conversation context is not recorded;
7. outbound guardrails are hard-coded.

---

## Iteration 21: Fail-Closed New-Chat Health

**Status:** pending — P0.

**Files:**
- Modify: `backend/src/whatsapp/account-health.ts`
- Modify: `backend/src/whatsapp/account-health.test.ts`
- Modify: `backend/src/policy/outbound-policy.ts`
- Modify: `backend/src/policy/outbound-policy.test.ts`
- Modify: `backend/src/routes/message.routes.ts`

**Contract:** add `WA_HEALTH_UNAVAILABLE`; block new recipients when account health is unavailable/checking after a failed refresh, while preserving stronger known restriction reasons and allowing known-recipient policy evaluation when the connected socket itself is healthy.

TDD sequence:

- [ ] Change the existing fetch-error regression so `isNewRecipient: true` expects `{ allowed: false, reason: "WA_HEALTH_UNAVAILABLE" }`.
- [ ] Add companion known-recipient regression.
- [ ] Preserve last-known reachout/new-chat restriction snapshot on refresh failure; mark availability/error metadata without clearing known restriction values.
- [ ] Evaluate known restrictions before unknown-health fallback.
- [ ] Add reason to policy error names and map it to HTTP `503`.
- [ ] Add route regression for cold send returning `503 WA_HEALTH_UNAVAILABLE`.
- [ ] Run:

```bash
pnpm --dir backend test -- account-health.test.ts outbound-policy.test.ts app.test.ts
pnpm --dir backend test
pnpm --dir backend run build
pnpm check
```

Acceptance:

- health-fetch failure cannot silently permit a cold/new recipient send;
- known restriction data survives transient fetch errors;
- no external dependency added.

---

## Iteration 22: ACK-Correct Recipient Success and Async `463` Cooldown

**Status:** pending — P0.

**Files:**
- Modify: `backend/src/whatsapp/client.ts`
- Modify: `backend/src/whatsapp/message-status-store.ts`
- Modify/add focused tests in `backend/src/whatsapp.test.ts` and/or status-store tests
- Modify: `backend/src/policy/outbound-policy.ts`
- Modify: `backend/src/policy/outbound-policy-store.ts`
- Modify: `backend/src/policy/outbound-policy.test.ts`
- Modify: `backend/src/recipients/store.ts`
- Modify: `backend/src/recipients/store.test.ts`

**Interfaces:**

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

Rules:

- `recordOutboundDispatched()` updates rate/idempotency state after local `socket.sendMessage()` resolution but does **not** set `lastSuccessfulOutboundAt`.
- `SERVER_ACK` is the transition that marks recipient outbound success.
- async `463` uses pending message identity to apply account-level restriction and recipient cooldown.

TDD sequence:

- [ ] RED: local dispatch does not set recipient success.
- [ ] Store policy/original JID + resolved JID in pending message state.
- [ ] Rename/refactor accepted bookkeeping to dispatched bookkeeping.
- [ ] Remove premature `rememberSuccessfulOutboundSync()` call.
- [ ] On `status >= SERVER_ACK`, mark recipient acknowledged once, then transition message status accepted.
- [ ] RED/GREEN: server ACK sets success exactly once.
- [ ] Async `REACHOUT_RESTRICTED` calls `markReachoutRestricted()` and `markRecipientReachoutRestricted(policyJid, now + 30min)`.
- [ ] RED/GREEN: async `463` does not set recipient success and does create cooldown.
- [ ] Keep synchronous `REACHOUT_RESTRICTED` fallback.
- [ ] Run:

```bash
pnpm --dir backend test -- whatsapp.test.ts outbound-policy.test.ts store.test.ts
pnpm --dir backend test
pnpm --dir backend run build
pnpm check
```

Acceptance:

- local resolution cannot classify a cold recipient as successfully reached;
- `SERVER_ACK` owns successful-recipient transition;
- delayed `463` updates both account and recipient safety state.

---

## Iteration 23: Single-Account Serial Outbound Dispatcher

**Status:** pending — P1.

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

Minimal shape:

```ts
let tail: Promise<void> = Promise.resolve();

export function dispatchOutbound<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job, job);
  tail = run.then(() => undefined, () => undefined);
  return run;
}
```

Critical section:

```text
connection re-check
→ checkOutboundPolicy
→ resolveRecipientJid
→ socket.sendMessage
→ remember pending status
→ recordOutboundDispatched
```

TDD sequence:

- [ ] RED/GREEN: two concurrent jobs run in submission order and never overlap.
- [ ] RED/GREEN: a rejected first job does not poison the tail.
- [ ] Move the complete critical send sequence into dispatcher.
- [ ] Re-check socket/status inside queued job.
- [ ] Add concurrency regression proving later requests observe updated persistent counters instead of the same stale snapshot.
- [ ] No sleeps/random send jitter.
- [ ] Run:

```bash
pnpm --dir backend test -- outbound-dispatcher.test.ts whatsapp.test.ts outbound-policy.test.ts
pnpm --dir backend test
pnpm --dir backend run build
pnpm check
```

Acceptance:

- concurrent HTTP requests cannot bypass local account window through check/record race;
- failed job cannot deadlock later jobs;
- no distributed queue infrastructure.

---

## Iteration 24: Reason-Aware Automatic Circuit Breaker

**Status:** pending — P1.

**Files:**
- Modify: `backend/src/infrastructure/database.ts`
- Modify: `backend/src/policy/outbound-policy-store.ts`
- Modify: `backend/src/policy/outbound-policy.ts`
- Modify: `backend/src/policy/outbound-policy-persistence.test.ts`
- Create: `backend/src/policy/outbound-circuit-breaker.ts`
- Create: `backend/src/policy/outbound-circuit-breaker.test.ts`
- Modify: `backend/src/whatsapp/client.ts`
- Modify: `backend/src/routes/whatsapp.routes.ts` only if needed for operator-visible pause metadata

**Wago-local defaults:**

```ts
const REJECTION_BREAKER_WINDOW_MS = 5 * 60_000;
const REJECTION_BREAKER_THRESHOLD = 3;
const REJECTION_BREAKER_PAUSE_MS = 30 * 60_000;
```

Interface:

```ts
export function recordProtocolRejection(input: {
  reason: "REACHOUT_RESTRICTED" | "MESSAGE_REJECTED";
  now?: number;
}): { tripped: boolean; retryAt?: Date };
```

TDD sequence:

- [ ] Add migration for bounded rejection timestamps + automatic pause metadata.
- [ ] Prune outside active five-minute window.
- [ ] Threshold 1/2 do not trip; threshold 3 trips 30-minute auto pause.
- [ ] Expired automatic pause clears itself; manual pause never auto-clears.
- [ ] Feed synchronous/asynchronous relevant rejection paths exactly once per message rejection.
- [ ] Persist across restart.
- [ ] Expose safe reason/retry metadata without recipient identifiers.
- [ ] Run:

```bash
pnpm --dir backend test -- outbound-circuit-breaker.test.ts outbound-policy-persistence.test.ts whatsapp.test.ts
pnpm --dir backend test
pnpm --dir backend run build
pnpm check
```

Acceptance:

- repeated protocol rejection cannot cause unbounded immediate retry through Wago;
- automatic pause is durable and predictable;
- manual pause remains manual.

---

## Iteration 25: Inbound Context and Configurable Guardrails

**Status:** pending — P2.

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

Add nullable recipient context:

```ts
lastInboundAt?: string;
```

Optional configuration with existing defaults:

```text
WA_ACCOUNT_MAX_PER_MINUTE=30
WA_RECIPIENT_MAX_PER_MINUTE=5
WA_NEW_CHAT_MAX_PER_HOUR=10
```

TDD sequence:

- [ ] Migration for `recipients.last_inbound_at`.
- [ ] `rememberInboundMessage(jid)` upserts context with `allowed=false`, `optedOut=false` for newly observed recipient.
- [ ] Handle only real inbound `messages.upsert`; ignore own outbound echoes; never persist message text.
- [ ] Test inbound updates context without granting permission.
- [ ] Expose `lastInboundAt` only if consistent with current API privacy contract; otherwise keep internal.
- [ ] Move 30/5/10 limits into typed optional config with positive-integer validation.
- [ ] Test defaults unchanged, invalid/non-positive rejected, explicit valid values applied.
- [ ] Do not weaken WhatsApp reachout/new-chat-cap checks solely because inbound context exists.
- [ ] Run:

```bash
pnpm --dir backend test -- store.test.ts validation.test.ts outbound-policy.test.ts whatsapp.test.ts
pnpm check
pnpm test
pnpm build
```

Acceptance:

- Wago can record inbound interaction context without storing content;
- inbound never grants consent;
- omitted env values preserve existing pacing defaults.

## Final Verification

- [ ] Cold/new send blocked on account-health fetch failure.
- [ ] Locally resolved send remains pending and does not update recipient success until `SERVER_ACK`.
- [ ] Async `463` leaves success unset, adds recipient cooldown, updates account restriction, contributes to breaker once.
- [ ] Concurrent requests cannot bypass configured account window via check/record race.
- [ ] Dispatcher failure does not block later jobs forever.
- [ ] Repeated protocol rejection trips persistent automatic pause; expiry/manual semantics verified.
- [ ] Inbound context never creates outbound permission.
- [ ] New durable safety state survives restart where required.
- [ ] No secret/content/raw protocol payload enters new persistent state.
- [ ] Run:

```bash
pnpm check
pnpm test
pnpm build
docker build -t wago:safety-audit .
```

Definition of done: Wago remains unofficial and non-zero-risk, but its own outbound behavior is conservative, deterministic, observable, and resistant to the concrete failure modes identified in the audit.
