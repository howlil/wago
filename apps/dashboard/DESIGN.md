# Wago Frontend Design & Engineering Guide

This file is the source of truth for dashboard information architecture, layout, density, interaction hierarchy, and UI engineering decisions.

Wago is a small self-hosted operator console. It should feel like focused infrastructure tooling: compact, calm, technical, predictable, and deliberate. It is not a generic SaaS admin dashboard, CRM, inbox, or marketing surface.

## Product UI model

```text
Control   = observe + operate
Settings  = configure
Audit Log = investigate
```

Global navigation stays exactly `Control`, `Settings`, and `Audit Log` unless the product boundary itself changes.

### Control

Control answers: **Is the gateway operational, and what action is needed now?**

It owns runtime readiness, WhatsApp connection/account lifecycle, account restriction state, and secondary end-to-end diagnostics.

Rules:
- overview is summary only;
- WhatsApp connection, binding, and account health are one operator domain;
- one dependency failure must not read as several independent alarms;
- downstream capability summaries use dependency language such as `Waiting` when a root prerequisite is unavailable;
- runtime warnings may link directly to filtered Audit evidence;
- manual send remains a collapsed diagnostic tool, never the primary product workflow;
- when a diagnostic prerequisite is missing, show a concise prerequisite state instead of a large disabled form;
- do not add optional application-integration promotion to Control.

### Settings

Settings answers: **How is this gateway configured for applications and operators?**

Local functional navigation is:

```text
Access
Messaging
Webhooks
Sessions
```

These are not global workspaces. Settings shows **one active module at a time**. The active module is addressable through the URL hash (`#access`, `#messaging`, `#webhooks`, `#sessions`) and normal browser hash navigation must remain valid.

Ownership:
- Access: App ID and machine API-key lifecycle;
- Messaging: recipient policy;
- Webhooks: callback, signing, supported events, test action, and delivery activity;
- Sessions: operator browser-session controls.

Settings must not regress into a long page containing all modules at once.

### Audit Log

Audit Log answers: **What happened, and where did the failure occur?**

It is an operational console, not a card stack. Search and filters apply immediately. Event details remain progressively disclosed. Technical provider/library terminology appears only where it materially improves diagnosis.

## Anti-slop visual grammar

Preferred hierarchy:

```text
Page
  module / toolbar
    state
    fields or rows
    action
```

Avoid:

```text
Page
  explanatory heading
    card
      duplicate heading
      decorative info panel
        mini cards
      nested card
        selected-item card
```

A border should represent a real conceptual boundary. Subsections inside one domain normally use dividers and smaller headings, not more full cards.

Do not add:
- decorative gradients or glass effects;
- card/button shadows for routine surfaces;
- hover lift;
- oversized rounding;
- decorative icon boxes for routine modules;
- promotional onboarding cards inside operational pages;
- status pills/badges that expose implementation state without helping an operator decide;
- empty disabled form controls for capabilities that do not yet exist;
- nested cards when inline disclosure is sufficient;
- arbitrary centered application max-width containers;
- redundant headings or explanatory paragraphs.

Use hierarchy in this order:
1. layout/alignment;
2. spacing;
3. typography;
4. borders/surface contrast;
5. semantic color;
6. elevation only for true overlays.

## Typography and density

Compactness comes from hierarchy and spacing, not unreadably small prose.

```text
page title             16-18px semibold
module title           14px semibold
subsection title       12-13px semibold
body/help/prose        12-14px
field/navigation label 11-13px
metadata               10-11px
technical identifier   10-13px monospace
```

Rules:
- normal explanatory prose is **never 9-10px**;
- 10px is reserved for metadata such as timestamps, counts, short event codes, and technical identifiers;
- 9px is not used for normal operator UI;
- monospace is limited to identifiers, keys, JIDs, endpoints, event codes, and similar technical values.

Spacing rhythm:

```text
4px   micro
8px   tight internal
12px  related content
16px  standard component/module
20px  tablet workspace gutter
24px  desktop gutter / major separation
32px  exceptional page-level separation
```

Standard controls are 36px high. Routine module padding is 16px. Inputs/buttons/nav items use about 6px radius; standard bounded modules use about 8px. Shadows are reserved for true overlays.

## Color and tokens

Use semantic tokens from `src/styles.css` and shared classes from `src/shared/ui/classes.ts`.

Prefer token classes such as:
- `wago-line` / `wago-control-line`;
- `wago-secondary` / `wago-tertiary`;
- `wago-surface-subtle` / `wago-hover`;
- `wago-positive`, `wago-warning`, `wago-danger`.

Do not introduce a new literal hex value for a routine control or text state when an existing semantic token can represent it. A few literals may remain for exceptional brand or accessibility tuning, but literal-color proliferation is design debt.

Status color is never the only signal; pair it with text.

## Key component rules

### Machine access

Do not render an empty password-like API-key input when no key exists.

Before generation:

```text
Machine API key
Not generated
Required only when another application calls Wago.
[Generate API key]
```

After configuration, show configured state and rotation action. A raw generated/rotated key appears only as a temporary one-time reveal with Copy/Show actions.

Do not expose source badges such as `generated` when they do not change operator behavior.

### Webhooks

Webhooks remain one product domain but must not become one mega-card.

Use a linear structure:

```text
Webhook integration
status + callback
------------------
signing
------------------
supported events (compact disclosure)
------------------
actions
------------------
delivery activity
```

Supported event names use operator-readable labels with technical event names as secondary monospace metadata.

Delivery detail expands inline with its delivery row. Do not create a separate nested `Selected delivery` card. Attempt history is inline evidence. Terminal incoming deliveries explain why manual redelivery is unavailable without rendering a dominant disabled action.

### Sessions

Current-browser sign-out is the normal action. `Sign out all sessions` is destructive, visually distinct, and requires explicit confirmation before execution.

### Audit

Audit uses a flat console composition:

```text
heading / refresh
search + filters
------------------------------
event rows
------------------------------
```

Do not wrap the whole Audit workspace in a routine card and then put the event list in another rounded card.

## Application shell and responsive behavior

Desktop sidebar:
- expanded: 196px;
- collapsed: 56px;
- nav target: 40px;
- no promotional/footer card;
- no redundant group label when all global destinations belong to one group.

Header height is about 56px. Global Control status reflects gateway readiness rather than only WhatsApp socket state.

Workspace gutters:

```text
< 768px       16px
768-1023px    20px
>= 1024px     24px
```

### 320-767px
- drawer global navigation;
- single-column task flow;
- Settings local navigation is a compact two-column selector;
- actions may stack/full-width;
- technical tables scroll only inside bounded regions;
- no viewport horizontal overflow.

### 768-1023px
- drawer global navigation;
- Settings module selector may be a four-item row;
- forms remain one readable main flow.

### >= 1024px
- persistent sidebar;
- Settings uses a local navigation rail around 168px next to content up to about 880px;
- large displays use available workspace without stretching forms proportionally.

## Frontend architecture

```text
App -> pages -> features -> shared
feature -> its local modules
shared -> shared
```

Rules:
1. `App.tsx` stays thin.
2. Pages compose feature modules and route/local navigation; they do not own networking or domain logic.
3. Shared code does not import feature internals.
4. Cross-feature imports are exceptional; prefer page composition.
5. Components use the frontend API boundary rather than calling `fetch` directly.
6. Browser authentication uses the HttpOnly browser session; machine API keys are not browser auth state.
7. React local state/focused hooks remain the default; do not add global state infrastructure without demonstrated need.

## Accessibility and verification

- icon-only actions require accessible names;
- status remains understandable without color;
- dialogs/drawers preserve keyboard and focus behavior;
- Settings module links expose active state and remain keyboard/browser navigable;
- long technical values wrap, truncate, or scroll without widening the viewport;
- destructive actions use explicit language and confirmation proportional to impact.

For meaningful UI changes verify at minimum:
- narrow mobile composition;
- desktop shell/navigation;
- Settings active-module behavior and hash navigation;
- operational state semantics and dependency alarms;
- prerequisite-aware diagnostics;
- Webhook disclosure/inline diagnostics;
- Audit filters and event disclosure;
- relevant component/architecture tests;
- formatting/lint, production build, Docker persistence/rollback smoke, and repository security gates.
