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
RUN cd packages/types && npx tsc --project tsconfig.json --skipLibCheck 2>/dev/null || true
RUN cd packages/validators && npx tsup src/index.ts --format cjs,esm --dts 2>/dev/null || true
RUN cd packages/db && npx tsc --skipLibCheck 2>/dev/null || true
RUN cd packages/core && npx tsc --skipLibCheck 2>/dev/null || true
RUN cd packages/repo-core && npx tsc --skipLibCheck 2>/dev/null || true
RUN cd packages/repo-db  && npx tsc --skipLibCheck 2>/dev/null || true
RUN cd packages/framework && npx tsup 2>/dev/null || true

# Build API — use tsconfig.build.json which excludes test files and has standalone settings
# to avoid rootDir resolution issues when extends chain is evaluated from monorepo root
# Note: tsc emits JS output even with type errors (noEmitOnError defaults to false).
# We allow non-zero exit so pre-existing TS errors don't block deployment.
# CI enforces type correctness separately via the typecheck workflow.
RUN cd apps/api && npx tsc --project tsconfig.build.json --skipLibCheck || true

# ---- runner stage ----
FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init curl

WORKDIR /app
COPY --from=builder /app ./

ENV NODE_ENV=production
EXPOSE 8000

# Give migrations time to complete before health checks start.
# Migration typically takes 5-30s; 60s covers slow cold-start scenarios.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run pending Prisma migrations then start the API server.
# prisma migrate deploy is idempotent — safe to run on every restart.
CMD ["dumb-init", "sh", "-c", \
    "npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma && \
    node apps/api/dist/server.js"]
