# syntax=docker/dockerfile:1
# Build from monorepo root: docker build -f apps/api/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ---- installer stage ----
FROM base AS installer
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY apps/api/package.json                   apps/api/
COPY packages/core/package.json              packages/core/
COPY packages/db/package.json                packages/db/
COPY packages/framework/package.json         packages/framework/
COPY packages/repo-core/package.json         packages/repo-core/
COPY packages/repo-db/package.json           packages/repo-db/
COPY packages/types/package.json             packages/types/
COPY packages/validators/package.json        packages/validators/
COPY packages/workflows/package.json         packages/workflows/
RUN pnpm install --frozen-lockfile

# ---- builder stage ----
FROM installer AS builder
WORKDIR /app
# Copy sources
COPY apps/api/                apps/api/
COPY packages/core/           packages/core/
COPY packages/db/             packages/db/
COPY packages/framework/      packages/framework/
COPY packages/repo-core/      packages/repo-core/
COPY packages/repo-db/        packages/repo-db/
COPY packages/types/          packages/types/
COPY packages/validators/     packages/validators/
COPY packages/workflows/      packages/workflows/

# Generate Prisma client
RUN cd packages/db && npx prisma generate --schema=prisma/schema

# Build shared packages (best-effort; errors in optional packages are non-fatal)
RUN pnpm --filter @witylogix/types    build 2>/dev/null || \
    cd packages/types && npx tsc --skipLibCheck 2>/dev/null || true
RUN pnpm --filter @witylogix/validators build 2>/dev/null || \
    cd packages/validators && npx tsup src/index.ts --format cjs,esm --dts 2>/dev/null || true
RUN cd packages/db && npx tsc --skipLibCheck 2>/dev/null || true
RUN cd packages/core && npx tsc --skipLibCheck 2>/dev/null || true
RUN cd packages/repo-core && npx tsc --skipLibCheck 2>/dev/null || true
RUN cd packages/repo-db  && npx tsc --skipLibCheck 2>/dev/null || true
RUN cd packages/framework && npx tsup 2>/dev/null || true

# Build API
RUN cd apps/api && npx tsc --project tsconfig.json --skipLibCheck

# ---- runner stage ----
FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init curl

WORKDIR /app
COPY --from=builder /app ./

ENV NODE_ENV=production
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["dumb-init", "node", "apps/api/dist/server.js"]
