FROM node:22-alpine AS frontend-deps
WORKDIR /app/frontend
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM frontend-deps AS frontend-build
COPY frontend/ ./
RUN pnpm run build

FROM node:22-alpine AS backend-deps
WORKDIR /app/backend
RUN corepack enable
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM backend-deps AS backend-build
COPY backend/ ./
RUN pnpm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV AUTH_DIR=/app/data/auth
ENV FRONTEND_DIST=/app/public

RUN corepack enable
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./backend/
WORKDIR /app/backend
RUN pnpm install --frozen-lockfile --prod

WORKDIR /app
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=frontend-build /app/frontend/dist ./public

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1
CMD ["node", "backend/dist/index.js"]
