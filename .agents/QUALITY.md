# Wago Quality

This file owns repository-specific verification commands, test policy, and quality/release gates.

## Canonical commands

Use the root Taskfile as the developer command surface:

```bash
task install
task lint
task gateway:test
task gateway:build
task dashboard:test
task dashboard:build
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

Verification is proportional to realistic regression risk.

For each change:

1. identify what can realistically break;
2. estimate impact and likelihood;
3. run the cheapest high-signal check first;
4. deepen verification only when the risk or mandatory repository gate justifies it.

Tests reduce delivery risk; coverage percentage, test count, and TDD ceremony are not goals.

Use TDD when a deterministic automated test is the cheapest high-signal way to define or protect behavior. It is optional, not the default workflow.

## High-value test areas

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

## Failure handling

Classify failures from evidence before calling them flaky or transient. Retry only when runner, timing, network, or external-dependency transience is plausible. Deterministic code/test failures require diagnosis or a fix.

## Repository gates

Core CI protects formatting/lint, gateway/dashboard tests, builds, and persistence/rollback smoke coverage where configured.

CodeQL remains a security gate for core JavaScript/TypeScript.

Docs CI protects public documentation changes.

Release publishing verifies supported production architectures (`linux/amd64` and `linux/arm64`) for runtime/build-relevant changes. Do not trigger container/release verification as ceremony for unrelated markdown, agent-context, test-only, or presentation-only changes unless the workflow itself or affected risk requires it.

## Completion evidence

Before claiming a change complete, report the checks actually run and their result. Do not claim local/CI validation that did not run.

Broaden from targeted checks to `task core:check`, `task check`, Docker smoke, or release verification only according to scope and risk.
