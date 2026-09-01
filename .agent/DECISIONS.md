# Wago Durable Decisions

This file records current decisions whose rationale is expensive to rediscover. It is semantic context, not a chronological task diary. Update an entry when the durable decision changes; do not append routine implementation choices.

## D1 — Single-instance modular monolith

**Decision:** Wago remains one Node.js/Express process, one WhatsApp account, one SQLite application store, one filesystem-backed Baileys auth state, and one Docker container per deployed instance.

**Why:** this shape satisfies the current product while keeping deployment, ownership, recovery, and reasoning small enough for a self-hosted gateway.

**Implication:** microservices, distributed coordination, multi-session ownership, and extra infrastructure require a concrete approved requirement rather than hypothetical scale.

## D2 — SQLite owns durable application state

**Decision:** SQLite remains the authoritative application database; Baileys authentication remains filesystem-backed under the same persistent `/app/data` boundary.

**Why:** SQLite matches the single-instance architecture and provides transactions/migrations without another service. Baileys auth has protocol-specific filesystem semantics that should remain contained rather than being re-modeled speculatively.

**Implication:** migrations are append-only after release, multi-write invariants use transactions, and the whole `/app/data` boundary is treated as secret-bearing state.

## D3 — One active owner per persistent volume

**Decision:** only one active Wago instance may own a given SQLite/auth volume/account at a time.

**Why:** SQLite plus filesystem-backed auth is a single-writer operational model; concurrent replicas can corrupt lifecycle and persistence assumptions.

**Implication:** production ownership/mount checks fail closed and horizontal scaling over one volume is outside the current architecture.

## D4 — Capability ownership over horizontal enterprise layers

**Decision:** backend behavior converges under capability modules and frontend behavior under features. Shared technical boundaries remain small and explicit.

**Why:** ownership and locality of reasoning are more valuable here than repository/service/controller hierarchies.

**Implication:** place code by `behavior -> owner -> boundary -> module/feature -> file`; keep feature-local code local, and introduce shared abstractions only after a real cross-owner boundary exists.

## D5 — Baileys remains contained behind the WhatsApp owner

**Decision:** raw Baileys sockets, protocol events, reconnect details, credential writes, and provider-specific adaptation belong to the WhatsApp module.

**Why:** Baileys is volatile external/protocol infrastructure. Letting it leak into routes or unrelated modules couples product behavior to provider internals.

**Implication:** other capabilities use narrow application-facing WhatsApp behavior rather than manipulating the socket directly.

## D6 — Public transport semantics stay at the HTTP boundary

**Decision:** routes/middleware own request parsing, authentication attachment, HTTP status, response serialization, and transport-specific mapping; business policy owns decisions/invariants.

**Why:** keeping transport separate from policy preserves clear ownership without requiring a full clean-architecture stack.

**Implication:** SQL and raw provider operations do not belong in routes; business policy does not choose HTTP status codes.

## D7 — Outbound safeguards are defensive, not evasive

**Decision:** idempotency, recipient permission, account/recipient/new-chat limits, cooldown/circuit behavior, and health checks may protect outbound behavior, but Wago does not implement enforcement-evasion techniques.

**Why:** Baileys is unofficial and enforcement risk cannot be eliminated. Wago should reduce accidental harmful behavior without claiming or engineering ban bypass.

**Implication:** no fake typing for evasion, fingerprint/device spoofing, proxy rotation, bulk/campaign behavior, or restriction bypasses.

## D8 — Truthful degraded state

**Decision:** health/readiness/dashboard state represents uncertainty and degradation explicitly rather than optimistically presenting unavailable state as healthy.

**Why:** operational correctness depends on distinguishing liveness from the ability to safely perform gateway work.

**Implication:** disconnected, checking, unavailable, degraded, and invalid-session states remain distinct where the product can observe them.

## D9 — Agent context is semantic, not task history

**Decision:** `.agent/` is split by durable concern (`PROJECT`, `STATE`, `ENGINEERING`, `OPERATIONS`, `DECISIONS`) and does not store permanent plans, specs, skills, checkpoints, sprint logs, or status history.

**Why:** concern separation keeps durable context discoverable while avoiding stale execution machinery and duplicated workflow artifacts.

**Implication:** task-specific planning/evidence stays in the active conversation or substantive PR; durable knowledge is distilled into the semantic file that owns it.