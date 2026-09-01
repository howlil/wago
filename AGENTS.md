# Wago Agent Instructions

Use the user's current request as the source of scope. Execute the smallest complete change that satisfies it.

## Context

Read only what the task needs:

- `.agent/PROJECT.md` — durable product, architecture, engineering, operational, and repository constraints.
- `.agent/STATE.md` — concise current baseline/direction when current state matters.
- `frontend/DESIGN.md` — frontend information architecture, interaction, layout, and visual rules for UI work.

Do not preload the whole repository or recursively audit it unless the task requires that breadth.

## Working preferences

- Prefer execution over process artifacts.
- Do not create committed plan/spec/checkpoint/status/skill files.
- Do not turn `STATE.md` into a sprint log, iteration tracker, roadmap, or authorization record.
- Keep plans, acceptance criteria, temporary notes, command transcripts, and routine verification evidence in the active task conversation or substantive PR when useful.
- Do not add engineering ceremony, metrics, abstractions, tests, docs, infrastructure, or refactors merely because they are considered best practice.
- Do not invent features or expand product scope beyond the user's request.

## Implementation

Start from observable behavior, then find the existing owner. Prefer, in order:

```text
reuse existing behavior/pattern
  -> extend the current owner
  -> add a small local abstraction only when current pressure justifies it
  -> add a new owner only when responsibility is genuinely distinct
  -> change architecture only when the requested behavior cannot reasonably fit the current model
```

Keep changes cohesive, local, reversible, and easy to review. Preserve existing contracts unless the user explicitly authorizes a change. Remove obsolete local code made dead by the requested change, but do not continue into unrelated cleanup or speculative future-proofing.

The user owns product behavior, scope, priorities, and material architecture decisions. The agent may choose ordinary local implementation details without asking for approval again.

Surface a decision only when continuing would require an unapproved material change such as a destructive migration, breaking public/persisted contract, security/privacy boundary change, service/deployment topology change, data-ownership change, or major consistency/infrastructure change. If the user's request already authorizes that change, execute it.

## Verification

Verification is proportional to realistic regression risk.

- Run the smallest high-signal checks first.
- Add or keep tests when they protect a meaningful invariant or regression.
- TDD is optional, not a workflow requirement.
- Do not add tests for coverage/count alone.
- Do not weaken valid tests to make CI pass.
- Diagnose deterministic failures; retry only when a transient failure is plausible.
- Run broader build/CI/container/release checks only when they apply to the affected scope or repository gates require them.

## Git

Use Git as an integration mechanism, not a planning system.

- Reuse an existing task branch/PR when one already represents the work.
- For substantive isolated work, prefer one short-lived branch and one PR when repository integration needs it.
- Do not create branches/PRs for planning, iteration announcements, checkpoints, status updates, or evidence-only changes.
- Keep follow-up fixes for the same task on the same branch/PR.
- Prefer squash merge unless there is a concrete reason not to.
- Do not create extra process state after the requested change is complete.

## Stop

Stop when the requested scope is complete, relevant verification passes, and no material in-scope blocker remains. Do not automatically continue into adjacent features, broad audits, aesthetic refactors, extra documentation, extra tests, instrumentation, or infrastructure work.

## Repository context model

The committed agent context is intentionally small:

```text
AGENTS.md
.agent/
  PROJECT.md
  STATE.md
```

`PROJECT.md` owns durable constraints. `STATE.md` owns only what is currently true. Historical task machinery and separate skill/plan/spec/engineering-ceremony documents do not belong in the repository context model.
