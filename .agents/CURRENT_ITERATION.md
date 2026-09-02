# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** Dashboard Fluid Workspace Layout — implementation complete, verification in progress.

Goal: make the operator dashboard use desktop width intentionally without becoming visually loose. Primary workspace panels fill the available content area; compactness comes from internal grid composition, spacing, and hierarchy rather than narrow page-level max-width constraints.

## Current baseline

- global navigation remains exactly `Control`, `Settings`, and `Audit Log`;
- Settings shows one hash-addressable active module at a time: `Access`, `Messaging`, `Webhooks`, or `Sessions`;
- Settings uses a fixed local navigation rail with a fluid active-module column on desktop;
- Control overview, WhatsApp state, and diagnostics use the available workspace width instead of narrow page-level caps;
- Access, Messaging, Webhooks, Sessions, WhatsApp state, account health, and manual-send diagnostics use responsive internal grids on wide screens to reduce vertical scanning;
- intrinsically narrow tasks such as dialogs, authentication, and QR pairing remain measure-constrained;
- Webhook delivery evidence and Audit Log retain full-width operational table/list behavior;
- repository design documentation uses neutral design-system terminology;
- backend behavior and public API contracts remain unchanged by this milestone.

## Active slice

Milestone: Dashboard Fluid Workspace Layout
Current slice: verification and cleanup.

Completed slices:
1. Removed Settings `1120px`/`880px`, Control `1180px`, WhatsApp `920px`, and diagnostics `780px` workspace caps.
2. Made Settings `176px/192px + minmax(0, 1fr)` on wide desktop.
3. Added responsive internal layouts for machine access, recipient policy, webhook configuration, session controls, WhatsApp/account health, and manual send diagnostics.
4. Updated `apps/dashboard/DESIGN.md` with the fluid-workspace width strategy and neutral visual-system language.
5. Added architecture regression coverage for fluid desktop workspace behavior.

Evidence:
- branch `feat/dashboard-fluid-workspace` created from `main` at `3aea92ce23d326f8f6882e362b62698f495cdfa7`;
- PR #117 `refactor(dashboard): make workspace fluid on wide screens` is open;
- prior merged PR #116 title/body were renamed to neutral visual-hierarchy language;
- implementation preserves mobile single-column behavior and keeps narrow-task max-width constraints only where functionally appropriate.

Verification gate:
- formatting/lint;
- core tests;
- production build;
- Docker persistence/rollback smoke;
- CodeQL.

Blockers: none known.

Next action: fix every deterministic verification regression on PR #117, then squash-merge when all required gates are green. After merge, return this file on `main` to idle.

## Completion rule

When a slice completes, record only evidence needed to leave truthful resumable state and remove stale blockers/next actions.

When a milestone completes and is integrated into `main`, return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
