# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY packages/validators/package.json packages/validators/
COPY packages/types/package.json packages/types/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build --filter=@witylogix/api

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 witylogix && adduser --system --uid 1001 witylogix
COPY --from=builder --chown=witylogix:witylogix /app/apps/api/dist ./dist
COPY --from=builder --chown=witylogix:witylogix /app/node_modules ./node_modules
COPY --from=builder --chown=witylogix:witylogix /app/packages ./packages
USER witylogix
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD wget -q --spider http://localhost:3001/api/health || exit 1
CMD ["node", "dist/server.js"]
