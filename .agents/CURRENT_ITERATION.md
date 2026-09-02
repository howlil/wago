# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** Dashboard Fluid Workspace Layout.

Goal: make the operator dashboard use desktop width intentionally without becoming visually loose. Primary workspace panels should fill the available content area; compactness must come from internal grid composition, spacing, and hierarchy rather than narrow page-level max-width constraints.

## Current baseline

- global navigation remains exactly `Control`, `Settings`, and `Audit Log`;
- Settings shows one hash-addressable active module at a time: `Access`, `Messaging`, `Webhooks`, or `Sessions`;
- Webhook configuration is linear and delivery evidence expands inline with the selected row;
- machine access uses explicit `Not generated` / `Configured` states and exposes raw API keys only as one-time reveal output;
- normal explanatory prose uses readable body sizing while technical metadata remains compact;
- shared/high-traffic dashboard surfaces use semantic color tokens;
- Control uses dependency-aware messaging state instead of repeating one root failure as several alarms;
- Audit Log is a flat searchable/filterable operational console;
- backend behavior and public API contracts remain unchanged by this milestone.

## Active slice

Milestone: Dashboard Fluid Workspace Layout
Current slice: layout redesign and implementation.

Design direction:
1. Remove arbitrary page-level and primary-card max-width caps that create unused desktop space.
2. Keep global and local navigation rails fixed-width while active workspace content uses `minmax(0, 1fr)`.
3. Make primary cards full-width within their workspace column.
4. Recover compactness with responsive internal grids: credentials side-by-side, recipient form/list split on wide screens, connection/account-health sections distributed horizontally where useful.
5. Keep dialogs, authentication forms, and long prose measure-constrained where a narrow reading width is functionally correct.
6. Preserve mobile single-column behavior and avoid viewport horizontal overflow.
7. Replace previous informal visual-cleanup terminology with neutral design-system language in repository documentation.

Evidence:
- branch `feat/dashboard-fluid-workspace` created from current `main`;
- current code audit found Settings capped at `1120px` with an `880px` content column, Control capped at `1180px`, and the WhatsApp primary panel capped at `920px`, which explains the large unused right-side area on wide desktop viewports.

Blockers: none known.

Next action: implement the fluid workspace layout, update design contracts/tests, run formatting/lint, core tests, production build, Docker persistence/rollback smoke, and CodeQL, then merge when all required gates are green.

## Completion rule

When a slice completes, record only evidence needed to leave truthful resumable state and remove stale blockers/next actions.

When a milestone completes and is integrated into `main`, return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
