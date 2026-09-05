# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active milestone: Wago Consolidation & Messaging Hardening.**

**S0 branch consolidation is complete. S1 is the next implementation slice.**

The user explicitly authorized consolidating all outstanding feature branches into `main` and continuing from one coherent baseline. The repository now has no open feature PRs from the consolidation work.

## Integrated baseline

- PR #123 — `refactor(dashboard): complete anti-ai-slop pass 2`: merged into `main` as `37766f8557512aff54b3f5d20b84d94c5029ed04`.
- PR #128 — `feat(whatsapp): consolidate Baileys reliability and contextual media`: merged into `main` as `1af08057cfb99ad0005304ea1497b946726593a0`.
- Final verified PR #128 implementation head: `962a63138be89428240dc9d0b7f24dde0ff467d1`.
- Final PR #128 verification was green: CI run `33993871015`, Docs CI run `33993871012`, Docker Smoke run `33993871028`, CodeQL workflow run `33993871004`, plus GitHub CodeQL PR analysis with no new changed-code alerts.
- CI found and drove fixes for formatter drift, stale media composition mocks, an invalid private Messages import from WhatsApp, and a jsdom binary-response fixture before merge.
- Search after integration returned no open pull requests in `howlil/wago`.

## Milestone outcome

At completion, `main` must preserve the merged operator-console and Baileys feature baseline while hardening the newer messaging paths:

- compact operator-console dashboard and page-frame grammar remain intact;
- new-chat capping, PN→LID routing, and monotonic delivery evidence remain stable;
- contextual replies and bounded media remain integration capabilities rather than chat-history persistence;
- gateway and dashboard client contracts remain aligned;
- media/reply paths are hardened against memory, HTTP transport, privacy, and identity mistakes found in audit;
- API catalog, docs, audit vocabulary, durable decisions, and tests match runtime truth;
- relevant risk-routed CI gates are green on each integration head.

## Sprint slices

### S0 — Branch consolidation and conflict reconciliation — COMPLETE

Delivered:
- merged PR #123;
- reconciled PR #128 with the merged dashboard baseline;
- preserved page-frame, semantic workspace tokens, Motion, density, and account-health/new-chat semantics;
- reconciled dashboard and Baileys durable decisions;
- expanded architecture guards for webhook/capping behavior;
- fixed deterministic lint/test failures found by final CI;
- merged PR #128 only after all relevant checks were green;
- confirmed no open PRs remain from the consolidation work.

### S1 — Inbound media memory safety — NEXT

Goal: prevent one inbound media download from exhausting the single Wago process.

Work:
- remove unbounded `downloadMediaMessage(..., "buffer", ...)` behavior as the default production path;
- use a bounded stream or explicit byte ceiling before materializing payloads;
- define one Wago-owned maximum inbound-download size and stable application error when exceeded;
- abort provider/network reads once the limit is crossed;
- keep `Cache-Control: no-store` and never persist media bytes;
- add tests for below-limit, exact-limit, over-limit, provider failure, and expired context.

Acceptance:
- memory use is bounded by policy rather than sender-controlled media size;
- no media bytes enter SQLite, audit metadata, or webhook payloads;
- failure is explicit and client-readable.

### S2 — Media HTTP contract hardening

Goal: stop transporting user-controlled captions and filenames as custom HTTP headers.

Work:
- replace `X-Wago-Caption` / `X-Wago-Filename` payload semantics with a typed multipart/form-data contract;
- keep recipient, media kind, idempotency, optional reply context, caption, filename, MIME, and binary payload explicit;
- preserve or deliberately version compatibility where the current public route requires it;
- update dashboard client helpers and route/service tests together;
- ensure Unicode caption/filename handling is deterministic;
- use RFC 5987-compatible download filenames with a safe ASCII fallback.

Acceptance:
- emoji/Unicode caption and filename round-trip safely;
- arbitrary message content is not encoded as infrastructure metadata headers;
- request size/MIME validation remains bounded and explicit.

### S3 — Provider retry evidence for media

Goal: give outbound media the same Baileys `getMessage` recovery semantics available to recent text sends where practical.

Work:
- generalize the bounded recent-message provider cache to retain minimum transient message content needed by Baileys retries;
- include supported media without creating durable chat history;
- cap entry count, TTL, and total byte budget;
- clear/evict deterministically;
- keep restart behavior truthful because ephemeral retry material may disappear across process restart.

Acceptance:
- text behavior does not regress;
- media retry lookup works while inside the bounded ephemeral window;
- memory limits are explicit and tested.

### S4 — Context identity and cache correctness

Goal: ensure reply/context resolution cannot cross logical recipients and recent-context TTL behaves truthfully.

Work:
- require the same logical recipient when mapping quoted provider message IDs to canonical Wago IDs;
- keep PN/LID transport addressing separate from logical phone identity;
- refresh `Map` insertion order when an existing recent inbound entry is refreshed;
- test duplicate notifications, cross-recipient quoted IDs, PN/LID equivalents, TTL expiry, overflow, and process reset.

Acceptance:
- provider message ID alone cannot expose another recipient's canonical Wago context;
- refreshed context is not evicted as the oldest entry;
- no full JID/message body is added to logs or durable diagnostics.

### S5 — Public contract and documentation truth

Goal: make docs/tests reflect the actual runtime surface.

Work:
- add media send/download and reply semantics to the public API catalog;
- strengthen route-catalog verification so runtime/docs drift cannot false-pass;
- update Configuration docs for `message.media_received`, quoted context, retention/download expiry, capping, and delivery evidence;
- update README capability/non-goal statements for bounded media;
- update webhook examples without expanding permanent content retention.

Acceptance:
- docs no longer claim non-text is ignored while runtime emits media events;
- every public runtime route is represented once in the docs catalog;
- vocabulary is consistent across gateway, dashboard, and docs.

### S6 — Capability-boundary cleanup

Goal: remove small architecture leaks introduced during feature expansion.

Work:
- export webhook input types through `modules/webhooks/index.ts` rather than importing another capability's private implementation file;
- keep Baileys raw types/provider behavior inside `modules/whatsapp`;
- remove temporary integration glue when tests prove it unnecessary;
- preserve one clear application-service boundary for HTTP message routes.

Acceptance:
- cross-module imports follow `.agents/ARCHITECTURE.md`;
- no speculative generic abstraction is introduced;
- dependency direction remains capability-owned and local.

### S7 — Verification, final audit, and repository normalization

Goal: finish on a green, truthful, resumable baseline.

Verification order:
- targeted formatter/lint and changed unit/contract tests;
- `task gateway:test` + `task gateway:build` for gateway/media/persistence work;
- `task dashboard:design:test`, `task dashboard:test`, `task dashboard:build` for operator/client behavior;
- `task docs:test` + `task docs:build` for API/docs changes;
- full normal CI on the integration PR;
- Docker persistence/rollback smoke when runtime/persistence paths require it;
- CodeQL for core source changes.

Final audit:
- no unbounded media-buffer path remains;
- no message content/full identifiers appear in logs/audit;
- operation state remains `pending | accepted | rejected` and evidence stays additive;
- one visible outer page frame remains on main operator pages with flat internal modules;
- no stale PR/current-iteration/docs claim contradicts code.

Completion:
- merge each hardening integration only after the relevant final head is green;
- after S7 is integrated, return this file to idle/no-active-milestone unless the user has already authorized the next milestone.

## Blockers

None.

## Next action

Start S1 from the consolidated `main` baseline when implementation of the hardening milestone continues. Do not reopen or extend the already-merged feature branches.
