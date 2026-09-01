# Wago Code Patterns

This file owns repository-specific implementation conventions. It does not define product scope or generic SWE workflow.

## Ownership first

Organize code from meaning outward:

```text
behavior -> owner -> boundary -> module/feature -> file
```

Prefer, in order:

```text
reuse the existing pattern
  -> extend the current owner
  -> add a small local abstraction when current pressure justifies it
  -> add a new owner when responsibility is genuinely distinct
  -> change architecture only when current boundaries cannot reasonably satisfy the authorized behavior
```

Do not split code merely because of line count or framework convention. Split when it materially improves ownership, dependency direction, side-effect boundaries, independent changeability, or locality of reasoning.

Avoid generic dumping grounds and vague owners such as `manager`, `processor`, `helper`, `common`, or global `services` when a capability/domain name is available.

## State and dependencies

Keep behavior, invariants, meaningful mutable state, and mutation code close to the owner that protects them.

For meaningful mutable state, identify its owner, mutation boundary, lifecycle, invariant, and persistence requirement.

- depend on narrow public capability boundaries, not another module's private files;
- keep framework/provider mechanisms at the edge of the owner that contains them;
- avoid dependency cycles; re-evaluate ownership before adding indirection;
- pass dependencies explicitly at useful boundaries, but do not add a DI container for routine wiring;
- add an interface/port only for a real volatile/external boundary, substitution point, or repeated concept with the same reason to change;
- testability may reinforce an abstraction decision but is not enough justification by itself;
- remove obsolete dependencies and compatibility paths only when the authorized change actually makes them unused.

## Gateway conventions

- capability behavior belongs under `apps/gateway/src/modules/<capability>/` by default;
- composition broader than one capability belongs under `app/`;
- reusable transport plumbing belongs under `http/`, not feature policy;
- application-level persistence/runtime mechanisms belong under `infrastructure/`;
- raw Baileys sockets, protocol events, reconnect behavior, credential writes, and provider adaptation remain inside the WhatsApp owner;
- routes parse/authenticate/serialize and map transport status; they do not execute SQL or manipulate raw Baileys sockets;
- business policy returns domain/application outcomes rather than HTTP status codes;
- persistence tests should use real SQLite behavior where practical.

## Dashboard conventions

- keep behavior and mutable state feature-local by default;
- `pages/` compose route/workspace surfaces but do not own feature networking or business state;
- `shared/` is only for proven cross-feature primitives/infrastructure with one clear reason to change;
- keep `App.tsx` and shell code as composition surfaces;
- prefer local React state and focused hooks until current complexity proves a broader state mechanism is needed;
- follow `apps/dashboard/DESIGN.md` for interaction/layout/visual behavior;
- use Wago product vocabulary in UI and expose provider internals only for justified diagnosis.

## Implementation quality

Prefer code that can be read in one pass.

- use established repository terminology for the same concept;
- prefer specific domain/action names over vague implementation names;
- keep branching close to the decision it represents;
- prefer explicit state transitions over mutation scattered across callbacks;
- validate untrusted input at HTTP, persistence/import, and provider boundaries;
- keep expected application failures typed/stable where callers need to distinguish them;
- keep HTTP status mapping at the HTTP boundary;
- do not swallow unexpected failures; add sanitized context at the owning boundary.

## Scope discipline

Implement the smallest complete change that satisfies the authorized behavior. Local cleanup required by the change is appropriate; adjacent aesthetic refactors, speculative abstractions, extra instrumentation, and unrelated cleanup are not part of the change unless explicitly authorized.
