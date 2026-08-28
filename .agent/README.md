# Wago Agent Workspace

`.agent/` is the repository-local workspace for internal engineering artifacts that are useful to contributors or coding agents but are **not public product documentation**.

## Source of Truth

Root `AGENTS.md` is the canonical repository-wide operating policy.

The canonical lifecycle is:

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

This is a reasoning and execution model, not a mandatory artifact pipeline or approval-gate SOP. Small tasks may collapse stages. Verification may happen throughout the lifecycle.

If an older plan, spec, checkpoint, or contributor note conflicts with current `AGENTS.md`, follow `AGENTS.md`. Historical artifacts remain task history and should not be rewritten solely to match newer policy.

## Boundary

Use `.agent/` for internal work products when they materially improve execution, continuity, review, or auditability, for example:

- design specs for material design decisions
- implementation plans for genuinely multi-step work
- focused audit notes when an audit is explicitly useful
- execution/checkpoint evidence for complex or interrupted work

Use `docs/` only for public Wago documentation.

Do not place agent plans/specs under `docs/`, because everything under `docs/` belongs to the public documentation product boundary.

## Operating Principles

Use `.agent/` to support delivery, not to create ceremony.

- Start from the explicit user intent and approved scope.
- Do not invent features, product semantics, or adjacent requirements.
- Inspect only the minimum repository context necessary to implement safely.
- Prefer the smallest coherent vertical slice.
- Reuse existing patterns before introducing abstractions or architecture.
- Keep ordinary local implementation autonomous and reversible.
- Surface material product, architecture, security, contract, or destructive-data decisions instead of silently choosing them.
- Use risk-based verification: choose the cheapest high-signal check for the realistic failure mode.
- TDD is optional and should be used when it is the cheapest deterministic way to define or protect behavior.
- Do not require TDD for styling/layout, static markup, copy/docs, trivial wiring, or exploratory implementation.
- Do not require repo-wide audits, delivery metrics, instrumentation, specs, plans, or checkpoints for ordinary bounded work.
- Instrumentation is conditional: add it when needed to evaluate an outcome, diagnose a meaningful new failure mode, or operate changed behavior safely.
- Stop once approved scope is satisfied, justified verification and mandatory gates pass, and no material in-scope blocker remains.

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

Add another subdirectory only when a real recurring artifact type appears. Do not mirror source-code architecture inside `.agent/`.

## Artifact Rules

### Specs

Use `.agent/specs/` when a task has material design risk or trade-offs worth settling explicitly before or during implementation, such as:

- service or ownership boundary changes
- public/persisted contract changes
- security/trust-boundary changes
- destructive or irreversible data behavior
- consistency-model changes
- material infrastructure changes

Keep specs decision-oriented: problem, approved requirement, constraints, invariants, chosen design, important alternatives when relevant, risks, and acceptance criteria.

Do not create a spec for a trivial or locally obvious implementation decision.

### Plans

Use `.agent/plans/` when sequencing, dependencies, migration safety, cross-module coordination, or verification complexity would otherwise be easy to lose.

Plans should be executable and bounded. They should not repeat repository documentation, create speculative future scope, or prescribe broad audits unrelated to the task.

### Checkpoints

Use `.agent/checkpoints/` only when concise execution evidence materially helps continuity or review:

- what changed
- what was verified
- current result
- remaining material blocker or risk, if any

Do not create checkpoint spam for every command, test run, edit, or CI retry.

## Source-of-Truth Hierarchy

For future execution:

1. Explicit current user requirement and approved product decision.
2. Root `AGENTS.md` for repository-wide engineering policy.
3. Current runtime/backend/frontend code and tests for actual implemented behavior.
4. Root `plan.md` for the engineering roadmap and milestone state.
5. Relevant approved `.agent/specs/` for task-specific design decisions.
6. Relevant `.agent/plans/` for task-specific sequencing.
7. `.agent/checkpoints/` for execution evidence.
8. `docs/` for released/current public behavior.

Historical task artifacts can contain superseded workflow language. Treat them as evidence of what happened, not as policy for new work.

## Public Documentation Rule

Never publish agent workflow language, internal checkpoints, speculative implementation details, unfinished requirements, or internal decision records in the Astro docs unless they are intentionally rewritten as user-facing documentation.
