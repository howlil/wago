FROM node:26-alpine AS pnpm-base
ARG PNPM_VERSION=11.21.0
RUN npm install --global "pnpm@${PNPM_VERSION}" && pnpm --version
WORKDIR /app

FROM pnpm-base AS core-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/gateway/package.json ./apps/gateway/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY apps/docs/package.json ./apps/docs/package.json
RUN pnpm install --frozen-lockfile --filter @wago/gateway... --filter @wago/dashboard...

FROM core-deps AS core-build
COPY apps/gateway ./apps/gateway
COPY apps/dashboard ./apps/dashboard
RUN pnpm --filter @wago/gateway build
RUN pnpm --filter @wago/dashboard build

FROM pnpm-base AS runtime
ENV NODE_ENV=production
LABEL io.mypaas.persistent-volumes="/app/data"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/gateway/package.json ./apps/gateway/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY apps/docs/package.json ./apps/docs/package.json
RUN pnpm install --frozen-lockfile --prod --filter @wago/gateway...

COPY --from=core-build /app/apps/gateway/dist ./apps/gateway/dist
COPY --from=core-build /app/apps/dashboard/dist ./public
RUN mkdir -p /app/data && chown -R node:node /app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- "http://127.0.0.1:3000/health" >/dev/null || exit 1
USER node
CMD ["node", "apps/gateway/dist/index.js"]
