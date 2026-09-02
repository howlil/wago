# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** Dashboard Anti-Slop Visual Consolidation — implementation complete, verification in progress.

Goal: remove residual admin-dashboard chrome and make Wago read as a focused gateway tool without changing backend/public API behavior.

## Current baseline

- global navigation remains exactly `Control`, `Settings`, and `Audit Log`;
- Settings shows one hash-addressable active module at a time: `Access`, `Messaging`, `Webhooks`, or `Sessions`;
- Webhook configuration uses linear subsections and delivery detail expands inline with its row;
- machine access uses explicit `Not generated` / `Configured` states and only shows raw keys as one-time reveal output;
- shared controls and the highest-traffic dashboard surfaces use semantic color tokens, while normal explanatory prose is no longer compressed to 9-10px;
- Control uses `Messaging` dependency language (`Waiting`) instead of repeating WhatsApp/root failures as another alarm, and the optional integration promo surface is removed;
- Audit Log is a flat operational console rather than card-inside-card composition;
- sidebar no longer renders the redundant `Workspace` group label;
- session-wide sign-out is destructive and requires an explicit in-context confirmation;
- `apps/dashboard/DESIGN.md` codifies the anti-slop contract;
- backend behavior and public API contracts remain unchanged.

## Active slice

Milestone: Dashboard Anti-Slop Visual Consolidation
Current slice: verification and cleanup.

Completed slices:
1. Settings single-module navigation with hash active state.
2. Webhook linear hierarchy + inline delivery inspection.
3. Machine access state redesign.
4. Typography/semantic-token cleanup on shared/high-traffic surfaces.
5. Control alarm deduplication + removal of integration promotion.
6. Flat Audit Log composition.
7. Decorative/redundant chrome cleanup.

Verification gate:
- focused architecture/component tests;
- formatting/lint;
- core tests;
- production build;
- Docker persistence/rollback smoke;
- CodeQL.

Evidence:
- branch `feat/dashboard-anti-slop` created from `main` at `4f983677e00422afdc0957d18d381aecb5715af1`;
- obsolete `IntegrationNextStep` component/test removed;
- `information-architecture.test.ts` now protects single-module Settings, dependency-aware Control, non-nested Webhook diagnostics, simplified machine access, flat Audit, and sidebar chrome removal.

Blockers: none known.

Next action: open PR, fix every deterministic CI regression on this branch, then squash-merge automatically when all required gates are green. After merge, return this file on `main` to idle.

## Completion rule

When a milestone completes and is integrated into `main`, return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
