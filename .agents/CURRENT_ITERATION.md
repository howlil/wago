# Wago Current Iteration

This file is the single resumable source of truth for active Wago engineering work. It records the current milestone/slice, evidence, blockers, and next action. It is not a chronological sprint diary.

## Status

**Active product milestone:** Documentation Technical Reference Design Consolidation.

Goal: redesign `apps/docs` so Wago documentation reads as focused technical reference material rather than a generic dark SaaS/marketing site. Preserve bilingual content, information architecture, routes, and technical accuracy while replacing decorative card-heavy presentation with deliberate shell, typography, dividers, bounded examples, and semantic design tokens.

## Acceptance boundary

- documentation header/navigation is compact and content-first;
- remove decorative OSS pill, hero glow, oversized mock-dashboard chrome, promotional card grids, and routine heavy shadows;
- landing pages prioritize product boundary, quick start, runtime facts, and documentation paths over marketing spectacle;
- documentation navigation remains `Start/Mulai`, `Reference/Referensi`, `Operate/Operasional`, and `Open Source`;
- article prose keeps a readable measure while the documentation shell uses desktop width intentionally;
- shared design tokens replace routine hard-coded color decisions in shell/primitives;
- cards are reserved for bounded examples, code, warnings, diagrams, or interactive API tooling;
- normal informational groupings use rules, rows, typography, and spacing;
- mobile documentation navigation remains accessible and does not become a floating card stack;
- English and Indonesian landing/docs surfaces remain structurally equivalent;
- technical content, product behavior, backend/API contracts, and dashboard code are unchanged.

## Active slice

Slice 1 — documentation design contract and semantic tokens.

Planned slices:
1. documentation design contract and semantic tokens;
2. header, footer, and documentation navigation shell;
3. bilingual landing-page composition;
4. documentation reading surfaces and shared primitives;
5. API/diagram bounded surfaces and residual visual cleanup;
6. responsive/accessibility pass;
7. verification, PR, CI/Docs CI, and automatic merge.

## Evidence

- execution branch: `feat/docs-technical-reference-design`;
- baseline main before branch: `b39a0b0fea96caa705e261d4e7efafee082140d6`;
- current docs use repeated literal dark colors, rounded feature cards, hero glow/shadow, and marketing-style dashboard mock presentation;
- `apps/dashboard/DESIGN.md` already establishes Wago's compact, calm, technical, divider-led product posture; the docs redesign should feel related without copying dashboard UI literally.

## Blockers

None known.

## Next action

Implement all planned slices, verify documentation build and repository gates, then merge automatically and return this file on `main` to idle.

## Completion rule

When the milestone completes and is integrated into `main`, return this file to an idle/no-active-milestone state unless the user has already authorized the next milestone.
