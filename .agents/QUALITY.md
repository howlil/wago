# Wago Quality

This file owns repository-specific verification commands, test policy, and quality/release gates.

## Canonical commands

Use the root Taskfile as the developer command surface:

```bash
task install
task lint
task gateway:test
task gateway:build
task dashboard:design:test
task dashboard:test
task dashboard:build
task docs:design:test
task docs:test
task docs:build
task core:test
task core:build
task core:check
task test
task build
task check
task docs:check
task docker:build
```

`task dev` runs gateway and dashboard development servers. `task docker:up` / `task docker:down` operate the Compose stack.

## Verification policy

Verification is proportional to realistic regression risk and should produce useful feedback as early as possible.

For each change:

1. identify what can realistically break;
2. run the cheapest high-signal targeted check first;
3. run the complete test/build gate for the affected application before integration;
4. run deployment, persistence, rollback, or security gates only when the changed boundary makes them relevant or the repository workflow explicitly requires them.

Do not use heavyweight gates as generic ceremony. Faster feedback is preferred when it preserves the same relevant failure detection.

Tests reduce delivery risk; coverage percentage, test count, and TDD ceremony are not goals. Use TDD when a deterministic automated test is the cheapest high-signal way to define or protect behavior.

## Design and presentation changes

Dashboard and docs design work has explicit fast regression loops because visual-language regressions are mostly structural and deterministic.

For dashboard presentation, layout, navigation, shell, or design-system changes:

1. run `task dashboard:design:test` while iterating;
2. run `task dashboard:test` and `task dashboard:build` before completion;
3. do not require Docker persistence/rollback smoke solely because dashboard source changed.

The dashboard design guard should protect durable rules from `apps/dashboard/DESIGN.md`, including information architecture, semantic containment, anti-card-wall/anti-pill conventions, readable text sizing, semantic tokens, and the protected operational surfaces that should not regress.

For docs presentation/content changes:

1. run `task docs:design:test` while iterating when the shared landing/public-surface grammar is affected;
2. run `task docs:test` and `task docs:build` before completion;
3. standalone static deployment smoke is required when the standalone build boundary changes, such as docs package/workspace/build configuration, not for routine content or styling edits.

Do not substitute screenshot churn or broad end-to-end ceremony for deterministic structural guards when the design contract can be protected directly in source-level tests.

## High-value behavioral test areas

Prioritize automated coverage for:

- product/business invariants;
- SQLite persistence and migrations;
- multi-write transaction integrity;
- concurrency/idempotency behavior;
- lifecycle and reconnect state transitions;
- security/privacy boundaries;
- public HTTP contracts;
- webhook identity/signature/retry semantics;
- Wago-owned Baileys adapters/classifiers/lifecycle behavior;
- deterministic regressions with meaningful user/operational impact.

Do not use real WhatsApp connectivity as a unit-test dependency.

Mock-based tests must restore behavior, queued responses, timers, and mutable state they modify—not only call history.

Do not weaken, delete, or skip a valid test merely to make CI green.

## CI routing

CI is intentionally split by risk boundary:

- **CI**: formatting/lint plus full gateway/dashboard tests and builds. This is the normal core correctness gate.
- **Docs CI**: docs tests plus Astro build for docs changes.
- **Docker Smoke**: production image build plus persistence/rollback smoke only for runtime/deployment/persistence-relevant paths.
- **Docs Standalone Smoke**: isolated `apps/docs` install/build only for the standalone deployment boundary.
- **CodeQL**: JavaScript/TypeScript security analysis for core source changes and the scheduled repository scan. JavaScript/TypeScript analysis does not require a duplicate dependency install or core build first.

All pnpm setup actions should avoid implicit dependency installation when the workflow already performs an explicit `pnpm install --frozen-lockfile`.

Use workflow `paths`/`paths-ignore` and concurrency cancellation to prevent obsolete or irrelevant heavy jobs from consuming feedback time.

## Failure handling

Classify failures from evidence before calling them flaky or transient. Retry only when runner, timing, network, or external-dependency transience is plausible. Deterministic code/test failures require diagnosis or a fix.

## Release gates

Release publishing verifies supported production architectures (`linux/amd64` and `linux/arm64`) for runtime/build-relevant changes. Do not trigger container/release verification as ceremony for unrelated markdown, agent-context, test-only, docs-content, or presentation-only changes unless the workflow itself or affected risk requires it.

## Completion evidence

Before claiming a change complete, report the checks actually run and their result. Do not claim local/CI validation that did not run.

Broaden from targeted checks to `task core:check`, `task check`, Docker smoke, standalone docs smoke, or release verification only according to scope and risk.
