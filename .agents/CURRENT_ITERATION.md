# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active milestone: Wago Consolidation & Messaging Hardening.**

The user explicitly authorized consolidating the outstanding feature branches into `main` and then continuing the audit-driven hardening work. Dashboard Anti–AI-Slop Pass 2 has already been integrated through PR #123. PR #128 remains the active integration branch and must be reconciled with the merged dashboard changes, brought back to a truthful green verification state, and merged before the post-integration hardening slices continue from a fresh branch.

## Integration state

- PR #123 — `refactor(dashboard): complete anti-ai-slop pass 2`: **merged** into `main` as `37766f8557512aff54b3f5d20b84d94c5029ed04`.
- PR #128 — `feat(whatsapp): add Baileys reliability signals`: **active integration branch** `feat/baileys-reliability-signals`.
- PR #128 includes B1/B2/B3 reliability signals plus subsequent B4/B5/B6 contextual reply/media work.
- The previous PR #128 description and verification section are stale because later contextual-media commits changed runtime/API/docs after the earlier green head.
- Latest pre-reconciliation CI for PR #128 failed in Biome before core tests/build; Docs CI, CodeQL, and Docker Smoke succeeded.
- PR #128 conflicted with PR #123 in agent context, Account Health presentation, and dashboard architecture guards; conflict resolution must preserve both the operator-console design contract and the newer Baileys semantics.

## Milestone outcome

At completion, `main` must contain one coherent Wago baseline with:

- the compact operator-console dashboard and page-frame grammar from PR #123;
- Baileys new-chat capping, PN→LID routing hardening, and monotonic delivery evidence;
- contextual replies and bounded media integration without chat-history persistence;
- gateway and dashboard client contracts aligned;
- media/reply paths hardened against memory, transport, privacy, and identity mistakes found in the code audit;
- API catalog, public docs, audit vocabulary, durable decisions, and tests synchronized with runtime behavior;
- no open feature PR representing already-integrated product work;
- all relevant risk-routed CI gates green on the final implementation head.

## Sprint slices

### S0 — Branch consolidation and conflict reconciliation

Goal: integrate the already-finished UI branch and make PR #128 represent the combined product truth.

Work:
- merge PR #123 to `main`;
- reconcile PR #128 conflict files against the new `main` without regressing page-frame, semantic workspace tokens, Motion, density, or new-chat capacity behavior;
- preserve dashboard architecture guards from PR #123 and extend them for new webhook/capping behavior;
- reconcile durable decision numbering so dashboard and Baileys decisions coexist;
- replace stale active-iteration state with this milestone;
- fix deterministic formatter/import failures before any completion claim.

Acceptance:
- PR #128 becomes mergeable against current `main`;
- no PR #123 design rule is lost;
- no B1–B6 runtime/client behavior is accidentally removed;
- lint passes before broader verification.

### S1 — Inbound media memory safety

Goal: prevent one inbound media download from exhausting the single Wago process.

Work:
- remove unbounded `downloadMediaMessage(..., "buffer", ...)` behavior as the default production path;
- use a bounded stream or explicit byte ceiling before materializing payloads;
- define one Wago-owned maximum inbound-download size and expose a stable application error when exceeded;
- abort provider/network reads once the limit is crossed;
- keep response semantics `Cache-Control: no-store` and do not persist media bytes;
- add deterministic tests for below-limit, exact-limit, over-limit, provider failure, and expired context.

Acceptance:
- memory use is bounded by policy rather than sender-controlled media size;
- no media bytes enter SQLite, audit metadata, or webhook payloads;
- failure is explicit and client-readable.

### S2 — Media HTTP contract hardening

Goal: stop transporting user-controlled captions/filenames as custom HTTP headers.

Work:
- replace `X-Wago-Caption` / `X-Wago-Filename` payload semantics with a typed multipart/form-data contract;
- keep recipient, media kind, idempotency, optional reply context, caption, filename, MIME, and binary payload explicit;
- preserve or deliberately version compatibility if an existing public client contract already depends on the old route;
- update dashboard client helpers and route/service tests together;
- ensure Unicode caption/filename handling is deterministic;
- use RFC 5987-compatible download filename handling with a safe ASCII fallback.

Acceptance:
- emoji/Unicode caption and filename round-trip safely;
- arbitrary message content is not encoded as infrastructure metadata headers;
- media request size/MIME validation remains bounded and explicit.

### S3 — Provider retry evidence for media

Goal: give outbound media the same Baileys `getMessage` recovery semantics available to recent text sends where practical.

Work:
- generalize the bounded recent-message provider cache to retain the minimum transient message content Baileys needs for retries;
- include supported media sends without creating durable chat history;
- cap entry count, TTL, and total retained byte budget;
- clear/evict deterministically;
- verify restart behavior remains truthful: process restart may lose ephemeral retry material and must not imply durability.

Acceptance:
- text behavior does not regress;
- media retry lookup returns usable recent content while it remains inside the bounded ephemeral window;
- memory limits are explicit and tested.

### S4 — Context identity and cache correctness

Goal: ensure reply/context resolution cannot cross logical recipients and recent-context TTL behaves truthfully.

Work:
- require same logical recipient when mapping quoted provider message IDs to canonical Wago IDs;
- keep PN/LID transport addressing separate from logical phone identity;
- refresh `Map` insertion order when an existing recent inbound entry is refreshed so overflow eviction respects newest activity;
- test duplicate notifications, cross-recipient quoted IDs, PN/LID equivalents, TTL expiry, overflow, and process reset.

Acceptance:
- a provider message ID alone can never expose another recipient's canonical Wago context;
- refreshed context is not evicted as the oldest entry;
- no full JID/message body is added to logs or durable diagnostics.

### S5 — Public contract and documentation truth

Goal: make docs/tests derive from the actual runtime surface rather than stale hard-coded expectations.

Work:
- add media send/download and reply semantics to the public API catalog;
- update route-catalog tests so missing runtime routes cannot silently pass because both catalog and expected array are stale;
- update Configuration docs for `message.media_received`, quoted context, media retention/download expiry, capping, and delivery evidence;
- update README capability/non-goal statements to match the approved bounded media feature;
- update webhook examples without expanding permanent content retention.

Acceptance:
- docs no longer say non-text is ignored while runtime emits media events;
- every public runtime route is represented once in the docs catalog;
- vocabulary is Wago-owned and consistent across gateway/dashboard/docs.

### S6 — Capability-boundary cleanup

Goal: remove small architecture leaks introduced during the feature expansion.

Work:
- export webhook input types through `modules/webhooks/index.ts` rather than importing another capability's private implementation file;
- keep Baileys raw types/provider behavior inside `modules/whatsapp`;
- remove dead compatibility helpers or dynamic imports introduced only as temporary integration glue when tests prove they are unnecessary;
- preserve one clear application-service boundary for HTTP message routes.

Acceptance:
- cross-module imports follow `.agents/ARCHITECTURE.md`;
- no generic abstraction layer is introduced merely for cleanliness;
- dependency direction stays capability-owned and local.

### S7 — Verification, final audit, and repository normalization

Goal: finish on a green, truthful, resumable baseline.

Verification order:
- targeted formatter/lint and changed unit/contract tests;
- `task gateway:test` + `task gateway:build` for gateway/media/persistence work;
- `task dashboard:design:test`, `task dashboard:test`, `task dashboard:build` for reconciled operator/client behavior;
- `task docs:test` + `task docs:build` for API/docs changes;
- full normal CI on the integration PR;
- Docker persistence/rollback smoke because migrations/media runtime paths are affected;
- CodeQL for core source changes.

Final audit:
- verify no unbounded media buffer path remains;
- verify no message content/full identifiers appear in logs/audit;
- verify operation state remains `pending | accepted | rejected` and evidence stays additive;
- verify one visible outer page frame remains on main operator pages with flat internal modules;
- verify no stale PR body/current-iteration/docs claim contradicts code.

Completion:
- merge PR #128 only after the reconciled head is green;
- create a fresh hardening branch for S1–S7 if those slices are not already included in the reconciled PR;
- when all milestone slices are merged, return this file to the idle/no-active-milestone state.

## Blockers

Current blocker: PR #128 must be reconciled with the newly merged PR #123 and reverified. Do not describe the current PR #128 head as green until CI has actually passed after reconciliation.

## Next action

Complete S0 continuously: finish conflict reconciliation, fix formatter/import failures, run/review the new CI result, update the PR description to the actual B1–B6 scope, then merge PR #128 as explicitly authorized once the reconciled head is green.
