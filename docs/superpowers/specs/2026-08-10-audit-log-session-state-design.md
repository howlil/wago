# Audit Log and WhatsApp Session State Design

Date: 2026-08-10
Status: Proposed for implementation
Scope: Wago backend observability, WhatsApp lifecycle state, and frontend navigation

## 1. Goals

This change has two related goals:

1. Provide a dedicated, operator-friendly **Audit Log** page that exposes useful low-level Baileys lifecycle detail without storing raw sensitive protocol payloads.
2. Fix status correctness so the UI never reports outbound/account health as healthy when the WhatsApp session is not actually connected.

The design keeps Wago single-process, single-account, self-hosted, and SQLite-backed. It does not add a log service, queue, Redis, or external observability stack.

## 2. Current problems

### 2.1 Audit data is too high-level

The existing activity log stores curated Wago events, but the Baileys logger is disabled and important socket lifecycle evidence is not persisted in a structured way. This makes cases such as linked-device removal, terminal logout, reconnect loops, and pairing failures difficult to diagnose after the fact.

### 2.2 Session and health state are conflated

The current connection state and account-health cache are independent. `markDisconnected()` clears the QR and connection status, but the account-health snapshot can remain populated. The frontend can therefore render `Outbound: Normal`, `Reach-out: Available`, or `New chats: Normal` even when WhatsApp is disconnected.

### 2.3 Activity is embedded in Control

The operator dashboard currently embeds Activity Log as one of the cards. The requested product boundary is now two pages:

- `/` — Control
- `/audit` — Audit Log

The Control page should contain no activity-log panel.

## 3. Chosen approach

Use a **unified structured audit-event model**.

Baileys events are not persisted raw. Instead, a small adapter converts selected Baileys lifecycle events into:

- a human-readable title and explanation,
- severity and category,
- source (`wago` or `baileys`),
- a stable event code,
- sanitized technical metadata.

This produces enough low-level evidence for debugging while keeping the UI understandable and preventing QR payloads, auth credentials, API keys, message bodies, cookies, tokens, and full JIDs from entering the audit database.

Raw Pino/Baileys debug output will remain disabled by default.

## 4. Architecture

```text
Baileys socket
   |
   +-- connection.update
   +-- creds.update
   +-- messages.update
   +-- account-health fetch/update
   |
   v
Baileys audit adapter
   |
   +-- classify event
   +-- map disconnect reason
   +-- sanitize identifiers
   +-- remove raw payloads
   +-- create friendly summary
   |
   v
Audit service
   |
   v
SQLite activity_events
   |
   v
GET /activity
   |
   v
Audit Log page (/audit)
```

Wago-originated operator events continue to use the same audit service. There is one event timeline rather than separate user and protocol logs.

## 5. Audit event model

The logical event returned by the API becomes:

```ts
type AuditEvent = {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  category: "system" | "security" | "connection" | "recipient" | "messaging";
  source: "wago" | "baileys";
  code: string;
  title: string;
  description: string;
  metadata?: Record<string, string | number | boolean | null>;
};
```

A SQLite migration adds a non-null `source` column with a default of `wago` for existing rows.

### 5.1 Persisted Baileys events

The adapter records only events that have operational value.

#### Socket lifecycle

- `baileys.socket.created`
  - socket generation
  - auth registered: boolean
  - binding state
  - restore vs fresh pairing
- `baileys.connection.qr_ready`
  - socket generation
  - `qrAvailable: true`
  - **never store the QR value**
- `baileys.connection.open`
  - socket generation
  - masked account JID
  - reconnect attempt count
- `baileys.connection.close`
  - socket generation
  - disconnect status code
  - normalized reason
  - terminal/recoverable classification
  - reconnect decision
- `baileys.reconnect.scheduled`
  - attempt
  - delay milliseconds
  - triggering reason
- `baileys.session.invalidated`
  - normalized terminal reason
  - pairing required: true
- `baileys.socket.shutdown`
  - intentional shutdown: true

#### Credentials

- `baileys.credentials.updated`
  - socket generation
  - persistence queued/succeeded/failed state
  - **never store credentials or keys**

Credential updates may happen frequently, so successful updates should be sampled/coalesced. Failures are always persisted.

#### Message lifecycle

- `baileys.message.server_ack`
  - message ID
  - masked recipient JID when available
  - normalized status
- `baileys.message.rejected`
  - message ID
  - mapped rejection reason
  - safe status/stub classification only

No message body, quoted content, raw stub parameters, media metadata, contact data, or incoming-message payload is stored.

#### Account restrictions

- `baileys.account.reachout_timelock`
  - active
  - enforcement type
  - retry timestamp
- `baileys.account.new_chat_cap`
  - capping status
  - used quota
  - total quota
  - cycle timestamps when available
- `baileys.account.health_fetch_failed`
  - error class/name only
  - no raw protocol payload

### 5.2 Events intentionally not persisted

Do not persist raw or high-volume protocol noise such as:

- websocket frames,
- message content,
- full `messages.upsert` payloads,
- presence updates,
- history sync payloads,
- Signal keys,
- auth credentials,
- full phone/JID identifiers,
- raw QR content,
- raw HTTP headers,
- raw Baileys Pino objects.

## 6. Sanitization boundary

Sanitization happens **before** `recordActivity()` receives Baileys metadata.

The existing global `redactLogFields()` remains a second defensive layer, not the primary Baileys sanitizer.

Rules:

- JIDs and phone-like identifiers are masked.
- QR, key, secret, token, cookie, authorization, credential, password, message, text, and payload fields are dropped or redacted.
- Errors are normalized into safe fields such as `name`, `statusCode`, and a short mapped reason; arbitrary serialized error objects are not stored.
- Metadata must remain primitives only. Nested arbitrary protocol objects are rejected by the adapter.

## 7. Retention and query model

The current maximum of 300 events is too small once structured protocol diagnostics are included.

Use a bounded SQLite timeline:

- maximum retained events: **2,000**,
- newest events retained,
- pruning occurs after insertion,
- no message contents are stored, so the expected database footprint remains small.

Enhance the existing authenticated `GET /activity` endpoint rather than introduce a breaking route.

Supported query fields:

```text
GET /activity
  ?limit=100
  &before=<cursor>
  &source=wago|baileys
  &category=connection|messaging|recipient|security|system
  &level=info|success|warning|error
  &q=<search>
```

`before` is an opaque cursor based on timestamp + row identity. Pagination is server-side. The UI must not load all 2,000 rows and filter them in memory.

Indexes should support newest-first pagination plus source/category/level filters. Search can use bounded `LIKE` over title, description, and code; FTS is unnecessary at this scale.

## 8. WhatsApp lifecycle state model

A single boolean `connected` is insufficient for correct UI behavior. Wago should treat these as separate concepts:

```text
Gateway API health
WhatsApp connection state
WhatsApp binding/session validity
WhatsApp account-health snapshot
Outbound availability
```

### 8.1 Connection state

Keep the existing runtime states:

- `connecting`
- `qr`
- `connected`
- `disconnected`

### 8.2 Session validity

Binding/session validity is derived from persistent binding plus lifecycle evidence:

- `unbound` — no account is bound; pairing required.
- `bound` — an account identity is persisted.

A bound account can temporarily be disconnected and reconnectable. A terminal logout invalidates the binding and requires pairing again.

### 8.3 Disconnect classification

Create one central disconnect classifier. It converts Baileys status/error information into:

```ts
type DisconnectClassification = {
  statusCode?: number;
  reason: string;
  terminal: boolean;
  shouldReconnect: boolean;
};
```

Rules:

- `DisconnectReason.loggedOut` is terminal: clear binding/session identity, invalidate account health, do not auto-reconnect, require pairing.
- non-terminal disconnects remain bound, invalidate current account-health visibility, and may reconnect according to the existing backoff policy.
- intentional rebind/shutdown is classified separately so it does not produce misleading recovery actions.

Unknown reasons are treated conservatively as disconnected and health-unavailable; they are logged with safe technical details. They are not silently presented as healthy.

## 9. Account-health invalidation

Introduce an explicit function such as:

```ts
invalidateAccountHealth(reason)
```

It clears current reach-out/new-chat-cap data from the operator-visible snapshot and records why it became unavailable.

Call it when:

- connection closes,
- rebind starts,
- terminal logout occurs,
- shutdown clears the active socket.

A successful `connection=open` triggers a forced health refresh. Until that refresh succeeds, the UI shows health as `Checking`/`Unavailable`, not `Available` or `Normal`.

The account-health snapshot gains availability context, for example:

```ts
type AccountHealthSnapshot = {
  availability: "unavailable" | "checking" | "available";
  unavailableReason?: "not_connected" | "session_invalid" | "fetch_failed";
  reachoutTimeLock?: ...;
  newChatCap?: ...;
  lastFetchedAt?: string;
  lastFetchErrorAt?: string;
};
```

## 10. Outbound status semantics

The overview `Outbound` metric must incorporate connection state first.

Priority:

1. Backend unavailable -> `Unknown`
2. WhatsApp not connected -> `Unavailable`
3. Account health checking/unavailable -> `Checking` or `Unknown`
4. Reach-out timelock/new-chat cap/warning -> appropriate restricted state
5. Otherwise -> `Normal`

Therefore `Outbound: Normal` means **the WhatsApp session is connected and Wago currently knows of no active outbound restriction**.

It must never mean merely "the cached cap fields are empty".

The send endpoint keeps its existing hard check that an active socket must be connected before sending.

## 11. Frontend page architecture

The frontend becomes a real two-page SPA.

Add `react-router-dom` rather than creating a custom history/router abstraction. The production Express fallback already serves `index.html` for unmatched frontend paths, so `/audit` can be refreshed directly.

Routes:

```text
/       -> ControlPage / existing DashboardPage
/audit  -> AuditLogPage
```

### 11.1 Global shell

Rename/generalize `DashboardShell` to `AppShell`.

It owns only:

- sidebar collapse/mobile drawer,
- header layout,
- active route navigation,
- content width.

Page-specific data is passed in through props. The shell must not know WhatsApp domain types.

Header API should support:

```ts
type AppShellProps = {
  title: string;
  children: ReactNode;
  headerStatus?: ...;
  headerAction?: ReactNode;
};
```

Control can provide connection status + Refresh. Audit Log can provide its own Refresh action and no fake connection badge if it is not useful.

### 11.2 Sidebar

Sidebar navigation becomes data-driven and is shared by desktop and mobile variants.

```text
Workspace
  Control      /
  Audit Log    /audit
```

Use `NavLink` active-state semantics. Collapsed sidebar remains icon-only with accessible labels/tooltips.

Suggested icons:

- Control: Gauge
- Audit Log: ScrollText or ListTree

### 11.3 Control page

Remove `ActivityLogPanel` completely.

The page contains only operational controls:

- overview,
- WhatsApp connection/pairing,
- send message,
- recipients,
- credentials,
- account health.

Account Health should render a clear unavailable state when WhatsApp is not connected rather than optimistic values.

### 11.4 Audit Log page

The page is designed for both ordinary operators and technical debugging.

Top area:

```text
Audit Log                         [Refresh]
Operational and Baileys events. Sensitive values are masked.

[Search events................]
[All sources] [All categories] [All levels]
```

Timeline/table behavior:

- newest first,
- clear timestamp,
- severity indicator,
- friendly title,
- one-sentence explanation,
- source badge: `Wago` or `Baileys`,
- category label,
- expandable `Technical details`,
- `Load more` pagination.

Example:

```text
23:11:42   WARNING   Baileys / WhatsApp
Connection closed
WhatsApp ended the linked-device session. Pairing is required again.

Technical details
  Event             connection.update
  Status code       401
  Reason            logged_out
  Terminal          true
  Reconnect         false
  Socket generation 7
```

For recoverable disconnect:

```text
23:08:14   INFO   Baileys / WhatsApp
Connection interrupted
Wago will retry the existing linked session in 4 seconds.

Technical details
  Reason       connection_closed
  Terminal     false
  Attempt      2
  Delay        4000 ms
```

The default view prioritizes friendly text. Technical details are opt-in per event.

## 12. API and frontend data flow

```text
AuditLogPage
   |
   v
useAuditLogQuery
   |
   v
GET /activity?limit=...&before=...&filters
   |
   v
SQLite indexed query
```

Do not poll continuously while the Audit page is hidden. Suggested behavior:

- load on page entry,
- manual Refresh,
- optional 10-second refresh only while `/audit` is visible and the document is visible,
- preserve current filters across refresh,
- pagination appends older rows.

## 13. Backend component boundaries

Recommended structure:

```text
backend/src/
  activity/
    store.ts
    audit-event.ts
    baileys-audit.ts
    query.ts
  whatsapp/
    client.ts
    disconnect-classifier.ts
    account-health.ts
    connection-state.ts
```

Responsibilities:

- `baileys-audit.ts`: maps selected Baileys lifecycle data to sanitized audit inputs.
- `disconnect-classifier.ts`: one source of truth for terminal/recoverable disconnect semantics.
- `account-health.ts`: owns availability and cached restriction data.
- `connection-state.ts`: owns connection/QR state only.
- `activity/store.ts`: persistence only.
- `activity/query.ts`: filter/cursor query construction.

Do not turn `client.ts` into a larger switchboard; event handlers should call focused helpers.

## 14. Frontend component boundaries

Recommended structure:

```text
frontend/src/
  app/
    routes.tsx
  shared/
    layout/
      AppShell.tsx
      AppSidebar.tsx
      AppHeader.tsx
  features/
    audit/
      AuditLogPage.tsx
      AuditFilters.tsx
      AuditEventList.tsx
      AuditEventDetails.tsx
      useAuditLogQuery.ts
    dashboard/
      DashboardPage.tsx
```

The existing activity components can be migrated/renamed rather than duplicated. There must be one implementation of audit-event rendering.

## 15. Error handling

### Audit API

- malformed filters -> `400`
- unauthenticated -> existing `401`
- invalid cursor -> `400`
- database/query failure -> existing centralized server error behavior, plus engineering Pino log

UI messages remain operator-friendly and never show raw HTML/server payloads.

### WhatsApp lifecycle

- terminal logout -> invalidate binding + health, show pairing required
- recoverable disconnect -> keep binding, health unavailable, show reconnecting/disconnected
- health fetch failure while connected -> connection remains connected, health becomes unavailable/unknown; outbound policy stays conservative for new-chat decisions
- unknown disconnect reason -> audit safe reason/status and never display outbound as normal until connection is restored

## 16. Performance constraints

- no raw Baileys debug persistence,
- no message-body persistence,
- prepared SQLite statements,
- indexed server-side filtering/pagination,
- bounded 2,000-event retention,
- coalesce frequent successful `creds.update` events,
- do not persist every internal reconnect timer tick,
- do not poll Audit Log in background tabs.

This keeps logging useful without turning SQLite into a high-volume telemetry database.

## 17. Testing strategy

### Backend unit tests

- disconnect classifier: logged-out terminal vs recoverable reasons
- account health invalidates on disconnect/rebind and no stale `Normal` semantics remain
- Baileys audit sanitizer never persists QR, credentials, text/message, tokens, cookies, or full JIDs
- credential-success coalescing and credential-failure persistence
- audit query filtering and cursor pagination
- retention capped at 2,000

### Backend behavior tests

- linked-device terminal logout -> binding cleared, account health unavailable, reconnect not scheduled
- recoverable close -> binding retained, health unavailable, reconnect scheduled
- reconnect open -> health checking then refreshed
- sending while disconnected -> `WHATSAPP_NOT_CONNECTED`

### Frontend tests

- `/` renders Control and no Activity Log panel
- `/audit` renders Audit Log and sidebar active state
- mobile and collapsed sidebar contain both routes
- disconnected WhatsApp -> Outbound `Unavailable`, never `Normal`
- disconnected WhatsApp -> Account Health unavailable state
- connected + no restrictions -> Outbound `Normal`
- audit filters/search/pagination update requests correctly
- technical details expand without exposing redacted fields

### Regression case from reported bug

Given a previously connected session, when the linked device is removed and Baileys reports terminal logout:

1. WhatsApp becomes disconnected/pairing required.
2. Binding is cleared.
3. Account health is invalidated.
4. Outbound displays `Unavailable`.
5. Send remains blocked.
6. Audit Log records the disconnect status, normalized reason, terminal classification, and reconnect decision.

## 18. Migration and compatibility

- SQLite migration adds `source` to existing activity rows with default `wago`.
- Existing activity history remains readable.
- Existing `/activity` endpoint remains the API path; new filters/cursors are additive.
- Existing `/` Control URL remains unchanged.
- `/audit` is new and supported by the current Express SPA fallback.
- No new environment variables are required.
- No raw logging mode is introduced.

## 19. Acceptance criteria

The implementation is accepted when:

- Control contains no Activity Log panel.
- Sidebar exposes Control and Audit Log on desktop/mobile/collapsed states.
- `/audit` is directly refreshable and displays a friendly paginated audit timeline.
- Selected Baileys lifecycle events are visible with sanitized low-level technical details.
- QR, credentials, message content, API keys, tokens, cookies, and full JIDs cannot enter persisted audit metadata.
- Removing/logging out the linked WhatsApp device can no longer leave Outbound as `Normal` or Account Health as `Available`.
- terminal vs recoverable disconnect behavior is centralized and covered by tests.
- existing send safety check remains intact.
- tests, formatting/lint, TypeScript build, Docker build, Docs CI, and CodeQL pass before merge.
