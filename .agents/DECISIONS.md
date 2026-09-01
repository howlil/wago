# Wago Durable Decisions

This file records material decisions whose rationale is expensive to rediscover. It is not a chronological change log. Update an entry when the durable decision changes; do not append routine implementation choices.

## D1 — Single-instance modular monolith

**Decision:** Wago remains one Node.js/Express process, one WhatsApp account, one SQLite application store, one filesystem-backed Baileys auth state, and one Docker container per deployed instance.

**Why:** this satisfies the product while keeping deployment, ownership, recovery, and reasoning small enough for a self-hosted gateway.

**Implication:** microservices, distributed coordination, multi-session ownership, and extra infrastructure require a concrete approved requirement.

## D2 — SQLite owns durable application state

**Decision:** SQLite remains the authoritative application database; Baileys authentication remains filesystem-backed under the same `/app/data` persistence boundary.

**Why:** SQLite matches the single-instance architecture and provides transactions/migrations without another service. Baileys auth has protocol-specific filesystem semantics that should not be re-modeled speculatively.

**Implication:** released migrations are append-only, multi-write invariants use transactions, and the whole `/app/data` boundary is secret-bearing state.

## D3 — One active owner per persistent volume

**Decision:** only one active Wago instance may own a given SQLite/auth volume/account at a time.

**Why:** SQLite plus filesystem-backed auth is a single-writer operational model; concurrent replicas can violate lifecycle and persistence assumptions.

**Implication:** production ownership/mount checks fail closed and horizontal scaling over one volume is outside the current architecture.

## D4 — Capability ownership over horizontal enterprise layers

**Decision:** gateway behavior converges under capability modules and dashboard behavior under features. Shared technical boundaries remain small and explicit.

**Why:** ownership and locality of reasoning are more valuable here than repository/service/controller hierarchies.

**Implication:** place code by `behavior -> owner -> boundary -> module/feature -> file`; introduce shared abstractions only after a real cross-owner boundary exists.

## D5 — Baileys remains contained behind the WhatsApp owner

**Decision:** raw Baileys sockets, protocol events, reconnect details, credential writes, and provider-specific adaptation belong to the WhatsApp capability.

**Why:** Baileys is volatile external/protocol infrastructure. Letting it leak into routes or unrelated modules couples product behavior to provider internals.

**Implication:** other capabilities use narrow application-facing WhatsApp behavior rather than manipulating the socket directly.

## D6 — Public transport semantics stay at the HTTP boundary

**Decision:** routes/middleware own request parsing, authentication attachment, HTTP status, response serialization, and transport mapping; business policy owns decisions and invariants.

**Why:** this keeps transport separate from policy without requiring a full clean-architecture stack.

**Implication:** SQL and raw provider operations do not belong in routes; business policy does not choose HTTP status codes.

## D7 — Outbound safeguards are defensive, not evasive

**Decision:** idempotency, recipient permission, account/recipient/new-chat limits, cooldown/circuit behavior, and health checks may protect outbound behavior, but Wago does not implement enforcement-evasion techniques.

**Why:** Baileys is unofficial and enforcement risk cannot be eliminated. Wago should reduce accidental harmful behavior without engineering ban bypass.

**Implication:** no fake typing for evasion, fingerprint/device spoofing, proxy rotation, bulk/campaign behavior, or restriction bypasses.

## D8 — Truthful degraded state

**Decision:** health/readiness/dashboard state represents uncertainty and degradation explicitly rather than optimistically presenting unavailable state as healthy.

**Why:** operational correctness depends on distinguishing liveness from the ability to safely perform gateway work.

**Implication:** disconnected, checking, unavailable, degraded, and invalid-session states remain distinct where observable.

## D9 — Monorepo + root Taskfile are the repository operating shape

**Decision:** Wago uses one pnpm workspace with `apps/gateway`, `apps/dashboard`, and `apps/docs`; root `Taskfile.yml` is the canonical developer command surface.

**Why:** one workspace boundary and one command entrypoint reduce duplicated orchestration while preserving app-local package scripts.

**Implication:** do not reintroduce nested workspaces/lockfiles or duplicate root orchestration without a concrete need.

## D10 — Canonical agent context follows the default `.agents/` SWE-flow model

**Decision:** root `AGENTS.md` is a thin routing/authority entrypoint and `.agents/` contains exactly `PROJECT.md`, `ARCHITECTURE.md`, `CURRENT_ITERATION.md`, `CODE_PATTERNS.md`, `QUALITY.md`, and `DECISIONS.md`.

**Why:** this matches the user's canonical agent-SWE flow: project knowledge, active iteration state, implementation conventions, quality gates, and durable rationale each have one owner without duplicating global workflow rules.

**Implication:** `.agent/` singular is legacy. Do not create extra workflow mirrors, sprint diaries, generic skill files, temporary plan/checkpoint files, or duplicate state under `.agents/`.

## D11 — Incoming messages are integration events, not retained chat history

**Decision:** live direct incoming text is normalized by the WhatsApp capability and delivered as signed `message.received` through the existing durable webhook engine. Wago does not create a second inbound queue, chat-history store, or dashboard inbox.

**Why:** external applications need inbound events with the same restart-safe at-least-once guarantees as existing callbacks, but permanently retaining sender/message content would change Wago into a message store and weaken its privacy boundary.

**Implication:** the stable Wago inbound message ID is derived deterministically so duplicate Baileys notifications converge on the existing unique webhook message/event key. Sender and text may be persisted only inside an active retry payload for at most the webhook retry horizon. SQLite atomically redacts that payload when the delivery becomes delivered, failed, or expired; terminal diagnostics keep IDs/status/attempt evidence only, and manual redelivery is unavailable once the inbound payload is redacted.
