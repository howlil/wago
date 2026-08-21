# Wago Agent Workspace

`.agent/` is the repository-local workspace for agent planning and execution artifacts.

## Boundary

Use `.agent/` for internal engineering work products that are useful to contributors or coding agents but are **not public product documentation**:

- design specs
- implementation plans
- audit notes
- execution/checkpoint notes
- temporary engineering decisions that should stay versioned

Use `docs/` only for the public Astro documentation site that Wago users read.

Do not place agent plans/specs under `docs/`, because everything under `docs/` belongs to the public documentation product boundary.

## Operating Model

Repository-wide agent behavior is defined by root `AGENTS.md`. The default engineering model is **fast verified delivery**:

```text
goal
  -> acceptance criteria
  -> RED
  -> GREEN
  -> REFACTOR
  -> focused verification
  -> PR / CI
  -> review and fixes on the same branch
  -> merge
  -> observe
```

Use `.agent/` to support that loop, not to add ceremony.

- Behavior changes use TDD by default.
- Keep batches small, bounded, reviewable, and reversible.
- Prefer one coherent task, one branch, and one PR through its feedback cycles.
- Do not create new branches or retained commits merely because tests fail, CI reruns, formatting changes, or review feedback arrives.
- Run focused tests for a fast inner loop, then widen verification according to risk before merge.
- Apply YAGNI; avoid speculative abstraction and infrastructure.
- Do not write a heavyweight design or implementation plan for a trivial low-risk task whose acceptance criteria and verification are already obvious.
- For migrations, concurrency, security boundaries, public API contracts, durable-state changes, or architecture changes, capture the design/risk decisions before implementation.

Delivery health is judged by flow and quality signals such as cycle time, PR lead time, CI feedback time, rework, escaped defects, change failure rate, flaky tests, and WIP age. Commit count, branch count, lines changed, and PR count are not productivity KPIs.

## Structure

```text
.agent/
  README.md
  specs/
    YYYY-MM-DD-<topic>-design.md
  plans/
    YYYY-MM-DD-<topic>.md
  checkpoints/
    YYYY-MM-DD-<topic>.md
```

Create an artifact only when it improves execution, review, continuity, or auditability. Add another subdirectory only when a real recurring artifact type appears. Do not mirror source-code architecture inside `.agent/`.

## Artifact Rules

### Specs

Use `.agent/specs/` when the task has material design risk or tradeoffs that should be settled before coding. Keep specs decision-oriented: problem, constraints, invariants, chosen design, rejected alternatives when relevant, risks, and acceptance criteria.

### Plans

Use `.agent/plans/` for multi-step implementation where sequencing, dependencies, migration safety, or verification would otherwise be easy to lose. Plans should describe executable work, not repeat the codebase documentation.

### Checkpoints

Use `.agent/checkpoints/` for concise execution evidence when useful:

- what changed
- what was verified
- current result
- remaining blocker/risk, if any

Do not create checkpoint spam for every command or tiny edit.

## Source-of-truth hierarchy

1. Runtime/backend/frontend code defines actual product behavior.
2. Root `AGENTS.md` defines repository-wide engineering and agent execution policy.
3. Root `plan.md` is the concise engineering roadmap and milestone ledger.
4. `.agent/specs/` holds approved designs.
5. `.agent/plans/` holds detailed task-by-task implementation plans.
6. `.agent/checkpoints/` holds concise execution evidence when needed.
7. `docs/` explains released/current Wago behavior to public users.

If a public document and code disagree, fix the public document. If an agent plan/spec and current code disagree because implementation has advanced or an approved decision changed, update the relevant internal artifact before relying on it for further work.

## Public Documentation Rule

Never publish agent workflow language, internal checkpoints, speculative implementation details, or unfinished requirements in the Astro docs unless they are intentionally rewritten as user-facing documentation.
