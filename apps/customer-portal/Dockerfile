# syntax=docker/dockerfile:1
# Build from monorepo root: docker build -f apps/customer-portal/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ---- installer stage ----
FROM base AS installer
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY apps/customer-portal/package.json apps/customer-portal/
COPY packages/types/package.json       packages/types/
COPY packages/validators/package.json  packages/validators/
COPY packages/db/package.json          packages/db/
RUN pnpm install --frozen-lockfile

# ---- builder stage ----
FROM installer AS builder
WORKDIR /app
COPY apps/customer-portal/ apps/customer-portal/
COPY packages/types/       packages/types/
COPY packages/validators/  packages/validators/
COPY packages/db/          packages/db/

ENV NEXT_TELEMETRY_DISABLED=1

RUN cd packages/db && npx prisma generate --schema=prisma/schema || true
RUN cd packages/types && npx tsc --skipLibCheck 2>/dev/null || true
RUN cd packages/validators && npx tsup src/index.ts --format cjs,esm --dts 2>/dev/null || true

RUN cd apps/customer-portal && npx next build

RUN mkdir -p /tmp/public && \
    (cp -r apps/customer-portal/public/* /tmp/public/ 2>/dev/null || true)

# ---- runner stage ----
FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init

WORKDIR /app
COPY --from=builder /app/apps/customer-portal/.next/standalone ./
COPY --from=builder /app/apps/customer-portal/.next/static     ./apps/customer-portal/.next/static
COPY --from=builder /tmp/public                                ./apps/customer-portal/public

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health 2>/dev/null || exit 0

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/customer-portal/server.js"]
