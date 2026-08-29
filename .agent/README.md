# Wago Project Context

`.agent/` is Wago's small semantic project model. It stores current project truth that is expensive to rediscover, not task history or agent scratchpads.

`AGENTS.md` is the canonical execution adapter. Read this directory progressively and only for the concern the current task touches.

## Context routing

| Need | Read |
| --- | --- |
| durable current project state/direction | `STATE.md` |
| product shape, architecture, project structure, ownership, non-goals | `PROJECT.md` |
| code organization, design discipline, testing, verification, Git | `ENGINEERING.md` |
| persistence, deployment, readiness, backup, rollback, release | `OPERATIONS.md` |
| durable architectural/product engineering choices and rationale | `DECISIONS.md` |

Do not preload every file and do not begin ordinary work with a recursive repository audit. `STATE.md` is not mandatory reading for a task whose scope is already clear from the request and affected code.

## Information model

Keep these concerns separate:

1. `PROJECT.md` — what Wago is and which component owns what.
2. `ENGINEERING.md` — how implementation changes should be shaped and verified.
3. `OPERATIONS.md` — how Wago remains safe and operable in production.
4. `DECISIONS.md` — why durable choices exist.
5. `STATE.md` — durable current baseline/direction, not a task plan or sprint log.

If a durable fact changes, update the document that owns that fact rather than creating another overlapping file.

## Artifact discipline

Do not use `.agent/` as a permanent archive for:

- implementation plans
- design-spec snapshots for completed tasks
- checkpoints or command transcripts
- CI/run evidence
- retrospective scratchpads
- generic task playbooks or skills
- iteration announcements or status-only updates

Routine bounded work belongs in the task conversation and substantive PR. A temporary plan may exist outside the committed project model when complexity genuinely requires it, but completed task machinery should not become permanent repository knowledge.

Do not create a standalone repository change merely to announce that an iteration started or ended. Update `STATE.md` only when the durable current project state itself materially changes, and fold that update into the substantive change when practical.

Preserve durable project knowledge before deleting obsolete task artifacts: current requirements, architecture boundaries, state/data ownership, security/operational constraints, compatibility rules, and material decision rationale.

## Public documentation boundary

`docs/` is public Wago documentation. Internal execution policy and project-model files stay in `AGENTS.md` and `.agent/`.

Do not publish internal agent workflow, unfinished requirements, or decision scratchpads under `docs/` unless intentionally rewritten as user-facing documentation.
