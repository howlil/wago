# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** Dashboard Information Architecture & Layout Consolidation — implementation complete, awaiting merge.

Goal: reorganize the Wago operator console around clear product functions and module ownership so Control is easier to act on, Settings is easier to navigate, and repeated/nested visual hierarchy is removed without expanding Wago into a generic SaaS dashboard.

## Current baseline

- global navigation remains exactly `Control`, `Settings`, and `Audit Log`;
- Control keeps the compact gateway overview and now presents WhatsApp connection, binding, and account health inside one cohesive runtime module;
- detailed connection/account-health state is no longer split across independent sibling cards;
- Gateway diagnostics remain secondary/collapsible and show a compact prerequisite state instead of a large disabled send form when WhatsApp is not connected;
- Settings now uses page-local `Access`, `Messaging`, `Webhooks`, and `Sessions` navigation without adding global workspaces;
- Settings no longer uses redundant parent section headings such as `Application integration -> Machine access` or `Delivery integration -> Webhook integration`;
- Settings desktop composition uses a local navigation rail plus a readable module column instead of the previous narrow `max-w-[820px]` long-form stack;
- Access owns App ID and machine API-key lifecycle;
- Messaging owns recipient policy;
- Webhooks presents callback configuration, supported events, signing lifecycle, test action, and delivery activity inside one cohesive visual module;
- Sessions owns operator browser-session controls with reduced decorative chrome;
- `apps/dashboard/DESIGN.md` codifies the consolidated IA, responsive behavior, hierarchy, and density contract;
- backend behavior and public API contracts were not changed by this milestone.

## Active slice

Milestone: Dashboard Information Architecture & Layout Consolidation
Goal: produce a compact, function-oriented operator layout with clear module boundaries and less vertical/visual fragmentation.
Current slice: Integration complete — awaiting merge authorization.

Acceptance boundary:
- [x] global navigation remains `Control`, `Settings`, `Audit Log`;
- [x] Control prioritizes actionable runtime state with one cohesive WhatsApp module;
- [x] account-health semantics remain truthful for available, limited, checking, unavailable, and invalid-session states;
- [x] diagnostics remain secondary and prerequisite-aware;
- [x] Settings has local `Access / Messaging / Webhooks / Sessions` navigation;
- [x] redundant section -> card hierarchy is removed;
- [x] webhook configuration and delivery activity are visually one domain;
- [x] large-desktop workspace width is used intentionally while keeping a readable content column;
- [x] mobile/tablet local navigation and actions use stacked/grid responsive layouts without introducing viewport-width technical surfaces;
- [x] Wago remains compact, border-led, and focused on gateway operation rather than CRM/inbox/SaaS expansion;
- [x] existing backend/API behavior remains unchanged;
- [x] regression coverage protects the new IA boundaries and state semantics;
- [x] lint, core tests, core production build, Docker persistence/rollback smoke, and CodeQL pass.

Completed slices:
1. **IA contract and layout primitives** — `DESIGN.md` now defines local Settings navigation, module hierarchy, responsive composition, and anti-duplication rules.
2. **Control consolidation** — WhatsApp connection/binding and account health are one module; the overview remains summary-only.
3. **Troubleshooting disclosure** — disconnected diagnostics use a compact prerequisite message; connected diagnostics preserve the end-to-end send/status tools.
4. **Settings navigation shell** — page-local anchor navigation groups `Access / Messaging / Webhooks / Sessions` without route remounts or global sidebar expansion.
5. **Settings module consolidation** — redundant wrappers were removed; webhook configuration and delivery diagnostics are composed inside the same module boundary.
6. **Responsive and density pass** — Settings uses a 168px local rail + up-to-880px content column on desktop, compact grid navigation on smaller screens, full-width small-screen actions, and bounded technical overflow.
7. **Verification and cleanup** — architecture regression tests were added, stale presentation assumptions were corrected, and all required repository gates passed.

Evidence:
- branch `feat/dashboard-ia-layout` was created from `main` at `36d36ef2ff0c1dad4996de3fc7e878d21baba89c`;
- PR #115: `refactor(dashboard): consolidate operator information architecture`;
- verified code head: `eeb5dc74f1bef7e322f98a3b20b54388ce4239d8`;
- CI run `33671642482`: success; formatting/lint, gateway/dashboard tests, production builds, and Docker persistence/rollback smoke passed;
- CodeQL run `33671642539`: success;
- focused `information-architecture.test.ts` protects Settings local navigation, cohesive WhatsApp ownership, prerequisite-aware diagnostics, and Webhook module composition;
- no backend/public API files were required for the product behavior.

Blockers: none.

Next action: merge PR #115 only when explicitly authorized by the user. After merge, return this file on `main` to an idle/no-active-milestone state unless another milestone is authorized.

## Completion rule

When a slice completes, record only evidence needed to leave truthful resumable state, advance to the next already-authorized slice, and remove stale blockers/next actions.

When the milestone completes and is integrated into `main`, mark its gate complete and return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
