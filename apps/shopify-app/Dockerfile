# ── Build Stage ──────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./

# Copy package.json files for shopify-app and its workspace deps
COPY apps/shopify-app/package.json apps/shopify-app/
COPY packages/types/package.json packages/types/
COPY packages/validators/package.json packages/validators/
COPY packages/db/package.json packages/db/

# Install dependencies (includes prisma CLI from packages/db devDependencies)
RUN pnpm install --frozen-lockfile --filter @witylogix/shopify-app... --filter @witylogix/db

# Copy source
COPY apps/shopify-app/ apps/shopify-app/
COPY packages/types/ packages/types/
COPY packages/validators/ packages/validators/
COPY packages/db/ packages/db/

# Generate Prisma client (outputs to packages/db/src/generated/prisma)
RUN cd /app/packages/db && npx prisma generate --schema=./prisma/schema

# Build
WORKDIR /app/apps/shopify-app
RUN pnpm build

# Create a clean, symlink-free production deployment directory
WORKDIR /app
RUN pnpm deploy --filter @witylogix/shopify-app --prod /standalone

# ── Production Stage ─────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy clean node_modules from pnpm deploy (no broken pnpm store symlinks)
COPY --from=builder /standalone/node_modules ./node_modules
COPY --from=builder /standalone/package.json ./
# Build output is separate from pnpm deploy output
COPY --from=builder /app/apps/shopify-app/build ./build
# Generated Prisma client referenced by @prisma/client at runtime
COPY --from=builder /app/packages/db/src/generated/prisma ./packages/db/src/generated/prisma

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node_modules/.bin/react-router-serve", "./build/server/index.js"]
