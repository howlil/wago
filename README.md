# WhatsApp Gateway

Lightweight WhatsApp Gateway MVP built with Node.js, TypeScript, Express, and Baileys.

## Support Boundary

Supported:

- single WhatsApp account
- single Wago process/container
- Docker self-hosting with one persistent data volume
- text message sending through the API
- recipient consent, opt-out, idempotency, and outbound safety limits
- reverse proxy or PaaS routing in front of the container

Unsupported:

- multiple running replicas sharing one auth directory
- multi-tenant SaaS or multiple WhatsApp sessions
- bulk messaging, campaigns, scraping, or number enumeration
- guaranteed ban prevention
- anti-detection behavior such as fake typing, proxy rotation, fingerprint rotation, or message mutation
- horizontal scaling without redesigning session ownership and auth storage

This project uses Baileys, an unofficial WhatsApp Web client. Wago is not affiliated with WhatsApp and cannot guarantee that an account will avoid WhatsApp technical or policy enforcement. For official business messaging requirements, evaluate WhatsApp Cloud API.

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

## Quality Commands

From the repository root:

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

`pnpm check` runs Biome formatting/import/lint checks for backend and frontend source. Use `pnpm check:fix` for safe automatic fixes.
GitHub Actions runs the same root quality commands, a Docker image build, and CodeQL analysis on pushes and pull requests to `main`.

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
The default `docker-compose.yml` is production-oriented and uses a published image plus a named Docker volume. Use `docker-compose.dev.yml` when you want to build from local source.

Required production environment:

```env
APP_ID=wa-gateway-prod
WAGO_VERSION=v0.1.0
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
BIND_ADDRESS=127.0.0.1
HOST_PORT=3000
CORS_ORIGIN=https://your-app.example.com
FRONTEND_DIST=/app/public
```

Production install:

```bash
cp .env.production.example .env
# edit .env, set API_KEY and CORS_ORIGIN
docker compose pull
docker compose up -d
```

By default the production compose file binds to `127.0.0.1:${HOST_PORT:-3000}`. Put Caddy, Traefik, Nginx, or your PaaS router in front of it for public HTTPS. Set `BIND_ADDRESS=0.0.0.0` only when you intentionally want the container port exposed on every interface.

Run locally from source:

```bash
docker compose -f docker-compose.dev.yml up --build
```

For first-run setup through the web UI, start with bootstrap enabled, initialize the app, then restart without it:

```bash
ALLOW_WEB_BOOTSTRAP=true docker compose -f docker-compose.dev.yml up --build
```

For public deployments, prefer setting `API_KEY` yourself or enable web bootstrap only while the app is private.
When `NODE_ENV=production`, the backend fails fast unless web bootstrap is disabled, secure auth cookies are enabled, an API key or generated key exists, and `CORS_ORIGIN` is not `*`.
Set `TRUST_PROXY=true` only when the app is behind a trusted reverse proxy that sets client IP headers.
Phone numbers should be sent in international format, for example `6281234567890`; local numbers starting with `0` use `DEFAULT_COUNTRY_CODE` and default to `62`.
Logs are structured JSON. Keep `LOG_LEVEL=info` in production unless debugging, and do not paste logs containing auth, QR, or message metadata into public issues.

If local port `3000` is occupied:

```bash
HOST_PORT=3101 docker compose -f docker-compose.dev.yml up --build
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
Do not paste auth state, QR payloads, API keys, full phone numbers, full JIDs, message text, or raw production logs into public issues. See `SECURITY.md` for reporting guidance.

Production compose stores data in the named volume `wago_data`. Upgrade by changing `WAGO_VERSION`, then run:

```bash
docker compose pull
docker compose up -d
```

Rollback uses the same process with an older version:

```env
WAGO_VERSION=v0.1.1
```

```bash
docker compose pull
docker compose up -d
```

Do not run `docker compose down -v` for normal upgrades because `-v` removes `wago_data` and can delete the WhatsApp auth session.

Release images are published to `ghcr.io/howlil/wago-simple` from Git tags matching `v*`, for example `v0.1.2`. Published tags include the full version tag, the minor tag such as `0.1`, and `latest`.

Backup the production volume:

```bash
docker run --rm -v wago_data:/data -v "$PWD:/backup" alpine \
  tar czf /backup/wago_data-backup.tgz -C /data .
```

Restore into an empty production volume:

```bash
docker run --rm -v wago_data:/data -v "$PWD:/backup" alpine \
  sh -c "cd /data && tar xzf /backup/wago_data-backup.tgz"
```

## Contributing and Security

Read `CONTRIBUTING.md` before opening a pull request and `SECURITY.md` before reporting sensitive issues. This project is MIT licensed.
