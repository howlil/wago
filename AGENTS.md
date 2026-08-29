# Wago Agent Adapter

This file is the canonical execution adapter for Wago. It owns the lifecycle, authority model, scope discipline, release-ready boundary, and stop conditions. Detailed project knowledge lives under `.agent/`; those files refine concerns but must not create a competing workflow.

## Read progressively

Start with the minimum context needed for the task:

1. `.agent/STATE.md` — current committed project state.
2. `.agent/PROJECT.md` — product/system shape, source structure, ownership, constraints, and non-goals when implementation placement or architecture matters.
3. `.agent/ENGINEERING.md` — detailed code quality, design, testing/verification, and Git rules for code changes.
4. `.agent/OPERATIONS.md` — persistence, deployment, readiness, backup/restore, rollback, or release work.
5. `.agent/DECISIONS.md` — durable rationale when a task touches an established material boundary.

Do not load the whole `.agent/` model or recursively audit the repository by default. Expand context only when the requested change or a discovered dependency materially requires it.

## Authority model

The user owns:

- WHY and desired product outcome;
- WHAT behavior/capability is in scope;
- product semantics and scope boundaries;
- priorities/product trade-offs;
- material architecture decisions;
- final approve/reject/release/revert/change-of-direction decisions.

The agent has high autonomy for ordinary local engineering execution inside approved scope. It may inspect relevant code/tests/docs, derive concise acceptance criteria from approved intent, choose reversible local implementation details, reuse/extend current patterns, add justified verification, fix defects created by the change, and remove code made dead by the change.

The agent must not invent features or product behavior, expand scope because of best practice, silently resolve material product ambiguity, introduce speculative architecture/infrastructure, or refactor unrelated code.

Do not ask for approval for ordinary local implementation choices that preserve approved product and architecture boundaries.

## Canonical execution loop

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

This is a reasoning model, not a rigid SOP. Stages may overlap or collapse for small work, and verification may happen throughout.

Operationally:

```text
understand explicit request/problem
  -> inspect only relevant existing implementation/contracts
  -> bound smallest coherent change
  -> derive only acceptance criteria needed to remove ambiguity
  -> choose smallest design using existing owner/pattern
  -> implement minimum complete change
  -> identify realistic regression risk
  -> choose cheapest high-signal verification
  -> satisfy mandatory repository gates
  -> release/merge when evidence supports readiness
  -> stop
```

## Understand and bound

For each task:

1. separate the problem, any proposed solution, and the explicit requirement;
2. identify the expected observable product/engineering outcome;
3. inspect only affected code, contracts, tests, and relevant project context;
4. identify material risks/dependencies;
5. keep acceptance criteria concise and sufficient to verify the authorized intent.

Do not require repo-wide reconnaissance, bottleneck analysis, DORA/flow metrics, broad inventories, instrumentation, plans, specs, checkpoints, or mini-PRDs for ordinary bounded work.

## Design rule

Before introducing design, answer:

1. What behavior must change?
2. Which existing component/module/feature owns it?
3. Can current architecture/patterns satisfy the requirement?
4. What is the smallest design with the lowest justified blast radius?

Prefer:

```text
reuse current pattern
  -> extend current owner
  -> small local abstraction when current pressure justifies it
  -> new owner/component when responsibility is genuinely distinct
  -> material architecture change only when necessary
```

Use `.agent/PROJECT.md` for placement, state ownership, dependency, and hard architecture constraints. Use `.agent/ENGINEERING.md` for detailed code/abstraction/testing rules.

Explicit user approval is required before an otherwise-unauthorized material change to:

- service/deployment boundaries;
- durable data ownership/persistence model;
- materially breaking public or persisted contracts;
- major inter-component communication patterns;
- consistency model;
- security/privacy/trust boundaries;
- infrastructure topology;
- destructive or irreversible data behavior.

If the user's explicit request already authorizes the material decision, execute it within that scope instead of asking again.

## Implementation rule

Prefer the smallest coherent vertical slice that produces the required observable behavior or protects the required invariant.

- preserve current contracts unless change is explicitly authorized;
- keep frontend/backend aligned to one product contract when both are affected;
- avoid speculative future-proofing and unrelated cleanup;
- remove superseded local paths made obsolete by the current change;
- keep changes reviewable and reversible;
- if implementation reveals an unauthorized material requirement/architecture decision, surface that decision rather than silently widening scope.

## Testing and verification

Tests reduce meaningful delivery risk; they do not exist to maximize coverage/test count or enforce TDD ceremony.

For each change:

1. identify realistic failure modes;
2. estimate impact/likelihood;
3. choose the cheapest high-signal verification;
4. deepen only when risk justifies it.

TDD is optional. Use it when a deterministic automated test is the cheapest useful way to define/protect behavior. Do not require it for presentation-only changes, styling/layout, static markup, copy/docs, trivial wiring, or exploratory work.

Before adding or retaining a test ask:

> What realistic regression does this prevent?

Do not weaken/delete/skip a valid test merely to make CI green.

When a test/CI check fails, classify from evidence before calling it flaky/transient. Retry only when a transient runner/infrastructure/external-dependency failure is plausible; deterministic code/test failures require diagnosis or a fix.

Detailed verification and mock-isolation rules live in `.agent/ENGINEERING.md`.

## Quality gates and release readiness

A change is release-ready when:

- approved scope and acceptance criteria are satisfied;
- relevant risk-based verification has passed;
- mandatory repository/CI/build/security/migration/release checks for the scope have passed;
- no known material in-scope blocker remains;
- compatibility and rollback risk are acceptable for the change.

Instrumentation is conditional, not a default deliverable. Add it only when needed to evaluate an expected outcome, diagnose a meaningful new failure mode, or operate changed behavior safely.

Release the smallest complete useful increment.

## Git integration

Use the repository's short-lived trunk-oriented flow described in `.agent/ENGINEERING.md`.

Default shape:

```text
main
  -> one short-lived task branch
  -> implement / verify / review / fix
  -> one PR
  -> required gates
  -> squash merge
  -> cleanup
```

Branches/PRs are integration tools. Do not create iteration/retry/staging/personal branch machinery for routine work.

## Stop conditions

Stop normal implementation and surface the decision when continuing requires an unauthorized material choice, especially:

- conflicting/missing product semantics that change observable behavior;
- destructive/irreversible migration or data behavior;
- materially breaking public/persisted contract change;
- security/privacy/trust-boundary change;
- major architecture/service/consistency/infrastructure change.

Stop the task when approved scope is satisfied, justified verification and mandatory gates pass, and no material in-scope issue remains.

After that point, do not continue into adjacent features, aesthetic refactors, speculative cleanup, future-proofing, broad audits, extra tests/docs, metrics, or infrastructure without a concrete authorized need.

## Documentation model

- `AGENTS.md` — canonical execution adapter.
- `.agent/README.md` — project-context router and artifact discipline.
- `.agent/PROJECT.md` — product/system/source-structure truth.
- `.agent/ENGINEERING.md` — detailed engineering rules.
- `.agent/OPERATIONS.md` — operational/release constraints.
- `.agent/DECISIONS.md` — durable rationale.
- `.agent/STATE.md` — short current committed state.
- `docs/` — public product documentation.

Do not commit permanent task plans/spec snapshots/checkpoints/skills as project-model artifacts. Routine task evidence belongs in PR/CI history and the task conversation.
