# One-Time Bootstrap Code Implementation Plan

## Goal

Remove the operational requirement to configure `SETUP_TOKEN` before first WhatsApp pairing while preserving the first-run root-of-trust that prevents an unauthenticated visitor from claiming a fresh public Wago deployment.

The fresh-install UX becomes:

1. Wago starts with durable storage.
2. If gateway credentials do not exist, Wago creates a high-entropy one-time setup code.
3. Only the setup-code hash is persisted in SQLite; the plaintext code is emitted once to deployment logs for the current startup.
4. The Control page keeps `Pair WhatsApp` as the primary action. It no longer renders a permanent `Deployment setup token` field in `Gateway credentials`.
5. On first pairing, `Pair WhatsApp` opens a focused setup-code dialog.
6. A valid code bootstraps the generated machine API key, creates a separate HttpOnly browser session, invalidates the setup code, then immediately starts WhatsApp pairing.
7. Later pairing/reconnect operations use the authenticated browser session and do not ask for the setup code again.

## Security invariants

- Fresh public production deployments MUST NOT expose an unauthenticated bootstrap endpoint without a possession secret.
- The plaintext generated setup code MUST NOT be stored in SQLite, browser storage, cookies, activity metadata, or normal API responses.
- Only a SHA-256 hash of the active setup code is durable.
- A generated setup code is one-time: successful gateway bootstrap clears the durable hash before the flow proceeds.
- Restarting an uninitialized gateway rotates the generated setup code and makes previously logged generated codes invalid.
- Same-origin production bootstrap checks remain mandatory.
- Existing `API_KEY` deployments remain supported and bypass first-run setup-code generation because the gateway is already initialized.
- Existing initialized SQLite volumes remain compatible.
- `PERSISTENT_DATA_REQUIRED` and the single-instance storage lease remain unchanged.

## Compatibility decision

`SETUP_TOKEN` is retained only as a temporary compatibility override for operators who already inject it. It is no longer required or advertised in the dashboard. If a valid legacy `SETUP_TOKEN` is present during an uninitialized production start, Wago hashes that value as the current setup code instead of generating/logging a new one. New deployments need no setup env variable.

The HTTP bootstrap endpoint accepts the new `X-Wago-Setup-Code` header. During the compatibility window it may also accept `X-Wago-Setup-Token` as a fallback so old automation does not break. Public documentation uses only `X-Wago-Setup-Code`.

## Data model

Append migration 8 to `backend/src/infrastructure/database/migrations.ts`:

```sql
ALTER TABLE app_settings ADD COLUMN setup_code_hash TEXT;
ALTER TABLE app_settings ADD COLUMN setup_code_generated_at TEXT;
```

`app_settings` remains the single-row owner of gateway bootstrap state. No new table or service is needed.

Persisted fields:

- `app_id`
- `api_key_hash`
- `generated_at`
- `setup_code_hash`
- `setup_code_generated_at`

## Backend design

### Configuration/bootstrap state

Refactor `backend/src/config/index.ts` so first-run bootstrap owns setup-code lifecycle:

- read the two migration-8 columns;
- if `API_KEY` or persisted API-key hash exists, no setup code is needed;
- if uninitialized and a valid legacy `SETUP_TOKEN` exists, hash it and persist that hash;
- otherwise generate a random one-time code with at least 128 bits of entropy, persist only its SHA-256 hash, and retain plaintext only in process memory until startup logging consumes it;
- expose `consumeGeneratedSetupCodeForLog()` so `index.ts` can print the code exactly once;
- expose `isSetupCodeValid(candidate)` using timing-safe comparison;
- clear setup-code hash/timestamp atomically with successful API-key bootstrap;
- keep test helpers explicit and test-only in purpose.

### Startup log

`backend/src/index.ts` consumes the generated code once after startup and emits a dedicated operator message such as:

```text
Wago first-run setup code: <code>
Enter this code after clicking Pair WhatsApp. It is valid only until gateway initialization or the next restart.
```

Do not include it in activity events.

### HTTP contract

`GET /app/info` exposes:

- `credentialSetupRequired`
- `setupCodeRequired`
- `webBootstrapEnabled`

Keep the old `setupTokenRequired` field only as a temporary compatibility alias if necessary, but frontend code must stop depending on it.

`POST /app/bootstrap`:

- still enforces same-origin in production;
- requires `X-Wago-Setup-Code` when first-run setup needs authorization;
- optionally accepts legacy `X-Wago-Setup-Token` as fallback;
- returns `SETUP_CODE_REQUIRED` / `INVALID_SETUP_CODE` for the new contract;
- successful bootstrap invalidates the one-time code and creates the browser session as today.

## Frontend design

### API client

Update `frontend/src/api.ts`:

- add `setupCodeRequired` to `AppInfoResponse`;
- rename bootstrap argument to `setupCode`;
- send `X-Wago-Setup-Code`;
- retain response compatibility fields only where needed.

### Snapshot/controller

Update dashboard state so setup-code input is dialog-scoped, not credential-card state.

`Pair WhatsApp` behavior:

- backend unavailable -> existing error;
- already initialized but signed out -> existing sign-in guidance;
- fresh gateway + setup code required -> open setup dialog;
- fresh gateway without setup code requirement (development) -> bootstrap directly;
- confirmed setup code -> bootstrap machine API key + browser session, close dialog, then call `/whatsapp/pair`;
- incorrect code -> keep dialog open and show returned error;
- successful bootstrap -> show generated API key in Gateway credentials exactly as today.

### UI

Remove the `Deployment setup token` block from `GatewayCredentialsCard` entirely.

Add a small `FirstRunSetupDialog` near the other feature dialogs. It contains:

- title: `Authorize first pairing`
- explanation that the code is printed in deployment/container logs and is required once;
- password-style input labelled `Setup code`;
- Cancel and `Continue to pairing` actions;
- no persistence of the entered code.

The red global banner `Configure SETUP_TOKEN...` must disappear because generated setup is available by default.

## Documentation updates

Update current-state docs and security guidance:

- `README.md`
- `SECURITY.md`
- Getting Started
- Configuration
- Deployment
- API/bootstrap docs or diagrams that mention `SETUP_TOKEN`

New guidance: first deploy -> inspect deployment logs for one-time setup code -> click Pair WhatsApp -> enter code -> save generated API key -> scan QR.

Document `SETUP_TOKEN` only as a temporary optional compatibility override, not a required variable.

## TDD execution order

### Phase 1 — RED

Add/modify regressions before production implementation:

1. Backend production bootstrap accepts `X-Wago-Setup-Code` and no longer requires the old header name.
2. `/app/info` reports `setupCodeRequired` for an uninitialized protected production gateway.
3. Gateway credentials UI does not render `Deployment setup token` during first run.
4. API client sends `X-Wago-Setup-Code`.
5. Migration test expects schema version 8 / setup-code columns.

Open the PR on the RED head and confirm CI fails for the intended missing behavior.

### Phase 2 — GREEN backend

1. append migration 8;
2. add durable setup-code hash fields to settings reads/writes;
3. generate/rotate first-run code on startup;
4. add validation + invalidation;
5. update `/app/info` and `/app/bootstrap` contract;
6. log generated code exactly once from startup;
7. update backend tests until focused and full backend suite pass.

### Phase 3 — GREEN frontend

1. update API types/header;
2. remove setup-token UI from credentials card;
3. add first-run setup dialog;
4. route first pairing through the dialog and then existing bootstrap/pair sequence;
5. preserve API-key reveal/save behavior and existing sign-in behavior;
6. run frontend tests/build.

### Phase 4 — docs + compatibility

1. replace required `SETUP_TOKEN` instructions with one-time generated setup-code flow;
2. retain a short compatibility note for optional legacy `SETUP_TOKEN`;
3. update diagrams if their first-run contract is stale;
4. build docs.

### Phase 5 — verification and merge

Required exact-head gates:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm --dir backend test
pnpm --dir backend run build
pnpm --dir frontend test
pnpm --dir frontend run build
pnpm run build:docs
docker build .
bash scripts/smoke-container.sh
```

Also require GitHub CI, Docs CI, CodeQL, Docker persistence/rollback smoke, and native ARM64 build to be green on the PR head.

Inspect complete PR diff and unresolved review threads. Squash-merge to `main` only when the current head is green. Then verify post-merge CI and GHCR release for the merge SHA.

## Out of scope

- changing API-key semantics after initialization;
- removing browser sessions;
- changing Baileys auth persistence;
- changing MyPaaS volume behavior;
- adding Redis/external secret stores;
- exposing setup code through an unauthenticated HTTP endpoint;
- automatic recovery that bypasses possession of the deployment-log setup code.
