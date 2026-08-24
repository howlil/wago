# Frontend Structure Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for each behavior or architecture-rule change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make frontend route pages, domain widgets, hooks, and API logic visually and mechanically distinct so developers can tell where pages live and where domain logic lives.

**Architecture:** Keep React + Vite + TypeScript and local hooks. Avoid introducing a router/state library. Use pages as route composition roots and keep domain features as widgets, API clients, model hooks, and types.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Biome.

**Spec:** Derived from the frontend structure audit in this session.

## Global Constraints

- Do not introduce Redux, Zustand, TanStack Query, or React Router.
- Preserve existing runtime behavior and public UI copy except where tests explicitly define a structural contract.
- Use TDD for behavior changes and executable architecture rules.
- Keep moves mechanical and reviewable.
- Run focused checks at the end of every iteration.
- Do not commit unless explicitly requested.

---

### Iteration 1: Explicit Page Boundary

**Files:**
- Create: `frontend/src/pages/dashboard/DashboardPage.tsx`
- Create: `frontend/src/pages/audit/AuditPage.tsx`
- Create: `frontend/src/pages/settings/SettingsPage.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/architecture/page-boundary.test.ts`

**Acceptance Criteria:**
- Route pages live under `frontend/src/pages/*`.
- `frontend/src/App.tsx` imports route pages only from `./pages/*`.
- Existing dashboard, audit, and settings route tests still pass.

**TDD Steps:**
- Add architecture test that fails while `App.tsx` imports page components from `features/*`.
- Move the page files and update imports.
- Run `pnpm --dir frontend test src/architecture/page-boundary.test.ts src/App.test.tsx`.
- Run scoped Biome on touched frontend files.

---

### Iteration 2: Dashboard Section Components

**Files:**
- Create: `frontend/src/pages/dashboard/DashboardConnectionSection.tsx`
- Create: `frontend/src/pages/dashboard/DashboardMessagingSection.tsx`
- Create: `frontend/src/pages/dashboard/DashboardAccessSection.tsx`
- Create: `frontend/src/pages/dashboard/DashboardDialogs.tsx`
- Modify: `frontend/src/pages/dashboard/DashboardPage.tsx`
- Create: `frontend/src/pages/dashboard/DashboardPage.structure.test.ts`

**Acceptance Criteria:**
- `DashboardPage.tsx` composes named dashboard sections instead of directly rendering every card/dialog.
- Section files own cross-domain widget assembly.
- Existing app behavior remains unchanged.

**TDD Steps:**
- Add structure test checking `DashboardPage.tsx` imports and renders the named section components.
- Verify RED before extraction.
- Extract sections.
- Run `pnpm --dir frontend test src/pages/dashboard/DashboardPage.structure.test.ts src/App.test.tsx`.
- Run scoped Biome on touched frontend files.

---

### Iteration 3: Split Dashboard Snapshot Responsibilities

**Files:**
- Create: `frontend/src/pages/dashboard/useGatewaySnapshot.ts`
- Create: `frontend/src/pages/dashboard/useWhatsAppSnapshot.ts`
- Create: `frontend/src/pages/dashboard/useDashboardPolling.ts`
- Modify: `frontend/src/pages/dashboard/useDashboardSnapshot.ts`
- Modify: dashboard action hooks imports after page move.
- Create: `frontend/src/pages/dashboard/useDashboardSnapshot.structure.test.ts`

**Acceptance Criteria:**
- Gateway/app/readiness state is isolated in `useGatewaySnapshot`.
- WhatsApp/binding/QR state is isolated in `useWhatsAppSnapshot`.
- Visibility/poll timer logic is isolated in `useDashboardPolling`.
- `useDashboardSnapshot.ts` becomes a facade/orchestrator instead of one god hook.

**TDD Steps:**
- Add structure test proving helper hooks exist and `useDashboardSnapshot.ts` imports them.
- Verify RED.
- Extract the hooks while keeping the returned facade contract compatible with existing action hooks.
- Run `pnpm --dir frontend test src/pages/dashboard/useDashboardSnapshot.structure.test.ts src/App.test.tsx`.
- Run scoped Biome on touched frontend files.

---

### Iteration 4: Remove API Module Side Effect

**Files:**
- Modify: `frontend/src/features/gateway/api.ts`
- Create: `frontend/src/features/gateway/legacy-session.ts`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/features/gateway/legacy-session.test.ts`

**Acceptance Criteria:**
- Importing `features/gateway/api.ts` no longer mutates `sessionStorage`.
- Legacy API-key browser session cleanup is explicit and runs from the app bootstrap path.

**TDD Steps:**
- Add test that imports `api.ts` with a legacy session key and expects the key to remain.
- Add test for explicit `clearLegacyApiKeySessionStorage()`.
- Verify RED.
- Move the side effect into `legacy-session.ts` and call it from `App`.
- Run `pnpm --dir frontend test src/features/gateway/legacy-session.test.ts src/App.test.tsx`.
- Run scoped Biome on touched frontend files.

---

### Iteration 5: Frontend Architecture Guards

**Files:**
- Create: `frontend/src/architecture/frontend-boundary.test.ts`

**Acceptance Criteria:**
- `shared/*` does not import `features/*` or `pages/*`.
- `pages/*` may import `features/*` and `shared/*`.
- `features/*/api.ts` imports only local feature files and `shared/api`.
- `features/*/api.ts` files contain no module-level browser storage access.

**TDD Steps:**
- Add architecture guard tests.
- Run and fix only actual violations.
- Run `pnpm --dir frontend test src/architecture/frontend-boundary.test.ts`.
- Run scoped Biome on architecture test.

---

### Final Verification

- Run focused frontend tests touched by the work.
- Run full frontend test suite.
- Run frontend build.
- Run scoped Biome for touched frontend files.
- Report root `pnpm run check` status separately if still blocked by repo-wide pre-existing formatting/schema issues.
