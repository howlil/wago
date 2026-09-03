# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** Dashboard Console Surface Consolidation.

Goal: remove remaining generic dashboard/card composition from the operator UI and make Control and Settings read as a purpose-built gateway console. Primary hierarchy must come from workspace layout, dividers, key/value regions, operational tables, and action placement rather than large rounded cards, repeated status chrome, tiny badges, or redundant explanatory copy.

## Product boundary

- global navigation remains exactly `Control`, `Settings`, and `Audit Log`;
- Settings remains one hash-addressable active module at a time: `Access`, `Messaging`, `Webhooks`, or `Sessions`;
- backend behavior and public API contracts remain unchanged unless a UI state cannot be represented truthfully without a small compatibility fix;
- browser-session auth, machine API-key behavior, recipient policy, webhook semantics, and WhatsApp lifecycle remain product-equivalent;
- no new dashboard framework, generic design-system package, or global state layer.

## Design target

Preferred workspace grammar:

```text
workspace

module title                                      primary action
short state only when useful
---------------------------------------------------------------
field / state          field / state          related evidence
---------------------------------------------------------------
secondary operational evidence
```

Avoid using a full rounded card as the default boundary for the only active module on a page. Bounded surfaces remain appropriate only for exceptional states, QR content, dialogs, temporary secrets, warnings, or similarly self-contained interactions.

## Planned slices

### Slice 1 — Workspace surface primitives and design contract

Purpose: establish the structural vocabulary used by the remaining slices before changing feature modules.

Work:
- update `apps/dashboard/DESIGN.md` to define workspace sections, divider-led regions, bounded exceptional surfaces, and card-avoidance rules;
- add/refine shared classes for workspace/module headers, horizontal regions, dividers, and compact key/value rows where reuse is demonstrated;
- keep `cardBodyClass` available only for bounded surfaces that still warrant it; do not create another generic abstraction layer;
- extend architecture regression coverage to protect the new surface model.

Acceptance:
- design guidance no longer implies routine Settings/Control modules should default to rounded cards;
- primary workspace modules can be composed without `cardBodyClass`;
- no visual behavior change outside the intended dashboard surfaces.

### Slice 2 — Control status rail and header deduplication

Purpose: remove KPI-card composition and duplicate gateway state.

Work:
- replace the three-tile `Gateway / WhatsApp / Messaging` overview with one compact operational status rail;
- remove duplicate routine gateway status from the Control header when the same authoritative state is visible directly below;
- preserve text-based state semantics and dependency-aware `Waiting` behavior;
- keep Refresh in the header as the page-level operation.

Acceptance:
- Control has one authoritative visible gateway status presentation, not a header chip plus a duplicate tile;
- status rail is horizontally compact on desktop and stacks cleanly on narrow screens;
- one dependency failure still produces one visual alarm rather than multiple independent alarms.

### Slice 3 — WhatsApp workbench and pairing cleanup

Purpose: make the runtime domain read as operational state rather than a large card.

Work:
- remove the outer routine card silhouette from the WhatsApp module;
- compose `Connection`, `Account`, and account-health evidence as aligned key/value regions separated by dividers;
- keep action placement explicit (`Pair WhatsApp` / `Change account`) at the module header level;
- remove the decorative QR icon box;
- keep QR itself measure-constrained as a true bounded task surface;
- use readable prose sizing for pairing instructions and health explanations.

Acceptance:
- WhatsApp state uses workspace hierarchy rather than a rounded white container;
- QR pairing remains obvious without decorative icon chrome;
- connection/account/account-health information scans horizontally on wide screens and remains single-column on mobile.

### Slice 4 — Settings workspace surfaces

Purpose: make the single active Settings module feel native to the workspace instead of a giant card.

Work:
- preserve the local `Access / Messaging / Webhooks / Sessions` navigation rail;
- remove routine outer `cardBodyClass` wrappers from Access, Messaging, and Sessions;
- use module header + divider + functional regions instead;
- keep temporary API-key reveal, destructive confirmation, and other exceptional states bounded only when the boundary improves comprehension;
- preserve existing responsive internal grids from the fluid-workspace milestone.

Acceptance:
- active Settings content fills the workspace naturally without a giant rounded rectangle;
- module ownership and hash navigation remain unchanged;
- actions remain easy to locate and destructive session actions retain explicit confirmation.

### Slice 5 — Webhook console composition

Purpose: remove the remaining mega-card silhouette while preserving one coherent Webhooks domain.

Work:
- remove the Webhook outer routine card;
- separate configuration/signing/event controls from `Delivery activity` using full-width horizontal regions and dividers;
- retain the wide configuration/signing internal grid on large screens;
- keep generated signing-secret reveal as a temporary bounded output;
- keep delivery rows and inline attempt evidence flat and full-width;
- avoid creating nested cards or a separate diagnostics page.

Acceptance:
- Webhooks reads as `Configuration` + `Delivery activity`, not one giant card containing everything;
- delivery evidence remains directly inspectable inline;
- callback URL, signing, events, save/test actions, and delivery diagnostics remain one product domain.

### Slice 6 — Typography, status, token, and copy cleanup

Purpose: remove remaining generated-dashboard styling residue after structural changes are stable.

Work:
- remove normal UI text at `9px`;
- reserve `10px` for timestamps, counts, event codes, and other true metadata;
- raise explanatory prose/instructions to at least 12px where currently undersized;
- replace recipient tiny status pills with plain semantic status text or dot + text when that improves scanning;
- migrate remaining routine dashboard literal colors to semantic tokens;
- remove title/description pairs whose description merely restates the title;
- keep requirement, risk, privacy, prerequisite, destructive, and one-time-secret copy where it changes operator decisions.

Acceptance:
- no normal operator prose is rendered at 9–10px;
- recipient state does not depend on tiny badge styling;
- routine dashboard surfaces do not introduce new literal colors;
- copy density is lower without losing operational meaning.

### Slice 7 — Verification, responsive review, and cleanup

Purpose: prove the redesign is coherent across viewport sizes and does not regress product behavior.

Verification:
- narrow mobile composition with no viewport horizontal overflow;
- tablet Settings selector and single active module behavior;
- wide desktop status rail, Settings workbench, Webhooks regions, and WhatsApp state distribution;
- QR pairing state;
- API-key generate/rotate one-time reveal;
- recipient allow/opt-out/reallow flows;
- Webhook save/test/rotate/complete-rotation and inline delivery inspection;
- session sign-out and sign-out-all confirmation;
- Audit Log remains unchanged as a flat operational console;
- architecture/component acceptance tests;
- formatting/lint;
- core tests;
- production build;
- Docker persistence/rollback smoke;
- CodeQL.

Cleanup:
- remove obsolete card-only wrappers/classes/imports no longer used by migrated surfaces;
- remove obsolete microcopy and status-pill helpers made redundant by the new composition;
- keep narrow-task max-width constraints only where functionally justified.

## Milestone acceptance

The milestone is complete only when all of the following are true:

1. Control no longer presents its overview as three KPI cards.
2. Routine gateway status is not duplicated between the Control header and the status rail.
3. WhatsApp runtime state is divider/key-value driven rather than wrapped in a routine card.
4. Access, Messaging, Sessions, and Webhooks do not use a giant routine outer card merely because they are the active Settings module.
5. Webhooks has visually distinct configuration and delivery regions without splitting the product domain.
6. QR pairing has no decorative icon box.
7. Normal operator prose is at least 12px; 9px normal UI text is eliminated.
8. Recipient state uses readable semantic presentation rather than a tiny badge wall.
9. Remaining routine dashboard literal colors are migrated to semantic tokens where an existing token fits.
10. Redundant explanatory copy is removed while prerequisite, risk, privacy, and irreversible-action copy is preserved.
11. Mobile/tablet/wide-desktop behavior remains coherent and overflow-safe.
12. Required repository verification gates are green on the final implementation head.

## Non-goals

- no new global navigation destinations;
- no backend feature redesign;
- no inbox/CRM/contact-management expansion;
- no decorative motion, gradients, glass, hover lift, or marketing-style onboarding surfaces;
- no wholesale rewrite of the dashboard component architecture;
- no attempt to eliminate every border or every card: bounded surfaces remain when they communicate a real boundary.

## Current slice

Slice 1 — Workspace surface primitives and design contract.

Evidence:
- milestone authorized from the post-fluid-workspace design audit;
- baseline `main` HEAD before planning: `5cd15787ef8db70f3b823470d6e35c9542b6da2a`;
- current implementation still uses routine `cardBodyClass` wrappers for active Settings modules and WhatsApp/Webhooks, a three-tile Control overview, decorative QR icon chrome, undersized recipient status text, and several routine literal colors.

Blockers: none known.

Next action: implement Slice 1, then proceed through all slices in order. Do not redesign backend contracts or expand product scope while executing this milestone.

## Completion rule

When a slice completes, record only evidence needed to leave truthful resumable state and remove stale blockers/next actions.

When the milestone completes and is integrated into `main`, return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
