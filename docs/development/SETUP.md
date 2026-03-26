# Development Setup Guide

This guide walks you through setting up the Witylogix development environment.

## System Requirements

### Node.js

- **Version**: 20 LTS or higher
- **Installation**: https://nodejs.org/
- **Verify**: `node --version`

### pnpm

- **Version**: 9.0 or higher
- **Installation**: `npm install -g pnpm`
- **Verify**: `pnpm --version`

### Docker & Docker Compose

- **Docker**: Latest version (Desktop or CLI)
- **Docker Compose**: v2 or higher
- **Installation**: https://docs.docker.com/get-docker/
- **Verify**: `docker --version && docker compose --version`

### Git

- **Installation**: https://git-scm.com/
- **Verify**: `git --version`

## Clone & Install

### 1. Clone the Repository

```bash
# For contributors: fork first, then clone your fork
git clone https://github.com/YOUR-USERNAME/witylogix-platform.git
cd witylogix-platform

# Add upstream remote for keeping fork synchronized
git remote add upstream https://github.com/witylogix/witylogix-platform.git
```

### 2. Install Dependencies

```bash
pnpm install
```

This installs all workspace dependencies for packages and applications.

### 3. Verify Installation

```bash
# Check monorepo structure
pnpm ls --depth=0

# Expected output shows packages/ and apps/ directories
```

## Environment Configuration

### Creating .env.local

```bash
cp .env.example .env.local
```

### Configuration Walkthrough

Edit `.env.local` with values for your environment:

#### Server Configuration

```env
NODE_ENV=development
PORT=8000
LOG_LEVEL=debug
```

- **NODE_ENV**: Controls feature flags and logging behavior
- **PORT**: API server port (default: 8000)
- **LOG_LEVEL**: `error`, `warn`, `info`, `debug` (default: info)

#### Database Configuration

```env
DATABASE_URL="postgresql://witylogix:witylogix_dev@localhost:5432/witylogix?schema=public"
DATABASE_POOL_SIZE=20
```

- **DATABASE_URL**: PostgreSQL connection string
- **DATABASE_POOL_SIZE**: Connection pool size (default: 20 for local dev)

**Format**: `postgresql://[user]:[password]@[host]:[port]/[database]?schema=[schema]`

#### Redis Configuration

```env
REDIS_URL="redis://localhost:6379"
```

- **REDIS_URL**: Redis connection string for caching and queues
- Used for sessions, caching, and job queue (BullMQ)

#### JWT Authentication

```env
JWT_SECRET=your-secure-secret-key-min-32-chars-required
JWT_ACCESS_EXPIRY=24h
JWT_REFRESH_EXPIRY=7d
```

- **JWT_SECRET**: Signing key (min 32 chars for production)
- **JWT_ACCESS_EXPIRY**: Access token lifetime
- **JWT_REFRESH_EXPIRY**: Refresh token lifetime

**Generate a secure secret**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### Application URLs

```env
APP_URL="http://localhost:3000"
DASHBOARD_URL="http://localhost:3001"
```

- **APP_URL**: Public-facing app URL
- **DASHBOARD_URL**: Admin dashboard URL

#### Optional Services

These are optional for full development but useful for specific features:

```env
# Email (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password

# Twilio SMS (optional)
TWILIO_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE=+1234567890

# Stripe (optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Mapbox (optional)
MAPBOX_TOKEN=your-token

# AWS S3 (optional)
S3_BUCKET=your-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY=your-key
S3_SECRET_KEY=your-secret
```

See `.env.example` for complete list of configuration options.

## Database Setup

### Start Docker Containers

```bash
docker compose up -d
```

This starts:
- **PostgreSQL**: Port 5432 with PostGIS extension
- **Redis**: Port 6379
- **mailhog**: Port 8025 (email testing)

### Verify Services Are Running

```bash
docker compose ps
```

Expected output:
```
NAME                COMMAND                  STATUS
witylogix-postgres  postgres                 Up 2 minutes
witylogix-redis     redis-server             Up 2 minutes
mailhog            MailHog version v1.0.1  Up 2 minutes
```

### Generate Prisma Client

```bash
pnpm db:generate
```

Generates the Prisma client based on schema in `packages/db/prisma/schema.prisma`.

### Run Database Migrations

```bash
pnpm db:migrate
```

Applies pending migrations to your local database.

### Seed Database (Optional)

```bash
pnpm db:seed
```

Populates the database with sample data:
- Test users and organizations
- Sample delivery zones
- Demo carriers and drivers
- Example orders and shipments

Useful for manual testing and development.

### Reset Database (Development Only)

```bash
pnpm db:reset
```

**Warning**: This deletes all data and recreates the database from scratch. Only for development.

## Running All Apps

### Start Development Servers

```bash
pnpm dev
```

This uses Turbo to start all applications in watch mode:

- **API**: http://localhost:8000
- **Dashboard**: http://localhost:3000
- **Driver App**: Development server (typically Metro bundler)
- **Shopify App**: http://localhost:3001
- **Docs**: http://localhost:3002

Watch mode enables hot reload for instant feedback on code changes.

### Monitor Development

```bash
# In another terminal, watch Turbo task execution
turbo build --watch

# View Turbo UI (visual task graph)
turbo --ui
```

### Stop Development Servers

```bash
# In the terminal running pnpm dev
Ctrl+C

# Stop Docker containers
docker compose down
```

## Running Individual Apps

### Start Specific Application

```bash
cd apps/api
pnpm dev

# Or from root with scope flag (Turbo)
pnpm dev --filter=api
```

### Available Applications

- **API**: `cd apps/api && pnpm dev`
- **Dashboard**: `cd apps/dashboard && pnpm dev`
- **Driver App**: `cd apps/driver-app && pnpm dev`
- **Shopify App**: `cd apps/shopify-app && pnpm dev`
- **Tracking Page**: `cd apps/tracking-page && pnpm dev`
- **Docs**: `cd apps/docs && pnpm dev`

## Hot Reload Behavior

All applications support hot module replacement (HMR):

- **Next.js apps** (Dashboard, Shopify, Tracking, Docs): HMR on file save
- **Fastify API**: Full hot reload via nodemon
- **TypeScript packages**: Recompiled on change

### If Hot Reload Doesn't Work

```bash
# 1. Check if process is running
ps aux | grep -E "node|next"

# 2. Clear cache
rm -rf .turbo
pnpm clean

# 3. Restart development server
pnpm dev
```

## Debugging Tips

### VS Code Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "program": "${workspaceFolder}/apps/api/src/index.ts",
      "preLaunchTask": "build",
      "outFiles": ["${workspaceFolder}/apps/api/dist/**/*.js"],
      "runtimeArgs": ["--loader", "tsx/cjs"],
      "sourceMaps": true
    },
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug Dashboard",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/apps/dashboard",
      "sourceMaps": true
    }
  ]
}
```

### Chrome DevTools

1. **Dashboard**: Open http://localhost:3000, press `F12`
2. **API Requests**: Use Network tab to inspect API calls
3. **Application State**: Use React DevTools extension

### API Debugging

```bash
# Enable verbose logging
LOG_LEVEL=debug pnpm dev --filter=api

# Check API health
curl http://localhost:8000/health
```

### Database Debugging

```bash
# Connect to PostgreSQL directly
psql postgresql://witylogix:witylogix_dev@localhost:5432/witylogix

# View tables
\dt

# Exit
\q
```

### View Email Locally

Mail sent during development goes to mailhog:
- Web UI: http://localhost:8025
- SMTP: localhost:1025

## Common Issues & Fixes

### Issue: `pnpm install` fails with permission errors

**Solution**:
```bash
# Check pnpm store location
pnpm store path

# Clear store and reinstall
pnpm store prune
pnpm install
```

### Issue: Port already in use (3000, 3001, 8000, etc.)

**Find and kill process**:
```bash
# macOS/Linux
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

Or change the port in `.env.local`:
```env
PORT=8001
DASHBOARD_URL=http://localhost:3001
```

### Issue: Docker containers won't start

```bash
# Check Docker daemon
docker ps

# Rebuild containers
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Issue: Database connection fails

**Verify connection string**:
```bash
# Check PostgreSQL is running
docker compose ps

# Test connection
psql postgresql://witylogix:witylogix_dev@localhost:5432/witylogix
```

**Reset database**:
```bash
pnpm db:reset
```

### Issue: Turbo cache corruption

```bash
# Clear Turbo cache
rm -rf .turbo

# Clear all build artifacts
pnpm clean

# Rebuild everything
pnpm build
```

### Issue: Node modules issues

```bash
# Remove all node_modules
find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null

# Clear pnpm store
pnpm store prune

# Reinstall
pnpm install
```

## IDE Recommendations

### VS Code Extensions

**Essential**:
- TypeScript Vue Plugin
- ESLint
- Prettier - Code formatter
- Tailwind CSS IntelliSense

**Recommended**:
- Thunder Client (API testing)
- SQLTools (database management)
- GitLens
- React DevTools
- Debugger for Chrome

Install with:
```bash
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
```

### Settings Configuration

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

### WebStorm / IntelliJ

Enable:
- Settings → Languages & Frameworks → TypeScript
- Settings → Languages & Frameworks → JavaScript → Prettier
- Settings → Tools → Run Configurations → Enable "Run with" for pnpm

## Next Steps

1. **Read the architecture guide**: `docs/architecture/ARCHITECTURE.md`
2. **Review code style**: `docs/development/CODE_STYLE.md`
3. **Check out the FAQ**: `docs/development/FAQ.md`
4. **Start coding**: Create a feature branch and submit a PR!

## Getting Help

- **Questions**: Check `docs/development/FAQ.md`
- **Community**: [Discord](https://discord.gg/witylogix)
- **Issues**: [GitHub Issues](https://github.com/witylogix/witylogix-platform/issues)
- **Discussions**: [GitHub Discussions](https://github.com/witylogix/witylogix-platform/discussions)
