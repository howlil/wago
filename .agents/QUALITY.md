# Wago Quality

This file owns repository-specific verification commands and delivery policy.

## Canonical commands

Use the root Taskfile as the developer and CI command surface:

```bash
task install
task dev
task lint
task lint:fix
task test
task build
task check

task gateway:dev
task gateway:test
task gateway:build

task dashboard:dev
task dashboard:test
task dashboard:build

task docs:dev
task docs:build

task image
task up
task down
task logs
```

Do not add a Taskfile alias unless it represents a distinct operation. Prefer the existing namespace over wrappers such as `core:*`, `docker:*`, or one-off design-test aliases.

## Verification policy

Verification is proportional to realistic regression risk and should produce useful feedback early.

For each change:

1. identify what can realistically break;
2. run the cheapest high-signal targeted check first;
3. run the affected application test/build before integration;
4. use `task check` for the core pre-merge gate when gateway or dashboard behavior changes;
5. run deployment-specific checks only when that boundary changes.

Tests reduce delivery risk; coverage percentage, test count, and ceremony are not goals. Keep tests that protect product invariants, persistence, transactions, concurrency/idempotency, lifecycle/reconnect behavior, security/privacy boundaries, public HTTP contracts, webhook semantics, and provider adaptation.

Do not use real WhatsApp connectivity as a unit-test dependency. Mock-based tests must restore behavior, queued responses, timers, and mutable state they modify.

## CI routing

CI stays intentionally small:

- **CI**: install dependencies, then `task check` for gateway/dashboard lint, tests, and builds.
- **Docs CI**: install docs dependencies, then `task docs:build`.
- **CodeQL**: scheduled/manual security analysis; it is not a normal PR gate.
- **Release Container**: main-branch runtime changes automatically build and push `ghcr.io/howlil/wago` without repeating the full test suite.

Use workflow path filters and concurrency cancellation so irrelevant work does not consume delivery time.

## Release policy

The normal release path is automatic after a relevant change reaches `main`:

```text
PR gate -> merge main -> build amd64 image -> push latest/main/sha-* to GHCR
```

The release workflow does not repeat the full test suite. Manual workflow dispatch remains only as a fallback.

## Completion evidence

Before claiming a change complete, report the checks that actually ran and their result. Do not claim validation that did not run.
