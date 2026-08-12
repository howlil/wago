# Webhook Settings and Operator UI Design

## Goal
Move webhook delivery configuration from deployment-only environment variables into Wago's authenticated operator UI and SQLite-backed runtime state, while simplifying the dashboard visual system into a flatter, more consistent admin/infra interface.

## Product decisions

- Add a `Settings` workspace destination alongside `Control` and `Audit Log`.
- Move gateway credentials out of `Control` into `Settings` so the main control surface stays operational rather than configuration-heavy.
- Add `Webhook integration` settings under `Settings`.
- Existing `WEBHOOK_URL`, `WEBHOOK_SECRET`, and `WEBHOOK_SECRET_PREVIOUS` remain supported only as a legacy bootstrap/import source when SQLite has no webhook configuration yet.
- Once SQLite contains webhook settings, SQLite is authoritative and environment variables do not overwrite dashboard changes.
- Webhook configuration changes take effect without restarting Wago.
- External integrations keep using the existing Bearer API key; dashboard authentication remains the browser-session model already implemented.

## Webhook runtime model

Persist one singleton webhook configuration row in SQLite:

- `enabled`
- `url`
- `secret`
- `previous_secret`
- `created_at`
- `updated_at`

Unlike API keys and browser sessions, the signing secret cannot be hash-only because Wago must possess the original value to produce HMAC signatures. The secret must therefore be treated as encrypted-at-rest only if a future key-management layer is added; this change does not introduce a new encryption dependency. The database file remains permission-restricted as existing Wago state already is.

Normal settings reads never expose raw secrets. API responses expose only `secretConfigured` and `rotationPending`.

### First configuration

1. Operator opens Settings.
2. Operator enters a valid HTTP/HTTPS callback URL and enables webhook delivery.
3. Wago generates a cryptographically random signing secret server-side.
4. Wago persists the URL, enabled state, and secret to SQLite.
5. The raw signing secret is returned once in the mutation response so the operator can copy it to the receiving backend.
6. Future GET requests do not return the raw secret.

### Editing URL or enabled state

Changing callback URL or enabled state does not rotate the signing secret unless no secret exists yet. Disabling delivery preserves the configured URL/secret so it can be re-enabled without re-pairing integrations.

### Secret rotation

`Rotate secret` generates a new secret and moves the current secret to `previous_secret`. During the rotation window Wago signs with both current and previous secrets using the delivery module's existing multi-signature mechanism. A separate `Complete rotation` action removes the previous secret once the receiver has been updated.

### Legacy env migration

On startup:

- if SQLite has no webhook row and env webhook configuration is complete and valid, import it once into SQLite;
- if SQLite already has webhook settings, ignore webhook env variables for runtime configuration;
- malformed legacy env configuration still fails fast during the import path rather than silently creating partial state.

## Runtime worker boundary

The current webhook sender is created once from startup config. Refactor it so the delivery worker resolves the active webhook settings when processing a delivery attempt. Saving, disabling, enabling, or rotating webhook settings therefore affects subsequent attempts without process restart.

The durable delivery outbox, retries, replay-resistant signing, status tracking, retention, and redelivery behavior remain unchanged.

## API surface

Authenticated dashboard/API routes:

- `GET /webhooks/settings`
  - returns `enabled`, `url`, `secretConfigured`, `rotationPending`, `updatedAt`.
- `PUT /webhooks/settings`
  - accepts `enabled` and `url`.
  - creates the first secret automatically when enabling a configuration without one.
  - returns `generatedSecret` only when a new secret is generated.
- `POST /webhooks/settings/rotate-secret`
  - rotates the signing secret and returns the new raw secret once.
- `POST /webhooks/settings/complete-rotation`
  - removes the previous secret.

Existing delivery history/redelivery routes remain unchanged.

Validation:

- URL is required when enabling.
- URL protocol must be HTTP or HTTPS.
- embedded URL credentials are rejected.
- mutation routes retain existing cookie same-origin protection and authentication middleware.

## Information architecture

Sidebar:

- Control
- Audit Log
- Settings

Collapsed sidebar navigation targets are fixed square 40 x 40 controls centered in the 76 px rail. Expanded navigation rows remain full-width.

Control contains connection state, outbound messaging, recipient access, message status, and account health. Configuration such as API credentials and webhook integration belongs in Settings.

## Visual system

The interface should resemble practical operator/admin tooling rather than a decorative SaaS landing dashboard.

### Shape

- Cards/surfaces: 8 px radius (`rounded-lg`).
- Inputs/buttons: 6 px radius (`rounded-md`).
- Modal/drawer: 10-12 px radius where separation from the page is useful.
- `rounded-full` only for semantic compact badges/status dots, never as a default container shape.
- Collapsed navigation items: exact square shape, not a wide rounded rectangle.

### Elevation

- No shadow on standard buttons.
- No shadow on standard cards or overview metrics.
- No hover translate/lift effects.
- No gradient active navigation backgrounds.
- No decorative canvas radial gradients.
- Shadow is reserved for true overlays such as mobile drawer/modal.

### Color and hierarchy

- Preserve current green brand family.
- Use border, whitespace, type weight, and restrained surface contrast for hierarchy.
- Reduce one-off hard-coded decorative greens where an existing Wago token is sufficient.
- Brand mark becomes a solid brand surface without gradient/shadow.

## Audit Log redesign

Replace the current mini-card/pill-heavy event feed with a compact operational event table/list.

Columns at desktop widths:

- Time
- Source
- Event
- Level

The event cell contains title plus event code/description with restrained typography. Severity uses one small semantic indicator/text treatment rather than multiple badges. Technical metadata remains expandable per row.

### Filters

There is no `Apply filters` button.

- Source/category/level changes apply immediately.
- Search applies automatically with approximately 300 ms debounce.
- Filter changes reset pagination to the first page.
- Manual `Refresh` remains because it is an explicit data-refresh action, not filter application.
- `Load more` remains for pagination.

## Testing requirements

Backend:

- migration creates webhook settings storage;
- legacy env imports only when SQLite has no settings;
- settings GET does not leak raw secrets;
- first enable creates a strong random secret and returns it once;
- URL validation rejects invalid protocol and embedded credentials;
- URL/enabled changes apply without rotating an existing secret;
- rotate preserves previous secret and returns new secret once;
- complete rotation removes previous secret;
- runtime delivery resolves updated settings without restart;
- disabling settings stops new webhook enqueue/delivery behavior consistently;
- existing Bearer/session authentication contracts remain intact.

Frontend:

- Settings route renders credentials + webhook configuration;
- dashboard no longer renders gateway credentials card;
- webhook secret one-time result can be copied and is not re-fetched;
- collapsed navigation controls are square and Settings is reachable;
- Audit Log filters fire automatically without an Apply button;
- search is debounced;
- design-system regression assertions ensure base buttons/cards do not reintroduce shadow/lift/gradient classes.

## Documentation

Update public README/security/configuration/API documentation to state that webhook settings are normally managed in Wago Settings and persisted in SQLite. Environment variables are documented as legacy/bootstrap compatibility rather than the primary operator workflow.
