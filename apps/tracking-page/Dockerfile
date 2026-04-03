# syntax=docker/dockerfile:1
# Build from monorepo root: docker build -f apps/tracking-page/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ---- installer stage ----
FROM base AS installer
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY apps/tracking-page/package.json  apps/tracking-page/
COPY packages/types/package.json      packages/types/
COPY packages/validators/package.json packages/validators/
RUN pnpm install --frozen-lockfile

# ---- builder stage ----
FROM installer AS builder
WORKDIR /app
COPY apps/tracking-page/ apps/tracking-page/
COPY packages/types/     packages/types/
COPY packages/validators/ packages/validators/

RUN cd apps/tracking-page && npx vite build

# ---- runner stage ----
FROM node:22-alpine AS runner
RUN npm install -g serve@14 && apk add --no-cache dumb-init

WORKDIR /app
COPY --from=builder /app/apps/tracking-page/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/ 2>/dev/null || exit 0

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT:-3000}"]
