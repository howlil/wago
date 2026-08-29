# Wago Engineering Rules

`AGENTS.md` owns the canonical execution lifecycle and authority model. `PROJECT.md` owns current project structure and architecture constraints. This file defines implementation quality, testing/verification, and Git mechanics in more detail.

## Smallest correct change

Optimize for the smallest correct, clear, maintainable change that satisfies the authorized requirement.

Prefer, in order:

```text
reuse existing pattern
  -> extend existing owner
  -> add a small local abstraction when current pressure justifies it
  -> add a new owner/component when responsibility is genuinely distinct
  -> change architecture only when current boundaries cannot reasonably satisfy the requirement
```

When several designs are valid, prefer lower coupling, smaller change surface, fewer dependencies/concepts, lower migration cost, easier reversibility, and clearer ownership.

Do not expand scope because adjacent cleanup, polish, abstraction, instrumentation, or future flexibility seems useful.

## Code organization

Use the ownership model from `PROJECT.md`:

```text
behavior -> owner -> boundary -> module/feature -> file
```

A cohesive module groups behavior that changes for related reasons and can be understood with bounded context.

Split only when the split improves a real property:

- clearer ownership;
- easier navigation;
- cleaner dependency direction;
- independent changeability;
- narrower side-effect boundary;
- better locality of reasoning.

Do not split merely because of line count or because a framework pattern has a conventional file name.

Avoid generic dumping grounds and vague owners such as `manager`, `processor`, `helper`, `common`, or `utils` when a domain/capability name is available.

## Locality and state ownership

Behavior, invariants, meaningful mutable state, and mutation code should remain as close together as practical.

For meaningful mutable state, identify:

- owner;
- who may mutate it;
- lifecycle;
- invariant;
- persistence requirement, if any.

Avoid hidden shared mutable state, ambient singletons, duplicate writable sources of truth, and mutation spread across unrelated callbacks.

## Dependency discipline

- Depend on narrow public capability boundaries, not another module's private files.
- Keep framework/provider mechanisms at the edge of the owner that contains them.
- Do not create dependency cycles; re-evaluate ownership first.
- Pass dependencies explicitly at useful boundaries, but do not add a DI container for routine wiring.
- Add an interface/port only for a real external/volatile boundary, a current substitution point, or a repeated concept with the same reason to change.
- Testability may reinforce an abstraction decision; it is not sufficient justification by itself.
- Remove a dependency when the current change makes it unused.

## Implementation quality

Prefer code that can be read in one pass.

- Use established repository terminology for the same concept.
- Prefer specific domain/action names over vague implementation names.
- Keep branching close to the decision it represents.
- Prefer explicit state transitions over mutation scattered across callbacks.
- Validate untrusted input at HTTP, persistence/import, and provider boundaries.
- Keep expected application failures typed/stable where callers need to distinguish them.
- Keep HTTP status mapping at the HTTP boundary.
- Do not swallow unexpected failures; add useful sanitized context at the owning boundary.

## Testing and verification

Tests reduce meaningful delivery risk; coverage percentage, test count, and TDD ceremony are not goals.

For each change:

1. identify what can realistically break;
2. estimate impact and likelihood;
3. choose the cheapest high-signal verification;
4. deepen verification only when risk justifies it.

Use TDD when a deterministic automated test is the cheapest high-signal way to define or protect behavior. It is not the default workflow.

Prioritize automated tests for:

- domain/business invariants;
- persistence and data integrity;
- migrations;
- concurrency/lifecycle state transitions;
- security/privacy boundaries;
- public/provider contracts;
- valuable deterministic regressions.

Avoid duplicated confidence across layers. For each test ask:

> What realistic regression does this prevent?

If there is no strong answer, do not add it.

Project-specific guidance:

- use real SQLite behavior in persistence tests where practical;
- test Wago's Baileys adapters/classifiers/lifecycle rather than real WhatsApp connectivity in unit tests;
- keep mock-based tests isolated: restore behavior, response queues, timers, and mutable state that a test can change, not only call history;
- do not weaken/delete/skip a valid test merely to make CI green;
- prefer deterministic tests with clear failure reasons over broad brittle tests;
- run the smallest relevant check first, then widen according to risk and mandatory gates.

## Failure classification

When a test or CI check fails, classify from evidence before calling it flaky/transient.

Useful hypotheses include:

- product regression;
- test isolation/state leakage;
- timing/race behavior;
- environment/runner failure;
- external dependency instability.

Call a failure flaky only when there is evidence of nondeterminism under materially equivalent code and conditions.

Retry is diagnostic for a plausibly transient failure, not a root-cause substitute. Do not add repeated reruns, sleeps, automatic retries, or wider timeouts merely to hide a deterministic failure.

## Git and integration

Prefer short-lived, trunk-oriented task integration:

```text
main
  -> one short-lived task branch
  -> implement / verify / review / fix on the same branch
  -> one PR
  -> required gates
  -> squash merge
  -> cleanup
```

Rules:

- check whether an active branch/PR already represents the task before creating Git state;
- one coherent task normally uses one branch and one PR;
- use purpose-prefixed names such as `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`;
- CI failures, formatting fixes, and review feedback stay on the same task branch;
- when `main` materially advances beneath a dependent task, rebase or recreate the task commit directly on latest `main` before final verification; do not partially synchronize content and leave divergent history/unrelated diff;
- commits are useful engineering checkpoints, not command transcripts;
- keep PRs small enough to review/revert confidently and split by coherent behavior/invariant boundaries;
- squash merge is the default unless a concrete reason requires another method;
- if verified head changes, rerun checks materially affected by that change;
- remove temporary branch/worktree state after merge when tooling permits.

## Typical verification commands

Use only the checks relevant during the inner loop; mandatory repository gates still apply before merge.

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm --dir backend test
pnpm --dir backend run build
pnpm --dir frontend test
pnpm --dir frontend run build
pnpm run build:docs
docker build .
```

Use container persistence/rollback smoke verification when the affected change can realistically break durable deployment behavior.
