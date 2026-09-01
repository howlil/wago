# Wago Agent Instructions

Use the user's current request as the source of scope. Execute the smallest complete change that satisfies it.

## Context

Read only what the task needs:

- `.agent/PROJECT.md` — product shape, architecture, ownership, hard constraints, and non-goals.
- `.agent/STATE.md` — durable current baseline when current state matters.
- `.agent/OPERATIONS.md` — persistence, deployment, readiness, backup/restore, rollback, and release safety.
- `apps/dashboard/DESIGN.md` — UI information architecture, interaction, responsive layout, and visual rules.

Do not preload every context file or recursively audit the repository by default.

## Execution

- Prefer execution over process artifacts.
- Do not create committed plan/spec/checkpoint/status/skill files.
- Do not use `.agent/` as task history, sprint machinery, or scratch space.
- Do not add ceremony, abstractions, tests, docs, metrics, infrastructure, or refactors merely because they are considered best practice.
- Reuse the current owner/pattern first; add a new abstraction or owner only when the requested behavior creates real pressure for it.
- Preserve public and persisted contracts unless the user explicitly authorizes a breaking change.
- Remove obsolete local code made dead by the requested change, but do not continue into unrelated cleanup.

The user owns product behavior, scope, priorities, and material architecture decisions. Ordinary local implementation details do not require another approval round.

## Engineering

Organize code from meaning outward:

```text
behavior -> owner -> boundary -> module/feature -> file
```

Keep behavior and mutable state near the owner that protects their invariants. Prefer narrow capability boundaries over generic `manager`, `service`, `common`, or DI layers. Framework/provider details stay at their boundary.

Verification is proportional to realistic regression risk:

- run the smallest high-signal check first;
- retain/add tests for meaningful invariants or regressions, not test count or coverage ceremony;
- do not weaken valid tests to make CI green;
- use broader container/release checks only when the affected risk or repository gates require them.

## Git

Use Git for integration, not planning. Reuse an existing task branch/PR when one exists. For substantive isolated work, use one short-lived branch and one PR, keep fixes on the same branch, and prefer squash merge. Do not create Git state for plans, checkpoints, or evidence-only work.

## Stop

Stop when the requested scope is complete, relevant verification passes, and no material in-scope blocker remains. Do not automatically continue into adjacent features, aesthetic refactors, extra documentation, instrumentation, or infrastructure work.
