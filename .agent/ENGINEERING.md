# Wago Engineering Rules

This file owns durable implementation-quality, dependency, testing/verification, and Git integration rules. `AGENTS.md` owns task execution preferences; `PROJECT.md` owns product and architecture boundaries.

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

Split only when it materially improves ownership, navigation, dependency direction, independent changeability, side-effect boundaries, or locality of reasoning. Do not split merely because of line count or framework convention.

Avoid generic dumping grounds and vague owners such as `manager`, `processor`, `helper`, `common`, or generic global `services` when a domain/capability name is available.

## Locality, state, and dependencies

Behavior, invariants, meaningful mutable state, and mutation code should remain as close together as practical.

For meaningful mutable state, identify its owner, mutation boundary, lifecycle, invariant, and persistence requirement when applicable.

- Depend on narrow public capability boundaries, not another module's private files.
- Keep framework/provider mechanisms at the edge of the owner that contains them.
- Avoid dependency cycles; re-evaluate ownership first.
- Pass dependencies explicitly at useful boundaries, but do not add a DI container for routine wiring.
- Add an interface/port only for a real current external/volatile boundary, substitution point, or repeated concept with the same reason to change.
- Testability may reinforce an abstraction decision; it is not sufficient justification by itself.
- Remove dependencies and compatibility paths when the current authorized change makes them unused.

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

Prioritize automated tests for business invariants, persistence/data integrity, migrations, concurrency/lifecycle state transitions, security/privacy boundaries, public/provider contracts, and valuable deterministic regressions.

Project-specific guidance:

- use real SQLite behavior in persistence tests where practical;
- test Wago's Baileys adapters/classifiers/lifecycle rather than real WhatsApp connectivity in unit tests;
- keep mock-based tests isolated: restore behavior, response queues, timers, and mutable state a test can change, not only call history;
- do not weaken/delete/skip a valid test merely to make CI green;
- prefer deterministic tests with clear failure reasons over broad brittle tests;
- run the smallest relevant check first, then widen according to risk and applicable repository gates.

When a test or CI check fails, classify from evidence before calling it flaky/transient. Retry is diagnostic only when environment, runner, timing, or external-dependency transience is plausible; deterministic code/test failures require diagnosis or a fix.

## Git integration

Prefer short-lived, trunk-oriented integration for substantive repository changes:

```text
main
  -> one short-lived task branch
  -> implement / verify / review / fix on the same branch
  -> one PR when integration/review requires it
  -> applicable gates
  -> squash merge
  -> cleanup
```

Rules:

- check whether an active branch/PR already represents the task before creating Git state;
- one coherent task normally uses one branch and one PR;
- do not create a branch/PR solely for a plan, iteration announcement, status update, checkpoint, or evidence transcript;
- CI failures, formatting fixes, and review feedback stay on the same task branch;
- keep PRs small enough to review/revert confidently and split by coherent behavior/invariant boundaries;
- squash merge is the default unless a concrete reason requires another method;
- if verified head changes materially, rerun checks affected by that change;
- remove temporary branch/worktree state after merge when tooling permits.

Use only verification commands relevant to the affected risk and scope. Container/release checks are not ceremony; run them when the change can realistically affect those boundaries or repository gates require them.