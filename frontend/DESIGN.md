# Wago Frontend Design & Engineering Guide

This document is the source of truth for frontend structure, responsive layout, visual density, and UI engineering decisions in `frontend/`.

Wago is a small self-hosted operator console, not a generic SaaS dashboard. The interface should feel closer to focused admin/infra tooling: compact, calm, technical, predictable, and efficient at every viewport size.

When an existing component conflicts with this document, this document wins unless a later accepted design explicitly changes the rule.

## 1. Product UI posture

Wago UI MUST feel:

- compact rather than spacious;
- operational rather than promotional;
- border-led rather than shadow-led;
- information-dense without becoming visually noisy;
- responsive from 320px mobile screens through large desktop monitors;
- consistent across Control, Audit Log, and Settings;
- clear to an operator who does not know the backend implementation.

The application is not a marketing surface. Do not add decorative copy, trust statements, feature slogans, or explanatory cards that do not help the operator complete a task.

### Explicit removals

The application shell MUST NOT show:

- a `Gateway` badge next to the page title;
- a `Self-hosted` card or the copy `Your session and gateway stay under your control.`;
- decorative product claims in the sidebar or mobile drawer.

The page title and current application context are already sufficient.

## 2. Core visual principles

Use hierarchy in this order:

1. layout and alignment;
2. spacing;
3. typography;
4. borders and surface contrast;
5. semantic color;
6. elevation only when the UI truly floats above another layer.

Do not use shadows, gradients, pills, or icon boxes as default hierarchy tools.

### Avoid generic AI-dashboard patterns

Do not introduce:

- decorative gradients;
- glassmorphism;
- card shadows;
- button shadows;
- hover lift or `translate-y` effects;
- oversized rounded cards;
- decorative radial backgrounds;
- nested cards without a real hierarchy reason;
- excessive status pills;
- icon containers around every metric;
- dashed informational boxes;
- large empty hero-like regions;
- duplicated explanatory marketing copy;
- badges that repeat context already stated by the page title;
- arbitrary per-component spacing, radius, or width values.

## 3. Frontend architecture

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

Only create folders/files that have a real responsibility. A small feature does not need artificial `components/`, `hooks/`, and `utils/` subdirectories.

### Dependency direction

Allowed:

```text
App → page/dashboard composition → features → shared
feature → its own local modules
shared → shared
```

Rules:

1. `shared/` MUST NOT import from `features/`.
2. Feature components may import shared primitives and API types.
3. Cross-feature imports should be exceptional. Prefer composition at the page boundary.
4. Domain-specific components belong to the owning feature, not `shared/`.
5. `App.tsx` should remain a thin application entry point.
6. Page components compose features; they should not own networking or complex workflow state.

## 4. State, effects, and controller boundaries

Use React local state by default. Do not add Redux, Zustand, TanStack Query, or another state layer until the current model creates a demonstrated problem.

Extract a custom hook when stateful logic has one clear purpose and either is reused or materially simplifies the owning component.

Examples:

- `useDashboardSnapshot`;
- `useMessageComposer`;
- `useActivityLog`;
- `useClipboard`.

Use `useEffect` for synchronization with external systems such as timers, visibility, event listeners, and network lifecycle. User actions belong in event handlers.

Avoid duplicated state when a value can be derived safely.

A controller may coordinate multiple workflows, but feature-owned behavior should stay in the feature that owns it.

## 5. API boundary

Components MUST NOT call `fetch` directly. Use the frontend API boundary.

Rules:

1. Normalize HTTP/API errors at the request boundary where practical.
2. Do not assume HTTP `200` implies a valid domain payload.
3. Never log or accidentally render API keys, QR payloads, WhatsApp auth credentials, webhook secrets, or message bodies.
4. Keep response unions explicit when success/failure shapes differ.
5. Browser authentication uses the browser session cookie; do not add API-key persistence to frontend storage.

If `api.ts` becomes materially difficult to maintain, split it by capability around one shared HTTP client. Do not split pre-emptively into one file per endpoint.

## 6. Density system

Wago uses one compact density system across the application.

### Spacing scale

Use this spacing rhythm:

```text
4px   = micro spacing
8px   = tight internal spacing
12px  = compact related-content spacing
16px  = standard component/card spacing
20px  = tablet workspace gutter
24px  = desktop workspace gutter / major section separation
32px  = exceptional page-level separation only
```

Do not introduce 18px, 22px, 28px, 30px, or other one-off spacing values without an explicit design reason.

### Standard dimensions

```text
collapsed desktop sidebar   56px
expanded desktop sidebar    196px
application header           56px
mobile drawer               248px
icon-only nav target         40×40px
small header action          32px
standard control/button      36px
standard card padding        16px
standard card gap            16px
compact internal gap         8–12px
```

The collapsed sidebar MUST remain visually narrow. A 40×40 navigation target inside a 56px rail gives 8px horizontal breathing room and should not be widened merely to center an icon.

## 7. Radius and elevation

Use a small, consistent radius hierarchy.

```text
inputs/buttons/nav items     6px  (`rounded-md`)
standard cards/surfaces      8px  (`rounded-lg`)
dialogs/drawers             10–12px maximum when useful
status pills                full radius only when it is genuinely a pill/tag
```

### Elevation

Default elevation is none.

No shadow on:

- standard cards;
- buttons;
- sidebar;
- sticky application header;
- status overview;
- standard inputs.

Shadow is allowed for:

- modal/dialog surfaces;
- mobile navigation drawer;
- true floating overlays such as menus/popovers.

Use borders and surface color before elevation.

## 8. Color semantics

Global semantic color tokens live in `src/styles.css` under Tailwind `@theme`.

Reusable visual classes live in `src/shared/ui/classes.ts`.

Use semantic tokens rather than introducing arbitrary hex values in feature components.

Meaning:

- `wago-brand`: primary action and identity;
- `wago-ink`: primary text;
- `wago-muted`: secondary text;
- `wago-line`: neutral separator/border;
- success green: healthy/accepted/connected;
- warning amber: attention/restriction/pairing;
- danger red: destructive action or actual error.

Status color is never the only status signal. Pair it with text and, where useful, a semantic icon.

## 9. Typography

Keep hierarchy compact.

Recommended scale:

```text
page title             16–18px / semibold
card/section title     14px / semibold
primary body           13–14px
secondary body         12px
field label            11–12px / medium
metadata               10–11px
technical identifier   11–13px monospace
```

Rules:

- avoid oversized headings;
- do not use uppercase tracking for ordinary body copy;
- use uppercase metadata only when it adds real scanability;
- monospace is for identifiers, API keys, JIDs, event codes, endpoints, and technical metadata;
- line length for explanatory text should remain readable even when the workspace is fluid.

## 10. Application shell

The shell is fluid on desktop. Do not center the entire workspace inside a fixed application max-width.

### Desktop geometry

At `lg` and above:

```text
expanded sidebar    196px
collapsed sidebar    56px
header               56px
workspace gutter     20–24px depending on breakpoint
```

`AppShell` and `AppHeader` MUST NOT use a global `max-w-[1440px]` or similar arbitrary centered workspace cap.

The primary work area absorbs additional monitor width. Page-specific content may constrain itself when readability requires it, but the shell itself remains fluid.

### Workspace gutters

```text
< 768px             16px
768–1023px          20px
>= 1024px           24px
```

Use the same horizontal gutter in header alignment and page content whenever both are visible in the same shell.

## 11. Sidebar specification

### Desktop expanded

- width: 196px;
- persistent from `lg` upward;
- brand and collapse action in a 56px top row;
- navigation follows directly with compact spacing;
- navigation rows are 40px high;
- labels remain visible;
- no promotional/footer card;
- expand/collapse control stays visually subordinate to navigation.

### Desktop collapsed

- width: 56px;
- nav targets are exactly 40×40px;
- icons are centered;
- labels move to accessible names/tooltips;
- collapsed rail MUST NOT retain expanded padding;
- no empty footer block;
- expand action is 40×40px and aligned to the same nav rhythm.

### Mobile

- persistent desktop sidebar is removed;
- use a 248px drawer;
- drawer contains brand, close action, and the same navigation items;
- drawer may use elevation because it floats above an overlay;
- no `Self-hosted` copy or promotional footer.

### Active navigation

Active state should use semantic background/border/text contrast. Do not use gradients, glow, heavy shadow, or oversized rounded capsules.

## 12. Header specification

Header height is 56px on desktop and mobile unless content wrapping makes a temporary larger height necessary.

Desktop structure:

```text
Page title + optional short description                    status   refresh/action
```

Rules:

- do not show a `Gateway` badge next to `Control` or another page title;
- title and actions align to the same workspace gutter as page content;
- status remains a compact semantic control, not a large badge;
- description is secondary and may be hidden on small screens;
- header has a neutral bottom border and no shadow;
- refresh is text + icon when space allows;
- at narrow mobile widths, refresh may become icon-only with an accessible name;
- status text may shorten on mobile but must remain understandable.

Mobile structure:

```text
menu   title                                      status   refresh icon
```

The header must never force horizontal page overflow.

## 13. Responsive breakpoint contract

Use the existing Tailwind breakpoint vocabulary unless a demonstrated requirement needs a new token.

### 320–479px

- mobile drawer navigation;
- 16px page gutter;
- single-column content;
- status overview stacks vertically or uses a layout that never truncates critical state;
- header description hidden;
- header actions compressed;
- action groups may become full-width when necessary;
- credential field + Copy button stack when inline layout would overflow;
- tables/log rows must not create horizontal viewport overflow.

### 480–767px

- mobile drawer navigation;
- 16px gutter;
- single-column task flow;
- forms stay one column;
- inline actions are allowed only when each control remains comfortably usable.

### 768–1023px

- mobile/tablet drawer navigation;
- 20px gutter;
- status overview may use three columns when content fits;
- primary task content remains one main flow;
- do not force a narrow utility rail beside forms.

### 1024–1279px

- persistent desktop sidebar;
- 24px gutter;
- compact desktop shell;
- Control generally remains one primary column when a two-column layout would make forms cramped;
- cards should use available width without artificial global centering.

### >= 1280px

- persistent desktop sidebar;
- 24px gutter;
- Control uses a flexible primary work area plus a stable utility rail;
- utility rail width: approximately 360px;
- primary column absorbs additional width.

### >= 1920px

- shell remains fluid;
- no arbitrary centered application max-width;
- utility rail remains stable rather than scaling proportionally;
- primary task area absorbs the extra width;
- explanatory text/forms may constrain their own readable width locally.

## 14. Page layout recipes

### Control

Control is a task-oriented operational page.

At `>= 1280px`:

```text
PRIMARY: minmax(0, 1fr)       UTILITY: 360px

WhatsApp connection           Gateway credentials
Send a message                Account health
Recipient access
Message status when present
```

Use a 16px column gap.

The utility rail should not grow proportionally with the monitor. Credentials and health are reference/context surfaces; sending and recipient management are primary work.

At `1024–1279px`, prefer a single main flow rather than squeezing forms into a narrow primary column.

Recommended content order when one column is required:

1. overview/status;
2. WhatsApp connection;
3. gateway credentials;
4. account health;
5. send message;
6. message status when present;
7. recipient access.

The exact DOM composition may differ if accessibility or workflow state benefits from another order, but critical prerequisites should appear before dependent actions.

### Audit Log

Audit Log is an operational history console, not a collection of cards.

Desktop filter row:

```text
Search (flex) | Source | Category | Level | Refresh
```

Tablet:

```text
Search
Source | Category | Level
```

Mobile:

```text
Search
Source
Category
Level
```

Filter behavior:

- there is no Apply Filters button;
- selects apply immediately;
- search uses a short debounce around 300ms;
- Refresh is a separate data-refresh action and may remain a button;
- event rows should prioritize timestamp, source, event/description, and level;
- technical metadata is progressively disclosed.

### Settings

The shell remains fluid, but settings forms should not become extremely wide.

- align forms to the left workspace edge;
- use a local readable form width of roughly 680–760px;
- do not center the settings form as a marketing card;
- forms remain single-column unless a pair of short, clearly related controls benefits from sharing a row;
- mutation actions remain close to the section they affect.

A page-specific content constraint is allowed here because it protects form readability. This does not justify bringing back a global shell max-width.

## 15. Status overview

The Control status overview is a compact status strip, not three hero cards.

Target behavior:

- three equal segments when space allows;
- neutral border and dividers;
- approximate height: 72–80px desktop;
- semantic dot + label + value + short detail;
- icon boxes are optional, not mandatory;
- avoid large decorative 40×40 icon containers when text already communicates the state;
- on narrow mobile, stack segments without losing semantic borders or labels.

Prefer:

```text
● Gateway
Healthy
API responding
```

over a large icon tile followed by duplicate status decoration.

## 16. Cards and surfaces

Use cards only when a visual boundary represents a real conceptual boundary.

Standard card:

```text
8px radius
1px neutral border
white/default surface
16px padding
no shadow
```

Do not use a separate card for every two-line status message.

Nested cards are allowed only when the nested surface has a distinct responsibility such as a generated one-time secret requiring special emphasis.

## 17. Forms

Standard control height is 36px.

### Vertical rhythm

Use this default form rhythm:

```text
section title
4px
section description
16px
field label
6px
input/control
12px
next field label
6px
input/control
16px
primary action group
```

A component may compress or expand this slightly when content requires it, but arbitrary `mt-*` values should not accumulate into a new local system.

### Inputs

- 36px standard height;
- 6px radius;
- neutral border;
- visible focus ring/border;
- disabled state must remain legible;
- long technical values use monospace and must truncate/scroll/wrap without widening the viewport.

### Textareas

- do not assign excessive default height;
- preserve the same border/radius/focus system as inputs;
- resize behavior should not break surrounding layout.

### Action placement

Primary action belongs at the logical end of its workflow. Do not float action buttons to unrelated corners merely for visual symmetry.

## 18. Buttons

Button hierarchy:

- primary: strong brand fill for the principal action;
- secondary: neutral border/surface;
- danger: explicit destructive styling;
- icon-only: compact action with accessible label.

Rules:

- standard height: 36px;
- small header actions may be 32px;
- 6px radius;
- no shadow;
- no hover lift;
- hover changes color/surface only;
- do not make every action primary;
- disabled actions must remain visibly disabled without relying only on opacity.

## 19. Empty, unavailable, loading, and error states

### Informational unavailable states

Do not use dashed borders for ordinary information such as:

- account health unavailable until connected;
- recipients unavailable until authenticated;
- no persisted optional configuration.

Dashed borders visually imply a drop zone, placeholder, or interactive insertion target.

Prefer a quiet normal surface or inline muted state:

```text
Account health
Available after WhatsApp is connected.
```

### Empty state

Use concise explanatory text. Do not create a large illustration or promotional empty-state card in the operator console.

### Loading

Use inline spinner/progress feedback near the content being loaded. Avoid large skeleton systems unless the latency and layout shift justify them.

### Errors

- use semantic danger treatment;
- preserve operator-readable language;
- technical detail may be progressively disclosed;
- errors use `role="alert"` when appropriate;
- never render raw HTML/stack traces as the primary message.

## 20. Activity and diagnostic UI

Activity Log is operator history, not a raw terminal.

It should:

- explain what happened;
- show timestamp, source, severity, category/event, and readable description;
- keep technical metadata optional;
- mask phone/JID metadata where appropriate;
- never display secrets, QR payloads, auth credentials, webhook secrets, or message bodies;
- use row/table-like density rather than a stack of mini-cards and decorative pills.

Event code may use monospace. Severity may use a small semantic dot/text treatment rather than a large badge.

## 21. Operator-facing language

Write for an operator, not for the implementation.

Prefer:

- `WhatsApp connected`;
- `Recipient is not allowed yet`;
- `Message accepted by WhatsApp`.

Avoid exposing implementation details as primary UI copy:

- raw Baileys event names;
- stack traces;
- HTTP mechanics;
- opaque enum strings without explanation.

Technical details are allowed in diagnostic disclosure where they help debugging.

## 22. Accessibility

Minimum requirements:

- usable at 320px viewport width without horizontal page scrolling;
- prefer native `button`, `input`, `select`, `details`, and semantic headings;
- icon-only controls require an accessible name;
- keyboard focus remains visible;
- dialogs need an accessible name and explicit close/cancel path;
- errors use `role="alert"` when appropriate;
- successful transient feedback may use `role="status"`;
- forms use real labels or equivalent accessible names;
- required functionality never depends on hover;
- color is never the only status signal;
- touch/click targets remain practical even in compact mode.

## 23. Responsive acceptance matrix

Frontend layout work MUST be reviewed at these representative widths:

```text
320px   small mobile
375px   common mobile
640px   large mobile/small tablet
768px   tablet
1024px  small desktop
1280px  desktop two-column threshold
1440px  common desktop monitor
1920px  full-HD desktop
```

For each width verify:

- no horizontal page overflow;
- sidebar/drawer behavior is correct;
- header title/status/actions do not collide;
- cards do not create unusable narrow columns;
- long IDs and secrets do not widen the page;
- primary actions remain discoverable;
- status text remains understandable;
- forms preserve consistent label/control/action spacing;
- mobile stacking order follows task prerequisites.

## 24. Shared UI source of truth

`src/shared/ui/classes.ts` is the shared source for standard card, input, button, label, and section styles.

Feature components should not repeatedly recreate equivalent classes.

When a feature needs a unique layout, compose shared primitives and add only the layout-specific classes locally.

Do not create a huge component framework. Wago should have a small number of boring, predictable primitives.

## 25. Testing strategy

Test behavior and contracts first. Layout rules that are easy to regress may have targeted class/DOM assertions, but avoid brittle snapshots of entire Tailwind strings.

Priorities:

1. critical operator workflows: bootstrap/pair, sign-in/out, change account, send, allow-and-send;
2. webhook Settings behavior;
3. Audit Log immediate select filtering and debounced search;
4. state boundary failures: backend unavailable, malformed payload, unauthorized state;
5. component accessibility for dialogs and important controls;
6. shell behavior: sidebar collapse/expand and mobile drawer;
7. responsive invariants that can be expressed structurally without browser screenshot brittleness.

When practical, visual/browser checks should cover the responsive acceptance matrix rather than relying only on unit tests.

## 26. Pull-request checklist

Before merging frontend work, verify:

- [ ] UI follows the 56px/196px sidebar contract.
- [ ] Header follows the 56px compact contract.
- [ ] The application shell is fluid and does not restore a global 1440px-style cap.
- [ ] Workspace gutters follow 16/20/24px rules.
- [ ] Standard cards use 8px radius, border, and no shadow.
- [ ] Standard controls use 6px radius and 36px height.
- [ ] No decorative gradient, hover lift, or standard button/card shadow was introduced.
- [ ] No gratuitous pill/badge duplicates page context.
- [ ] Informational unavailable states do not use dashed placeholder styling.
- [ ] Control remains usable at every acceptance width.
- [ ] Audit filters apply without an Apply button.
- [ ] Settings form remains readable and left-aligned.
- [ ] Icon-only controls have accessible names.
- [ ] Loading, empty, error, and disabled states are understandable.
- [ ] Sensitive values are not logged or accidentally rendered.
- [ ] `pnpm check`, `pnpm test`, and relevant builds pass.

## 27. Deliberate non-goals

Do not turn Wago into a design-system framework or enterprise dashboard platform.

Avoid abstractions that only make sense for hypothetical multi-tenant, plugin-based, white-label, or enterprise requirements.

The goal is a small, deliberate operator console with obvious ownership, consistent density, strong responsive behavior, and minimal visual noise.
