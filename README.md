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

On first run, open the frontend and click `Initialize app`. The backend generates an API key, stores it in `backend/data/app-settings.json`, sets an auth cookie for the browser, and the UI can then bind WhatsApp. You can still set `API_KEY` manually for API clients or locked-down deployments.

Default server:

```text
http://localhost:3000
```

Available endpoints:

```text
GET  /health
GET  /whatsapp/status
GET  /whatsapp/qr
GET  /whatsapp/qr/image
POST /whatsapp/rebind
POST /messages/send
GET  /messages/:id/status
```

`GET /app/info` is public and returns the configured App ID plus API key status. WhatsApp and message endpoints require `Authorization: Bearer <API_KEY>`.
`POST /app/bootstrap` is public only before the app has an API key; after initialization it returns `409`.

Open `http://localhost:3000/whatsapp/qr/image` in a browser to scan the WhatsApp login QR when authentication is required.

## Production Docker

This repository includes a root `Dockerfile` that builds the frontend and backend into one container. The backend serves the frontend static files and API from the same host.

Required production environment:

```env
APP_ID=wa-gateway-prod
API_KEY=
DATA_DIR=/app/data
AUTH_DIR=/app/data/auth
AUTH_COOKIE_SECURE=true
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=https://your-app.example.com
FRONTEND_DIST=/app/public
```

Run locally with Docker:

```bash
docker compose up --build
```

If local port `3000` is occupied:

```bash
HOST_PORT=3101 docker compose up --build
```

Build the production image directly:

```bash
docker build -t wa-gateway .
docker run --rm -p 3000:3000 \
  -e APP_ID=wa-gateway-prod \
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

The send endpoint returns `status: "accepted"` when WhatsApp accepts the outbound message request. This is not a read receipt. If WhatsApp rejects the message quickly, the API returns `MESSAGE_REJECTED`.
Poll `GET /messages/:id/status` for the in-memory status while it is retained by the backend.

Use `POST /whatsapp/rebind` or the frontend session action to clear the current WhatsApp auth files and scan a new account QR. The frontend asks for the API key and stores it only in the browser session.
If the app was initialized from the UI, the browser auth cookie is enough for frontend actions. The generated API key is also shown in the UI field so it can be reused by API clients.

Runtime settings are stored in `backend/data/app-settings.json`; WhatsApp authentication files are stored in `backend/data/auth`. Do not commit either.
