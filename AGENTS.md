# AGENTS.md

## Goal

Wago is a small production gateway: one process, one WhatsApp account, one SQLite database, one `/app/data` volume, one React dashboard, and one Docker image.

Optimize for **fast verified delivery**: the shortest safe path from a bounded requirement to production evidence. Preserve the current shape until measured product or operational evidence proves it insufficient.

## Scope Governor

An audit finding is not automatically implementation work.

Classify findings as `now`, `after-feedback`, `later`, or `not-now`. Work on it now only when at least one is true:

1. the primary user journey fails without it;
2. it prevents material security, data-loss, compatibility, reliability, or external-side-effect risk;
3. real usage/dogfood evidence exposed it;
4. the decision becomes expensive to reverse if delayed.

Otherwise defer it. Do not mix opportunistic cleanup into an active product slice.

## Requirement and Iteration Rule

Start from an **outcome**, not a technical solution.

For every non-trivial task establish only:

- user/operator outcome;
- acceptance criteria observable from outside the implementation;
- constraints/invariants that must remain true;
- smallest coherent vertical slice that can prove the outcome.

Default iteration loop:

```text
outcome
  -> acceptance criteria
  -> RED when behavior needs a test
  -> smallest GREEN implementation
  -> REFACTOR only demonstrated complexity
  -> focused verification
  -> PR / CI
  -> merge
  -> observe
```

Do not create artificial iteration PRs, milestone ledgers, or follow-up branches for the same unfinished outcome. Feedback, CI failures, and review fixes stay inside the current task.

## Execution Modes

### Fast path — default

Use for localized, reversible work with clear acceptance criteria and no material security, durable-state, concurrency, migration, public-contract, architecture, or release risk.

- no plan/spec/checkpoint file;
- one coherent task at a time;
- smallest relevant test during coding;
- one branch and one PR;
- widen verification only when the change becomes mergeable.

### Design path — exceptional

Use only for expensive-to-reverse decisions: security boundaries, durable state/migrations, concurrency/lifecycle invariants, public API compatibility, architecture boundaries, or release/rollback semantics.

Create at most **one** short `.agent/<task>.md` containing:

1. acceptance criteria;
2. invariants;
3. decision;
4. risks/rollback;
5. verification.

No separate spec + plan + checkpoint stack. Delete the note after merge unless the decision remains useful beyond the PR.

## System Design Rules

Prefer a modular monolith and explicit ownership.

- HTTP routes own transport: authentication middleware, boundary validation, rate limits, response mapping, and transport-specific activity reporting.
- Application/business code owns use-case policy and invariants, not HTTP status codes.
- Persistence owns SQLite statements, transactions, migrations, and durable-state semantics.
- `backend/src/modules/whatsapp` owns Baileys sockets, lifecycle, protocol adaptation, credential persistence, and sending.
- Other modules consume narrow WhatsApp capabilities; they never manipulate the raw Baileys socket.
- Composition wiring belongs in the app/composition boundary.
- `index.ts` owns process startup/shutdown and OS signals, not business logic.
- Frontend state, hooks, and API contracts belong to the feature that owns them; avoid root god APIs/stores.

Add a layer, interface, adapter, cache, queue, database, service, or new dependency only when a current requirement creates a concrete boundary or measurable pressure.

## Code Pattern Rules

Prefer direct code over architectural ceremony.

- small cohesive modules and functions;
- explicit data flow and state transitions;
- stable typed errors for expected application failures;
- boundary validation before business logic;
- explicit SQLite transactions for multi-write invariants;
- idempotency where retries can duplicate unsafe side effects;
- append-only released migrations;
- structured sanitized logs;
- dependency injection by ordinary function/module composition when a test seam is needed;
- characterization tests before risky legacy deletion.

Do not introduce generic repository/service/controller/factory/mapper/DTO layers merely for pattern consistency. Duplication is cheaper than a wrong abstraction when the common behavior is not yet proven.

## Backend Invariants

Every backend change preserves these unless the requirement explicitly changes the contract:

- expected failures use stable typed application errors;
- HTTP status mapping stays at the HTTP boundary;
- lifecycle transitions are explicit and deterministic;
- shutdown stops new work before closing runtime/persistence state;
- public API changes have regression/characterization coverage and documentation;
- durable application state remains `/app/data/wago.db` plus `/app/data/auth/`;
- never run multiple active Wago processes against the same data/auth volume.

Never log or persist API keys, admin passwords, cookies, authorization headers, QR payloads, Baileys credentials, message text, full phone/JIDs, or arbitrary raw protocol payloads.

## Verification Strategy

Verification depth follows risk, not ritual.

| Level | Change | Minimum evidence |
| --- | --- | --- |
| 0 | docs/copy/local metadata | diff/syntax review |
| 1 | localized deterministic behavior | focused test + relevant static/build check |
| 2 | core user flow | focused tests + normal CI/integration smoke |
| 3 | persistence, migration, security, concurrency, external side effect | broader affected suite + regression/rollback evidence |
| 4 | packaging/runtime portability/release | full relevant CI + explicit target-platform/release verification |

Normal repository merge gate when applicable:

```bash
pnpm check
pnpm test
pnpm build
```

Docker persistence/rollback, ARM64, security, or release checks are required only when the change touches those risks or when branch protection requires them. Do not use remote CI as the normal inner-loop test runner when a focused local/repository test can answer faster.

Never weaken a valid test to get green. Treat flaky or slow tests as delivery-system defects.

## Git Strategy

```text
main -> one task branch -> one PR -> required evidence -> squash merge -> delete branch
```

- WIP limit: one coherent task per agent.
- No normal work directly on `main`.
- No `-v2`, `-final`, `-retry`, iteration, staging, or long-lived develop branches.
- CI failures and review feedback do not create a new branch or PR.
- Split oversized work by independently useful behavior/invariant, not technical layers.
- Working commits are disposable checkpoints; commit count is not productivity.
- Default merge method is squash.
- Never merge a changed head using stale verification evidence.

## Skill and Tool Strategy

Use the smallest capability that can prove the current step.

1. inspect repository code/tests/config first;
2. use existing repository scripts and focused tests before adding tooling;
3. use external documentation only when repository reality cannot answer the question;
4. use specialized security/design/release analysis only when the task actually contains that risk;
5. do not create new agent roles, skills, schemas, orchestration, or automation merely to make the workflow look complete.

A tool or skill must reduce uncertainty or execution time for the active task. If it creates more setup, state, or coordination than the problem it solves, do not add it.

## Release Strategy

`main` is continuously integrated and should remain releasable, but merge is not automatically a stable release. `RELEASING.md` is canonical.

- green `main` may publish `edge` and immutable SHA images;
- stable releases use immutable `vMAJOR.MINOR.PATCH` tags from a green `main` commit;
- `latest` points only to a stable release;
- no normal release branch and no retagging a bad release;
- released SQLite migrations are immutable;
- compatibility removal requires an explicit version decision and changelog entry;
- rollback must respect durable-state compatibility.

## Delivery and Product Metrics

Metrics diagnose the system; they do not score developers or agents.

Engineering flow:

- cycle time: task start -> merged;
- PR lead time: PR opened -> merged;
- CI feedback time: push -> actionable result;
- review wait time;
- WIP age;
- rework rate;
- flaky-test rate;
- change failure rate;
- deployment/release frequency;
- failed-release recovery time.

Product/operational signals:

- deploy -> healthy startup success rate;
- deploy -> paired -> first successful message time;
- pairing success/failure rate;
- outbound API success/error rate;
- webhook delivery/retry failure rate;
- upgrade and rollback success rate;
- production incident/escaped-defect rate.

Commit count, branch count, PR count, and lines changed are **not** productivity KPIs. They may only be used as clues that a batch or workflow has become too large.

## Anti-Over-Engineering

Do not add by default:

- microservices;
- Redis/PostgreSQL as decoration;
- queues/workers without demonstrated workload;
- dependency-injection frameworks;
- Kafka, RabbitMQ, BullMQ, Kubernetes, service mesh, CQRS, event sourcing;
- generic ports/adapters/factories/mappers/DTO layers without a real boundary;
- Redux/Zustand/TanStack Query or a new router without demonstrated frontend complexity;
- configurability for values that do not need to vary;
- compatibility shims without a supported upgrade path and removal condition.

Prefer deletion over deprecation for unreleased/internal contracts Wago controls. For released compatibility, preserve only what is required for a safe supported upgrade.

## Scope and Documentation

Wago remains single-account and self-hosted. It does not provide bulk campaigns, anti-detection behavior, restriction bypasses, fake typing/humanization, fingerprint spoofing, proxy rotation, or multi-tenant/session infrastructure.

Baileys is an unofficial WhatsApp Web client. Represent connectivity/account-health uncertainty truthfully and never claim guaranteed ban prevention.

- `README.md` and `docs/` describe current/released product behavior.
- `AGENTS.md` is the engineering operating policy.
- `.agent/` is an exception workspace, not a project-management archive.
- `plan.md` contains only current engineering direction.

Keep source, tests, runtime behavior, release docs, and user docs aligned. Delete stale internal process artifacts instead of maintaining parallel sources of truth.
