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
- the runtime summary is one compact status rail, not a row of KPI cards;
- the status rail is the routine authoritative gateway/WhatsApp/messaging summary;
- do not repeat the same routine gateway state in the page header and the status rail;
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

Settings must not regress into a long page containing all modules at once. The one active module is a workspace section, not a giant routine card.

### Audit Log

Audit Log answers: **What happened, and where did the failure occur?**

It is an operational console, not a card stack. Search and filters apply immediately. Event details remain progressively disclosed. Technical provider/library terminology appears only where it materially improves diagnosis.

## Console surface grammar

The default hierarchy is divider-led workspace composition with deliberate surface contrast:

```text
workspace

module title                                      primary action
short state only when useful
---------------------------------------------------------------
field / state          field / state          related evidence
---------------------------------------------------------------
secondary operational evidence
```

A routine primary module does **not** receive a rounded floating card merely because it needs a visual boundary. Use alignment, spacing, typography, dividers, and a restrained low-chroma surface tint first.

A workspace tint is allowed when it materially improves scanning. Treat it as part of the page plane: one controlled tint plus a rule or divider, no shadow, no glow, no decorative icon box, and no oversized rounding.

### Surface types

**Workspace section** is the default for primary Control and Settings modules.

Use it for:
- WhatsApp runtime state;
- Access;
- Messaging recipient policy;
- Webhooks;
- Sessions;
- Audit tooling.

A workspace section normally has:
- a module header;
- optional action/state on the opposite edge;
- responsive internal regions or key/value rows;
- dividers for internal boundaries;
- a restrained semantic surface tint when additional separation from the canvas is useful;
- at most one strong editorial rule for the outer section boundary.

The tint must not turn the page back into a card wall. Routine sections remain flat, fluid, and integrated with the workspace.

**Bounded surface** is reserved for a real self-contained interaction or exceptional state.

Appropriate examples:
- QR pairing content;
- one-time API key/signing-secret reveal;
- destructive confirmation;
- warnings/errors requiring stronger containment;
- dialogs, sheets, tooltips;
- secondary diagnostic forms where a form boundary improves comprehension.

Do not use bounded surfaces as the default wrapper for the only active module on a page.

**Operational rail** is for compact cross-domain runtime summaries. A rail uses text state plus a semantic dot; it is not a set of metric/KPI cards.

### Borders and hierarchy

A border represents a real conceptual boundary. Subsections inside one domain normally use dividers and smaller headings, not nested full cards.

Avoid:

```text
Page
  card
    duplicate heading
    info panel
      mini cards
    nested card
      selected-item card
```

Do not add:
- decorative gradients or glass effects;
- card/button shadows for routine surfaces;
- hover lift;
- oversized rounding;
- decorative icon boxes for routine modules;
- promotional onboarding cards inside operational pages;
- tiny status badges or pills when readable status text is enough;
- status badges that expose implementation state without helping an operator decide;
- empty disabled form controls for capabilities that do not yet exist;
- nested cards when inline disclosure is sufficient;
- arbitrary centered application max-width containers;
- redundant headings or explanatory paragraphs;
- active-navigation pills or rounded tinted tiles that read like generic SaaS navigation.

Use hierarchy in this order:
1. layout/alignment;
2. spacing;
3. typography;
4. borders/surface contrast;
5. semantic color;
6. elevation only for true overlays.

## Width and density strategy

The dashboard workspace is **fluid after the global sidebar**. On desktop, primary operational surfaces use the available content width instead of stopping at a narrow centered max-width and leaving a large empty right column.

Rules:
- page-level workspace containers use the available width;
- primary workspace sections are `w-full` inside their workspace column;
- Settings keeps a fixed local navigation rail and a fluid `minmax(0, 1fr)` active-module column;
- Control status rail, WhatsApp module, and diagnostics align to the same fluid workspace width;
- Audit search, filters, and event rows use the full workspace width;
- compactness on wide screens comes from responsive internal grids, not from constraining the whole page;
- long prose may use a readable text measure inside a full-width module;
- dialogs, authentication forms, QR blocks, and other intrinsically narrow tasks may keep explicit max-width constraints;
- tables and technical evidence gain useful horizontal room before adding horizontal scrolling.

Recommended wide-screen pattern:

```text
full workspace width
---------------------------------------------------------------
module header / action
---------------------------------------------------------------
primary fields / state       | related state / evidence
---------------------------------------------------------------
```

Do not create empty desktop space merely to preserve a form width that was appropriate for tablet. If a form itself should remain narrow, keep the module full-width and use an internal column or grid so the remaining width carries related state, help, or evidence.

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
- explanatory prose and instructions are at least 12px;
- 10px is reserved for metadata such as timestamps, counts, short event codes, and technical identifiers;
- 9px is not used for normal operator UI;
- readable semantic status text is preferred over tiny badges;
- monospace is limited to identifiers, keys, JIDs, endpoints, event codes, and similar technical values.

Spacing rhythm:

```text
4px   micro
8px   tight internal
12px  related content
16px  standard region
20px  tablet workspace gutter
24px  desktop gutter / major separation
32px  exceptional page-level separation
```

Standard controls are 36px high. Inputs/buttons/nav items use about 6px radius. Bounded exceptional surfaces normally use about 6-8px radius. Routine workspace sections normally stay unrounded; their low-chroma tint and editorial rule belong to the workspace plane rather than a floating card.

## Color and tokens

Use semantic tokens from `src/styles.css` and shared classes from `src/shared/ui/classes.ts`.

Prefer token classes such as:
- `wago-line` / `wago-control-line`;
- `wago-secondary` / `wago-tertiary`;
- `wago-surface-subtle` / `wago-hover`;
- `wago-section` / `wago-section-line` for routine primary workspace separation;
- `wago-sidebar-active` / `wago-sidebar-active-line` for active navigation wash and rule;
- `wago-brand` / `wago-brand-strong`;
- `wago-positive`, `wago-warning`, `wago-danger`.

Do not introduce a literal hex value for a routine dashboard control, text state, status, divider, or notice when an existing semantic token can represent it. Literal colors are acceptable only inside the token definition layer or for exceptional rendering needs where a semantic token would be misleading.

Status color is never the only signal; pair it with text.

Do not create a rainbow of per-module cards. Routine modules share the same low-chroma workspace family unless their semantic state genuinely requires warning/danger treatment.

## Motion and interaction

Motion exists to clarify state and make direct manipulation feel responsive. It is not decoration.

Use Motion for React for purposeful interaction transitions such as:
- active navigation indicator changes;
- restrained hover/press feedback;
- small state/layout transitions where continuity helps orientation.

Rules:
- the application root uses `MotionConfig` with `reducedMotion="user"`;
- respect `prefers-reduced-motion` without requiring separate user configuration;
- keep routine navigation motion short and restrained;
- small translation feedback should stay within a few pixels;
- press scale may be subtle, never rubbery or bouncy;
- do not add hover lift, floating cards, parallax, glow trails, springy page choreography, or decorative entrance animations;
- motion must never delay navigation, data rendering, or an operator action;
- CSS color changes may remain CSS when Motion provides no meaningful continuity benefit.

## Key component rules

### Runtime status rail

The Control summary presents `Gateway`, `WhatsApp`, and `Messaging` as one compact rail. Each state contains:
- semantic dot;
- domain label;
- readable state text;
- concise dependency/evidence text.

The rail may stack on narrow screens, but must not become three rounded KPI cards.

### WhatsApp

WhatsApp connection, account binding, and account health are one workspace module. The module header owns `Pair WhatsApp` / `Change account` actions.

Connection/account/account-health evidence uses divider-led key/value regions. QR pairing is a bounded task surface because the QR code is an intrinsically self-contained interaction; it does not need an additional decorative icon box.

### Machine access

Do not render an empty password-like API-key input when no key exists.

Before generation:

```text
Machine API key
Not generated
Required only when another application calls Wago.
[Generate API key]
```

After configuration, show configured state and rotation action. A raw generated/rotated key appears only as a temporary one-time bounded reveal with Copy/Show actions.

On wide screens, App ID and API-key lifecycle may share a two-column region. Do not expose source badges such as `generated` when they do not change operator behavior.

### Messaging

Recipient policy stays one workspace module. On wide screens, use the available width to separate add-recipient controls from saved-recipient evidence when that reduces vertical scanning.

Recipient state uses readable semantic text (optionally with a small dot) rather than a tiny pill. `Allowed`, `Opted out`, and `Not allowed` must remain understandable without color.

### Webhooks

Webhooks remain one product domain but use two clear workspace regions:

```text
Webhooks
---------------------------------------------------------------
Configuration
  callback / enablement      | signing / supported events
  temporary secret when any
  save / test
---------------------------------------------------------------
Delivery activity
  recent deliveries / inline attempt evidence
```

Do not wrap the entire Webhooks module in a floating routine card. The configuration region and delivery region are separated by workspace dividers. A shared low-chroma workspace tint is acceptable because it separates the active operational surface from the canvas without introducing card-wall hierarchy. Generated signing-secret output may be bounded because it is temporary and sensitive.

Supported event names use operator-readable labels with technical event names as secondary monospace metadata. Delivery detail expands inline with its delivery row. Do not create a separate nested `Selected delivery` card.

### Sessions

Current-browser sign-out is the normal action. `Sign out all sessions` is destructive, visually distinct, and requires explicit confirmation before execution. The confirmation may use a bounded danger surface; the routine Sessions module itself does not become a floating card.

### Audit

Audit uses a flat console composition:

```text
heading / refresh
search + filters
------------------------------
event rows
------------------------------
```

Do not wrap the whole Audit workspace in a routine floating card and then put the event list in another rounded card.

## Copy rules

UI copy exists to change a decision or explain a constraint. Remove copy that merely restates the heading.

Keep copy when it communicates:
- a prerequisite;
- a security/privacy boundary;
- a risk or restriction;
- an irreversible/destructive consequence;
- a one-time secret requirement;
- a dependency that explains why an action is unavailable.

Prefer concise state labels and direct actions over generic explanatory paragraphs.

## Application shell and responsive behavior

Desktop sidebar:
- expanded: 196px;
- collapsed: 56px;
- nav target: 40px;
- no promotional/footer card;
- no redundant group label when all global destinations belong to one group;
- active destination uses a low-chroma full-row wash plus a narrow brand rule, never a rounded active pill/tile;
- icon and label remain plain content, not decorative icon-box components;
- hover/press motion is restrained and cannot delay routing.

Settings local navigation follows the same active-state grammar: low-chroma wash plus a directional rule, not rounded brand-soft pills.

Header height is about 56px. The header owns page identity and page-level actions such as Refresh; routine Control gateway state belongs to the status rail directly below and is not duplicated in the header.

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
- status rail stacks cleanly;
- actions may stack/full-width;
- technical tables scroll only inside bounded regions;
- no viewport horizontal overflow.

### 768-1023px
- drawer global navigation;
- Settings module selector may be a four-item row;
- forms remain one readable main flow;
- key/value workbench regions may begin distributing horizontally when space is sufficient.

### >= 1024px
- persistent sidebar;
- Settings uses a local navigation rail around 176px next to a fluid active-module column;
- primary workspace sections fill the available content column;
- use internal two-column or multi-column composition when wider screens can reduce vertical scanning;
- preserve readable text measure within modules rather than narrowing the whole workspace.

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
8. Shared visual classes should encode demonstrated repeated primitives only; do not build a generic component framework around this surface grammar.
9. Motion primitives are used directly where continuity is useful; do not create a broad animation abstraction layer without repeated demonstrated need.

## Accessibility and verification

- icon-only actions require accessible names;
- status remains understandable without color;
- dialogs/drawers preserve keyboard and focus behavior;
- Settings module links expose active state and remain keyboard/browser navigable;
- long technical values wrap, truncate, or scroll without widening the viewport;
- destructive actions use explicit language and confirmation proportional to impact;
- Motion respects the user's reduced-motion preference;
- active navigation remains understandable without animation.

For meaningful UI changes verify at minimum:
- narrow mobile composition;
- desktop shell/navigation;
- wide desktop fluid workspace behavior;
- active navigation at expanded, collapsed, and mobile widths;
- reduced-motion behavior for Motion interactions;
- workspace tint does not regress into nested/rounded card walls;
- Control status rail semantics and lack of header duplication;
- WhatsApp pairing/binding/account-health workbench;
- Settings active-module behavior and hash navigation;
- machine API-key generation/rotation one-time reveal;
- recipient allow/opt-out/reallow state;
- Webhook save/test/signing rotation and inline delivery diagnostics;
- session sign-out and sign-out-all confirmation;
- prerequisite-aware diagnostics;
- Audit filters and event disclosure;
- relevant component/architecture tests;
- formatting/lint, production build, Docker persistence/rollback smoke, and repository security gates.
