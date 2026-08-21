# AGENTS.md

## Project State

Wago is a production-grade, single-instance modular monolith for one self-hosted WhatsApp account per instance.

The runtime is intentionally small: Express + TypeScript, Baileys, SQLite, filesystem-backed Baileys authentication, React, and one Docker container. Preserve that shape unless a demonstrated requirement makes it insufficient.

## Engineering Priorities

Use this order when tradeoffs conflict:

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

## Delivery Operating Model

Optimize for **fast verified delivery**, not raw coding activity. The goal is to minimize the time from a well-bounded requirement to a reviewed, tested, mergeable change while keeping correctness and production safety intact.

Default feedback loop:

```text
goal
  -> acceptance criteria
  -> RED
  -> GREEN
  -> REFACTOR
  -> focused verification
  -> PR / CI
  -> review and fix on the same branch
  -> merge
  -> observe
```

Rules:

- Use **TDD for behavior changes**. Features and bug fixes follow RED -> GREEN -> REFACTOR unless the change has no meaningful executable behavior, such as prose-only documentation or mechanical formatting.
- For a reproducible bug, write the failing regression before the fix. The test must fail for the intended reason.
- Implement the **smallest coherent vertical slice** that produces useful behavior. Prefer end-to-end slices over large horizontal layer-by-layer batches.
- Keep work in small batches that are easy to review, verify, revert, and reason about.
- Prefer the shortest safe feedback loop: run focused tests during development; run broader repository gates when the change reaches a mergeable state or the risk warrants it.
- Limit WIP. One agent should normally drive one coherent task end-to-end before starting unrelated work.
- Stay on the same task branch and PR through RED/GREEN cycles, review fixes, CI failures, and small follow-ups. Feedback is not a new task identity.
- Do not over-plan trivial, low-risk changes. Plan only enough to expose acceptance criteria, dependencies, risks, and verification. Use deeper design work for migrations, concurrency, security boundaries, durable-state changes, public contracts, or architecture changes.
- Apply YAGNI aggressively. Do not add abstractions, infrastructure, generalization, or extensibility for hypothetical future requirements.
- Do not trade away correctness, security, data integrity, or rollback safety merely to improve speed metrics.

## Delivery Metrics

Use metrics to improve the engineering system, not to score individual developers or agents.

Prefer these signals:

- **Cycle time**: task start to merge-ready/merged.
- **PR lead time**: PR opened to merge.
- **CI feedback time**: push to actionable CI result.
- **Change failure rate**: merged/deployed changes that cause rollback, hotfix, or production incident.
- **Escaped defect rate**: behavior defects discovered after merge/release.
- **Rework rate**: substantial same-task work caused by unclear requirements, weak design, insufficient tests, or review churn.
- **Flaky-test rate**: failures that do not represent a real behavior regression.
- **WIP age**: how long an active task remains unfinished.
- **Deployment frequency**, when Wago has a reliable deployment/release signal.

Interpretation rules:

- Optimize trends, not vanity numbers.
- Commit count, branch count, lines changed, and PR count are **not productivity KPIs**.
- A fast cycle with high rework or escaped defects is not healthy delivery.
- A slower high-risk change can be correct if the extra time buys necessary verification or rollback safety.
- When a metric worsens, inspect the bottleneck first: unclear scope, oversized batch, slow CI, flaky tests, review latency, architecture coupling, or manual release friction.

## Agent Execution Rules

A coding agent should own a bounded task through implementation and verification rather than stopping after code generation.

For each task:

1. Resolve the intended behavior and acceptance criteria from existing requirements, code, tests, issues, or the user request.
2. Check whether an active branch or PR already represents the task before creating Git state.
3. Identify the smallest safe test seam and create RED evidence for behavior changes.
4. Implement only enough to reach GREEN.
5. Refactor while tests stay green; remove unnecessary duplication or accidental complexity, but do not broaden scope.
6. Run focused verification immediately after the change.
7. Run broader gates required by scope before merge.
8. Keep review fixes and CI corrections on the same branch and PR.
9. Record concise evidence when an internal plan/checkpoint exists: what changed, what was verified, and any remaining risk/blocker.
10. Finish the operational lifecycle: merge only after required gates pass, then clean temporary branch/worktree state when tooling permits.

Do not bypass human review or explicit approval gates when a change materially affects production-critical security boundaries, irreversible durable state, credentials, destructive operations, or similarly high-impact behavior.

## Architecture Boundaries

Keep module ownership explicit.

- HTTP routes own transport concerns: authentication middleware, request-shape validation, rate limiting, HTTP responses, and transport-specific activity reporting.
- Application services own use-case orchestration when a real boundary is useful.
- Business policy owns decisions and invariants, not HTTP status codes.
- Persistence modules own SQLite statements, migrations, transactions, and durable-state semantics.
- The WhatsApp module owns all Baileys-specific socket, lifecycle, connection, sender, and protocol adaptation behavior.
- Routes and unrelated modules must not manipulate or expose the raw Baileys socket.
- `index.ts` wires the application, lifecycle, HTTP server, and operating-system signals. It must not become a business-logic module.

Prefer narrow public APIs. Add an interface or layer only when it creates a concrete ownership boundary, test seam, or replacement point.

## Mandatory Backend Rules

Every backend change MUST follow these rules:

- Validate external input at the boundary before it reaches business logic.
- Represent expected application failures with stable typed error codes.
- Keep HTTP status mapping at the HTTP boundary.
- Add a regression test before fixing a behavior defect when the failure can be reproduced deterministically.
- Keep multi-write durable invariants inside explicit SQLite transaction boundaries.
- Released database migrations are append-only. Never rewrite migration versions already shipped.
- Make lifecycle and state transitions explicit, especially socket generation, reconnect, rebind, shutdown, and account-health invalidation.
- Use idempotency when retries can duplicate side effects.
- Use structured sanitized logging. Never log API keys, cookies, authorization headers, QR payloads, Baileys credentials, message text, full phone numbers/JIDs, or arbitrary raw protocol payloads.
- Startup and shutdown must be deterministic and graceful. Stop accepting new HTTP work before closing runtime/persistence state.
- Deliberate public API contract changes must be documented and covered by characterization/regression tests.
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

Keep public responses stable unless a change is explicitly reviewed.

Expected failures should flow as typed application errors into the shared HTTP error mapper. Unknown failures must be logged with sanitized context and returned as a generic 500 response without stack traces, causes, credentials, request bodies, or secret headers.

Asynchronous Express handlers should use the shared async-handler boundary rather than relying on unhandled promise behavior. Avoid catch/rethrow blocks that add no value.

## Testing and Change Discipline

TDD is the default engineering loop for executable behavior:

```text
RED -> GREEN -> REFACTOR
```

For behavior changes:

1. Characterize the existing contract when needed.
2. Add the intended failing test or regression first.
3. Confirm the RED failure is caused by the missing/incorrect behavior, not formatting, tooling, fixtures, or an unrelated failure.
4. Implement the smallest coherent change that makes the intended test pass.
5. Run focused tests immediately.
6. Refactor only while preserving GREEN.
7. Run repository checks and broader backend/frontend/build/container/security gates when the scope warrants them before merge.

Additional rules:

- Do not weaken, delete, skip, or rewrite a valid test merely to make CI green.
- Prefer deterministic tests with clear failure reasons over broad brittle tests.
- Bugs should leave a regression test behind whenever the failure can be reproduced deterministically.
- Test observable behavior and durable invariants rather than private implementation details unless the implementation boundary itself is the contract.
- Use real SQLite behavior in persistence tests where practical.
- For Baileys, test Wago adapters, classifiers, and lifecycle/state transitions rather than depending on external WhatsApp connectivity in unit tests.
- Keep the inner loop fast. Run the smallest relevant test set first, then widen verification as confidence grows.
- Treat flaky tests and slow CI as delivery-system defects that deserve repair, not as normal friction.

## Git Workflow Discipline

Keep repository history and temporary Git state small and intentional.

The normal lifecycle is:

```text
main
  -> one task branch
  -> work / test / review / fix on the same branch
  -> one PR
  -> verify current head and mandatory gates
  -> squash merge
  -> delete task branch and remove task worktree
```

### Branch lifecycle

- One task, bugfix, documentation update, or coherent feature gets at most one working branch.
- Before creating a branch, check whether an active branch or PR already represents the same task. If it does, continue it.
- Use short purpose-prefixed names such as `feat/<task-slug>`, `fix/<task-slug>`, `docs/<task-slug>`, `chore/<task-slug>`, or `refactor/<task-slug>`.
- A failed test, failed CI run, formatting correction, typo, small review follow-up, another RED/GREEN cycle, retry, or base-branch update is not a reason to create another branch.
- Do not create branch churn such as `fix/foo-v2`, `fix/foo-final`, `fix/foo-retry`, `iteration-*`, or `review-fixes-*` when the work is still the same task.
- Normal work must not be performed directly on `main`. Direct changes to `main` require an explicit exceptional reason.
- Do not introduce long-lived `develop`, iteration, staging-code, personal, or experiment branches by default. `main` is the integration branch.

### Commit discipline

- Working commits must represent useful engineering checkpoints, not every edit or command run.
- Meaningful TDD RED/GREEN checkpoints are allowed when they help diagnosis, review, or preserve useful evidence, but they are optional.
- Do not create a separate retained commit merely for formatting, a typo, lint cleanup, CI retry, a tiny same-task review fix, artifact regeneration caused by the same task, or `fix previous commit` cleanup.
- Prefer folding small corrections into the next meaningful checkpoint. Amend or squash local history when it is safe to do so.
- There is no artificial maximum commit count on a task branch. Every retained working commit should simply earn its existence.
- A test or CI failure is feedback within the current task, not a new task identity.

### Pull requests and merge

- One normal task uses one PR. Review corrections, failed CI, added tests, and implementation revisions stay on the same branch and PR.
- Use a draft PR only when early CI or review is materially useful; do not create draft PRs automatically.
- Keep the task coherent: include tests and documentation required by the task, but do not mix unrelated opportunistic cleanup into the same branch.
- Keep PRs small enough to review and revert confidently. Split oversized work by user-visible behavior or invariant boundaries, not by arbitrary technical layers.
- If `main` advances, update the existing task branch when needed instead of replacing it with a new branch.
- Avoid force-pushing shared branches unless rewriting is necessary and safe. Never rewrite another contributor's active history casually.
- Default normal merge method is **squash merge**, so `main` receives one clean logical commit for the completed task even when the working branch contained useful checkpoints.
- Before merge, verify the current PR head, required acceptance/focused tests, mandatory CI/build/security gates for the scope, and that no unresolved review thread or known blocker remains.
- If the verified PR head changes, verify the relevant gates again before merge.
- When the user has already authorized completion of the task and all merge gates are satisfied, do not ask for a redundant merge confirmation.
- Merge commits or rebase merges require an explicit reason; they are not the normal completion path.

### Cleanup

A task is not operationally complete until temporary Git state is cleaned up.

- After merge, delete the remote task branch when tooling permits.
- Remove the task worktree if one was created, then delete its local task branch and prune stale worktree metadata when applicable.
- If a task is abandoned, close its PR when appropriate and remove the abandoned remote branch, local branch, and worktree after intentionally preserving any valuable work.
- Do not keep stale `experiment-*`, `iteration-*`, `retry-*`, or merged task branches as an informal archive. Git history, PRs, tags, or explicit patches are the archive.
- A worktree is an isolation mechanism, not a reason to create a second branch for the same task. Normally use at most one task worktree for one active task branch.
- Never delete a worktree that contains uncommitted work without intentionally preserving or discarding that work first.
- If available tooling cannot delete a remote branch or worktree, report exactly what cleanup remains. Never claim cleanup succeeded without evidence.

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

## Frontend

The frontend is React + Vite + TypeScript. Keep the feature-first structure and shared application shell already established. Prefer local state and focused hooks. Do not add Redux, Zustand, TanStack Query, or another router/state dependency unless current complexity demonstrates the need.

The UI must render backend uncertainty truthfully. Disconnected, unavailable, checking, and invalid-session states must never be presented as healthy/normal.

## Documentation and Planning

- `AGENTS.md` is the repository-wide execution policy for coding agents and contributors.
- `docs/` is public product documentation.
- `.agent/specs/` contains approved internal designs for work that genuinely benefits from a design artifact.
- `.agent/plans/` contains detailed implementation plans and execution evidence when task complexity warrants them.
- Root `plan.md` is the concise engineering roadmap.

Do not create planning/documentation artifacts as ceremony. A trivial, low-risk change does not need a heavyweight spec or plan when acceptance criteria and verification are already clear.

Do not put internal agent workflow notes under public `docs/`.

## Verification Commands

Typical repository gates:

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

Use the repository container smoke script when present for release/hardening verification.

## Security and Operational Constraints

- Never commit `/app/data`, SQLite WAL/SHM files, Baileys auth state, credentials, API keys, or live QR material.
- Keep production deployments behind HTTPS when exposed outside localhost.
- Do not use `docker compose down -v` during a normal upgrade unless durable gateway state is intentionally being destroyed.
- Back up `/app/data` before risky operational changes and treat that backup as sensitive credential material.
- Preserve rollback compatibility when changing durable state; if a migration prevents a known-good revision from opening a copied persistent volume, stop and redesign before merge.
