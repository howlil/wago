# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** Dashboard Information Architecture & Layout Consolidation.

Goal: reorganize the Wago operator console around clear product functions and module ownership so Control is easier to act on, Settings is easier to navigate, and repeated/nested visual hierarchy is removed without expanding Wago into a generic SaaS dashboard.

## Current baseline

- workspace layout is `apps/gateway`, `apps/dashboard`, and `apps/docs`;
- dashboard global navigation remains intentionally limited to `Control`, `Settings`, and `Audit Log`;
- `Control` already owns gateway readiness, WhatsApp lifecycle, account health, and compact diagnostics, but connection/account-health presentation repeats related state across separate surfaces;
- `Settings` currently renders application access, recipient policy, webhook configuration/diagnostics, and operator sessions as one long `max-w-[820px]` vertical column;
- Settings uses repeated section/card hierarchy such as `Application integration -> Machine access` and `Delivery integration -> Webhook integration`, which adds labels without improving task orientation;
- webhook configuration and delivery diagnostics are one product domain but are visually separated;
- gateway diagnostics are secondary by product intent, but the expanded diagnostic form can consume excessive Control space;
- `apps/dashboard/DESIGN.md` remains the source of truth for dashboard IA, interaction, layout, density, and responsive behavior;
- backend behavior and public API contracts are not part of this milestone unless a UI requirement exposes a real missing backend capability.

## Active slice

Milestone: Dashboard Information Architecture & Layout Consolidation
Goal: produce a compact, function-oriented operator layout with clear module boundaries and less vertical/visual fragmentation.
Current slice: Slice 1 — IA contract and layout primitives.

Acceptance boundary:
- keep global navigation exactly `Control`, `Settings`, `Audit Log`;
- Control prioritizes actionable runtime state: compact gateway overview, one cohesive WhatsApp module, and secondary troubleshooting;
- merge WhatsApp connection/binding and account-health presentation into one cohesive module without changing truthful state semantics;
- keep gateway overview as a compact summary strip and remove unnecessary repetition of the same state beneath it;
- diagnostics remain secondary/collapsible and do not render a large disabled send form when prerequisites are unavailable;
- Settings gains page-local functional navigation for `Access`, `Messaging`, `Webhooks`, and `Sessions` rather than adding global destinations;
- Settings content uses one primary module heading per concept and removes redundant section->card naming layers;
- `Access` owns App ID and machine API-key lifecycle;
- `Messaging` owns recipient policy;
- `Webhooks` owns callback configuration, event/signing settings, test action, and delivery activity as one cohesive domain;
- `Sessions` owns operator browser-session controls;
- large-desktop layout uses workspace width intentionally instead of one narrow long-form column with excessive empty space;
- mobile/tablet layouts remain single-flow, accessible, and free from horizontal overflow;
- Wago remains compact, border-led, no decorative SaaS dashboard treatment, no inbox/CRM behavior;
- existing backend/API semantics remain unchanged unless implementation proves a specific operator workflow cannot be represented truthfully;
- dashboard tests/build/lint pass, with focused tests for local navigation, responsive composition, and truthful disabled/empty states.

Planned slices:
1. **IA contract and layout primitives** — update `DESIGN.md`, define Settings local navigation/responsive behavior, establish module/page layout primitives without visual redesign drift.
2. **Control consolidation** — keep the overview strip, combine WhatsApp connection + account health into one module, reduce duplicated state and action competition.
3. **Troubleshooting disclosure** — make diagnostics clearly secondary; use prerequisite-aware empty/disabled states instead of large unusable forms.
4. **Settings navigation shell** — add page-local `Access / Messaging / Webhooks / Sessions` navigation with route/state behavior that does not remount unrelated application state.
5. **Settings module consolidation** — flatten redundant hierarchy and reorganize existing cards/features into the four functional modules; combine webhook configuration + delivery diagnostics presentation.
6. **Responsive and density pass** — desktop workspace utilization, tablet/mobile local-nav behavior, long technical values, action alignment, spacing/density normalization.
7. **Verification and cleanup** — update acceptance/component/architecture tests, remove obsolete layout wrappers/copy, run dashboard/core gates, and leave milestone state truthful.

Evidence:
- user-provided screenshots show excessive vertical length, empty desktop space, repeated section/card hierarchy, and fragmented related settings;
- `apps/dashboard/src/pages/settings/SettingsPage.tsx` currently composes four domains in one `max-w-[820px]` column;
- `DashboardMainColumn.tsx` currently separates `WhatsAppBindingCard` and `AccountHealthCard` into independent columns;
- `DashboardDiagnostics.tsx` already treats diagnostics as a `<details>` secondary surface, giving a safe consolidation point rather than requiring a new product workflow;
- branch `feat/dashboard-ia-layout` created from `main` at `36d36ef2ff0c1dad4996de3fc7e878d21baba89c`.

Blockers: none known.

Next action: execute Slice 1 only when implementation is authorized, then continue the already-approved slices on the same branch without creating separate sprint/plan artifacts.

## Completion rule

When a slice completes, record only evidence needed to leave truthful resumable state, advance to the next already-authorized slice, and remove stale blockers/next actions.

When the milestone completes, mark its gate complete and return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
