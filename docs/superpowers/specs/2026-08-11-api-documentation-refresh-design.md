# Interactive API Documentation Refresh — Design

## Goal

Refresh Wago's README and Astro documentation so a developer can understand, integrate, and troubleshoot the public HTTP API without reading backend source code. The API documentation must stay faithful to the current `main` implementation, especially the newly added structured audit API, while remaining concise enough for an OSS project.

The central UX change is a **Hybrid API Explorer**: every documented endpoint can generate request examples, and selected endpoints can optionally execute a live request against a user-supplied Wago instance.

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

If docs and code disagree, the code wins and the docs must be corrected.

## Documentation Information Architecture

The Astro documentation should teach Wago in the order an external application actually uses it:

1. **Overview**
   - what Wago is
   - supported scope
   - architecture summary
   - unofficial Baileys disclaimer

2. **Getting Started**
   - deployment assumption
   - first-run bootstrap or pre-provisioned API key
   - pair WhatsApp
   - allow a recipient
   - send a first text message
   - inspect message status

3. **Authentication**
   - Bearer API key for external clients
   - HttpOnly cookie for the control dashboard
   - generated API-key behavior
   - why API keys belong in backend/server environments, not browser application code

4. **API Reference**
   - endpoint catalog
   - request/response contracts
   - query/path/header parameters
   - endpoint-specific errors
   - Hybrid API Explorer

5. **Outbound Messaging**
   - explicit allowlist requirement
   - opt-out behavior
   - idempotency
   - `202 pending` semantics
   - retained `pending | accepted | rejected` message state
   - local safety guardrails vs WhatsApp guarantees

6. **WhatsApp Session and Account Health**
   - pair/status/QR/rebind lifecycle
   - `reachoutTimeLock`
   - new-chat cap/warnings
   - connected state vs messaging health

7. **Audit and Operations**
   - Wago vs Baileys audit source
   - filtering
   - cursor pagination
   - retention boundary
   - sensitive-data sanitization
   - health/readiness endpoints

8. **Deployment and Configuration**
   - Docker/Compose
   - `/app/data`
   - environment variables
   - reverse proxy/TLS expectation

9. **Development / OSS**
   - local development
   - checks/tests/builds
   - contribution links

The existing bilingual `/en` and `/id` route structure remains. Shared Astro components should continue receiving `lang` rather than duplicating full page implementations.

## README Design

`README.md` remains the repository landing page and should not duplicate the full API reference.

It should answer five questions quickly:

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
- **External Application Quick Start** with:
  - `Authorization: Bearer <API_KEY>`
  - allow recipient once
  - send text
  - optional status lookup
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

The explorer should help two types of users:

- developers learning the contract who only need generated examples
- operators/developers testing their own Wago instance directly from the documentation

It replaces the current fixed `CodePlayground` with a structured endpoint-aware explorer.

### Interaction Model

The explorer contains:

- **Base URL** input, default `http://localhost:3000`
- **API key** input for protected endpoints
- endpoint selector grouped by domain
- method and path display
- path-parameter inputs when required
- query-parameter inputs when supported
- JSON body editor/fields for body endpoints
- generated request tabs:
  - cURL
  - JavaScript `fetch`
  - Python `requests`
  - Node.js native `fetch`
- copy button
- optional **Send Request** button
- response panel with:
  - HTTP status
  - elapsed time
  - content type
  - pretty JSON when possible
  - raw text fallback
- clear/reset response action

### Endpoint Metadata

The explorer should use a typed local endpoint catalog instead of hard-coded one-off snippets. Each endpoint descriptor contains only documentation/runtime metadata, for example:

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

The catalog is documentation metadata only. It does not become a generated API client and does not introduce OpenAPI as a new project dependency.

### Endpoint Coverage

The catalog must cover the real public routes:

#### System

- `GET /health`
- `GET /ready`

#### Application bootstrap

- `GET /app/info`
- `POST /app/bootstrap`

#### WhatsApp session

- `GET /whatsapp/status`
- `GET /whatsapp/qr`
- `GET /whatsapp/qr/image`
- `POST /whatsapp/pair`
- `POST /whatsapp/rebind`

#### Recipients

- `GET /recipients`
- `POST /recipients/allow`
- `POST /recipients/:phone/opt-out`

#### Messaging

- `POST /messages/send`
- `GET /messages/:id/status`

#### Audit

- `GET /activity`
  - `source=wago|baileys`
  - `category=system|security|connection|recipient|messaging`
  - `level=info|success|warning|error`
  - `q=<search>`
  - `before=<cursor>`
  - `limit=<number>`

### Live Request Safety

The docs site must never proxy or store API requests. Live requests are sent **directly from the user's browser to the Base URL they entered**.

Rules:

- API key is kept only in React component state by default.
- Do not use `localStorage` for the API key.
- Do not print the API key in rendered response/log panels.
- Generated snippets may show `YOUR_API_KEY` by default rather than echoing the real secret.
- The actual live request may use the entered key in the `Authorization` header.
- Never put the API key in a URL/query string.
- Do not persist request/response history.
- Do not send telemetry containing request bodies, headers, phone numbers, message text, or responses.
- When the docs origin differs from Wago, live execution may fail unless the Wago instance's CORS configuration allows that docs origin. The UI must explain this clearly rather than treating it as an API failure.

### Destructive / State-Changing Actions

All POST endpoints are state-changing and must be visually distinguished from GET requests.

The following endpoints require a confirmation step before live execution:

- `POST /app/bootstrap`
- `POST /whatsapp/pair`
- `POST /whatsapp/rebind`
- `POST /recipients/allow`
- `POST /recipients/:phone/opt-out`
- `POST /messages/send`

`/whatsapp/rebind` receives a stronger warning because it clears the current binding/auth state before pairing a replacement account.

The explorer does **not** invent a dry-run mode because the backend does not support one.

## API Documentation Contract

### Authentication

Protected endpoints use:

```http
Authorization: Bearer <API_KEY>
```

The dashboard may authenticate with the bootstrap HttpOnly cookie, but external applications should use the Bearer header.

### App Bootstrap

Document that first-run bootstrap:

- can accept a `wa_...` API-key candidate
- is constrained by production origin rules
- persists only the server-side credential representation required by Wago
- returns the raw generated/candidate key to the caller for use by the operator/client
- should not be used as a recurring key-rotation endpoint

### Recipient Policy

Before outbound text sending, a recipient must be explicitly allowed and not opted out.

Document the lifecycle:

```text
consent/permission
    -> POST /recipients/allow
    -> POST /messages/send as needed
    -> POST /recipients/:phone/opt-out when permission is withdrawn
```

Inbound traffic must not be documented as an implemented consent mechanism because inbound messaging is not implemented yet.

### Message Send Semantics

`POST /messages/send` returning `202` with `status: "pending"` means the gateway accepted the outbound operation. It is not a delivery/read receipt.

The currently documented retained states are:

- `pending`
- `accepted`
- `rejected`

The docs must not claim `delivered`, `read`, or `played` status support.

### Idempotency

Document both supported forms:

- `Idempotency-Key` request header
- `idempotencyKey` body field

The header takes precedence when both are present.

Examples should favor the header.

### Account Health

`GET /whatsapp/status` should be documented as returning three categories of information:

- connection state
- persistent account binding
- account-health snapshot

Account-health fields should be explained as WhatsApp/Baileys-provided signals Wago uses defensively, not as a guarantee that a send is safe or that an account cannot be restricted.

### Audit API

The updated docs must reflect the current audit backend rather than the older simple activity-list description.

`GET /activity` supports:

- source filtering (`wago`, `baileys`)
- category filtering
- level filtering
- text search
- cursor pagination
- bounded `limit`

The response may include `nextCursor` when another page is available.

The operations documentation must explain that persisted Baileys audit data is sanitized and is intentionally not a raw protocol dump.

## Error Documentation

Errors should be documented in two layers:

1. **Common error model**

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable message"
}
```

2. **Endpoint-specific error tables** where they matter.

The API docs should at minimum cover the implemented families already exposed/documented, including:

- invalid request/input
- authentication failures
- recipient policy failures
- duplicate/idempotency conflicts
- phone not registered
- rate/reach-out restrictions
- WhatsApp disconnected
- outbound paused
- message rejected
- payload too large
- invalid audit filter/cursor

Do not fabricate retry timing when the backend does not expose one in the HTTP response.

## Rate and Safety Documentation

The docs must distinguish:

- HTTP route request limit
- Wago outbound policy windows
- WhatsApp account-health/reach-out signals

Current local guardrails should be described as **Wago defaults**, not official WhatsApp safe limits.

The docs must also retain the explicit statement that Baileys is unofficial and Wago cannot guarantee ban/restriction prevention.

## Documentation Components

Expected focused component structure:

```text
docs/src/components/api/
  ApiExplorer.tsx
  endpoint-catalog.ts
  request-builder.ts
  response-format.ts
  types.ts

docs/src/components/docs/
  ApiDoc.astro
  AuthenticationDoc.astro        (only if useful after content consolidation)
  ...existing shared docs components
```

Exact file count may be reduced if a dedicated file would contain only trivial code. Avoid a single oversized interactive component containing catalog data, request serialization, UI state, and response formatting together.

Existing `CodeBlock`, `Callout`, `PageHeader`, and docs layout components should be reused where appropriate.

## Visual Design

Stay consistent with the existing dark docs UI rather than redesigning the site.

The API explorer should visually emphasize:

- method badge (`GET`, `POST`)
- endpoint path
- authentication requirement
- generated-code tabs
- state-changing action warning
- request/response separation
- response status and latency

No heavy component library should be added.

## Bilingual Content

All user-facing explorer controls and API explanations need English and Indonesian labels through the existing `lang` prop pattern.

Technical identifiers remain unchanged:

- route paths
- JSON keys
- HTTP headers
- error codes
- enum values

Translations should explain them rather than translate identifiers.

## Testing Strategy

### Documentation build

Run:

```bash
pnpm --dir docs run build
```

This is the minimum hard gate for Astro integration.

### Interactive explorer tests

Add focused frontend-style tests in the docs package for pure request-building logic and the interactive component when the existing docs test setup supports it. At minimum test:

- protected endpoint adds Bearer auth only to the actual live request
- generated safe snippets use `YOUR_API_KEY` rather than leaking entered key
- path parameters are URL-encoded
- query parameters omit empty values
- JSON body contains only applicable fields
- idempotency header generation/example behavior
- GET requests do not send JSON body
- response formatter handles JSON and plain text
- live-mode confirmation is required for state-changing endpoints

If the docs package currently has no component-test runner, add only the smallest existing-compatible test tooling; do not introduce Playwright solely for this feature.

### Documentation/code consistency review

Before completion, compare the documented endpoint catalog with all backend route files and verify:

- every public route appears exactly once in the API reference
- every listed route exists in backend code
- auth classification matches middleware
- query/body/path parameters match implementation
- error examples are not invented

## README Verification

README examples must use the same endpoint names and semantics as the API catalog.

The external integration quick start must show:

```text
POST /recipients/allow
POST /messages/send
GET  /messages/:id/status   # optional
```

and explain that recipient allow should normally happen when the external application records real permission/consent, not before every message.

## Non-Goals

This documentation refresh will not:

- add or change backend API routes
- implement inbound messaging
- implement webhooks
- implement media messaging
- add OpenAPI/Swagger generation
- create an SDK package
- add OAuth or user accounts
- make the docs server proxy API calls
- store users' Wago API keys
- attempt CORS bypasses
- add anti-detection/ban-bypass guidance
- redesign the control dashboard

## Completion Criteria

The refresh is complete when:

- README accurately describes the current product and server-to-server integration path.
- API reference includes all current endpoints, including the new audit filters/cursor behavior.
- A developer can generate cURL, JavaScript, Python, and Node.js examples for each endpoint.
- A developer can optionally execute supported requests directly against their own Wago instance from the docs browser UI.
- State-changing live calls require explicit confirmation.
- Entered API keys are not persisted or displayed in generated examples/responses.
- English and Indonesian documentation remain functionally equivalent.
- Docs build/tests pass.
- No backend/frontend runtime behavior is changed as part of this documentation-only milestone.
