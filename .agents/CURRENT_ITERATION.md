# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active milestone: Baileys Reliability & Messaging Capability Pass — B1/B2/B3.**

Branch: `feat/baileys-reliability-signals`

Pull request: **#128 — `feat(whatsapp): add Baileys reliability signals`**

## Authorized scope

- **B1 — New-chat message capping:** consume realtime `message-capping.update`, expose normalized capacity state, surface warnings without blocking, and block new-recipient sends only when WhatsApp explicitly reports `CAPPED`.
- **B2 — LID mapping hardening:** persist PN→LID transport identity, invalidate stale recipient lookup cache on `lid-mapping.update`, and preserve the logical phone recipient as the policy/idempotency identity.
- **B3 — Delivery evidence:** preserve public `pending | accepted | rejected` operation state while adding monotonic `submitted | server_accepted | delivered | read | played` evidence and signed delivery-evidence webhooks.
- Keep the existing single-account, no-history, no-inbox, no-groups, no-campaign, no-media product boundary.

## Implementation evidence

- migration 14 adds `recipient_identities` and additive outbound delivery-evidence/timestamp columns;
- WhatsApp socket wiring consumes `lid-mapping.update`, `message-capping.update`, and `message-receipt.update` while preserving stale-generation guards;
- account health now exposes normalized `newChatCapacity` and treats provider warning states as observable pressure rather than a hard block;
- recipient lookup prefers persisted LID transport addressing and invalidates the per-phone cache immediately when Baileys supplies a newer mapping;
- message diagnostics persist monotonic delivery evidence while preserving the existing terminal operation-state contract;
- signed webhook events now include `message.delivered`, `message.read`, and `message.played` in addition to existing server-accepted/rejected/incoming events;
- Control account-health UI distinguishes Warning from Capped and does not claim warnings pause sends;
- Settings Webhooks lists the expanded delivery-evidence event surface;
- deterministic migration, account-health, recipient-routing, receipt-ordering, and dashboard architecture coverage has been added or updated;
- durable boundary is recorded in `.agents/DECISIONS.md` D14.

## Verification

Final-head verification is pending. Required gates for this persistence/runtime/API/dashboard change are:

- formatting/lint;
- full gateway/dashboard tests;
- production core build;
- CodeQL;
- Docker persistence/rollback smoke;
- docs checks if documentation files are changed before finalization.

Do not mark the milestone complete or merge PR #128 until the final head has the required green evidence.

## Blockers

None known; verification is in progress.

## Next action

Run/follow the final-head CI gates, fix any deterministic failures, update PR #128 verification evidence, and leave the PR open for explicit user-authorized merge.

## Completion rule

When the milestone is integrated into `main`, return this file to the idle/no-active-milestone state unless the user has already authorized the next milestone.
