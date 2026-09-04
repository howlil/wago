# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**PR-ready milestone: Baileys Reliability & Messaging Capability Pass — B1/B2/B3.**

Branch: `feat/baileys-reliability-signals`

Pull request: **#128 — `feat(whatsapp): add Baileys reliability signals`**

The milestone is implemented and left open for explicit user-authorized merge.

## Authorized scope

- **B1 — New-chat message capping:** consume realtime `message-capping.update`, expose normalized capacity state, surface warnings without blocking, and block new-recipient sends only when WhatsApp explicitly reports `CAPPED`.
- **B2 — LID mapping hardening:** persist PN→LID transport identity, invalidate stale recipient lookup cache on `lid-mapping.update`, and preserve the logical phone recipient as the policy/idempotency identity.
- **B3 — Delivery evidence:** preserve public `pending | accepted | rejected` operation state while adding monotonic `submitted | server_accepted | delivered | read | played` evidence and signed delivery-evidence webhooks.
- Keep the existing single-account, no-history, no-inbox, no-groups, no-campaign, no-media product boundary.

## Implementation evidence

- migration 14 adds `recipient_identities` and additive outbound delivery-evidence/timestamp columns;
- WhatsApp socket wiring consumes `lid-mapping.update`, `message-capping.update`, and `message-receipt.update` while preserving stale-generation guards;
- account health exposes normalized `newChatCapacity` and treats provider warning states as observable pressure rather than a hard block;
- recipient lookup prefers persisted LID transport addressing and invalidates the per-phone cache immediately when Baileys supplies a newer mapping;
- message diagnostics persist monotonic delivery evidence while preserving the existing terminal operation-state contract;
- a delivery/read/played receipt received before a separate server-ACK event is treated as proof that the pending operation was accepted, while later lower evidence cannot downgrade the retained evidence;
- signed webhook events include `message.delivered`, `message.read`, and `message.played` in addition to existing server-accepted/rejected/incoming events;
- Control account-health UI distinguishes Warning from Capped and does not claim warnings pause sends;
- Settings Webhooks lists the expanded delivery-evidence event surface;
- deterministic migration, account-health, recipient-routing, receipt-ordering, message-service compatibility, and dashboard architecture coverage has been added or updated;
- durable boundary is recorded in `.agents/DECISIONS.md` D14.

## Verification

The implementation head `e9491de5d194fff57bd47cfba8b673630c501246` passed all required runtime/persistence gates before this state-only update:

- CI **#1254** — frozen install, Biome formatting/lint, full gateway/dashboard core tests, and production core build: **success**;
- CodeQL **#1253** — JavaScript/TypeScript analysis: **success**;
- Docker Smoke **#36** — image build plus persistence/rollback smoke: **success**.

Failures found during the sprint were fixed before the green implementation head, including stale migration-count coverage, Biome formatting, backward-compatible dashboard account-health fixtures, and exact message-service response-shape compatibility.

## Blockers

None.

## Next action

Leave PR #128 open for review. Merge only after explicit user authorization. After merge, reset this file to the idle/no-active-milestone state unless the next milestone has already been authorized.

## Completion rule

When the milestone is integrated into `main`, return this file to the idle/no-active-milestone state unless the user has already authorized the next milestone.
