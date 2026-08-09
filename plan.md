# Project Plan

## Current Codebase Status

The repository is currently a backend-first WhatsApp Gateway MVP scaffold based on `AGENTS.md`.

Implemented:

- Backend project setup with pnpm, TypeScript, Express, Baileys, Vitest, and Docker.
- Express bootstrap in `backend/src/index.ts`.
- Health endpoint: `GET /health`.
- WhatsApp module in `backend/src/whatsapp.ts` with Baileys initialization, QR state, connection status, reconnect handling, and text-message sending.
- API routes:
  - `GET /whatsapp/status`
  - `GET /whatsapp/qr`
  - `GET /whatsapp/qr/image`
  - `POST /messages/send`
- Phone normalization and WhatsApp JID creation in `backend/src/utils/phone.ts`.
- Unit tests for phone normalization/JID behavior.
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

Not yet verified:

- QR scan success.
- Real WhatsApp connected state.
- Real message delivery.
- Auth persistence across process restart.
- Docker runtime and Docker auth persistence.

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

Status: in progress on 2026-08-09. Backend is running on `http://127.0.0.1:3100` because port `3000` is occupied locally.

Tasks:

- [x] Start backend with empty `backend/data/auth`.
- [x] Confirm Baileys emits a QR.
- [x] Confirm `GET /whatsapp/qr` exposes the latest QR string.
- [x] Add and verify `GET /whatsapp/qr/image` for browser-based QR scanning.
- [ ] Scan QR with WhatsApp.
- [ ] Confirm `GET /whatsapp/status` reports `connected`.
- [ ] Confirm QR is cleared after connection.

Acceptance:

- [ ] WhatsApp becomes connected after QR scan.
- [x] Public API exposes only application-level status and QR state.

Observed responses:

- `GET /whatsapp/status` -> `{"success":true,"status":"qr"}`
- `GET /whatsapp/qr/image` -> `200 image/svg+xml`

Manual action required:

- Open `http://127.0.0.1:3100/whatsapp/qr/image` and scan it from WhatsApp Linked devices.

## Iteration 3: Send Message Flow

Goal: prove the main MVP operation works end to end.

Tasks:

- Send a real request to `POST /messages/send` with `to` and `text`.
- Verify phone normalization handles local Indonesian numbers such as `0812...`.
- Confirm a real WhatsApp message is delivered.
- Confirm disconnected state returns `503 WHATSAPP_NOT_CONNECTED`.
- Add focused unit tests for any new validation or error-mapping logic added during fixes.

Acceptance:

- A real WhatsApp message is delivered successfully.
- Error responses remain consistent and do not expose internals.

## Iteration 4: Persistence and Docker

Goal: prove session persistence works locally and in Docker.

Tasks:

- Restart the local backend after successful QR login.
- Confirm no QR scan is required after restart.
- Run `docker compose up --build`.
- Confirm backend starts inside Docker.
- Confirm `backend/data/auth` persists through container restart.
- Confirm WhatsApp status remains connected after Docker restart when credentials are valid.

Acceptance:

- Auth survives process and Docker restarts.
- Docker setup is usable with the documented commands.

## Iteration 5: Frontend MVP

Start only after the backend API is verified independently.

Tasks:

- Create a minimal React + Vite + TypeScript frontend.
- Show backend health.
- Show WhatsApp connection status.
- Render QR when authentication is required.
- Hide QR when connected.
- Provide phone and message inputs.
- Send message through the backend API.
- Display success and backend errors clearly.

Acceptance:

- Frontend supports the basic WhatsApp Gateway workflow without duplicating backend business rules.

## Ongoing Rules

- Use pnpm for JavaScript and TypeScript package management.
- Follow TDD for isolated logic: write or update unit tests before implementation when practical.
- Do not unit-test Baileys itself.
- Keep the architecture shallow and backend-first.
- Do not add multi-user, database, queue, or SaaS-style infrastructure unless explicitly requested.
