# Witylogix — Agent Rules

## Git Workflow (MANDATORY)

### Base Branch: `staging`
- The `staging` branch is the ONLY base branch for all work
- NEVER commit directly to `staging` or `main`
- ALWAYS create a feature branch from `staging`

### Branch Naming
```
feat/WIT-<id>-<short-description>    # New features
fix/WIT-<id>-<short-description>     # Bug fixes
refactor/WIT-<id>-<short-description> # Refactoring
```

### Workflow
1. Start work: `git checkout staging && git pull origin staging && git checkout -b feat/WIT-XX-description`
2. Commit with conventional commits (feat:, fix:, refactor:, test:, docs:, chore:)
3. Push: `git push origin feat/WIT-XX-description`
4. PR: `gh pr create --base staging --title "feat(WIT-XX): description"`
5. Never force push, never push to staging or main directly

### Pre-Commit Checks
Before committing, run: `pnpm lint && pnpm typecheck && pnpm test:run`

## Forbidden Actions
- Do NOT commit to `main` or `staging` directly
- Do NOT create branches from `main` — always branch from `staging`
- Do NOT push to staging or main directly
- Do NOT deploy to Railway — only DevOps deploys via routines
- Do NOT modify this CLAUDE.md file
- Do NOT install or remove global npm packages
- Do NOT modify Docker or Paperclip configuration
- Do NOT create, hire, or modify Paperclip agents
- Do NOT run docker compose up — use Railway Postgres and Redis only

## Environment
- Working dir: /root/Witylogix/witylogix-platform
- Node: v22, pnpm workspace
- Database: Railway Postgres (see .env for DATABASE_URL)
- Redis: Railway Redis (see .env for REDIS_URL)
- API: port 8000, Dashboard: port 3003, Portal: port 3004, Docs: port 3005

## Build and Test
```bash
pnpm install          # Install deps
pnpm db:generate      # Generate Prisma client
turbo build           # Build all packages
turbo dev --filter=X  # Dev server for specific app
pnpm test:run         # Run tests
pnpm lint             # Lint
pnpm typecheck        # Type check
```

## Project Structure
- apps/api — Fastify API server
- apps/dashboard — Next.js admin dashboard
- apps/customer-portal — Next.js customer portal
- apps/docs — Next.js documentation
- apps/tracking-page — Vite tracking page
- apps/shopify-app — Shopify app
- packages/db — Prisma schema and database client
- packages/core — Business logic
- packages/types — Shared TypeScript types
- packages/validators — Input validation schemas
