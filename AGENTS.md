# AGENTS.md

## Goal

Wago is a small production gateway: one process, one WhatsApp account, one SQLite database, one `/app/data` volume, one React dashboard, one Docker image. Preserve that shape until a measured requirement proves it insufficient.

Optimize for **fast verified delivery**: the shortest safe path from a bounded requirement to production evidence.

## Default Loop

```text
understand -> acceptance criteria -> RED -> GREEN -> REFACTOR -> focused verify -> PR/CI -> merge -> observe
```

Rules:

- TDD is the default for observable behavior and bug fixes. Reproduce bugs with a failing regression first when deterministic.
- Implement the smallest coherent vertical slice. Prefer useful end-to-end behavior over horizontal framework work.
- Keep WIP at one coherent task per agent. Finish feedback, CI fixes, and review fixes on the same branch/PR.
- Refactor only while tests are green and only to remove demonstrated complexity.
- Apply YAGNI aggressively. Do not build extension points, layers, infrastructure, or scale mechanisms for hypothetical needs.
- A change is done when behavior, tests, docs if needed, CI, and operational implications agree.

## Two Execution Modes

### Fast path — default

Use for localized, reversible work with clear acceptance criteria and no material security, durable-state, concurrency, migration, or public-contract risk.

- Do not create a plan/spec/checkpoint file.
- Write acceptance criteria in the issue/PR/task context.
- Run the smallest relevant test while coding.
- Open one PR when the slice is coherent; keep iterating there until green.

### Design path — exceptional

Use only when the task changes a security boundary, durable state/migration, concurrency/lifecycle invariant, public API contract, release/rollback semantics, or architecture boundary.

Create at most **one** short `.agent/<task>.md` containing only:

1. problem / acceptance criteria
2. invariants
3. chosen design
4. risks / rollback
5. verification

Do not create separate spec + plan + checkpoint documents. Delete the temporary task note after merge unless it records a durable decision that is still useful.

Git history, the PR, tests, and released documentation are the primary execution record.

## Simple Design / XP Rules

Prefer, in order:

1. code that passes the required tests
2. code that clearly expresses intent
3. fewer concepts and less duplication
4. the minimum machinery needed today

Practice:

- RED -> GREEN -> REFACTOR
- small batches and continuous integration
- characterization tests before risky cleanup
- collective ownership: improve nearby code only when it directly simplifies the active change
- frequent release of small coherent increments
- no speculative generalization

Do not confuse abstraction count with design quality. A direct function/module is better than a generic internal framework when both solve the same current problem.

## Architecture Boundaries

- HTTP routes own transport concerns: auth middleware, request validation, HTTP response mapping, rate limits, and transport-specific activity reporting.
- Application/business code owns use-case policy and invariants, not HTTP status codes.
- Persistence owns SQLite statements, migrations, transactions, and durable-state semantics.
- `backend/src/modules/whatsapp` owns Baileys sockets, lifecycle, connection, protocol adaptation, credential persistence, and sending.
- Other modules consume narrow WhatsApp capabilities; they must not manipulate the raw Baileys socket.
- Composition wiring belongs in the app/composition boundary. Do not hide dependency wiring in feature modules.
- `index.ts` owns process startup/shutdown and OS signals, not business logic.
- Frontend state and API contracts belong to the feature that owns them. Avoid root god APIs/stores.

Add an interface/layer only when it creates a real ownership boundary, test seam, or replacement point needed now.

## Backend Invariants

Every backend change must preserve these unless the task explicitly changes the contract:

- validate external input at the boundary
- expected failures use stable typed application errors
- HTTP status mapping stays at the HTTP boundary
- multi-write durable invariants use explicit SQLite transactions
- released database migrations are append-only
- lifecycle transitions are explicit and deterministic
- retryable side effects use idempotency where duplication is unsafe
- logs are structured and sanitized
- shutdown stops new work before closing runtime/persistence state
- public API changes get regression/characterization coverage and documentation

Never log or persist API keys, admin passwords, cookies, authorization headers, QR payloads, Baileys credentials, message text, full phone/JIDs, or arbitrary raw protocol payloads.

Durable state is `/app/data/wago.db` plus `/app/data/auth/`. Never run multiple active Wago processes against the same data/auth volume.

## Testing Strategy

Use risk-based verification, not ritual.

**Inner loop**

- run the specific test/file/package that proves the change
- keep feedback fast

**Normal merge gate**

```bash
pnpm check
pnpm test
pnpm build
```

**Production-sensitive changes**

Also run/require the relevant Docker persistence/rollback smoke, native architecture build, and security checks in CI.

Rules:

- never weaken a valid test merely to get green
- prefer deterministic behavior/invariant tests over implementation-detail tests
- persistence tests should use real SQLite when practical
- Baileys tests target Wago adapters/classifiers/lifecycle, not live WhatsApp connectivity
- flaky or slow tests are delivery-system defects and should be fixed

## Git Flow

```text
main -> one task branch -> one PR -> required CI -> squash merge -> delete branch
```

- Normal work never lands directly on `main`.
- One coherent task uses one branch and one PR through RED/GREEN cycles, review, and CI fixes.
- Do not create `-v2`, `-final`, `-retry`, iteration, staging, or long-lived develop branches.
- Keep PRs small enough to review and revert confidently. Split by behavior/invariant, not arbitrary technical layers.
- Working commits are optional checkpoints; commit count is not a productivity metric.
- Default merge is squash.
- Do not merge a changed head using stale verification evidence.

## Release Rules

`main` is continuously integrated and should always be releasable, but a merge is **not** a stable release.

The canonical release policy is in `RELEASING.md`.

Summary:

- `main` may publish an `edge`/SHA image for current integration testing.
- stable releases are immutable SemVer tags: `vMAJOR.MINOR.PATCH`
- `latest` points only to a stable version tag, never an arbitrary `main` commit
- release tags are created only from a green `main` commit
- breaking compatibility changes require an explicit version decision and changelog note
- released SQLite migrations are never rewritten for a release

## Anti-Over-Engineering

Do not add by default:

- microservices
- Redis/PostgreSQL as decoration
- queues/workers without a demonstrated workload
- repository/service/controller layers for every feature
- generic ports/adapters/factories/mappers/DTO layers without a concrete boundary
- dependency-injection frameworks
- Kafka, RabbitMQ, BullMQ, Kubernetes, service mesh, CQRS, or event sourcing
- Redux/Zustand/TanStack Query or a new frontend router without demonstrated complexity
- configurability for values that do not need to vary
- compatibility shims without an explicit removal condition

Prefer deletion over deprecation when Wago controls both sides of an unreleased/internal contract. For released compatibility, keep a shim only when there is a concrete supported upgrade path and a defined removal release.

## Scope and Safety

Wago is deliberately single-account and self-hosted. It does not provide bulk campaigns, anti-detection behavior, restriction bypasses, fake typing/humanization, fingerprint spoofing, proxy rotation, or multi-tenant/session infrastructure.

Baileys is an unofficial WhatsApp Web client. Represent connectivity/account-health uncertainty truthfully and never claim guaranteed ban prevention.

## Documentation

- `README.md` and `docs/` describe released/current product behavior.
- `AGENTS.md` is the engineering operating policy.
- `.agent/` is a lightweight exception workspace, not a project-management archive.
- `plan.md` contains only the current short engineering direction; completed task history belongs in Git/PRs.

Keep public docs aligned with actual behavior. Delete stale internal plans instead of maintaining parallel sources of truth.
