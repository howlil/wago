# Project Plan

## Current Codebase Status

The repository is currently a backend-first WhatsApp Gateway MVP scaffold based on `AGENTS.md`.

Implemented:

- Backend project setup with pnpm, TypeScript, Express, Baileys, Vitest, and Docker.
- Express app wiring in `backend/src/app.ts` and startup bootstrap in `backend/src/index.ts`.
- Health endpoint: `GET /health`.
- WhatsApp module in `backend/src/whatsapp.ts` with Baileys initialization, QR state, connection status, reconnect handling, and text-message sending.
- API routes:
  - `GET /whatsapp/status`
  - `GET /whatsapp/qr`
  - `GET /whatsapp/qr/image`
  - `POST /messages/send`
- Phone normalization and WhatsApp JID creation in `backend/src/utils/phone.ts`.
- Unit tests for phone normalization/JID behavior.
- HTTP behavior tests for health, malformed JSON, and disconnected send-message behavior.
- Dockerfile and `docker-compose.yml` with auth persistence mounted at `backend/data/auth`.
- README with local and Docker startup commands.

Verified now:

- `pnpm test` passes.
- `pnpm run build` passes.
- `package-lock.json` is not present.
- `pnpm-lock.yaml` is present.
- Runtime server startup is verified.
- QR emission from an unauthenticated WhatsApp session is verified.
- `GET /whatsapp/qr/image` returns a scannable SVG QR image.
- QR scan success is verified.
- Real WhatsApp connected state is verified.
- Real WhatsApp message delivery is verified.
- Auth persistence across process restart is verified.
- Docker runtime and Docker auth persistence are verified.
- Frontend MVP is verified locally against the backend API.
- Disconnected send-message behavior returns `503 WHATSAPP_NOT_CONNECTED`.
- Malformed JSON returns a JSON `400 INVALID_JSON` response without exposing stack traces.

Not yet verified:

- None for the current MVP checklist.

## Iteration 1: Backend Runtime Verification

Goal: prove the scaffold starts and the basic HTTP API works locally.

Status: completed on 2026-08-09 using `PORT=3100` because port `3000` was already occupied by another local process.

Tasks:

- [x] Run the backend with `pnpm run dev`.
- [x] Verify `GET /health` returns `{ "status": "ok" }`.
- [x] Verify `GET /whatsapp/status` returns a consistent success response.
- [x] Verify `GET /whatsapp/qr` returns either QR state or connected state.
- [x] Verify invalid `POST /messages/send` input returns `400 INVALID_REQUEST`.
- [x] Document any runtime startup errors caused by Baileys or environment setup.

Acceptance:

- [x] Backend starts without TypeScript/runtime errors.
- [x] Health and basic API responses work through curl or another HTTP client.

Observed responses:

- `GET /health` -> `{"status":"ok"}`
- `GET /whatsapp/status` -> `{"success":true,"status":"qr"}`
- `GET /whatsapp/qr` -> `{"success":true,"qr":"...","status":"qr"}`
- invalid `POST /messages/send` -> `400 {"success":false,"error":"INVALID_REQUEST","message":"to and text are required"}`

Notes:

- Port `3000` returned `404 Cannot GET /health` from another local process, so verification used `127.0.0.1:3100`.
- Baileys emitted a deprecation warning for `printQRInTerminal`; the deprecated option was removed because QR handling is already implemented through `connection.update`.

## Iteration 2: WhatsApp Authentication Flow

Goal: prove QR authentication works with a real WhatsApp account.

Status: completed on 2026-08-09. Backend ran on `http://127.0.0.1:3100` because port `3000` was occupied locally.

Tasks:

- [x] Start backend with empty `backend/data/auth`.
- [x] Confirm Baileys emits a QR.
- [x] Confirm `GET /whatsapp/qr` exposes the latest QR string.
- [x] Add and verify `GET /whatsapp/qr/image` for browser-based QR scanning.
- [x] Scan QR with WhatsApp.
- [x] Confirm `GET /whatsapp/status` reports `connected`.
- [x] Confirm QR is cleared after connection.

Acceptance:

- [x] WhatsApp becomes connected after QR scan.
- [x] Public API exposes only application-level status and QR state.

Observed responses:

- before scan: `GET /whatsapp/status` -> `{"success":true,"status":"qr"}`
- before scan: `GET /whatsapp/qr/image` -> `200 image/svg+xml`
- after scan: `GET /whatsapp/status` -> `{"success":true,"status":"connected"}`
- after scan: `GET /whatsapp/qr` -> `{"success":true,"qr":null,"status":"connected"}`

## Iteration 3: Send Message Flow

Goal: prove the main MVP operation works end to end.

Status: completed on 2026-08-09 using the connected account as the target recipient for the delivery check.

Tasks:

- [x] Send a real request to `POST /messages/send` with `to` and `text`.
- [x] Verify phone normalization handles local Indonesian numbers such as `0812...`.
- [x] Confirm a real WhatsApp message is delivered.
- [x] Confirm disconnected state returns `503 WHATSAPP_NOT_CONNECTED`.
- [x] Add focused unit tests for any new validation or error-mapping logic added during fixes.
- [x] Fix malformed JSON handling so API clients receive JSON instead of an Express HTML stack trace.

Acceptance:

- [x] A real WhatsApp message is delivered successfully.
- [x] Error responses remain consistent and do not expose internals.

Observed responses:

- Current status: `GET /whatsapp/status` -> `{"success":true,"status":"connected"}`
- Real send request -> `{"success":true,"messageId":"..."}`
- Valid send while not connected -> `503 {"success":false,"error":"WHATSAPP_NOT_CONNECTED","message":"WhatsApp is not connected"}`
- Malformed JSON -> `400 {"success":false,"error":"INVALID_JSON","message":"Request body must be valid JSON"}`

Code quality measurement:

- `pnpm test` -> 2 test files, 7 tests passing.
- `pnpm run build` -> TypeScript build passing.
- Codebase graph re-indexed after changes; backend source remains shallow with app wiring, routes, WhatsApp module, and phone utility.

## Iteration 4: Persistence and Docker

Goal: prove session persistence works locally and in Docker.

Status: completed on 2026-08-09. Docker was verified on host port `3101` using `HOST_PORT=3101` because local port `3000` was already occupied.

Tasks:

- [x] Restart the local backend after successful QR login.
- [x] Confirm no QR scan is required after restart.
- [x] Run `docker compose up --build`.
- [x] Confirm backend starts inside Docker.
- [x] Confirm `backend/data/auth` persists through container restart.
- [x] Confirm WhatsApp status remains connected after Docker restart when credentials are valid.

Acceptance:

- [x] Auth survives process and Docker restarts.
- [x] Docker setup is usable with the documented commands.

Observed responses:

- local restart: `GET /whatsapp/status` -> `{"success":true,"status":"connected"}`
- local restart: `GET /whatsapp/qr` -> `{"success":true,"qr":null,"status":"connected"}`
- Docker start: `GET /health` -> `{"status":"ok"}`
- Docker start: `GET /whatsapp/status` -> `{"success":true,"status":"connected"}`
- Docker restart: `GET /whatsapp/status` -> `{"success":true,"status":"connected"}`

Code quality measurement:

- `pnpm test` -> 2 test files, 7 tests passing.
- `pnpm run build` -> TypeScript build passing.
- Docker image build passed with `pnpm install --frozen-lockfile` and `pnpm run build`.

## Iteration 5: Frontend MVP

Start only after the backend API is verified independently.

Status: completed on 2026-08-09. Frontend was verified locally at `http://127.0.0.1:5173` against backend `http://127.0.0.1:3100`.

Tasks:

- [x] Create a minimal React + Vite + TypeScript frontend.
- [x] Show backend health.
- [x] Show WhatsApp connection status.
- [x] Render QR when authentication is required.
- [x] Hide QR when connected.
- [x] Provide phone and message inputs.
- [x] Send message through the backend API.
- [x] Display success and backend errors clearly.

Acceptance:

- [x] Frontend supports the basic WhatsApp Gateway workflow without duplicating backend business rules.

Observed behavior:

- Frontend dev server returned `200 OK` at `http://127.0.0.1:5173`.
- Backend CORS returned `Access-Control-Allow-Origin: *` for the frontend origin.
- Backend health returned `{"status":"ok"}`.
- WhatsApp status returned `{"success":true,"status":"connected"}`.
- Frontend send-message flow was verified through the same backend API and returned `{"success":true,"messageId":"..."}`.

Code quality measurement:

- `pnpm test` in `backend` -> 2 test files, 8 tests passing.
- `pnpm run build` in `backend` -> TypeScript build passing.
- `pnpm run build` in `frontend` -> TypeScript and Vite production build passing.
- `docker compose build backend` -> backend image build passing with pnpm frozen lockfile.
- Codebase graph re-indexed after frontend implementation; structure remains shallow with React app, API client, CSS, backend app wiring, routes, WhatsApp module, and phone utility.

## Ongoing Rules

- Use pnpm for JavaScript and TypeScript package management.
- Follow TDD for isolated logic: write or update unit tests before implementation when practical.
- Do not unit-test Baileys itself.
- Keep the architecture shallow and backend-first.
- Do not add multi-user, database, queue, or SaaS-style infrastructure unless explicitly requested.
