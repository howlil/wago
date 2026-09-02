# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** none.

The repository is at a clean, resumable baseline after completion and integration of the Dashboard Fluid Workspace Layout milestone.

## Current baseline

- global navigation remains exactly `Control`, `Settings`, and `Audit Log`;
- Settings shows one hash-addressable active module at a time: `Access`, `Messaging`, `Webhooks`, or `Sessions`;
- Settings uses a fixed local navigation rail with a fluid active-module column on desktop;
- Control overview, WhatsApp state, and diagnostics use the available workspace width instead of narrow page-level caps;
- primary operational modules fill their workspace column while responsive internal grids keep wide-screen layouts compact;
- Access places App ID and API-key lifecycle side by side on wide screens, with one-time raw-key output spanning the module when present;
- Messaging separates recipient-entry controls from saved-recipient evidence on wide screens;
- Webhooks separates callback configuration from signing/events while keeping delivery evidence full-width;
- Sessions separates current-browser and all-session controls on wide screens;
- WhatsApp/account-health and manual-send diagnostics use horizontal space to reduce unnecessary vertical scanning;
- intrinsically narrow tasks such as dialogs, authentication, QR pairing, and long prose remain measure-constrained where appropriate;
- Audit Log retains full-width operational search, filters, and event evidence;
- `apps/dashboard/DESIGN.md` defines the fluid-workspace width and density strategy using neutral design-system language;
- backend behavior and public API contracts were unchanged by this milestone;
- no known material blocker.

## Active slice

None.

Evidence:
- PR #117 `refactor(dashboard): make workspace fluid on wide screens` was squash-merged into `main` as `0ad09f521075b07509f3d8305b2fa158e5666f8b`;
- final verified PR head: `adbba2a03963d080543e4e24601e4f1091c6f7d6`;
- CI run `33686532805`: success; formatting/lint, core tests, production build, and Docker persistence/rollback smoke passed;
- CodeQL run `33686532806`: success;
- architecture regression coverage protects the fluid Settings rail/content layout and removal of narrow Control/WhatsApp/diagnostic workspace caps.

Blockers: none known.

Next action: await explicit authorization for the next product milestone. Do not invent one from this file.

## Completion rule

When a slice completes, record only evidence needed to leave truthful resumable state and remove stale blockers/next actions.

When a milestone completes and is integrated into `main`, return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
