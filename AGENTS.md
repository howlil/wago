# AGENTS.md

## Project State

Wago is a production-grade, single-instance modular monolith for one self-hosted WhatsApp account per instance.

The runtime is intentionally small: Express + TypeScript, Baileys, SQLite, filesystem-backed Baileys authentication, React, and one Docker container. Preserve that shape unless an approved requirement makes it insufficient.

## Canonical Operating Model

This file is the repository-wide source of truth for coding-agent and contributor execution policy.

These are **operating principles, not a rigid SOP**. Use the lifecycle as a reasoning model; do not turn it into mandatory approval ceremony or create artifacts merely to prove that a stage happened.

```text
USER INTENT
  -> UNDERSTAND
  -> BOUND
  -> SPECIFY
  -> DESIGN
  -> IMPLEMENT
  -> VERIFY
  -> QUALITY GATES
  -> RELEASE READY
  -> STOP
```

The stages may overlap or collapse for small changes. Verification can happen throughout the lifecycle.

When an older `.agent/` plan, spec, checkpoint, contributor note, or historical workflow conflicts with this file, this file wins. Historical artifacts remain useful as task history; do not rewrite them solely to make old execution records look current.

## Product Authority and Agent Autonomy

The user owns:

- WHY and desired product outcome
- WHAT behavior or capability is in scope
- product semantics and scope boundaries
- priorities and product trade-offs
- material architecture decisions
- final approve, reject, release, revert, or change-of-direction decisions

The agent has high autonomy for ordinary local engineering execution inside approved scope. The agent may:

- inspect relevant code, tests, and documentation
- clarify the implementation meaning of an approved requirement
- draft acceptance criteria from approved intent
- choose local implementation details
- reuse or extend existing patterns
- add justified tests and verification
- fix incidental defects created by the change
- remove code made dead by the change

The agent must not:

- invent features, product requirements, or product behavior
- expand scope because something is considered a best practice
- silently resolve material product ambiguity
- introduce speculative architecture, infrastructure, or extensibility
- change unrelated behavior or refactor unrelated code
- make unsolicited product-direction changes

Surface material ambiguity, contradiction, or missing product semantics instead of guessing. Do not require approval for ordinary reversible local implementation decisions that stay inside the approved boundaries.

## Understand, Bound, Specify

Start from the request, not from a framework, architecture pattern, test strategy, or repository-wide audit.

For each task:

1. Separate the problem, any proposed solution, and the explicit requirement.
2. Identify the expected observable product or engineering outcome.
3. Inspect only the minimum repository context needed to implement safely: affected code, contracts, tests, and relevant docs.
4. Bound the change surface and identify material risks or dependencies.
5. Express concise acceptance criteria sufficient to verify the approved intent.

Do not require repo-wide reconnaissance, bottleneck analysis, DORA/flow metrics, broad inventories, or instrumentation for an ordinary bounded task. Perform broader analysis only when the task itself requires it or the local change cannot be understood safely without it.

## Design Decision Rule

Design the smallest solution that satisfies the current requirement while preserving existing system boundaries.

Before introducing a new design, determine:

1. What behavior must change?
2. Which existing component owns that behavior?
3. Can the requirement be implemented using the current architecture and patterns?
4. What is the smallest design with the lowest justified blast radius?

Prefer, in order:

```text
reuse existing pattern
  -> extend existing component
  -> small local abstraction
  -> new component when ownership requires it
  -> architecture change only when necessary
```

When multiple designs are valid, prefer lower coupling, smaller change surface, fewer new dependencies, fewer new abstractions, lower migration cost, easier reversibility, and clearer ownership.

Do not introduce architectural complexity for hypothetical scale, reuse, flexibility, or future requirements.

Explicit user approval is required before a material change to:

- service or deployment boundaries
- durable data ownership or persistence model
- public API or persisted contracts when compatibility is materially affected
- inter-component communication patterns
- consistency model
- security or trust boundaries
- infrastructure topology
- destructive or irreversible data behavior

## Codebase Quality Rule

Optimize for the **smallest correct, clear, maintainable change**. Code quality supports delivery; it must not become ceremony.

Core invariants:

- preserve required behavior
- keep ownership clear
- keep dependencies intentional
- follow existing repository conventions
- prefer the simplest reasonable design
- avoid unnecessary abstractions and dependencies
- avoid unrelated refactoring
- remove dead code created or made obsolete by the change
- keep the change surface proportional to the requirement

Structure code according to responsibility and ownership:

```text
behavior -> ownership -> boundary -> module/package -> file
```

Files and modules should contain cohesive behavior. Split only when separation improves ownership, navigation, dependency boundaries, or independent changeability. Do not split by arbitrary line-count rules and do not create generic dumping grounds.

Prefer explicit code over clever indirection. Add interfaces, layers, factories, mappers, adapters, or generic utilities only when they create a concrete ownership boundary, test seam, replacement point, or repeated behavior that exists now.

## Implementation Principle

Prefer the smallest coherent **vertical slice** that produces the required observable behavior or protects the required invariant.

- Reuse current contracts and patterns before adding new ones.
- Keep frontend and backend changes aligned to one product contract when both are affected.
- Implement only current requirements; do not future-proof speculatively.
- Keep changes reviewable and reversible.
- Do not perform opportunistic cleanup outside the touched behavior.
- If implementation reveals a material requirement or architecture conflict, stop that material decision and surface it rather than silently broadening the task.

## Testing and Verification Principle

Tests exist to reduce meaningful delivery risk, not to maximize coverage, test count, or testing ceremony.

Verification is risk-based and can occur before, during, or after implementation. It is not a mandatory separate phase and TDD is not the default requirement.

For every change:

1. Identify what can realistically break.
2. Estimate the impact and likelihood of that failure.
3. Choose the cheapest high-signal verification that can detect it.
4. Increase verification depth only when risk justifies the additional cost.

Use TDD when a deterministic automated test is the cheapest high-signal way to define or protect behavior. A reproducible high-value bug should normally leave a deterministic regression test when that test provides durable signal.

Do **not** require TDD for:

- presentation-only changes
- styling or layout
- static markup
- copy or documentation
- trivial wiring
- exploratory implementation

Prioritize automated tests for:

- domain and business invariants
- persistence and data integrity
- concurrency and lifecycle state transitions
- migrations
- security and privacy boundaries
- public/provider contracts
- valuable deterministic regressions

Avoid duplicated confidence across layers. Test observable behavior and durable invariants rather than private implementation details unless the implementation boundary itself is the contract.

For every added or retained test, ask:

> What realistic regression does this prevent?

If there is no strong answer, do not add the test.

Project-specific verification guidance:

- Use real SQLite behavior in persistence tests where practical.
- For Baileys, test Wago adapters, classifiers, and lifecycle/state transitions rather than external WhatsApp connectivity in unit tests.
- Do not weaken, delete, skip, or rewrite a valid test merely to make CI green.
- Prefer deterministic tests with clear failure reasons over broad brittle tests.
- Run the smallest relevant check first, then widen verification according to risk.
- Mandatory repository/CI checks still apply even when no new automated test is justified.

## Quality Gates and Release Readiness

A change is release-ready when:

- the approved scope and acceptance criteria are satisfied
- relevant risk-based verification has passed
- mandatory repository, CI, build, security, migration, or release checks for the scope have passed
- no known material in-scope blocker remains
- compatibility and rollback risk are acceptable for the change

Instrumentation is **conditional**, not a default requirement. Add or change product/operational instrumentation when it is necessary to evaluate the expected outcome, diagnose a meaningful new failure mode, or operate the changed behavior safely.

Release the smallest complete useful increment. Do not add polish, refactors, tests, documentation, metrics, infrastructure, or abstractions without a concrete need from the current change.

After release, observe technical health, user behavior, or product outcome when the task or risk warrants it. Use evidence to recommend keep, iterate, revert, remove, or investigate; the user owns the final product decision.

## Stop Conditions

Stop normal implementation and surface the issue when continuing would require an unapproved material decision, especially:

- requirement conflicts or missing semantics that change product behavior
- destructive or irreversible migration/data behavior
- breaking public or persisted contract changes
- security/trust-boundary changes
- major architecture, service-boundary, consistency-model, or infrastructure changes

Stop the task when approved scope is satisfied, justified verification and mandatory gates pass, and no material in-scope issue remains.

After that point, do not continue with adjacent features, aesthetic refactors, speculative cleanup, future-proofing, broad audits, extra tests, new documentation, or infrastructure unless explicitly required.

## Engineering Priorities

When trade-offs genuinely conflict, use this order unless the approved requirement says otherwise:

1. Correctness
2. Security
3. Data integrity
4. Reliability
5. Maintainability
6. Observability
7. Simplicity
8. Performance
9. Extensibility

Do not optimize for hypothetical scale or introduce infrastructure to imitate a larger platform.

## Architecture Boundaries

Keep module ownership explicit.

- HTTP routes own transport concerns: authentication middleware, request-shape validation, rate limiting, HTTP responses, and transport-specific activity reporting.
- Application services own use-case orchestration when a real boundary is useful.
- Business policy owns decisions and invariants, not HTTP status codes.
- Persistence modules own SQLite statements, migrations, transactions, and durable-state semantics.
- The WhatsApp module owns all Baileys-specific socket, lifecycle, connection, sender, and protocol-adaptation behavior.
- Routes and unrelated modules must not manipulate or expose the raw Baileys socket.
- `index.ts` wires the application, lifecycle, HTTP server, and operating-system signals. It must not become a business-logic module.

Prefer narrow public APIs. Add an interface or layer only when it creates a concrete ownership boundary, test seam, or replacement point.

## Mandatory Backend Rules

Every backend change must preserve these invariants where applicable:

- Validate external input at the boundary before it reaches business logic.
- Represent expected application failures with stable typed error codes.
- Keep HTTP status mapping at the HTTP boundary.
- Keep multi-write durable invariants inside explicit SQLite transaction boundaries.
- Released database migrations are append-only. Never rewrite migration versions already shipped.
- Make lifecycle and state transitions explicit, especially socket generation, reconnect, rebind, shutdown, and account-health invalidation.
- Use idempotency when retries can duplicate side effects.
- Use structured sanitized logging. Never log API keys, cookies, authorization headers, QR payloads, Baileys credentials, message text, full phone numbers/JIDs, or arbitrary raw protocol payloads.
- Startup and shutdown must be deterministic and graceful. Stop accepting new HTTP work before closing runtime/persistence state.
- Deliberate public API contract changes must be documented and protected by appropriate characterization/contract verification.
- Baileys internals must remain contained inside the WhatsApp module.

## Persistence and State

Durable application state lives under `/app/data`.

- SQLite database: `/app/data/wago.db`
- SQLite WAL/SHM files may exist while WAL mode is active.
- Baileys authentication: `/app/data/auth/`

Treat the entire directory and its backups as secret-bearing state.

SQLite is the durable application store. Keep released migrations append-only and preserve backward compatibility when possible. Use the shared transaction helper for multi-write invariants. Never move SQL into HTTP routes.

Transient socket, QR, reconnect, account-health cache, recent-message cache, and message-status cache state may remain in memory when durability is not required for correctness, safety, or diagnosis.

Never run multiple Wago replicas against the same SQLite/auth volume.

## WhatsApp and Baileys

Wago uses Baileys, an unofficial WhatsApp Web client. Do not claim guaranteed ban prevention or unrestricted deliverability.

Maintain one active WhatsApp account and one active socket lifecycle per process. Recoverable disconnects may reconnect with bounded backoff. Terminal session invalidation must stop reconnect attempts and require pairing again.

Keep low-level observability structured and sanitized. Persist normalized audit facts, not raw Baileys packet/frame objects. QR values, credentials, message content, full identifiers, tokens, and arbitrary protocol payloads must never enter the audit database.

Outbound safety controls are defensive controls, not anti-detection mechanisms. Do not implement fake typing, fingerprint spoofing, proxy rotation, bulk/campaign behavior, or restriction bypasses.

## HTTP and Errors

Keep public responses stable unless a change is explicitly approved.

Expected failures should flow as typed application errors into the shared HTTP error mapper. Unknown failures must be logged with sanitized context and returned as a generic 500 response without stack traces, causes, credentials, request bodies, or secret headers.

Asynchronous Express handlers should use the shared async-handler boundary rather than relying on unhandled promise behavior. Avoid catch/rethrow blocks that add no value.

## Frontend

The frontend is React + Vite + TypeScript. Keep the feature-first structure and shared application shell already established. Prefer local state and focused hooks. Do not add Redux, Zustand, TanStack Query, or another router/state dependency unless current complexity demonstrates the need.

The UI must render backend uncertainty truthfully. Disconnected, unavailable, checking, and invalid-session states must never be presented as healthy/normal.

## Git Workflow

Prefer a simple trunk-oriented flow with short-lived task branches.

```text
main
  -> one short-lived task branch
  -> implement / verify / review / fix on the same branch
  -> one PR
  -> required gates
  -> squash merge
  -> cleanup
```

Rules:

- Check whether an active branch or PR already represents the task before creating new Git state.
- One coherent task should normally use one branch and one PR.
- Use short purpose-prefixed branch names such as `feat/<task>`, `fix/<task>`, `docs/<task>`, `chore/<task>`, or `refactor/<task>`.
- Test failures, CI retries, formatting fixes, review feedback, or additional verification are feedback within the same task, not reasons for replacement branches.
- Do not create long-lived `develop`, iteration, retry, staging-code, personal, or experiment branches by default.
- Keep commits as useful engineering checkpoints rather than a transcript of every edit. TDD-specific RED/GREEN commits are optional, never required.
- Keep PRs small enough to review and revert confidently; split by coherent behavior or invariant boundaries, not arbitrary technical layers.
- Normal merge method is squash merge unless a concrete reason requires another method.
- If the verified PR head changes, rerun the checks materially affected by that change.
- After merge, remove temporary branch/worktree state when tooling permits. Never discard uncommitted work accidentally.

## Anti-Over-Engineering Rules

Do not add these by default:

- microservices
- Redis or queues as decoration
- background-worker infrastructure without a demonstrated workload
- generic repository/service/controller layers for every feature
- ports/adapters/factories/mappers/DTO layers without a concrete need
- dependency-injection frameworks without a concrete need
- Kafka, RabbitMQ, BullMQ, Kubernetes, service mesh, CQRS, or event-sourcing infrastructure
- SQL inside routes
- HTTP status decisions inside business policy

A small explicit module is preferable to a generic internal framework.

## Documentation and `.agent/` Workspace

- `AGENTS.md` is the canonical repository-wide execution policy.
- `docs/` is public product documentation.
- `.agent/specs/` contains internal designs only when a task genuinely benefits from a design artifact.
- `.agent/plans/` contains implementation plans only when sequencing, dependencies, migration safety, or verification complexity warrants them.
- `.agent/checkpoints/` contains concise execution evidence when continuity or auditability benefits from it.
- Root `plan.md` is the concise engineering roadmap.

Do not create planning or documentation artifacts as ceremony. Do not put internal agent workflow notes under public `docs/`.

Internal artifacts may describe the historical workflow used for their task. They do not override this file for future execution.

## Verification Commands

Typical repository gates include:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm --dir backend test
pnpm --dir backend run build
pnpm --dir frontend test
pnpm --dir frontend run build
pnpm run build:docs
docker build .
```

Run only the checks relevant to the change during the inner loop, then run mandatory scope-appropriate gates before merge. Use the repository container smoke script when present for release/hardening verification.

## Security and Operational Constraints

- Never commit `/app/data`, SQLite WAL/SHM files, Baileys auth state, credentials, API keys, or live QR material.
- Keep production deployments behind HTTPS when exposed outside localhost.
- Do not use `docker compose down -v` during a normal upgrade unless durable gateway state is intentionally being destroyed.
- Back up `/app/data` before risky operational changes and treat that backup as sensitive credential material.
- Preserve rollback compatibility when changing durable state; if a migration prevents a known-good revision from opening a copied persistent volume, stop and redesign before merge.
