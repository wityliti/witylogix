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

# Install dependencies (@witylogix/db is a declared dep, so ... includes it)
RUN pnpm install --frozen-lockfile --filter @witylogix/shopify-app...

# Copy source
COPY apps/shopify-app/ apps/shopify-app/
COPY packages/types/ packages/types/
COPY packages/validators/ packages/validators/
COPY packages/db/ packages/db/

# Generate Prisma client (outputs to packages/db/src/generated/prisma)
RUN cd /app/packages/db && npx prisma generate --schema=./prisma/schema

# Compile @witylogix/db TypeScript → dist/ (dist/ is gitignored so it must be built here)
RUN pnpm --filter @witylogix/db exec tsc

# Copy Prisma-generated JS files into dist/generated/ so dist/index.js can resolve them at runtime
# (Prisma generates plain JS files in src/generated/; tsc does not copy them to dist/generated/)
RUN cp -r /app/packages/db/src/generated /app/packages/db/dist/generated && \
    echo '{"type":"commonjs"}' > /app/packages/db/dist/generated/prisma/package.json && \
    sed -i \
      's|import { PrismaClient, Prisma } from "./generated/prisma";|import { createRequire as _cr } from "module"; const { PrismaClient, Prisma } = _cr(import.meta.url)("./generated/prisma/index.js");|' \
      /app/packages/db/dist/index.js

# Build
WORKDIR /app/apps/shopify-app
RUN pnpm build

# Create a clean, symlink-free production deployment directory
WORKDIR /app
RUN pnpm deploy --filter @witylogix/shopify-app --prod /standalone

# pnpm deploy --prod creates fresh node_modules that lack the generated .prisma/client/ files.
# shopify-app imports PrismaClient directly from @prisma/client (not the custom output path),
# so we regenerate without the custom output to populate .prisma/client/ in standalone.
RUN cp -r /app/packages/db/prisma /tmp/prisma_default && \
    sed -i '/^\s*output\s*=/d' /tmp/prisma_default/schema/00-config.prisma
WORKDIR /standalone
RUN /app/packages/db/node_modules/.bin/prisma generate --schema /tmp/prisma_default/schema

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

EXPOSE 3000

CMD ["node", "node_modules/@react-router/serve/bin.js", "./build/server/index.js"]
