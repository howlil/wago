# Wago Frontend Design & Engineering Guide

This document is the source of truth for frontend structure, visual consistency, and UI engineering decisions in `frontend/`.

Wago is a small self-hosted operator console. The frontend should stay easy to understand for one maintainer, predictable for operators, and deliberately smaller than a generic SaaS dashboard.

## 1. Product principles

Wago UI should feel:

- compact, calm, and technical;
- utility-first rather than decorative;
- clear enough for an operator who does not know the backend implementation;
- consistent across connection, credentials, recipients, messaging, health, and activity flows;
- responsive without maintaining separate desktop and mobile feature implementations.

Avoid:

- decorative sections that do not help the operator complete a task;
- generic "AI dashboard" patterns such as excessive gradients, floating glass cards, large empty hero areas, and unnecessary icon boxes;
- hiding important operational states behind ambiguous color alone;
- adding navigation items for sections that are not real pages;
- inventing frontend-only status that looks authoritative when the backend cannot actually know it.

## 2. Architecture

The frontend uses feature-first organization with a small shared layer.

```text
src/
├── App.tsx
├── api.ts
├── features/
│   └── <feature>/
│       ├── Component.tsx
│       ├── useFeature.ts
│       ├── types.ts
│       └── utils.ts
└── shared/
    ├── components/
    ├── hooks/
    ├── layout/
    └── ui/
```

Only create folders/files that have a real responsibility. A two-file feature does not need artificial `components/`, `hooks/`, and `utils/` subdirectories.

### Dependency direction

Allowed:

```text
App → dashboard composition → features → shared
feature → its own local modules
shared → shared
```

Rules:

1. `shared/` MUST NOT import from `features/`.
2. Feature components may import shared primitives and API types.
3. Cross-feature imports should be exceptional. Prefer composition at the dashboard/page boundary.
4. Domain-specific components such as gateway status summaries belong to the owning feature, not `shared/`.
5. `App.tsx` should remain a thin application entry point.
6. `DashboardPage` composes features; it should not own networking or complex workflow state.

## 3. State and side effects

Use React local state by default. Do not add Redux, Zustand, TanStack Query, or another state layer until the existing model creates a demonstrated problem that cannot be solved clearly with local state and focused hooks.

### Custom hooks

Extract a custom hook when stateful logic has one clear purpose and is reused or makes a component/controller materially easier to understand.

Good examples:

- gateway/WhatsApp snapshot polling;
- message composer workflow;
- activity-log polling and filters;
- clipboard interaction.

A hook name should state the capability it owns: `useDashboardSnapshot`, `useMessageComposer`, `useActivityLog`.

Do not create a hook merely to move lines out of a file. The extracted hook must have a coherent responsibility.

### Effects

Use `useEffect` for synchronization with external systems such as:

- timers;
- document visibility;
- event listeners;
- network polling lifecycle.

User actions such as Pair, Send, Allow recipient, Copy, or Change account belong in event handlers, not effects.

Avoid duplicated state when a value can be derived safely from existing state. Examples include `canSend`, `approvalRequired`, and display labels.

## 4. Controller boundaries

A controller may coordinate multiple feature workflows, but it should not implement all of them itself.

The dashboard controller should primarily:

- coordinate authentication/bootstrap with pairing;
- expose data/actions required by the page;
- produce operator-facing derived copy where multiple states must be combined.

Move feature-owned behavior out when it becomes independently understandable. In particular:

- polling/snapshot state belongs in `useDashboardSnapshot`;
- message form and send behavior belongs in `useMessageComposer`;
- clipboard behavior belongs in the shared clipboard hook.

As a review heuristic, split a module when it is simultaneously responsible for several of these: fetching, polling, mutation workflows, form state, formatting, filtering, and rendering.

## 5. API boundary

`src/api.ts` is currently the compatibility facade for the small HTTP API. Keep native `fetch` and typed response contracts.

Rules:

1. Components should not call `fetch` directly.
2. API errors should be normalized at the request boundary where practical.
3. Do not assume HTTP `200` means a valid domain payload; validate dangerous boundaries before writing them into UI state.
4. Never expose API keys, QR payloads, WhatsApp auth credentials, or message bodies in logs.
5. Keep API response unions explicit when success and failure shapes differ.

If `api.ts` grows enough that unrelated domains frequently change the same file, split it by capability while retaining a small shared HTTP client, for example:

```text
api/
├── client.ts
├── gateway.ts
├── whatsapp.ts
├── recipients.ts
├── messages.ts
└── activity.ts
```

Do not split it pre-emptively into one file per endpoint.

## 6. Components

Prefer small components with explicit props over components that reach into unrelated global state.

A feature component should usually own presentation and local interaction only. Networking/polling belongs in a hook or controller when it makes the component easier to test and read.

Naming:

- components: nouns (`GatewayCredentialsCard`);
- hooks: `use` + capability (`useActivityLog`);
- event props: `on` + action (`onPair`, `onAllowed`);
- internal event handlers: `handle` + action (`handleSubmit`);
- booleans: `is`, `has`, `can`, or domain phrase (`isSending`, `hasQr`, `canSend`).

Avoid generic names such as `data`, `handler`, `item`, and `manager` when a domain name is available.

## 7. Visual system

The Wago visual language is calm, compact, and operational.

### Source of truth

Global semantic color tokens live in `src/styles.css` under Tailwind `@theme`.

Reusable component classes live in `src/shared/ui/classes.ts`.

New feature code should prefer those semantic tokens/classes instead of introducing new arbitrary hex values. A one-off illustration or explicitly documented visual accent is the exception, not the default.

### Color semantics

- `wago-brand`: primary actions and identity;
- `wago-ink`: primary text;
- `wago-muted`: secondary text;
- `wago-line`: borders/dividers;
- success green: healthy/accepted/connected;
- warning amber: attention/restriction/pairing;
- danger red: destructive action or actual error.

Never use status color as the only status signal. Pair it with text or an icon.

### Spacing

Use a predictable spacing rhythm based primarily on:

```text
4px  / 1
8px  / 2
12px / 3
16px / 4
24px / 6
32px / 8
```

For the control dashboard:

- normal card gap: `gap-4`;
- compact internal gap: `gap-2` to `gap-3`;
- normal card padding: approximately `p-4`;
- controls: default `h-9`;
- avoid large vertical gaps unless the information hierarchy requires them.

### Radius and elevation

Use borders before shadows. Most operational cards should be visually quiet.

- controls: `rounded-md`;
- standard cards: `rounded-lg` or the established dashboard card primitive;
- large branded/illustrative surfaces may use a larger radius;
- avoid multiple strong shadows on one viewport.

### Typography

Keep hierarchy compact:

- page title: concise and clearly dominant;
- card title: approximately 14–16px semibold;
- body: 12–14px depending on density;
- metadata: 10–12px;
- monospace only for identifiers, API keys, JIDs, endpoints, and technical metadata.

Do not use uppercase tracking text for ordinary body copy.

## 8. Layout and responsiveness

Build mobile-first and enhance at breakpoints.

Rules:

1. Features must remain usable at 320px viewport width.
2. Desktop sidebar collapses; mobile navigation is a drawer, not a permanently compressed sidebar.
3. Do not duplicate business components for mobile and desktop.
4. Avoid fixed card heights. Let content determine height unless a scroll region is intentional (for example Activity Log).
5. Avoid row-based grids that force unrelated cards to share height and create large empty areas.
6. Use independent content columns when feature heights are naturally different.
7. Long identifiers must truncate or wrap without expanding the viewport.

## 9. Accessibility

Minimum requirements:

- prefer native `button`, `input`, `select`, `details`, and semantic headings;
- icon-only controls require an accessible name;
- keyboard focus must remain visible;
- dialogs need an accessible dialog name and explicit close/cancel path;
- errors use `role="alert"`; successful transient feedback may use `role="status"`;
- forms need real labels or equivalent accessible names;
- do not rely on hover to expose required functionality.

## 10. Operator-facing language

Write for an operator, not for the implementation.

Prefer:

- "WhatsApp connected"
- "Recipient is not allowed yet"
- "Message accepted by WhatsApp"

Avoid exposing internal terms unless they help debugging:

- raw Baileys event names;
- stack traces;
- HTTP implementation details as the primary message;
- opaque enum strings without explanation.

Technical details may be progressively disclosed underneath an operator-readable summary.

## 11. Activity and diagnostic UI

Activity Log is operator history, not a raw terminal.

It should:

- explain what happened;
- show timestamp, severity, category, and readable description;
- keep technical metadata optional;
- mask phone/JID metadata where appropriate;
- never display secrets, QR payloads, auth credentials, or message bodies.

## 12. Testing

Test behavior and contracts, not Tailwind class strings or internal hook implementation.

Priorities:

1. critical operator workflows: bootstrap/pair, change account, send, allow-and-send;
2. state boundary failures: backend unavailable, malformed payload, unauthorized state;
3. lifecycle behavior: polling pauses/reduces when hidden and cleans up on unmount;
4. component accessibility for dialogs and important controls.

As feature hooks gain non-trivial branching, test them near the owning feature rather than growing one monolithic `App.test.tsx` indefinitely.

## 13. Pull-request checklist

Before merging frontend work, verify:

- [ ] Feature ownership is clear.
- [ ] `shared/` does not import from `features/`.
- [ ] No new state library was introduced without a demonstrated need.
- [ ] Effects synchronize external systems rather than encode user actions.
- [ ] Derived values are not stored unnecessarily.
- [ ] New reusable visual values use semantic tokens/classes where practical.
- [ ] The layout works at mobile, tablet, and desktop widths.
- [ ] Icon-only controls have accessible names.
- [ ] Loading, empty, error, and disabled states are understandable.
- [ ] Operator-facing errors do not dump raw HTML or stack traces.
- [ ] Sensitive values are not logged or rendered accidentally.
- [ ] `pnpm check`, `pnpm test`, and `pnpm build` pass.

## 14. Deliberate non-goals

Do not turn Wago into a frontend framework project. Avoid abstractions that only make sense for hypothetical multi-page, multi-tenant, or enterprise-scale requirements.

The preferred result is a small codebase with obvious ownership and boring, predictable patterns.
