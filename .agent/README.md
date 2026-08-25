# Wago `.agent` Workspace

`.agent/` is intentionally small. It exists only for temporary engineering notes that materially improve a risky task.

## Default: no artifact

For normal features, bug fixes, refactors, tests, docs, and dependency work, do **not** create files here. Use the task/issue, tests, PR description, CI, and Git history as the execution record.

Default loop:

```text
acceptance criteria -> RED -> GREEN -> REFACTOR -> focused verify -> PR/CI -> merge -> observe
```

## When a note is justified

Create one `.agent/<task>.md` only when the work has material design risk involving at least one of:

- security/authentication boundary
- durable state or database migration
- concurrency/lifecycle ownership
- public API compatibility
- release/rollback semantics
- architecture boundary

Keep the note short and decision-oriented:

```text
# <task>

## Acceptance criteria
## Invariants
## Decision
## Risks / rollback
## Verification
```

Do not create separate specs, plans, ledgers, and checkpoints for the same task.

## Lifecycle

- The note supports the active change; it is not a second source of truth.
- Update it only when the decision changes materially.
- Delete it after merge when Git/PR/tests already preserve the useful history.
- Keep it only when it remains a durable engineering decision that future changes genuinely need.

`AGENTS.md` defines the repository operating model. `README.md` and `docs/` define current/released user-facing behavior. `plan.md` contains only current engineering direction.
