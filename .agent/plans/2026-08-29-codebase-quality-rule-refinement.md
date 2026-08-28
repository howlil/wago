# Codebase Quality Rule Refinement

Date: 2026-08-29

## Goal

Refine Wago's canonical `Codebase Quality Rule` so coding agents exercise stronger engineering judgment without adding architecture ceremony or changing product/runtime behavior.

## Scope

Policy-only changes in `AGENTS.md` plus this concise execution plan.

Out of scope:

- runtime/backend/frontend behavior
- repository-wide refactoring
- introducing new architecture patterns
- rewriting historical plans/specs/checkpoints

## Acceptance Criteria

1. Existing repository conventions remain the default, but are not treated as unquestionable precedent when they conflict with correctness, ownership, current architecture, or maintainability.
2. Production abstractions are not justified solely by easier mocking/testing; they must also improve a real ownership, dependency, substitution, or repeated-behavior boundary.
3. The rule explicitly optimizes for locality of reasoning so behavior, invariants, state, and mutation logic stay close enough to understand with bounded context.
4. Meaningful mutable state has an identifiable owner, mutation boundary, lifecycle, and invariant.
5. Dependency direction favors the owner of the invariant and avoids coupling stable policy to incidental transport, framework, or provider details.

## Verification

- compare branch against `main`
- confirm only policy/plan files changed
- inspect final wording for overlap or contradiction with Architecture Boundaries and Testing principles
- run mandatory CI/CodeQL gates triggered by the PR

## Stop Condition

Stop after the five refinements are represented clearly and minimally. Do not expand into a generic style guide, SOLID/design-pattern catalog, or unrelated codebase cleanup.
