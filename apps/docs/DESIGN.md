# Wago Documentation Design Guide

This file is the source of truth for the visual and interaction design of `apps/docs`.

Wago documentation is technical reference material for a small self-hosted gateway. It should feel compact, calm, precise, and operational. It is not a marketing microsite, generic dark SaaS landing page, or component showcase.

## Design objective

The documentation should help a reader answer, in order:

1. What is Wago and what is deliberately out of scope?
2. How do I run it safely?
3. How do I pair and operate the gateway?
4. How do I integrate with the HTTP API?
5. How do I diagnose failures and maintain the deployment?

Visual hierarchy exists to support those questions. Decoration that does not improve comprehension should not compete with technical content.

## Information architecture

Top-level documentation groups remain:

```text
Start / Mulai
Reference / Referensi
Operate / Operasional
Open Source
```

The public site header contains only product identity, Documentation, GitHub, language switch, and the container/package destination when useful. Do not add promotional nav groups, announcement pills, or dashboard-style global status.

## Surface grammar

Use this order for hierarchy:

1. page structure and alignment;
2. spacing;
3. typography;
4. rules/dividers;
5. subtle surface contrast;
6. semantic color;
7. elevation only for overlays.

Routine content groups are not cards by default.

Prefer:

```text
SECTION TITLE
Short explanation when it changes understanding.
--------------------------------------------------------
label / fact                         related value
--------------------------------------------------------
label / fact                         related value
```

Use a bounded surface only when the boundary is real:

- code or command examples;
- warnings and security notes;
- architecture diagrams;
- interactive API tooling;
- temporary or copyable technical output.

Avoid nested rounded cards, feature-card grids, decorative icon boxes, glow effects, floating hero mockups, heavy shadows, and pills that only restate metadata.

## Landing page

The landing page is an entry point into the documentation, not a marketing funnel.

It should contain:

- a restrained product statement;
- concise product boundary;
- primary path to Getting Started and API Reference;
- one copyable/run-oriented Docker command or deployment cue;
- runtime facts presented as rows or a compact matrix;
- a short deployment/pair/integrate sequence;
- clear links into documentation domains.

Do not use an oversized dashboard mockup, blurred glow, testimonial-style proof, or repeated feature-card sections.

## Documentation shell

Desktop:

```text
site header
--------------------------------------------------------
local documentation nav | readable article column
                        | optional free breathing room
```

The shell may be wider than the prose. Technical prose keeps a readable measure; code, tables, diagrams, and API evidence may use more horizontal space when useful.

Mobile documentation navigation is an inline disclosure separated by rules. It should not read as a floating card detached from the page.

## Typography

Use Inter for interface/prose and JetBrains Mono for code/technical identifiers.

Recommended scale:

```text
landing h1          40-48px desktop, 34-38px mobile
article h1          30-36px
section h2          20-24px
subsection h3       14-16px
body                14-16px
navigation          13-14px
metadata            11-12px
code                12-13px
```

Do not use uppercase tracking as decoration on every section. A small eyebrow/kicker is acceptable only when it conveys document type or sequence.

Normal prose must remain comfortably readable. Compactness comes from spacing and structure, not tiny text.

## Color

Use semantic tokens from `src/styles/global.css`.

Core roles:

- page background;
- subtle surface;
- raised/bounded surface;
- primary text;
- secondary text;
- tertiary/metadata text;
- normal and strong divider;
- green product accent;
- warning/danger states.

Routine components should not introduce new literal hex values. Status or warning color must never be the only signal.

## Links and actions

Primary documentation actions are text-first and restrained.

- one primary action per decision point;
- secondary actions use text or border treatment rather than another filled CTA;
- external links should look like links, not promotional buttons;
- language switching is utility navigation, not a badge;
- GitHub/GHCR should not visually dominate Getting Started.

## Code and technical evidence

Code blocks are bounded because they are copyable technical artifacts. Keep them compact:

- small label row only when the label adds context;
- no oversized radius or shadow;
- horizontal scroll stays inside the code region;
- code contrast is stronger than surrounding prose but remains consistent with the site palette.

Tables, endpoint lists, and runtime facts should prefer rows and column alignment over collections of cards.

## Callouts

Use callouts only for information that changes behavior:

- security boundary;
- destructive consequence;
- unsupported configuration;
- prerequisite;
- operational warning;
- data/privacy implication.

A callout normally uses a left rule plus subtle background. Do not use decorative icons unless the icon itself improves recognition.

## Responsive behavior

### < 768px

- header remains compact and horizontally stable;
- documentation navigation is an inline disclosure;
- article is single column;
- primary actions may stack;
- rows wrap intentionally;
- code/tables scroll internally;
- no viewport horizontal overflow.

### 768-1023px

- article remains primary;
- local nav stays in disclosure/compact form;
- fact rows and two-column technical regions may begin distributing horizontally.

### >= 1024px

- persistent documentation rail around 210-230px;
- readable article column around 780-900px for prose;
- code, tables, and technical evidence may expand beyond prose measure when the component supports it;
- avoid arbitrary centered marketing containers inside the documentation shell.

## Accessibility

- active documentation navigation uses `aria-current`;
- focus states remain visible;
- disclosure summaries are keyboard accessible;
- color is never the only status distinction;
- text contrast must remain readable on dark surfaces;
- external controls keep clear accessible names;
- content order must remain logical without layout styling.

## Verification

Meaningful documentation design changes verify at minimum:

- Indonesian and English landing pages;
- mobile and desktop header/navigation;
- active documentation nav state;
- article typography and heading hierarchy;
- code blocks, callouts, diagrams, and API explorer surfaces;
- long endpoint/code content without viewport overflow;
- Astro documentation build;
- repository formatting/lint/security gates required by CI.
