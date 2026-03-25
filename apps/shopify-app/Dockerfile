# ── Build Stage ──────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./

# Copy only the packages needed by shopify-app
COPY apps/shopify-app/package.json apps/shopify-app/
COPY packages/types/package.json packages/types/
COPY packages/validators/package.json packages/validators/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @witylogix/shopify-app...

# Copy source
COPY apps/shopify-app/ apps/shopify-app/
COPY packages/types/ packages/types/
COPY packages/validators/ packages/validators/

# Build
WORKDIR /app/apps/shopify-app
RUN pnpm build

# ── Production Stage ─────────────────────────────────────
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy built app and production deps
COPY --from=builder /app/apps/shopify-app/build ./build
COPY --from=builder /app/apps/shopify-app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/shopify-app/node_modules ./app_modules

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["npx", "react-router-serve", "./build/server/index.js"]
