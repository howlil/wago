# Product Landing and Documentation Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Astro homepage into a product-focused developer/self-hoster landing page, keep API Explorer only in API docs, and remove stale configuration guidance from all public documentation.

**Architecture:** Keep the public site fully inside the existing Astro/Tailwind structure. No backend or API behavior changes are required; documentation is derived from current Express configuration, origin middleware, Docker Compose, WhatsApp lifecycle/version resolution, and existing dashboard/API contracts.

**Tech Stack:** Astro 7, Tailwind CSS 4, React only for the existing API Explorer, Node.js test runner, GitHub Actions Docs CI.

## Global Constraints

- Primary audience: developers/self-hosters integrating one Wago instance with an existing application.
- Secondary audience: operators using the bundled React dashboard.
- The Hybrid API Explorer must remain available under `/docs/api` and must not render on `/id` or `/en`.
- Do not add backend behavior, runtime dependencies, or new public API endpoints.
- Do not claim inbound messaging, webhooks, media, groups, delivery/read receipts, multi-session, multi-tenant, campaigns, restriction bypass, or guaranteed ban prevention.
- Remove obsolete `CORS_ORIGIN` and `.env.production.example` guidance.
- Keep English and Indonesian landing pages structurally equivalent.

---

### Task 1: Lock public-surface regression contracts

**Files:**
- Create: `docs/src/components/api/public-surface.test.ts`

**Interfaces:**
- Consumes: current homepage and public documentation source files.
- Produces: source-level regression guards executed by the existing `pnpm --dir docs test` command.

- [ ] **Step 1: Write the failing test**

Create tests that read the relevant Astro/README files and assert:

```ts
assert.doesNotMatch(idHome, /ApiExplorer/);
assert.doesNotMatch(enHome, /ApiExplorer/);
assert.match(idHome, /Deploy/);
assert.match(idHome, /Pair/);
assert.match(idHome, /Integr/);
assert.match(enHome, /Deploy/);
assert.match(enHome, /Pair/);
assert.match(enHome, /Integr/);
assert.doesNotMatch(publicDocs, /CORS_ORIGIN/);
assert.doesNotMatch(readme, /\.env\.production\.example/);
```

- [ ] **Step 2: Run CI to verify RED**

Open a draft PR after the test-only commit so Docs CI runs `pnpm --dir docs test`. Expected result: FAIL because both homepages still import/render `ApiExplorer`, and current README/configuration/deployment/API docs still contain stale configuration guidance.

- [ ] **Step 3: Keep the regression focused**

If the failure is caused by path resolution or test syntax rather than the intended stale behavior, fix only the test harness and rerun until the expected assertions fail.

### Task 2: Replace homepage API playground with product landing

**Files:**
- Modify: `docs/src/pages/id/index.astro`
- Modify: `docs/src/pages/en/index.astro`
- Modify: `docs/src/utils/i18n.ts`

**Interfaces:**
- Consumes: existing `MainLayout`, current route structure, and product capabilities already exposed by backend/frontend.
- Produces: bilingual product-focused homepages with no client-side API Explorer.

- [ ] **Step 1: Remove API Explorer from both homepages**

Delete the `ApiExplorer` import and rendered component from `/id` and `/en` homepages.

- [ ] **Step 2: Build the hero and product visual**

Use static Astro/Tailwind markup. Hero copy must identify Wago as a self-hosted single-account WhatsApp gateway and point to docs/API reference/GitHub. The right-side or below-fold visual should represent actual product concepts such as `Connected`, recipient permission, `accepted` message state, and audit/health cards without pretending to be live data.

- [ ] **Step 3: Add the three-step flow**

Render three explicit stages in both languages:

```text
Deploy -> Pair -> Integrate
```

Indonesian explanatory copy may be localized, but the visible stage labels should retain recognizable `Deploy`, `Pair`, and `Integrate` wording so product navigation and regression checks remain stable.

- [ ] **Step 4: Add capability sections**

Cover only implemented behavior: single-account binding/rebind, protected REST API, recipient allow/opt-out, idempotency, retained message state, account-health signals, structured audit log, SQLite/Baileys persistence, Docker/GHCR distribution, and dashboard controls.

- [ ] **Step 5: Add scope and responsible-use boundaries**

Explain that local guardrails are defensive controls, not official WhatsApp safe limits or ban guarantees. State that Wago uses unofficial Baileys and is not affiliated with WhatsApp/Meta.

- [ ] **Step 6: Add static API teaser and final CTA**

Show a short inert `curl`-style example or request card linking to `/[lang]/docs/api`. Do not add a live form, API key input, fetch call, or React island.

### Task 3: Synchronize README and public docs with runtime

**Files:**
- Modify: `README.md`
- Modify: `docs/src/components/docs/ConfigurationDoc.astro`
- Modify: `docs/src/components/docs/DeploymentDoc.astro`
- Modify: `docs/src/components/docs/ApiDoc.astro`
- Review/modify if necessary: `docs/src/components/docs/GettingStartedDoc.astro`
- Review/modify if necessary: `docs/src/components/docs/OperationsDoc.astro`
- Review/modify if necessary: `docs/src/components/docs/OverviewDoc.astro`

**Interfaces:**
- Consumes: `backend/src/config/index.ts`, `backend/src/config/runtime-paths.ts`, `backend/src/middleware/origin.ts`, `backend/src/app.ts`, `backend/src/routes/*.ts`, `backend/src/whatsapp/wa-version.ts`, `docker-compose.yml`.
- Produces: public instructions consistent with the current runtime.

- [ ] **Step 1: Remove obsolete env setup**

Delete references to `.env.production.example` and `CORS_ORIGIN`. Explain that `API_KEY` is optional: set it to pre-provision a credential, or omit it on a fresh persistent volume and let the dashboard bootstrap a generated credential.

- [ ] **Step 2: Correct origin/security documentation**

Describe the actual production rule:

```text
cookie/bootstrap state-changing browser requests must use HTTPS in production and the request Origin host must match the request Host.
```

Do not claim Wago exposes a configurable CORS allowlist.

- [ ] **Step 3: Correct Docker deployment instructions**

Use the current compose workflow directly:

```bash
docker compose pull
docker compose up -d
curl http://127.0.0.1:3000/health
```

Keep the loopback publish, persistent `wago_data` volume, read-only root filesystem, tmpfs, dropped capabilities, and `no-new-privileges` guidance.

- [ ] **Step 4: Correct API Explorer networking explanation**

State that the explorer sends requests directly from the browser to the base URL supplied by the user. Browser cross-origin restrictions are a property of that deployment/routing setup; the docs server does not proxy requests and Wago itself does not currently provide a `CORS_ORIGIN` configuration knob.

- [ ] **Step 5: Document QR version resolution**

Explain that pairing resolves the current WhatsApp Web version before creating the Baileys socket, with a safe bundled Baileys version fallback when remote resolution fails.

- [ ] **Step 6: Search all public documentation for stale claims**

Check `README.md` and `docs/src/components/docs/*.astro` for `CORS_ORIGIN`, `.env.production.example`, claims of configurable WA version, or claims not supported by current routes/runtime. Remove or correct each occurrence.

### Task 4: GREEN verification and reconciliation

**Files:**
- Modify only files required to fix verified failures.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: a CI-green documentation branch ready for review.

- [ ] **Step 1: Push implementation and inspect Docs CI**

Expected CI commands:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm --dir docs test
pnpm build:docs
```

- [ ] **Step 2: Fix only verified lint/test/build failures**

Do not weaken the new regression tests to make CI green.

- [ ] **Step 3: Re-scan changed public docs**

Confirm no `ApiExplorer` remains on homepage source and no `CORS_ORIGIN` or `.env.production.example` remains in public documentation.

- [ ] **Step 4: Prepare PR summary**

Document the product-positioning change, stale-doc corrections, regression coverage, and CI evidence. Keep the PR focused on docs/public landing only.