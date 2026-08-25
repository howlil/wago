FROM node:26-alpine AS pnpm-base
ARG PNPM_VERSION=11.21.0
RUN npm install --global "pnpm@${PNPM_VERSION}" && pnpm --version

FROM pnpm-base AS build-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY docs/package.json ./docs/package.json
RUN pnpm install --frozen-lockfile

FROM build-deps AS build
COPY backend ./backend
COPY frontend ./frontend
RUN pnpm --dir backend run build && pnpm --dir frontend run build

FROM pnpm-base AS runtime
WORKDIR /app
ENV NODE_ENV=production
LABEL io.mypaas.persistent-volumes="/app/data"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY docs/package.json ./docs/package.json
RUN pnpm install --frozen-lockfile --prod --filter @wago/backend

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./public
RUN mkdir -p /app/data && chown -R node:node /app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- "http://127.0.0.1:3000/health" >/dev/null || exit 1
USER node
CMD ["node", "backend/dist/index.js"]
