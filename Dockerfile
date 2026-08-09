FROM node:26-alpine AS pnpm-base
RUN npm install --global pnpm@11.21.0

FROM pnpm-base AS frontend-deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM frontend-deps AS frontend-build
COPY frontend/ ./
RUN pnpm run build

FROM pnpm-base AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM backend-deps AS backend-build
COPY backend/ ./
RUN pnpm run build

FROM pnpm-base AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./backend/
WORKDIR /app/backend
RUN pnpm install --frozen-lockfile --prod

WORKDIR /app
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=frontend-build /app/frontend/dist ./public
RUN mkdir -p /app/data && chown -R node:node /app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- "http://127.0.0.1:3000/health" >/dev/null || exit 1
USER node
CMD ["node", "backend/dist/index.js"]
