# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**No active product milestone.**

## Current baseline

- `main` includes **Fast Risk-Based CI and Design Verification** via PR #122;
- squash merge commit: `9863979cea48c8f8ac0d78ffe17c46bdbc963ed1`;
- final implementation head verified before merge: `16f202ce681ea54d7726f7486f9acb1dd55833d1`;
- core and docs CI use one explicit frozen pnpm install instead of setup-time install plus a second install;
- normal core CI remains formatting/lint + full gateway/dashboard tests and builds;
- Docker image/persistence/rollback smoke is isolated to a path-scoped runtime/deployment/persistence workflow;
- standalone docs install/build smoke is isolated to package/workspace/build-configuration changes instead of routine content/design edits;
- JavaScript/TypeScript CodeQL runs source analysis without redundant dependency installation or core build;
- `task dashboard:design:test` and `task docs:design:test` provide fast deterministic design-contract loops before full affected-app verification;
- `.agents/QUALITY.md` defines the fast/accurate risk-based verification policy and design-specific testing flow;
- `.agents/DECISIONS.md` records risk-routed CI as durable decision D13;
- final-head workflows were all green: CI, Docs CI, Docker Smoke, Docs Standalone Smoke, and CodeQL;
- product behavior, public API, persistence schema, authentication semantics, and Wago design language were unchanged.

## Blockers

None.

## Next action

Await the next explicit user-authorized milestone or task. Do not infer or start product work from historical plans alone.

## Completion rule

When a milestone completes and is integrated into `main`, return this file to this idle/no-active-milestone state unless the user has already authorized the next milestone.
