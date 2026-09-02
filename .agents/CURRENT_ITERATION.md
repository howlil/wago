# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** Dashboard Anti-Slop Visual Consolidation.

Goal: remove residual admin-dashboard chrome and make Wago read as a focused gateway tool without changing backend/public API behavior.

## Current baseline

- global navigation remains exactly `Control`, `Settings`, and `Audit Log`;
- the previous IA consolidation is integrated on `main`;
- remaining design debt is presentation-level: Settings still renders every module, Webhooks is an oversized nested surface, machine access exposes implementation-shaped empty controls, small typography and literal colors are overused, Control repeats dependency alarms, Audit Log is card-inside-card, and decorative chrome remains;
- `apps/dashboard/DESIGN.md` remains authoritative.

## Active slice

Milestone: Dashboard Anti-Slop Visual Consolidation
Current slice: execute all authorized slices.

Authorized slices:
1. Settings single-module navigation with hash-addressable active state.
2. Webhook linear subsections and inline delivery inspection instead of nested selected-delivery card.
3. Machine access state redesign: no empty disabled credential field/source badge; one-time raw key reveal only when available.
4. Typography and semantic-token cleanup: prose >= 12px, remove normal 9px UI text, reduce arbitrary literal colors.
5. Control alarm deduplication: one root problem should not read as multiple independent alarms; remove optional integration promo surface.
6. Flatten Audit Log into an operational console rather than nested cards.
7. Remove decorative/redundant chrome such as the sidebar `Workspace` label and non-informational icon treatment.
8. Verification/cleanup: focused architecture/component tests, formatting/lint, core tests/build, Docker persistence/rollback smoke, CodeQL.

Acceptance boundary:
- no new global destinations, backend behavior, public API, CRM/inbox behavior, or design-system framework;
- compactness comes from hierarchy/spacing, not unreadably small explanatory text;
- Settings shows one active functional module at a time while preserving direct hash navigation;
- destructive session actions have truthful visual hierarchy;
- Webhook remains one product domain without becoming one mega-card;
- Audit remains searchable/filterable with progressive technical disclosure;
- all required repository gates pass before automatic merge.

Evidence:
- branch `feat/dashboard-anti-slop` created from `main` at `4f983677e00422afdc0957d18d381aecb5715af1`;
- milestone scope comes from the approved anti-slop audit.

Blockers: none known.

Next action: implement all authorized slices, open PR, fix CI until green, then squash-merge automatically and return this file on `main` to idle.

## Completion rule

When a milestone completes and is integrated into `main`, return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
