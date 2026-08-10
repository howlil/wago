# Interactive API Documentation Refresh — Design

## Goal

Refresh Wago's README and Astro documentation so a developer can understand, integrate, and troubleshoot the public HTTP API without reading backend source code. The API documentation must stay faithful to the current implementation, especially the structured audit API, while remaining concise enough for an OSS project.

The central UX change is a **Hybrid API Explorer**: every documented endpoint can generate request examples, and selected endpoints can optionally execute a live request against a user-supplied Wago instance.

## Repository Boundary

This file is an internal engineering design and therefore belongs under `.agent/specs/`.

Repository roles are intentionally separated:

- `docs/` = public Astro documentation read by Wago users.
- `.agent/specs/` = approved engineering designs.
- `.agent/plans/` = detailed implementation plans/checkpoints for coding agents.
- root `plan.md` = concise milestone roadmap and status ledger.

Agent workflow text, unfinished implementation details, and speculative requirements must not be placed in public `docs/` content.

## Product Boundary

This documentation describes Wago as it exists today:

- one Wago process
- one WhatsApp account per instance
- protected HTTP API
- React control dashboard
- Baileys-backed WhatsApp session
- SQLite durable application state
- text-only outbound messaging
- recipient allow/opt-out policy
- account-health and outbound-safety controls
- structured Wago/Baileys audit events

The docs must not imply support for capabilities that are not implemented, including inbound messages, webhooks, media messaging, groups, broadcast/campaign features, multi-session, multi-tenant, or ban-prevention guarantees.

## Source of Truth

Documentation must be derived from the current backend and frontend contracts, not from stale prose. The primary code sources are:

- `backend/src/routes/app.routes.ts`
- `backend/src/routes/whatsapp.routes.ts`
- `backend/src/routes/recipient.routes.ts`
- `backend/src/routes/message.routes.ts`
- `backend/src/routes/activity.routes.ts`
- `backend/src/policy/outbound-policy.ts`
- `backend/src/whatsapp/account-health.ts`
- `backend/src/whatsapp/message-status-store.ts`
- `frontend/src/api.ts`

If docs and code disagree, the code wins and the public docs must be corrected.

## Documentation Information Architecture

The Astro documentation should teach Wago in the order an external application actually uses it:

1. **Overview** — what Wago is, current supported scope, architecture summary, unofficial Baileys disclaimer.
2. **Getting Started** — deployment assumption, bootstrap/pre-provisioned key, pair WhatsApp, allow recipient, send first text, inspect status.
3. **Authentication** — Bearer API key for external clients, HttpOnly cookie for dashboard, generated-key behavior, server-side secret handling.
4. **API Reference** — endpoint catalog, request/response contracts, parameters, errors, Hybrid API Explorer.
5. **Outbound Messaging** — allowlist, opt-out, idempotency, `202 pending`, retained `pending | accepted | rejected`, safety guardrails.
6. **WhatsApp Session and Account Health** — pair/status/QR/rebind lifecycle, reach-out time-lock, new-chat cap/warnings.
7. **Audit and Operations** — Wago/Baileys audit source, filtering, cursor pagination, retention, sanitization, health/readiness.
8. **Deployment and Configuration** — Docker/Compose, `/app/data`, environment, reverse proxy/TLS.
9. **Development / OSS** — local development, checks/tests/builds, contribution links.

The existing bilingual `/en` and `/id` structure remains. Shared Astro components should continue receiving `lang` rather than duplicating full page implementations.

## README Design

`README.md` remains the repository landing page and should not duplicate the full API reference.

It should answer quickly:

1. What is Wago?
2. What does it support today?
3. How do I run it?
4. How do I call it from another application?
5. Where is the complete documentation?

Recommended README flow:

- badges
- product statement + unofficial-client warning
- concise feature matrix
- architecture diagram
- Docker quick start
- External Application Quick Start
- compact API endpoint table
- persistence/security boundaries
- docs/development/contributing links

The README must explicitly show the correct server-to-server integration pattern:

```text
Browser frontend
      |
      v
Application backend
      |
      | Bearer WAGO_API_KEY
      v
Wago
      |
      v
WhatsApp
```

The README must warn against embedding a Wago API key in a public React/browser frontend.

## Hybrid API Explorer

### Purpose

The explorer serves developers learning the contract and operators/developers testing their own Wago instance.

It replaces the current fixed `CodePlayground` with a structured endpoint-aware explorer.

### Interaction Model

The explorer contains:

- Base URL input, default `http://localhost:3000`
- API key input for protected endpoints
- endpoint selector grouped by domain
- method/path/auth display
- path-parameter inputs
- query-parameter inputs
- body fields/JSON input for body endpoints
- generated cURL, JavaScript `fetch`, Python `requests`, and Node.js native `fetch`
- copy action
- optional **Send Request** action
- response panel with HTTP status, elapsed time, content type, pretty JSON/raw fallback
- clear/reset response action

### Endpoint Metadata

Use a typed local catalog instead of one-off snippets:

```ts
type ApiEndpoint = {
  id: string;
  group: "system" | "app" | "whatsapp" | "recipients" | "messages" | "audit";
  method: "GET" | "POST";
  path: string;
  auth: "public" | "api-key" | "first-run";
  description: { en: string; id: string };
  pathParams?: ApiField[];
  queryParams?: ApiField[];
  bodyFields?: ApiField[];
  headers?: ApiField[];
  liveMode: "safe" | "confirm";
};
```

The catalog is documentation metadata only. It is not a generated SDK and does not introduce OpenAPI as a dependency.

### Endpoint Coverage

System:

- `GET /health`
- `GET /ready`

Application:

- `GET /app/info`
- `POST /app/bootstrap`

WhatsApp:

- `GET /whatsapp/status`
- `GET /whatsapp/qr`
- `GET /whatsapp/qr/image`
- `POST /whatsapp/pair`
- `POST /whatsapp/rebind`

Recipients:

- `GET /recipients`
- `POST /recipients/allow`
- `POST /recipients/:phone/opt-out`

Messaging:

- `POST /messages/send`
- `GET /messages/:id/status`

Audit:

- `GET /activity`
- filters: `source`, `category`, `level`, `q`, `before`, `limit`

### Live Request Safety

The documentation server must never proxy/store explorer requests. Live requests are sent directly from the browser to the Base URL entered by the user.

Rules:

- API key stays in React component memory; no `localStorage`.
- Never print the entered key in response/log panels.
- Generated snippets use `YOUR_API_KEY`, not the real secret.
- Actual live request may use the entered key only in `Authorization: Bearer ...`.
- Never put API key in a URL/query string.
- Do not persist request/response history.
- Do not send telemetry containing request bodies, auth headers, phone numbers, message text, or responses.
- Cross-origin live requests may fail unless the Wago instance allows the docs origin; explain this as a CORS condition.

### State-Changing Actions

All POST endpoints are state-changing and visually distinct. Live execution requires confirmation for:

- `POST /app/bootstrap`
- `POST /whatsapp/pair`
- `POST /whatsapp/rebind`
- `POST /recipients/allow`
- `POST /recipients/:phone/opt-out`
- `POST /messages/send`

`/whatsapp/rebind` receives the strongest warning because it replaces the current binding/session state.

The explorer does not invent a dry-run mode.

## API Contract Documentation

### Authentication

Protected endpoints use:

```http
Authorization: Bearer <API_KEY>
```

The dashboard may authenticate with the bootstrap HttpOnly cookie, but external applications should use the Bearer header.

### App Bootstrap

Document that first-run bootstrap can accept a `wa_...` candidate, is constrained by production origin rules, persists only the server-side credential representation required by Wago, returns the raw key to the operator/caller, and is not a recurring key-rotation endpoint.

### Recipient Policy

Before outbound text sending, a recipient must be explicitly allowed and not opted out.

```text
consent/permission
    -> POST /recipients/allow
    -> POST /messages/send as needed
    -> POST /recipients/:phone/opt-out when permission is withdrawn
```

Inbound traffic must not be documented as implemented consent because inbound messaging is not implemented.

### Message Semantics

`POST /messages/send` returning `202` with `status: "pending"` means Wago accepted the outbound operation. It is not a delivery/read receipt.

Current retained states:

- `pending`
- `accepted`
- `rejected`

Do not claim `delivered`, `read`, or `played` support.

### Idempotency

Document both `Idempotency-Key` header and `idempotencyKey` body field; header takes precedence. Examples favor the header.

### Account Health

`GET /whatsapp/status` documents connection state, persistent binding, and account-health snapshot. Account-health values are defensive signals, not a guarantee that an account cannot be restricted.

### Audit API

`GET /activity` supports source/category/level filtering, text search, cursor pagination, bounded limit, and optional `nextCursor`. Persisted Baileys audit metadata is sanitized and intentionally not a raw protocol dump.

## Error Documentation

Document the common model:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable message"
}
```

Then document endpoint-specific errors where relevant, including invalid input, auth failures, recipient policy failures, duplicate/idempotency conflicts, unregistered phone, rate/reach-out restrictions, WhatsApp disconnected, outbound paused, message rejection, payload too large, invalid audit filter, and invalid cursor.

Do not fabricate retry timing when the HTTP API does not expose it.

## Rate and Safety Documentation

Distinguish HTTP route limits, Wago outbound policy windows, and WhatsApp account-health/reach-out signals. Numeric values are Wago-local defaults, not official WhatsApp safe limits. Retain the explicit statement that Wago/Baileys cannot guarantee ban/restriction prevention.

## Component Structure

Expected focused structure:

```text
docs/src/components/api/
  ApiExplorer.tsx
  endpoint-catalog.ts
  request-builder.ts
  response-format.ts
  types.ts

docs/src/components/docs/
  ApiDoc.astro
  ...existing shared docs components
```

Reduce file count if a file would be trivial. Avoid one oversized explorer containing metadata, serialization, execution, state, and formatting together.

Reuse existing docs layout, `CodeBlock`, `Callout`, and `PageHeader` where appropriate. Do not add a heavy UI library.

## Bilingual Content

All user-facing explorer labels and API explanations must support English and Indonesian through the existing `lang` pattern. Technical identifiers—paths, JSON keys, headers, errors, enum values—remain unchanged.

## Testing Strategy

Minimum hard gate:

```bash
pnpm --dir docs run build
```

Add the smallest compatible test tooling for pure explorer logic. Prefer Vitest already used elsewhere in the repository; do not add Playwright solely for this docs feature.

Test at minimum:

- protected live request adds Bearer auth
- generated snippets use `YOUR_API_KEY`
- path params URL-encode values
- empty query params are omitted
- bodies contain only applicable values
- idempotency header behavior
- GET does not send JSON body
- JSON/plain-text response formatting
- state-changing endpoint metadata requires confirmation

Before completion compare the endpoint catalog against all backend route files and verify route existence, auth classification, parameters, and documented errors.

## Non-Goals

This refresh will not add/change backend API routes, implement inbound messaging/webhooks/media, add Swagger/OpenAPI generation, create an SDK, add OAuth/users, proxy API calls through the docs server, persist users' API keys, bypass CORS, add anti-detection guidance, or redesign the control dashboard.

## Completion Criteria

Complete when README accurately explains current product/server-to-server integration; API reference covers every current route including audit filters/cursor; developers can generate cURL/JS/Python/Node examples and optionally execute requests against their own instance; POST live calls require confirmation; API keys are not persisted/leaked; EN/ID are functionally equivalent; docs tests/build pass; and no backend/frontend runtime behavior changes are introduced by this documentation-only milestone.
