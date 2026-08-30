# Wago Frontend Design & Engineering Guide

This document is the source of truth for frontend information architecture, responsive layout, visual density, and UI engineering decisions in `frontend/`.

Wago is a small self-hosted operator console, not a generic SaaS dashboard. The interface should feel like focused infrastructure tooling: compact, calm, technical, predictable, and efficient.

## 1. Product UI model

The dashboard follows one operator mental model:

```text
Control   = observe + operate
Settings  = configure
Audit Log = investigate
```

Do not organize the UI around internal modules, provider names, or implementation details. Organize around the operator's intent.

### Control

Control answers:

> Is this gateway operational, and what action do I need to take now?

It owns:

- gateway readiness and runtime health;
- WhatsApp connection/pairing/account switching;
- account availability/restriction state;
- secondary end-to-end diagnostics.

It does **not** own application credentials, recipient policy, webhook configuration, or browser-session administration.

### Settings

Settings answers:

> How is this gateway configured for applications and operators?

It owns:

- machine application access: App ID and API key lifecycle;
- outbound recipient policy;
- webhook/delivery integration;
- operator browser-session administration.

Machine credentials and operator browser sessions are separate concepts and must remain separate in copy and layout.

### Audit Log

Audit Log answers:

> What happened, and where did the failure occur?

It owns searchable/filterable operational history and progressively disclosed technical evidence. UI terminology should stay gateway-facing; provider/library names belong only where they materially help diagnosis.

## 2. Operator journey

The normal first-run path is:

```text
create admin password
  -> Control
  -> pair WhatsApp
  -> gateway becomes operational
  -> optional application integration in Settings
  -> configure recipient policy / webhook as needed
```

Application integration is optional. Pairing WhatsApp must not depend on generating an API key.

Failure path:

```text
Control detects problem
  -> Audit Log identifies cause
  -> Control for runtime/connection action
     or Settings for configuration action
```

Readiness warnings should not dead-end in explanatory copy. When Audit evidence can help, Control should offer a direct investigation action and carry only narrow, validated filter context such as category and severity. Audit filters remain editable after navigation, and unsupported query parameters must be ignored safely.

## 3. Visual posture

Wago UI must be:

- compact rather than spacious;
- operational rather than promotional;
- border-led rather than shadow-led;
- information-dense without visual noise;
- responsive from 320px mobile through large desktop displays;
- understandable without knowledge of the backend implementation.

Do not add decorative product claims, hero regions, trust copy, marketing cards, or duplicate explanatory text.

Avoid generic dashboard styling:

- no decorative gradients or glassmorphism;
- no card/button shadows by default;
- no hover lift effects;
- no oversized rounded cards;
- no decorative icon boxes for every metric;
- no excessive status pills;
- no arbitrary centered application max-width.

Use hierarchy in this order:

1. layout/alignment;
2. spacing;
3. typography;
4. borders/surface contrast;
5. semantic color;
6. elevation only for true overlays.

## 4. Density and dimensions

Spacing rhythm:

```text
4px   micro
8px   tight internal
12px  related-content
16px  standard component/card
20px  tablet workspace gutter
24px  desktop gutter / major separation
32px  exceptional page-level separation
```

Standard dimensions:

```text
collapsed desktop sidebar   56px
expanded desktop sidebar    196px
application header           56px
mobile drawer               248px
icon-only nav target         40x40px
small header action          32px
standard control/button      36px
standard card padding        16px
standard card gap            16px
```

Radius hierarchy:

```text
inputs/buttons/nav items     6px
standard cards/surfaces      8px
dialogs/drawers              10-12px max when useful
```

Default elevation is none. Shadows are reserved for dialogs, drawers, menus, and other true floating surfaces.

## 5. Color and typography

Use semantic tokens from `src/styles.css` and shared classes from `src/shared/ui/classes.ts` rather than one-off styling.

Status color is never the only signal; pair it with clear text.

Recommended type scale:

```text
page title             16-18px semibold
card/section title     14px semibold
primary body           13-14px
secondary body         12px
field label            11-12px medium
metadata               10-11px
technical identifier   11-13px monospace
```

Monospace is for identifiers, API keys, JIDs, event codes, endpoints, and technical metadata.

## 6. Application shell and navigation

The desktop shell is fluid. Do not center the whole application in a fixed `max-width` container.

Workspace gutters:

```text
< 768px       16px
768-1023px    20px
>= 1024px     24px
```

Navigation order follows operator intent:

```text
Control
Settings
Audit Log
```

Desktop sidebar:

- expanded width: 196px;
- collapsed width: 56px;
- nav rows: 40px;
- no promotional/footer card.

Mobile navigation uses a 248px drawer with the same destinations.

The header is 56px and remains compact. On Control, the global status reflects **gateway readiness** (`Ready`, `Degraded`, `Not ready`, or checking/offline state), not merely WhatsApp socket connectivity.

## 7. Responsive contract

### 320-767px

- drawer navigation;
- 16px page gutter;
- single-column task flow;
- header description may hide;
- actions may stack/full-width when needed;
- no horizontal viewport overflow.

### 768-1023px

- drawer navigation;
- 20px gutter;
- status overview may use multiple columns when content fits;
- operational/configuration forms remain easy to scan in one main flow.

### >= 1024px

- persistent desktop sidebar;
- 24px gutter;
- shell remains fluid;
- page-local readable widths are allowed when they improve scanning.

Large monitors must not cause utility/configuration content to stretch proportionally without benefit.

## 8. Page recipes

### Control

Recommended order:

```text
Gateway status
  -> overview strip
  -> readiness warning when needed
  -> WhatsApp connection
  -> account health
  -> optional integration handoff
  -> Gateway diagnostics (collapsed by default)
```

Control should expose prerequisites before dependent actions. Manual sending is an end-to-end diagnostic tool, not the primary product workflow.

### Settings

Settings uses one readable configuration column, aligned to the workspace edge rather than centered like a marketing form.

Recommended section order:

```text
Application integration
Outbound policy
Delivery integration
Operator access
```

Mutation actions stay close to the section they affect.

### Audit Log

Audit Log is an operational history console, not a stack of unrelated cards.

Filters apply immediately:

```text
Search | Source | Category | Level | Refresh
```

On smaller screens, filters stack. There is no separate Apply button. Technical metadata stays behind progressive disclosure. Entry links from Control may preselect validated filters, but the operator can always broaden or change them.

## 9. Status overview and readiness

The Control overview is a compact status strip, not hero cards.

Prefer:

```text
Gateway
Healthy
API responding
```

over decorative icon tiles and duplicated badges.

The UI must represent disconnected, unavailable, degraded, checking, and invalid-session states truthfully. Never display optimistic `Healthy`, `Normal`, or `Connected` labels when the dependent capability is unavailable.

## 10. Cards, forms, and actions

Use a card only when the border represents a real conceptual boundary.

Standard card:

```text
8px radius
1px neutral border
white/default surface
16px padding
no shadow
```

Standard form controls are 36px high with visible focus treatment. Long technical values must wrap, truncate, or scroll without widening the viewport.

Primary actions are for the main operation in a section. Destructive actions require explicit language and should not visually compete with the normal path.

## 11. Frontend architecture

The frontend is feature-first with page composition:

```text
src/
├── App.tsx
├── pages/
├── features/
│   ├── access/
│   ├── activity/
│   ├── dashboard/
│   ├── gateway/
│   ├── messages/
│   ├── recipients/
│   ├── settings/
│   └── whatsapp/
└── shared/
```

Dependency direction:

```text
App -> pages -> features -> shared
feature -> its own local modules
shared -> shared
```

Rules:

1. `App.tsx` stays a thin application entry point.
2. `pages/` compose features and route-level navigation; they do not own networking/business state.
3. `shared/` must not import feature internals.
4. Cross-feature imports should be exceptional; prefer composition at page boundaries.
5. Domain behavior stays in the feature that owns it.
6. React local state and focused hooks remain the default; do not add a global state library without a demonstrated need.
7. Components do not call `fetch` directly; use the frontend API boundary.
8. Browser authentication uses the HttpOnly browser session; never persist API keys as browser authentication state.

## 12. Accessibility and verification

All icon-only actions need accessible names. Status must be understandable without color alone. Dialogs/drawers must preserve keyboard and focus behavior.

For meaningful UI changes, verify at minimum:

- narrow mobile behavior;
- desktop shell/navigation behavior;
- operational state semantics;
- relevant acceptance/component tests;
- formatting/lint and production build.

Design changes should preserve the product boundary: Wago is a focused WhatsApp gateway control plane, not a CRM, messaging client, or generic SaaS administration suite.
