FROM node:26-alpine AS pnpm-base
ARG PNPM_VERSION=11.21.0
RUN set -eux; \
    case "$(uname -m)" in \
      x86_64) PNPM_ARCH=x64; PNPM_SHA256=8cad0a4d20318c0445d992630ace51edc0853fd259573f50ee5d0216dce9b420 ;; \
      aarch64|arm64) PNPM_ARCH=arm64; PNPM_SHA256=43587a1f3d26ee009c640378ef377cac3531990579acf0f35646531b7832831d ;; \
      *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;; \
    esac; \
    wget -qO /tmp/pnpm.tar.gz "https://github.com/pnpm/pnpm/releases/download/v${PNPM_VERSION}/pnpm-linux-${PNPM_ARCH}-musl.tar.gz"; \
    echo "${PNPM_SHA256}  /tmp/pnpm.tar.gz" | sha256sum -c -; \
    mkdir -p /opt/pnpm; \
    tar -xzf /tmp/pnpm.tar.gz -C /opt/pnpm; \
    ln -s /opt/pnpm/pnpm /usr/local/bin/pnpm; \
    rm /tmp/pnpm.tar.gz; \
    pnpm --version

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
