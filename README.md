# WhatsApp Gateway

Lightweight WhatsApp Gateway MVP built with Node.js, TypeScript, Express, and Baileys.

## Backend

```bash
cd backend
pnpm install
pnpm run dev
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

Send a message:

```bash
curl -X POST http://localhost:3000/messages/send \
  -H "Content-Type: application/json" \
  -d "{\"to\":\"628xxxxxxxxxx\",\"text\":\"Hello from WhatsApp Gateway\"}"
```

WhatsApp authentication files are stored in `backend/data/auth` and must not be committed.
