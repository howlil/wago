# Compact Responsive UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This repository is being executed inline rather than with subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Wago into a compact, fluid, responsive operator console that follows `frontend/DESIGN.md`, removes redundant shell copy, and keeps Control, Audit Log, and Settings visually consistent from 320px mobile through large desktop displays.

**Architecture:** Keep the existing feature-first React structure. Treat `AppShell`, `AppHeader`, `AppSidebar`, and shared UI classes as the geometry/density source of truth; page components only choose layout recipes appropriate to their feature. Use semantic responsive composition rather than separate mobile/desktop business components.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library, pnpm, GitHub Actions.

## Global Constraints

- Desktop shell is fluid; no global application `max-w-[1440px]` or equivalent centered cap.
- Desktop sidebar is exactly `56px` collapsed and `196px` expanded.
- Header height target is `56px`.
- Workspace gutters are `16px` below 768px, `20px` at 768–1023px, and `24px` from 1024px upward.
- Standard control/button height is `36px`; icon-only nav target is `40×40px`.
- Standard card padding is `16px`; standard card gap is `16px`.
- Standard card radius is `8px`; controls/buttons/nav items use `6px` radius.
- No standard card/button/header/sidebar shadow, decorative gradient, hover lift, or duplicated promotional copy.
- Remove the `Gateway` badge from page headers.
- Remove `Self-hosted` and `Your session and gateway stay under your control.` from desktop and mobile navigation.
- At `>=1280px`, Control uses a flexible primary column plus a stable `360px` utility rail.
- At 1024–1279px, Control should not squeeze forms into a narrow two-column layout; use a single main flow.
- Audit filters auto-apply; there is no Apply Filters button. Search keeps the existing ~300ms debounce.
- Settings stays inside the fluid shell but constrains the form locally to roughly 680–760px, aligned left.
- Do not introduce a new state-management or UI framework dependency.
- Preserve existing auth, WhatsApp, webhook, recipients, and messaging behavior.

---

## File Structure Map

**Shell/density source of truth**
- `frontend/src/shared/components/AppShell.tsx` — sidebar offset, page gutter, fluid content shell.
- `frontend/src/shared/layout/AppHeader.tsx` — 56px header, mobile/desktop action compression, no redundant badge.
- `frontend/src/shared/layout/AppSidebar.tsx` — 56/196px desktop rail, 248px mobile drawer, no promotional footer.
- `frontend/src/shared/ui/classes.ts` — shared card/form/button density classes.

**Control page**
- `frontend/src/features/dashboard/DashboardPage.tsx` — responsive page ordering and desktop utility rail.
- `frontend/src/features/dashboard/OverviewCards.tsx` — compact status strip.
- `frontend/src/features/gateway/GatewayCredentialsCard.tsx` — narrow-width credential/copy behavior if required.
- `frontend/src/features/messages/SendMessageCard.tsx` — compact form rhythm.
- `frontend/src/features/recipients/RecipientAccessCard.tsx` — normal unavailable state rather than dashed placeholder.
- `frontend/src/features/whatsapp/AccountHealthCard.tsx` and dashboard fallback state — compact utility surface.

**Audit/Settings**
- `frontend/src/features/activity/ActivityLogPanel.tsx` — responsive filter/action layout.
- `frontend/src/features/activity/ActivityEventList.tsx` — prevent viewport overflow and keep operational row density.
- `frontend/src/features/settings/SettingsPage.tsx` — local readable form width, left aligned.
- `frontend/src/features/settings/WebhookSettingsCard.tsx` — responsive action/input grouping.

**Tests**
- `frontend/src/shared/layout/AppSidebar.test.tsx` — nav copy/controls and removal of promotional copy.
- `frontend/src/App.test.tsx` — application-level header/page copy regressions.
- `frontend/src/features/dashboard/status-semantics.test.tsx` — preserve status semantics after visual simplification.
- `frontend/src/features/activity/AuditPage.test.tsx` — filter behavior and responsive-safe semantic structure.
- `frontend/src/features/settings/WebhookSettingsCard.test.tsx` — preserve webhook settings behavior after layout changes.
- Add a focused shell/layout test only if an existing test cannot express the required semantic regression without asserting Tailwind internals.

---

### Task 1: Lock shell copy and navigation regressions with tests

**Files:**
- Modify: `frontend/src/shared/layout/AppSidebar.test.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: existing `AppSidebar`, `App`, router/page composition.
- Produces: regression guarantees that redundant `Gateway` badge and `Self-hosted` promotional copy are absent while accessible navigation remains intact.

- [ ] **Step 1: Write failing tests for shell removals**

Add assertions equivalent to:

```tsx
expect(screen.queryByText("Self-hosted")).not.toBeInTheDocument();
expect(screen.queryByText("Your session and gateway stay under your control.")).not.toBeInTheDocument();
```

At application/header level, ensure `Control` remains the page title but there is no separate badge whose text is `Gateway`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm --dir frontend test -- AppSidebar.test.tsx App.test.tsx
```

Expected: FAIL because current sidebar/header still render the removed copy.

- [ ] **Step 3: Do not change production code yet**

Confirm failures are specifically the intended copy regressions, not environment/setup failures.

- [ ] **Step 4: Commit RED tests**

```bash
git add frontend/src/shared/layout/AppSidebar.test.tsx frontend/src/App.test.tsx
git commit -m "test: lock compact shell copy"
```

---

### Task 2: Refactor AppShell, AppHeader, and AppSidebar geometry

**Files:**
- Modify: `frontend/src/shared/components/AppShell.tsx`
- Modify: `frontend/src/shared/layout/AppHeader.tsx`
- Modify: `frontend/src/shared/layout/AppSidebar.tsx`
- Modify: `frontend/src/shared/ui/classes.ts` only if shared shell actions need normalization.
- Test: `frontend/src/shared/layout/AppSidebar.test.tsx`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- `AppShell` continues to accept `title`, `description`, `activePath`, status/refresh props, and children.
- `AppSidebar` keeps its existing navigation API; only geometry/copy changes.
- `AppHeader` keeps its existing status/refresh API; no `Gateway` badge is rendered.

- [ ] **Step 1: Implement 56/196px desktop sidebar**

Use:

```tsx
collapsed ? "w-14" : "w-[196px]"
```

and matching shell offsets:

```tsx
sidebarCollapsed ? "lg:pl-14" : "lg:pl-[196px]"
```

Keep collapsed nav targets `h-10 w-10`.

- [ ] **Step 2: Remove promotional sidebar/footer content**

Delete both desktop and mobile `Self-hosted` blocks. Keep only navigation and the expand/collapse affordance.

- [ ] **Step 3: Make mobile drawer 248px**

Replace the current wider drawer with `w-[248px]`; keep modal/drawer shadow because it is a true overlay.

- [ ] **Step 4: Make header fluid and 56px**

Remove `max-w-[1440px]`, target `min-h-14`, and align horizontal padding with page gutters:

```tsx
px-4 md:px-5 lg:px-6
```

- [ ] **Step 5: Remove `Gateway` badge and compress mobile actions**

Keep title/description. Remove the hardcoded badge. Allow Refresh text to hide on narrow screens while retaining accessible label.

- [ ] **Step 6: Make AppShell content fluid with shared gutters**

Remove the global max-width. Use:

```tsx
<main className="px-4 pb-8 pt-4 md:px-5 lg:px-6 lg:pb-10">...</main>
```

Do not center the workspace.

- [ ] **Step 7: Run focused tests and verify GREEN**

```bash
pnpm --dir frontend test -- AppSidebar.test.tsx App.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Run frontend check**

```bash
pnpm --dir frontend check
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/shared/components/AppShell.tsx frontend/src/shared/layout/AppHeader.tsx frontend/src/shared/layout/AppSidebar.tsx frontend/src/shared/ui/classes.ts frontend/src/shared/layout/AppSidebar.test.tsx frontend/src/App.test.tsx
git commit -m "refactor: compact application shell"
```

---

### Task 3: Make Control page fluid, stable, and task-oriented

**Files:**
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx`
- Modify: `frontend/src/features/dashboard/OverviewCards.tsx`
- Modify: `frontend/src/features/recipients/RecipientAccessCard.tsx` if current unauthenticated state uses dashed informational styling.
- Modify: `frontend/src/features/gateway/GatewayCredentialsCard.tsx` only for narrow-width input/action stacking.
- Modify: `frontend/src/features/messages/SendMessageCard.tsx` only for spacing/action responsiveness.
- Test: `frontend/src/features/dashboard/status-semantics.test.tsx`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Preserve all controller props and behavior.
- `OverviewCards` still consumes `{ health, status, accountHealth }`.
- No backend/API contract changes.

- [ ] **Step 1: Add/adjust semantic regression tests**

Ensure status regions still expose Gateway, WhatsApp, and Outbound state text after icon-container simplification. Ensure Control still exposes Pair WhatsApp, credentials, Send a message, and Recipient access in the correct operational page.

- [ ] **Step 2: Run focused tests and confirm RED only where structure changed is expected**

```bash
pnpm --dir frontend test -- status-semantics.test.tsx App.test.tsx
```

- [ ] **Step 3: Replace proportional desktop columns with stable utility rail**

At `xl` and above use:

```tsx
xl:grid-cols-[minmax(0,1fr)_360px]
```

Below `xl`, use a single column. Keep `gap-4`.

- [ ] **Step 4: Preserve contextual single-column order**

For non-`xl` widths, prerequisites must appear before dependent messaging actions. Do not create a second mobile component tree; use CSS order/grid composition or a small shared composition that keeps one business component instance per rendered state.

- [ ] **Step 5: Compact status overview**

Remove mandatory 40×40 icon boxes. Use semantic dot + label + value + detail, with roughly `px-4 py-3.5`; stack at narrow widths and split into 3 equal segments from `md` upward.

- [ ] **Step 6: Replace dashed informational placeholders**

Unavailable/non-authenticated informational state should use a normal bordered surface or inline muted text, not `border-dashed` unless the element is truly a placeholder/drop target.

- [ ] **Step 7: Make credential/input action groups wrap safely**

On very narrow widths use `flex-col` or grid stacking; from a suitable small breakpoint, allow inline Copy/action controls. Long technical values must not widen the viewport.

- [ ] **Step 8: Normalize form rhythm**

Use shared `cardBodyClass`, `fieldLabelClass`, input/button primitives, and `gap-3`/`gap-4` rather than adding a new spacing system.

- [ ] **Step 9: Run focused tests**

```bash
pnpm --dir frontend test -- status-semantics.test.tsx App.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/dashboard frontend/src/features/recipients frontend/src/features/gateway frontend/src/features/messages frontend/src/App.test.tsx
git commit -m "refactor: make control workspace responsive"
```

---

### Task 4: Normalize Audit Log responsive composition

**Files:**
- Modify: `frontend/src/features/activity/ActivityLogPanel.tsx`
- Modify: `frontend/src/features/activity/ActivityEventList.tsx` only if rows can overflow small viewports.
- Modify: `frontend/src/features/activity/AuditPage.test.tsx`

**Interfaces:**
- Preserve `useActivityLog` behavior: selects apply immediately and search remains debounced.
- Refresh stays a separate explicit action.

- [ ] **Step 1: Add regression test that no Apply Filters action exists**

```tsx
expect(screen.queryByRole("button", { name: /apply filters/i })).not.toBeInTheDocument();
```

Keep interaction assertions that changing Source/Category/Level updates the query without a submit action.

- [ ] **Step 2: Run Audit test and confirm current behavior baseline**

```bash
pnpm --dir frontend test -- AuditPage.test.tsx
```

If already GREEN for no-Apply behavior, keep it as regression coverage; RED is not required for behavior that was already implemented in the previous task.

- [ ] **Step 3: Recompose filters for mobile/tablet/desktop**

Use a responsive grid such as:

```tsx
grid gap-2 md:grid-cols-3 xl:grid-cols-[minmax(240px,1fr)_repeat(3,minmax(120px,160px))_auto]
```

Place Search across the available row at tablet widths as needed; at mobile all controls stack.

- [ ] **Step 4: Keep Refresh visually separate from filtering**

At desktop it may sit in the same toolbar row; on smaller widths it may align with section heading/actions. Do not turn Refresh into an Apply button.

- [ ] **Step 5: Prevent event-row viewport overflow**

Long event codes/metadata must use `min-w-0`, truncation, wrapping, or progressive disclosure. Do not add horizontal page scrolling for normal content.

- [ ] **Step 6: Run Audit test**

```bash
pnpm --dir frontend test -- AuditPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/activity
git commit -m "refactor: compact audit log layout"
```

---

### Task 5: Normalize Settings form width and webhook action responsiveness

**Files:**
- Modify: `frontend/src/features/settings/SettingsPage.tsx`
- Modify: `frontend/src/features/settings/WebhookSettingsCard.tsx`
- Test: `frontend/src/features/settings/WebhookSettingsCard.test.tsx`

**Interfaces:**
- Preserve all webhook settings API behavior and one-time secret lifecycle.
- No backend changes.

- [ ] **Step 1: Preserve webhook behavior tests**

Confirm tests still cover load, save, enable/disable, rotate, complete rotation, and copy one-time generated secret.

- [ ] **Step 2: Make Settings locally constrained, not shell-centered**

Use a left-aligned local content width such as:

```tsx
<div className="grid w-full max-w-[720px] gap-4">
```

Do not add `mx-auto`.

- [ ] **Step 3: Make secret/input action groups responsive**

For generated secret and rotation actions, stack on narrow screens and switch to inline layout when space permits. Buttons must remain reachable and inputs must use `min-w-0`.

- [ ] **Step 4: Keep standard density**

Use 36px controls, 16px card padding, and standard shared primitives. Do not introduce new shadows, gradients, or large radii.

- [ ] **Step 5: Run focused test**

```bash
pnpm --dir frontend test -- WebhookSettingsCard.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/settings
git commit -m "refactor: compact settings layout"
```

---

### Task 6: Enforce shared visual-system guardrails

**Files:**
- Modify: `frontend/src/shared/ui/classes.ts`
- Modify/create the nearest existing shared visual-class regression test if one exists; otherwise add `frontend/src/shared/ui/classes.test.ts`.
- Modify feature files only to replace one-off values exposed by this work.

**Interfaces:**
- Shared class exports retain current names unless removing an unused export is proven safe.

- [ ] **Step 1: Add guardrail tests**

Assert standard shared card/button primitives do not include:

```text
shadow
translate-y
gradient
rounded-xl
rounded-2xl
```

Do not assert every Tailwind token; only protect anti-patterns explicitly prohibited by the design contract.

- [ ] **Step 2: Run guardrail test**

```bash
pnpm --dir frontend test -- classes.test.ts
```

- [ ] **Step 3: Normalize shared classes**

Keep:

```ts
cardClass = "rounded-lg border border-wago-line bg-wago-surface";
standard inputs/buttons = h-9 rounded-md;
```

Move recurring color/spacing choices into semantic shared primitives where the same pattern appears multiple times; do not build a new abstraction layer for single-use values.

- [ ] **Step 4: Run full frontend suite**

```bash
pnpm --dir frontend check
pnpm --dir frontend test
pnpm --dir frontend build
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared frontend/src/features
git commit -m "refactor: enforce compact design primitives"
```

---

### Task 7: Full verification, PR, and squash merge

**Files:**
- No feature additions.
- Update `CHANGELOG.md` only if the repository's current release policy expects UI changes to be recorded.

**Interfaces:**
- Exact final branch HEAD must be the SHA verified by CI before merge.

- [ ] **Step 1: Run repository-level checks locally when available**

```bash
pnpm check
pnpm test
pnpm build:core
pnpm --dir docs build
```

- [ ] **Step 2: Open one PR from `refactor/compact-responsive-ui` to `main`**

PR summary must mention:

- fluid shell;
- 56/196px sidebar;
- 56px header;
- removal of `Gateway` badge and `Self-hosted` copy;
- responsive Control utility rail;
- compact status overview;
- responsive Audit/Settings layouts;
- no backend behavior changes.

- [ ] **Step 3: Verify exact-head CI**

Required terminal success:

- CI / format / tests / core build / docs build;
- Docker persistence/rollback smoke;
- native ARM64 build;
- Docs CI;
- CodeQL.

- [ ] **Step 4: Review diff for scope creep**

Reject unrelated backend, webhook, auth, or documentation architecture changes. Ensure `frontend/DESIGN.md` and implementation agree.

- [ ] **Step 5: Squash merge once checks are green and no blocker remains**

Use one clean main-branch commit for the task.

- [ ] **Step 6: Verify post-merge main workflows**

Confirm CI, Docs CI, CodeQL, and container release (if triggered) succeed on the squash commit or its immediate CI-only follow-up if the workflow itself needs a demonstrated fix.

---

## Acceptance Checklist

- [ ] No `Gateway` badge beside `Control`.
- [ ] No `Self-hosted` promotional block on desktop or mobile.
- [ ] Desktop collapsed sidebar is 56px and navigation targets remain 40×40px.
- [ ] Desktop expanded sidebar is 196px.
- [ ] Header and page content use matching fluid gutters.
- [ ] No global `max-w-[1440px]` shell cap.
- [ ] Control is single-column below 1280px and uses a stable 360px utility rail at/above 1280px.
- [ ] Status overview is compact and does not require large icon tiles.
- [ ] Informational unavailable states are not rendered as dashed placeholder boxes.
- [ ] Credential/copy and webhook secret/copy groups do not overflow narrow screens.
- [ ] Audit filters require no Apply button and remain usable on mobile/tablet/desktop.
- [ ] Settings is left-aligned with a local readable width around 680–760px.
- [ ] No new standard card/button shadow, decorative gradient, hover lift, or oversized radius.
- [ ] Existing auth, pairing, messaging, recipients, audit, and webhook behavior remains green.
- [ ] Full frontend and repository CI are green before merge.
