# WhatsApp Gateway

Lightweight WhatsApp Gateway MVP built with Node.js, TypeScript, Express, and Baileys.

## Backend

```bash
cd backend
pnpm install
pnpm run dev
```

## Frontend

```bash
cd frontend
pnpm install
pnpm run dev
```

If the backend is running on another port:

```bash
VITE_API_BASE_URL=http://localhost:3100 pnpm run dev
```

On first run, open the frontend and click `Initialize app`. The backend generates an API key, stores only its SHA-256 digest in `backend/data/app-settings.json`, sets an auth cookie for the browser, and the UI can then bind WhatsApp. Copy the raw key at setup time if an external API client needs it. You can still set `API_KEY` manually for locked-down deployments.

Default server:

```text
http://localhost:3000
```

Available endpoints:

```text
GET  /health
GET  /ready
GET  /app/info
POST /app/bootstrap
GET  /whatsapp/status
GET  /whatsapp/qr
GET  /whatsapp/qr/image
POST /whatsapp/rebind
POST /messages/send
GET  /messages/:id/status
```

`GET /app/info` is public and returns the configured App ID plus API key status. WhatsApp and message endpoints require `Authorization: Bearer <API_KEY>`.
`POST /app/bootstrap` is available only when `ALLOW_WEB_BOOTSTRAP=true` and the app has no API key; after initialization it returns `409`.

Open `http://localhost:3000/whatsapp/qr/image` in a browser to scan the WhatsApp login QR when authentication is required.

## Production Docker

This repository includes a root `Dockerfile` that builds the frontend and backend into one container. The backend serves the frontend static files and API from the same host.
The HTTP server starts before WhatsApp finishes connecting, so `/health`, `/ready`, and the dashboard remain available while the socket is pairing or reconnecting.

Required production environment:

```env
APP_ID=wa-gateway-prod
API_KEY=
DATA_DIR=/app/data
AUTH_DIR=/app/data/auth
ALLOW_WEB_BOOTSTRAP=false
AUTH_COOKIE_SECURE=true
BODY_LIMIT=32kb
WA_VERSION_MODE=default
TRUST_PROXY=false
DEFAULT_COUNTRY_CODE=62
REQUEST_LOGGING=true
LOG_LEVEL=info
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=https://your-app.example.com
FRONTEND_DIST=/app/public
```

Run locally with Docker:

```bash
docker compose up --build
```

For first-run setup through the web UI, start with bootstrap enabled, initialize the app, then restart without it:

```bash
ALLOW_WEB_BOOTSTRAP=true docker compose up --build
```

For public deployments, prefer setting `API_KEY` yourself or enable web bootstrap only while the app is private.
When `NODE_ENV=production`, the backend fails fast unless web bootstrap is disabled, secure auth cookies are enabled, an API key or generated key exists, and `CORS_ORIGIN` is not `*`.
Set `TRUST_PROXY=true` only when the app is behind a trusted reverse proxy that sets client IP headers.
Phone numbers should be sent in international format, for example `6281234567890`; local numbers starting with `0` use `DEFAULT_COUNTRY_CODE` and default to `62`.
Logs are structured JSON. Keep `LOG_LEVEL=info` in production unless debugging, and do not paste logs containing auth, QR, or message metadata into public issues.

If local port `3000` is occupied:

```bash
HOST_PORT=3101 docker compose up --build
```

Build the production image directly:

```bash
docker build -t wa-gateway .
docker run --rm -p 3000:3000 \
  -e APP_ID=wa-gateway-prod \
  -e ALLOW_WEB_BOOTSTRAP=true \
  -e DATA_DIR=/app/data \
  -e AUTH_DIR=/app/data/auth \
  -v wa_data:/app/data \
  wa-gateway
```

Send a message:

```bash
curl -X POST http://localhost:3000/messages/send \
  -H "Content-Type: application/json" \
  -d "{\"to\":\"628xxxxxxxxxx\",\"text\":\"Hello from WhatsApp Gateway\"}"
```

The send endpoint returns `status: "pending"` after Baileys accepts the outbound message request and returns a message ID. This is not a read receipt.
Poll `GET /messages/:id/status` for the in-memory status while it is retained by the backend.

Use `POST /whatsapp/rebind` or the frontend session action to clear the current WhatsApp auth files and scan a new account QR. If the app was initialized from the UI, the browser auth cookie is enough for frontend actions. The frontend can accept a Bearer API key for the current tab, but it does not persist that key in browser storage.
Cookie-authenticated state-changing requests are rejected when their `Origin` does not match the configured `CORS_ORIGIN`.
Ordinary shutdowns, including `docker stop`, close the Baileys socket without logging out. Rebind is the intentional unlink path.

Runtime settings are stored in `backend/data/app-settings.json`; WhatsApp authentication files are stored in `backend/data/auth`. Do not commit either.

`WA_VERSION_MODE=default` uses the WhatsApp Web version bundled with the installed Baileys release. Use `WA_VERSION_MODE=live` only for troubleshooting pairing/version issues; it fetches the live version once per process and reuses it for reconnects.

This project intentionally uses Baileys filesystem auth state for the single-account self-hosted profile. Treat `backend/data/auth` like a private key: mount it as persistent storage, back it up carefully, and do not share it between multiple running replicas.
