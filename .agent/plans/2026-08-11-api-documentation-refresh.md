# Interactive API Documentation Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Wago's README and public Astro site into a professional, bilingual API guide with an endpoint-aware Hybrid API Explorer that can generate safe code samples and optionally execute requests directly against a user-supplied Wago instance.

**Architecture:** Keep the public documentation inside `docs/` and all internal planning artifacts inside `.agent/`. Build the explorer from a typed endpoint catalog plus pure request/response helpers, then render it as a React island inside the existing Astro API page. Live requests go browser → user-entered Wago Base URL directly; the docs server never proxies or stores secrets or payloads.

**Tech Stack:** Astro 7, React 19, TypeScript 7, Tailwind CSS 4, native `fetch`, Vitest 4.1.10 for focused docs logic tests, existing Biome root checks.

## Global Constraints

- `docs/` is public user-facing documentation only.
- Internal agent specs/plans/checkpoints belong under `.agent/`.
- Do not change backend or frontend runtime behavior in this milestone.
- Do not add OpenAPI/Swagger, an SDK, a proxy service, Playwright, or a heavy UI/component library.
- Keep the existing bilingual English/Indonesian route model and `lang` prop pattern.
- Never persist the API key in `localStorage`, IndexedDB, cookies, URL parameters, telemetry, or docs-server state.
- Generated snippets must use `YOUR_API_KEY`; the real entered API key is used only for the live `Authorization` header.
- All POST live requests require explicit confirmation; `/whatsapp/rebind` gets the strongest warning.
- The API catalog must describe only routes that exist in backend code.
- Do not claim inbound messages, webhooks, media, groups, delivery/read receipts, multi-session, multi-tenant, or ban-prevention guarantees.
- `202 pending` means the gateway accepted the outbound operation; it is not proof of delivery/read.
- Numeric outbound limits are Wago-local guardrails, not official WhatsApp safe thresholds.

---

### Task 1: Enforce the Agent/Public Documentation Boundary

**Files:**
- Modify: `AGENTS.md`
- Keep: `.agent/README.md`
- Keep: `.agent/specs/2026-08-11-api-documentation-refresh-design.md`
- Keep: `.agent/plans/2026-08-11-api-documentation-refresh.md`
- Delete: `docs/superpowers/specs/2026-08-11-api-documentation-refresh-design.md`
- Modify: `plan.md`

**Interfaces:**
- Consumes: repository planning convention defined in `.agent/README.md`.
- Produces: one repository-wide rule: public docs in `docs/`; agent artifacts in `.agent/`.

- [ ] **Step 1: Add an agent-workspace rule to `AGENTS.md`**

Add a concise repository rule equivalent to:

```md
## Agent Workspace

- `docs/` is exclusively the public Astro documentation site.
- Put agent design specs, implementation plans, audit notes, and execution checkpoints under `.agent/`.
- Use `.agent/specs/YYYY-MM-DD-<topic>-design.md` for approved designs.
- Use `.agent/plans/YYYY-MM-DD-<topic>.md` for implementation plans.
- Keep root `plan.md` as the concise engineering roadmap/ledger; link to `.agent/` for detailed task plans.
```

- [ ] **Step 2: Remove the misplaced internal spec from public docs**

Run:

```bash
git rm docs/superpowers/specs/2026-08-11-api-documentation-refresh-design.md
```

Expected: no planning/spec file remains under `docs/superpowers/`.

- [ ] **Step 3: Add a concise Milestone 6 entry to root `plan.md`**

The root roadmap entry must state:

```md
## Milestone 6: Public Documentation and Hybrid API Explorer

**Status:** planned.

Boundary:
- `docs/` is public product documentation only.
- `.agent/` stores agent specs/plans/checkpoints.

Detailed design: `.agent/specs/2026-08-11-api-documentation-refresh-design.md`
Detailed implementation plan: `.agent/plans/2026-08-11-api-documentation-refresh.md`

Planned scope:
- resync README/public docs to actual FE/BE contracts;
- add bilingual Hybrid API Explorer;
- document external server-to-server integration, auth, recipient consent, message status, account health, audit filters/cursors, errors, and local safety limits;
- keep runtime backend/frontend behavior unchanged.
```

- [ ] **Step 4: Verify the boundary**

Run:

```bash
find docs -type f | grep -E 'superpowers|agent|plan|spec' && exit 1 || true
find .agent -maxdepth 3 -type f -print
```

Expected: no internal planning artifact under `docs/`; `.agent/README.md`, spec, and plan are present.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md plan.md .agent docs/superpowers

git commit -m "docs(agent): separate public docs from agent workspace"
```

Acceptance:
- Public `docs/` and internal `.agent/` responsibilities are explicit.
- Root roadmap points to the detailed design/plan instead of duplicating them.

---

### Task 2: Add Typed API Endpoint Catalog and Minimal Docs Test Harness

**Files:**
- Create: `docs/src/components/api/types.ts`
- Create: `docs/src/components/api/endpoint-catalog.ts`
- Create: `docs/src/components/api/endpoint-catalog.test.ts`
- Modify: `docs/package.json`
- Modify: `docs/pnpm-lock.yaml`

**Interfaces:**
- Produces: `ApiEndpoint`, `ApiField`, `apiEndpoints`, `getEndpointById()`, `requiresLiveConfirmation()`.

- [ ] **Step 1: Add Vitest using the version already used by the backend**

Change `docs/package.json` scripts/dev dependencies to include:

```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^4.1.10"
  }
}
```

Run:

```bash
pnpm --dir docs install
```

Expected: `docs/pnpm-lock.yaml` updates with Vitest and no Playwright/jsdom dependency is required for pure helper tests.

- [ ] **Step 2: Define endpoint metadata types**

Create `types.ts` with the concrete contract:

```ts
export type ApiLanguage = "en" | "id";
export type ApiMethod = "GET" | "POST";
export type ApiAuth = "public" | "api-key" | "first-run";
export type ApiGroup = "system" | "app" | "whatsapp" | "recipients" | "messages" | "audit";
export type ApiFieldLocation = "path" | "query" | "header" | "body";

export type ApiField = {
  key: string;
  location: ApiFieldLocation;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  description: Record<ApiLanguage, string>;
};

export type ApiEndpoint = {
  id: string;
  group: ApiGroup;
  method: ApiMethod;
  path: string;
  auth: ApiAuth;
  title: Record<ApiLanguage, string>;
  description: Record<ApiLanguage, string>;
  fields: ApiField[];
  liveMode: "safe" | "confirm";
  danger?: "normal" | "high";
};
```

- [ ] **Step 3: Write the failing catalog test**

Test exact route coverage:

```ts
import { describe, expect, it } from "vitest";
import { apiEndpoints, requiresLiveConfirmation } from "./endpoint-catalog";

const routes = [
  "GET /health",
  "GET /ready",
  "GET /app/info",
  "POST /app/bootstrap",
  "GET /activity",
  "GET /recipients",
  "POST /recipients/allow",
  "POST /recipients/:phone/opt-out",
  "GET /whatsapp/status",
  "GET /whatsapp/qr",
  "GET /whatsapp/qr/image",
  "POST /whatsapp/pair",
  "POST /whatsapp/rebind",
  "POST /messages/send",
  "GET /messages/:id/status",
];

it("contains every current public route exactly once", () => {
  const actual = apiEndpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`);
  expect(actual.sort()).toEqual([...routes].sort());
  expect(new Set(actual).size).toBe(actual.length);
});

it("requires confirmation for every POST endpoint", () => {
  expect(apiEndpoints.filter((e) => e.method === "POST").every(requiresLiveConfirmation)).toBe(true);
});
```

- [ ] **Step 4: Run test and verify RED**

```bash
pnpm --dir docs test -- endpoint-catalog.test.ts
```

Expected: FAIL because catalog implementation does not exist.

- [ ] **Step 5: Implement the endpoint catalog**

Include exact metadata for all routes. `GET /activity` fields must include `source`, `category`, `level`, `q`, `before`, `limit`; `POST /messages/send` must include `to`, `text`, and `Idempotency-Key`; `/whatsapp/rebind` must use `danger: "high"`.

- [ ] **Step 6: Run tests and build**

```bash
pnpm --dir docs test
pnpm --dir docs run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add docs/package.json docs/pnpm-lock.yaml docs/src/components/api

git commit -m "feat(docs): define typed Wago API catalog"
```

---

### Task 3: Build Safe Request, Snippet, and Response Helpers

**Files:**
- Create: `docs/src/components/api/request-builder.ts`
- Create: `docs/src/components/api/request-builder.test.ts`
- Create: `docs/src/components/api/response-format.ts`
- Create: `docs/src/components/api/response-format.test.ts`

**Interfaces:**
- Consumes: `ApiEndpoint` catalog metadata.
- Produces:

```ts
export type ExplorerValues = Record<string, string>;
export type BuiltRequest = { url: string; init: RequestInit };

export function buildLiveRequest(input: {
  endpoint: ApiEndpoint;
  baseUrl: string;
  apiKey: string;
  values: ExplorerValues;
}): BuiltRequest;

export function buildSnippet(input: {
  endpoint: ApiEndpoint;
  baseUrl: string;
  values: ExplorerValues;
  language: "curl" | "javascript" | "python" | "nodejs";
}): string;

export async function formatExplorerResponse(response: Response): Promise<{
  contentType: string;
  body: string;
}>;
```

- [ ] **Step 1: Write request-builder RED tests**

Cover:

```ts
it("URL-encodes path parameters", ...);
it("omits blank query parameters", ...);
it("adds Bearer auth only to live protected requests", ...);
it("never emits the real API key in generated snippets", ...);
it("does not attach a JSON body to GET", ...);
it("uses Idempotency-Key header for message send", ...);
```

Use an entered secret like `wa_super_secret` and assert generated snippets contain `YOUR_API_KEY` and never contain `wa_super_secret`.

- [ ] **Step 2: Verify RED**

```bash
pnpm --dir docs test -- request-builder.test.ts
```

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement request building**

Rules:

```ts
const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
const headers = new Headers();

if (endpoint.auth === "api-key" && apiKey.trim()) {
  headers.set("Authorization", `Bearer ${apiKey.trim()}`);
}

if (endpoint.method === "POST" && hasBody) {
  headers.set("Content-Type", "application/json");
}
```

Path placeholders must be replaced with `encodeURIComponent(value)`. Empty optional query/body values are omitted. `Idempotency-Key` is a header, not a JSON field in generated default examples.

- [ ] **Step 4: Implement safe snippets**

Generated code uses `YOUR_API_KEY` whenever auth is required. Never interpolate the actual `apiKey` argument into snippets.

- [ ] **Step 5: Write and implement response-format tests**

Test JSON response pretty printing and text fallback:

```ts
expect(result.body).toContain('"success": true');
expect(textResult.body).toBe("service unavailable");
```

- [ ] **Step 6: Run tests/build/check**

```bash
pnpm --dir docs test
pnpm --dir docs run build
pnpm check
```

- [ ] **Step 7: Commit**

```bash
git add docs/src/components/api

git commit -m "feat(docs): add safe API request builders"
```

---

### Task 4: Replace Fixed CodePlayground with Hybrid API Explorer

**Files:**
- Create: `docs/src/components/api/ApiExplorer.tsx`
- Modify: `docs/src/components/docs/ApiDoc.astro`
- Delete: `docs/src/components/CodePlayground.tsx` after migration if no other import remains

**Interfaces:**
- Consumes: `apiEndpoints`, request/snippet/response helpers.
- Produces: `<ApiExplorer lang="en" | "id" />` React island.

- [ ] **Step 1: Implement explorer state without secret persistence**

Use component state only:

```ts
const [baseUrl, setBaseUrl] = useState("http://localhost:3000");
const [apiKey, setApiKey] = useState("");
const [endpointId, setEndpointId] = useState(apiEndpoints[0].id);
const [values, setValues] = useState<Record<string, string>>({});
const [response, setResponse] = useState<ExplorerResponse | null>(null);
```

Do not call `localStorage`, `sessionStorage`, `document.cookie`, or analytics APIs.

- [ ] **Step 2: Render endpoint-aware request form**

Render method badge, path, auth badge, bilingual description, dynamic fields, code tabs, and copy action. Group selector options by endpoint domain.

- [ ] **Step 3: Add live execution with explicit POST confirmation**

For GET endpoints, `Send Request` executes immediately. For POST endpoints, first click opens an inline confirmation panel/modal. `/whatsapp/rebind` warning explicitly states that current account binding/session will be replaced.

Live execution flow:

```ts
const startedAt = performance.now();
const { url, init } = buildLiveRequest(...);
const res = await fetch(url, init);
const formatted = await formatExplorerResponse(res);
const elapsedMs = Math.round(performance.now() - startedAt);
```

Catch browser/CORS/network failure separately and explain that a docs-origin/Wago-origin mismatch may require matching `CORS_ORIGIN`.

- [ ] **Step 4: Ensure response output cannot echo Authorization headers**

Display only status, latency, content type, and response body. Do not render request headers containing the real API key.

- [ ] **Step 5: Mount in `ApiDoc.astro`**

Replace:

```astro
<CodePlayground lang={lang} client:load />
```

with:

```astro
<ApiExplorer lang={lang} client:load />
```

- [ ] **Step 6: Remove obsolete playground only after import search**

```bash
grep -R "CodePlayground" -n docs/src || true
```

If the only remaining result is the component itself, remove it.

- [ ] **Step 7: Verify**

```bash
pnpm --dir docs test
pnpm --dir docs run build
pnpm check
```

- [ ] **Step 8: Commit**

```bash
git add docs/src/components

git commit -m "feat(docs): add hybrid live API explorer"
```

---

### Task 5: Rewrite the Public API Reference Around Real Integration Flows

**Files:**
- Modify: `docs/src/components/docs/ApiDoc.astro`
- Modify: `docs/src/components/docs/GettingStartedDoc.astro`
- Modify: `docs/src/components/docs/OperationsDoc.astro`
- Modify: `docs/src/components/docs/ConfigurationDoc.astro`
- Modify: `docs/src/components/docs/OverviewDoc.astro`

**Interfaces:**
- Consumes: actual endpoint catalog and backend contract.
- Produces: bilingual public guidance matching current Wago behavior.

- [ ] **Step 1: Restructure API reference sections**

Use this order:

```text
Authentication
Hybrid API Explorer
Endpoint Catalog
External App Flow
Application Bootstrap
WhatsApp Session
Recipients / Consent
Send Message / Idempotency
Message Status
Account Health
Audit Filters / Cursor Pagination
Common Error Model
Endpoint-Specific Errors
Rate Limits / Safety Boundaries
```

- [ ] **Step 2: Correct the audit documentation**

Document `source`, `category`, `level`, `q`, `before`, `limit`, and optional `nextCursor`. Explain that Baileys audit metadata is sanitized and not a packet dump.

- [ ] **Step 3: Make external integration explicit**

Add the server-to-server pattern and state clearly that `WAGO_API_KEY` belongs in the external application's backend environment, not a public React/Vue/browser bundle.

- [ ] **Step 4: Explain recipient permission lifecycle**

Document allow-on-consent, send-many, opt-out-on-withdrawal. Do not tell users to call `/recipients/allow` before every send.

- [ ] **Step 5: Document message status truthfully**

Only `pending | accepted | rejected`. Explain retained status is transient/in-memory and `accepted` is not documented as delivered/read.

- [ ] **Step 6: Update operations/configuration language**

Explain connection health vs account health, audit retention, `/app/data`, CORS implications for live explorer, and reverse-proxy/TLS expectations.

- [ ] **Step 7: Verify bilingual parity**

Because shared components use `lang`, verify every new user-facing sentence has both EN and ID variants; technical identifiers remain unchanged.

- [ ] **Step 8: Build/check**

```bash
pnpm --dir docs run build
pnpm check
```

- [ ] **Step 9: Commit**

```bash
git add docs/src/components/docs

git commit -m "docs(api): document complete external integration flow"
```

---

### Task 6: Rewrite README as the Professional OSS Entry Point

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: concise repository landing page; full API detail remains in Astro docs.

- [ ] **Step 1: Keep the README focused**

Recommended order:

```text
Badges
What Wago Is
Important Unofficial-Client Warning
Feature Matrix
Architecture
Quick Start
External Application Quick Start
API Summary
Outbound Safety
Persistence
Container Images
Documentation
Development / Contributing / Security
```

- [ ] **Step 2: Add external integration quick start**

Show exactly:

```bash
curl -X POST "$WAGO_URL/recipients/allow" \
  -H "Authorization: Bearer $WAGO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone":"6281234567890","label":"Example recipient"}'

curl -X POST "$WAGO_URL/messages/send" \
  -H "Authorization: Bearer $WAGO_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: example-001" \
  -d '{"to":"6281234567890","text":"Hello from Wago"}'
```

Then show optional status lookup using returned `messageId`.

- [ ] **Step 3: Add server-side secret warning**

State that browser frontends should call their own backend, and only that backend should hold `WAGO_API_KEY`.

- [ ] **Step 4: Update feature/API summary to current reality**

Include structured Wago/Baileys audit API and filters; do not list inbound/webhook/media functionality as available.

- [ ] **Step 5: Link prominently to public Astro docs**

README should point users to the full API guide rather than carrying every error/payload table itself.

- [ ] **Step 6: Verify examples against endpoint catalog**

Manually compare README method/path pairs to `endpoint-catalog.ts`.

- [ ] **Step 7: Commit**

```bash
git add README.md

git commit -m "docs(readme): clarify Wago API integration"
```

---

### Task 7: Contract Consistency, Security Review, and Final Documentation Gate

**Files:**
- Review: all `backend/src/routes/*.ts`
- Review: `backend/src/policy/outbound-policy.ts`
- Review: `backend/src/whatsapp/account-health.ts`
- Review: `frontend/src/api.ts`
- Review: `README.md`
- Review: `docs/src/components/api/*`
- Review: `docs/src/components/docs/*`
- Modify only files where review finds an actual mismatch.

**Interfaces:**
- Produces: verified one-to-one documentation/API contract.

- [ ] **Step 1: Route inventory check**

Compare backend routes against catalog. Required exact public inventory:

```text
GET  /health
GET  /ready
GET  /app/info
POST /app/bootstrap
GET  /activity
GET  /recipients
POST /recipients/allow
POST /recipients/:phone/opt-out
GET  /whatsapp/status
GET  /whatsapp/qr
GET  /whatsapp/qr/image
POST /whatsapp/pair
POST /whatsapp/rebind
POST /messages/send
GET  /messages/:id/status
```

Every route must appear once; no invented route is allowed.

- [ ] **Step 2: Auth contract review**

Verify public vs API-key vs first-run classifications match backend middleware. Confirm external examples always use Bearer auth on protected routes.

- [ ] **Step 3: Secret-handling review**

Search for accidental persistence/logging in explorer code:

```bash
grep -R "localStorage\|sessionStorage\|document.cookie" -n docs/src/components/api || true
grep -R "apiKey" -n docs/src/components/api
```

Expected: no persistent browser storage; generated snippets never interpolate the real key.

- [ ] **Step 4: Unsupported-feature wording scan**

Search public docs/README for claims implying implemented webhooks, inbound messages, media, delivery/read receipts, multi-session, or anti-ban guarantees and fix misleading wording.

- [ ] **Step 5: Run complete documentation quality gate**

```bash
pnpm --dir docs test
pnpm --dir docs run build
pnpm check
```

Expected: all green.

- [ ] **Step 6: Run repository regression gate**

Documentation-only changes should not break core packages:

```bash
pnpm test
pnpm build
```

Expected: backend/frontend tests and builds remain green.

- [ ] **Step 7: Review final diff**

Confirm changed runtime code is limited to the public docs package plus README/agent instructions/planning metadata; no backend/frontend behavior change is included.

- [ ] **Step 8: Commit final corrections**

```bash
git add README.md docs AGENTS.md plan.md .agent

git commit -m "docs: finalize interactive API documentation refresh"
```

## Final Acceptance Checklist

- [ ] `docs/` contains only public documentation/site assets, never agent plans/specs.
- [ ] `.agent/` contains the approved design and detailed implementation plan.
- [ ] Root `plan.md` contains only the concise Milestone 6 roadmap entry and links to `.agent/` details.
- [ ] Every current backend route is documented exactly once.
- [ ] Hybrid explorer generates cURL, browser JS, Python, and Node.js examples.
- [ ] Explorer can send direct live requests to a user-entered Wago instance.
- [ ] All POST live actions require confirmation; rebind has high-risk wording.
- [ ] API key is not persisted or exposed by generated snippets/response UI.
- [ ] Audit API documents filters and cursor pagination.
- [ ] README teaches server-to-server integration and keeps API secrets out of browser apps.
- [ ] Public docs do not claim unsupported inbound/webhook/media/delivery-read capabilities.
- [ ] `pnpm --dir docs test`, `pnpm --dir docs run build`, `pnpm check`, `pnpm test`, and `pnpm build` all pass.
