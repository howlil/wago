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
POST /messages/send
```

Open `http://localhost:3000/whatsapp/qr/image` in a browser to scan the WhatsApp login QR when authentication is required.

Run with Docker:

```bash
docker compose up --build
```

If local port `3000` is occupied:

```bash
HOST_PORT=3101 docker compose up --build
```

Send a message:

```bash
curl -X POST http://localhost:3000/messages/send \
  -H "Content-Type: application/json" \
  -d "{\"to\":\"628xxxxxxxxxx\",\"text\":\"Hello from WhatsApp Gateway\"}"
```

WhatsApp authentication files are stored in `backend/data/auth` and must not be committed.
