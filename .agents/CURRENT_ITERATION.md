# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active engineering milestone:** Fast Risk-Based CI and Design Verification.

Goal: reduce CI feedback time without weakening relevant regression detection, especially for dashboard/docs design work, and make the user's preferred fast/accurate verification strategy canonical under `.agents/`.

## Acceptance boundary

- core CI performs one explicit frozen install, then formatting/lint, gateway/dashboard tests, and builds;
- dashboard design changes retain deterministic anti-slop/information-architecture guards plus full dashboard test/build coverage;
- docs design/content changes retain public-surface tests plus Astro build;
- Docker image/persistence/rollback smoke runs only for runtime/deployment/persistence-relevant paths;
- standalone docs install/build smoke runs only for the standalone deployment/package/build boundary;
- CodeQL retains JavaScript/TypeScript analysis without redundant dependency install/core build;
- obsolete workflow runs remain cancellable through concurrency groups;
- no product behavior, API, persistence schema, auth semantics, or design language changes are introduced.

## Active work

Implementation branch: `chore/fast-risk-based-ci`.

Current changes:

- core and docs pnpm setup no longer performs an implicit dependency install before the explicit frozen install;
- Docker persistence/rollback smoke moved to a path-scoped workflow;
- standalone docs static smoke moved to a path-scoped workflow;
- CodeQL no longer duplicates core build setup for JavaScript/TypeScript analysis;
- `task dashboard:design:test` and `task docs:design:test` provide fast design-contract loops;
- `.agents/QUALITY.md` and `.agents/DECISIONS.md` codify risk-routed CI and design verification preferences.

## Blockers

None known.

## Next action

Verify workflow syntax, Taskfile commands, affected tests/builds, and PR workflow routing. Merge when final-head gates are green, then return this file to idle with final evidence.

## Completion rule

When the milestone completes and is integrated into `main`, return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
