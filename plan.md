# Next Iteration Plan: WhatsApp Outbound Safety

## Context

This project is a small self-hosted WhatsApp gateway using Baileys. The next production-grade step is not "anti-ban" behavior. There is no reliable or acceptable anti-ban implementation for an unofficial WhatsApp Web client.

The engineering goal is to make outbound behavior conservative, explicit, and hard to misuse:

- no accidental spam
- no retry storm
- no arbitrary cold outreach
- no repeated sends to the same recipient
- no sends while WhatsApp reports reach-out restriction or new-chat cap
- no duplicate sends caused by upstream HTTP retries

Keep the architecture shallow. Do not add Redis, BullMQ, Kafka, PostgreSQL, multi-user auth, or campaign-style features for this iteration.

## Current Baseline

Already implemented:

- Single WhatsApp session through Baileys.
- Persistent auth and generated app settings in `backend/data`.
- API key / auth cookie protection.
- Docker self-hosting setup.
- Basic HTTP rate limit for send/rebind routes.
- In-memory message status tracking.
- 463 error mapping to `REACHOUT_RESTRICTED`.
- Frontend setup/auth flow.
- Backend and frontend tests.

Main gap:

- There is no outbound policy layer between `POST /messages/send` and `socket.sendMessage()`.

## Non-Goals

Do not implement:

- anti-ban fingerprinting, fake typing, random delays, proxy rotation, or message mutation
- bulk sender, campaign manager, scheduler, queue, or retries
- database-backed contact CRM
- multi-session WhatsApp support
- official WhatsApp Cloud API migration

## Iteration 1: Outbound Policy Skeleton

Goal: introduce one explicit policy boundary without changing the public send API more than necessary.

Tasks:

- [x] Add `backend/src/outbound-policy.ts`.
- [x] Define `OutboundPolicyDecision`.
- [x] Define `OutboundPolicyInput` with `to`, `jid`, `text`, and optional `idempotencyKey`.
- [x] Add `checkOutboundPolicy(input)`.
- [x] Add `recordOutboundAccepted(input, messageId)`.
- [x] Add `recordOutboundRejected(input, error)`.
- [x] Call policy from `sendTextMessage()` before `socket.sendMessage()`.
- [x] Map blocked decisions to stable HTTP errors in `message.routes.ts`.

Acceptance:

- [x] No send can bypass `OutboundPolicy`.
- [x] Existing successful send behavior remains unchanged for allowed recipients at the policy layer.
- [x] Unit tests cover allowed and blocked decisions.

Verification:

- [x] `pnpm test` in backend.
- [x] `pnpm run build` in backend.

## Iteration 2: Consent and Recipient Controls

Goal: prevent arbitrary outbound messages to unknown recipients.

Initial design:

- Use a simple file-backed allowlist in `backend/data/recipients.json`.
- Keep it intentionally small and explicit.
- Store normalized JID, label, allow status, opt-out status, timestamps.

Proposed data shape:

```json
{
  "6281234567890@s.whatsapp.net": {
    "allowed": true,
    "optedOut": false,
    "label": "Customer A",
    "createdAt": "2026-08-09T00:00:00.000Z",
    "updatedAt": "2026-08-09T00:00:00.000Z"
  }
}
```

Tasks:

- [ ] Add recipient store helper with safe JSON read/write.
- [ ] Add `POST /recipients/allow` protected by API key.
- [ ] Add `POST /recipients/:phone/opt-out` protected by API key.
- [ ] Add `GET /recipients` protected by API key.
- [ ] Policy blocks `RECIPIENT_NOT_ALLOWED`.
- [ ] Policy blocks `RECIPIENT_OPTED_OUT`.
- [ ] Frontend can show a minimal allow/blocked state later, but not required in this iteration.

Acceptance:

- [ ] Sending to a recipient not on allowlist returns `403 RECIPIENT_NOT_ALLOWED`.
- [ ] Sending to opted-out recipient returns `403 RECIPIENT_OPTED_OUT`.
- [ ] Allowlist persists across process/container restart.

Verification:

- [ ] Unit tests for recipient store.
- [ ] HTTP tests for allow, opt-out, and blocked send.

## Iteration 3: Idempotency and Dedupe

Goal: prevent duplicate sends from client retry behavior.

Design:

- Accept `Idempotency-Key` header or optional `idempotencyKey` body field.
- Store recent keys in memory for now.
- TTL: 1 hour.
- Scope key by recipient JID plus key.

Tasks:

- [ ] Parse idempotency key in `POST /messages/send`.
- [ ] Pass it into outbound policy.
- [ ] Block duplicate pending/completed keys with `409 DUPLICATE_MESSAGE`.
- [ ] Return previous known message status when possible.
- [ ] Add tests for duplicate send prevention.

Acceptance:

- [ ] Same idempotency key to same recipient does not create a second WhatsApp send.
- [ ] Different recipient or different key can proceed.
- [ ] Behavior is documented as in-memory and lost on restart.

## Iteration 4: Account and Recipient Rate Limits

Goal: replace IP-only thinking with WhatsApp-account-aware safety limits.

Initial conservative defaults:

- Global account sends: 10 per minute.
- Per-recipient sends: 2 per minute.
- New-recipient sends: 3 per hour.

Keep these configurable through env only if needed:

- `OUTBOUND_ACCOUNT_LIMIT_PER_MINUTE`
- `OUTBOUND_RECIPIENT_LIMIT_PER_MINUTE`
- `OUTBOUND_NEW_CHAT_LIMIT_PER_HOUR`

Tasks:

- [ ] Add in-memory account limiter.
- [ ] Add in-memory per-recipient limiter.
- [ ] Track whether a recipient has been sent to before during current runtime.
- [ ] Block with `ACCOUNT_RATE_LIMITED`.
- [ ] Block with `RECIPIENT_RATE_LIMITED`.
- [ ] Block new-chat bursts with `NEW_CHAT_RATE_LIMITED`.

Acceptance:

- [ ] One upstream service cannot send many messages quickly through one WhatsApp account.
- [ ] A loop bug cannot spam one recipient.
- [ ] Tests cover each limiter independently.

## Iteration 5: WhatsApp Restriction Awareness

Goal: respect WhatsApp-side reach-out and new-chat restrictions instead of hard-coded cooldowns.

Baileys v7 capabilities to integrate:

- `socket.fetchAccountReachoutTimelock()`
- `socket.fetchNewChatMessageCap()`
- `connection.update.reachoutTimeLock`

Tasks:

- [ ] Add cached account restriction state to `outbound-policy.ts` or `whatsapp.ts`.
- [ ] On send policy check, fetch restriction state when cache is stale.
- [ ] If `isActive`, block with `WA_REACHOUT_RESTRICTED` and `retryAt`.
- [ ] On `connection.update.reachoutTimeLock`, update cached restriction immediately.
- [ ] Fetch new-chat cap when cache is stale.
- [ ] If cap status is `CAPPED`, block with `WA_NEW_CHAT_CAPPED`.
- [ ] If cap status is `FIRST_WARNING` or `SECOND_WARNING`, block new-recipient sends but allow known/consented recipients.
- [ ] Replace hard-coded account restriction behavior where possible.

Acceptance:

- [ ] 463 no longer maps only to per-JID 30-minute cooldown.
- [ ] Account-level restriction pauses outbound.
- [ ] Restriction/cap status appears in a protected status endpoint or `/ready` extension.

Risk:

- Baileys APIs may have imperfect type coverage. Use narrow local types and defensive runtime checks.

## Iteration 6: Circuit Breaker

Goal: stop outbound immediately when the account appears restricted or unhealthy.

Tasks:

- [ ] Add `outboundPausedUntil` and `outboundPauseReason`.
- [ ] Set pause on `REACHOUT_RESTRICTED`, cap `CAPPED`, repeated send failures, or active reachout timelock.
- [ ] Add protected `POST /messages/outbound/resume` for manual resume.
- [ ] Add protected `GET /messages/outbound/status`.
- [ ] Frontend shows paused state if present.

Acceptance:

- [ ] Once paused, all sends fail closed until `retryAt` passes or manual resume occurs.
- [ ] Pause reason is visible to operators.
- [ ] There is no automatic retry storm.

## Iteration 7: Reconnect Backoff

Goal: prevent aggressive reconnect loops.

Tasks:

- [ ] Replace immediate recursive reconnect with bounded backoff.
- [ ] Use delays: 2s, 5s, 15s, 30s, then stay disconnected until next scheduled attempt.
- [ ] Reset attempts after successful `open`.
- [ ] Do not reconnect after logged-out.
- [ ] Keep generation guard already present.
- [ ] Add unit-level tests around delay calculation.

Acceptance:

- [ ] Disconnect does not trigger a tight reconnect loop.
- [ ] Rebind still works.
- [ ] Logged-out state does not delete auth automatically.

## Iteration 8: Dependency and Storage Hygiene

Goal: reduce deployment drift and credential risk.

Tasks:

- [ ] Pin Baileys exactly: `"@whiskeysockets/baileys": "7.0.0-rc14"`.
- [ ] Run `pnpm install` to update lockfile.
- [ ] Confirm `.gitignore` and `.dockerignore` exclude all runtime credential data.
- [ ] Document `useMultiFileAuthState` as acceptable MVP storage but not ideal for high-volume production.
- [ ] Add backup note for `backend/data`.

Acceptance:

- [ ] Production deploys do not silently pick a newer Baileys release.
- [ ] Credential data is not included in Git or Docker build context.

## Suggested Implementation Order

Implement in this order:

1. Outbound policy skeleton.
2. Allowlist/opt-out.
3. Idempotency.
4. Account/per-recipient limits.
5. Baileys reachout timelock/new-chat cap.
6. Circuit breaker.
7. Reconnect backoff.
8. Dependency pinning/docs.

Reasoning:

- Policy boundary must exist before adding rules.
- Consent/allowlist is the highest-value safety rule.
- Idempotency prevents duplicate sends before adding more complex state.
- WhatsApp restriction checks become cleaner once policy decisions already exist.
- Reconnect backoff is important but independent of outbound policy, so it can be later.

## Definition of Done

The next iteration is complete when:

- [ ] All sends pass through `OutboundPolicy`.
- [ ] Unknown recipients are blocked by default.
- [ ] Opt-out is enforced.
- [ ] Duplicate sends can be blocked with idempotency key.
- [ ] Account and recipient rate limits exist.
- [ ] WhatsApp reachout timelock/new-chat cap are respected when Baileys exposes them.
- [ ] Account-level outbound pause is visible and enforceable.
- [ ] Reconnect uses bounded backoff.
- [ ] Backend tests pass.
- [ ] Frontend tests pass.
- [ ] Backend and frontend builds pass.
- [ ] Docker build passes.

## Manual Verification Checklist

Before calling this complete:

- [ ] Start backend with an initialized WhatsApp session.
- [ ] Add one allowed recipient.
- [ ] Send to allowed recipient successfully.
- [ ] Send to unknown recipient and confirm blocked.
- [ ] Opt out allowed recipient and confirm blocked.
- [ ] Send same idempotency key twice and confirm second does not send.
- [ ] Exceed per-recipient limit and confirm blocked.
- [ ] Exceed account limit and confirm blocked.
- [ ] Rebind still clears session and shows QR.
- [ ] Restart process and confirm allowlist persists.

## Engineering Rules for This Iteration

- Keep one WhatsApp account per process.
- Keep direct HTTP send; do not add a queue.
- Keep persistent app data file-backed for now.
- Use unit tests for policy logic.
- Do not unit-test Baileys internals.
- Do not add anti-ban behavior that tries to disguise automation.
- Prefer explicit failures over silent retries.
- Keep public API errors stable and documented.
