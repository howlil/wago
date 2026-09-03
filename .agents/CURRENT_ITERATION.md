# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** Documentation Technical Reference Design Consolidation — implementation complete, verification in progress.

Goal: redesign `apps/docs` so Wago documentation reads as focused technical reference material rather than a generic dark SaaS/marketing site. Preserve bilingual content, information architecture, routes, and technical accuracy while replacing decorative card-heavy presentation with deliberate shell, typography, dividers, bounded examples, and semantic design tokens.

## Completed slices

1. Documentation design contract and semantic tokens.
2. Header, footer, and documentation navigation shell.
3. Bilingual landing-page composition.
4. Documentation reading surfaces and shared primitives.
5. Diagram/bounded technical surfaces and overview hierarchy cleanup.
6. Responsive/accessibility-oriented shell and navigation pass.

## Current baseline

- `apps/docs/DESIGN.md` defines the documentation visual contract;
- site shell uses semantic docs tokens from `src/styles/global.css`;
- header no longer uses decorative OSS pill or dominant GHCR CTA;
- documentation navigation uses rule-led active state instead of rounded selected pills;
- EN/ID landing pages share one `LandingPage.astro` composition;
- hero glow, fake dashboard mock, feature-card walls, and routine heavy shadows are removed from landing pages;
- landing content now prioritizes runtime boundary, deploy/pair/integrate path, product boundary, guardrails, documentation map, and runtime model;
- `PageHeader`, `DocCard`, `Callout`, `CodeBlock`, and `PlantUmlDiagram` follow documentation surface grammar;
- Overview core capabilities and documentation map use rows/rules rather than routine cards;
- technical content, product behavior, backend/API contracts, and dashboard runtime are unchanged.

## Active slice

Slice 7 — verification, PR, CI/Docs CI, and automatic merge.

Required final gates:
- repository formatting/lint required by CI;
- docs helper tests;
- Astro static build for `apps/docs`;
- core CI jobs triggered by docs changes;
- merge only after required checks are green on the final PR head.

## Evidence

- execution branch: `feat/docs-technical-reference-design`;
- baseline main before branch: `b39a0b0fea96caa705e261d4e7efafee082140d6`;
- branch diff is limited to `.agents/CURRENT_ITERATION.md` and `apps/docs/**`;
- English and Indonesian landing pages now delegate to the same shared composition, preventing structural drift.

## Blockers

None known.

## Next action

Open the PR, fix deterministic formatter/build/test regressions, merge automatically when all required gates are green, then return this file on `main` to idle.

## Completion rule

When the milestone completes and is integrated into `main`, return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
