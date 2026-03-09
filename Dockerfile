# Multi-stage build for Witylogix Platform
# Stage 1: Dependencies
FROM node:20-alpine AS deps

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Set working directory
WORKDIR /app

# Copy workspace and package files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Install dependencies (only production)
RUN pnpm install --frozen-lockfile --prod

# Prune unused dependencies
RUN pnpm prune --prod

# Stage 2: Builder
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@9.15.0

WORKDIR /app

# Copy all source files
COPY . .

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.pnpm-store ./.pnpm-store

# Build arguments for configuration
ARG NEXT_PUBLIC_API_URL=http://localhost:3001

# Set environment variables for build
ENV NODE_ENV=production \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Generate Prisma client
RUN pnpm db:generate

# Build all packages and applications
RUN pnpm build

# Stage 3: Runtime
FROM node:20-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Copy built artifacts and dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Copy Prisma schema and generated client
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy built applications
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=builder /app/apps/dashboard/package.json ./apps/dashboard/

# Copy built packages
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/validators/dist ./packages/validators/dist
COPY --from=builder /app/packages/framework/dist ./packages/framework/dist
COPY --from=builder /app/packages/workflows/dist ./packages/workflows/dist
COPY --from=builder /app/packages/extension-core/dist ./packages/extension-core/dist
COPY --from=builder /app/packages/carrier-service/dist ./packages/carrier-service/dist

# Copy package files for built packages
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/validators/package.json ./packages/validators/
COPY --from=builder /app/packages/framework/package.json ./packages/framework/
COPY --from=builder /app/packages/workflows/package.json ./packages/workflows/
COPY --from=builder /app/packages/extension-core/package.json ./packages/extension-core/
COPY --from=builder /app/packages/carrier-service/package.json ./packages/carrier-service/

# Change ownership to nodejs user
RUN chown -R nextjs:nodejs /app

# Switch to nodejs user
USER nextjs

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
# Default to API server; can be overridden
CMD ["node", "apps/api/dist/server.js"]
