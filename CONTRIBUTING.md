# Contributing to Witylogix

Thank you for your interest in contributing to Witylogix! This document provides guidelines and instructions for contributing to our open-source delivery logistics platform.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Commit Conventions](#commit-conventions)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Architecture Notes](#architecture-notes)
- [License](#license)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please read our [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before participating.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 20 or higher
- **pnpm**: Version 9 or higher (we use pnpm as our package manager)
- **Docker**: For running development services (PostgreSQL, Redis)
- **Git**: For version control

### Installation Steps

1. **Clone the repository**

```bash
git clone https://github.com/witylogix/witylogix-platform.git
cd witylogix-platform
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

```bash
cp .env.example .env.local
```

Edit `.env.local` with your local development configuration:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/witylogix_dev

# Redis
REDIS_URL=redis://localhost:6379

# API
API_PORT=3001
API_HOST=localhost

# Dashboard
DASHBOARD_PORT=3000

# Shopify (if working on Shopify integration)
SHOPIFY_API_KEY=your_key_here
SHOPIFY_API_SECRET=your_secret_here
```

4. **Start development services**

```bash
docker compose up -d
```

This starts PostgreSQL and Redis containers. Verify they're running:

```bash
docker compose ps
```

5. **Generate Prisma client and run migrations**

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

6. **Start development servers**

```bash
pnpm dev
```

This launches all development servers in watch mode using Turbo.

## Project Structure

Witylogix is a monorepo built with **Turborepo**, organized as follows:

### Packages (`packages/`)

Core shared packages used across applications:

- **`core`** - Core business logic, utilities, and helpers
- **`db`** - Prisma ORM setup and database schema definitions
- **`types`** - TypeScript type definitions shared across the platform
- **`validators`** - Input validation schemas and utilities
- **`framework`** - Custom framework abstractions and utilities
- **`workflows`** - Workflow definitions and orchestration logic
- **`extension-core`** - Core functionality for extension development
- **`carrier-service`** - Carrier integration service

### Applications (`apps/`)

Production applications:

- **`api`** - Backend API (Fastify server, port 3001)
- **`dashboard`** - Admin dashboard (Next.js, port 3000)
- **`shopify-app`** - Shopify integration app
- **`driver-app`** - Mobile driver application
- **`tracking-page`** - Public tracking page for customers

### Extensions (`extensions/`)

Merchant-facing UI extensions:

- **`checkout-ui`** - Shopify checkout customization extension
- **`pos-ui`** - Point-of-sale integration extension

### Configuration Files

- **`turbo.json`** - Turborepo configuration
- **`pnpm-workspace.yaml`** - pnpm workspace definition
- **`docker-compose.yml`** - Development services (PostgreSQL, Redis)
- **`Dockerfile`** - Multi-stage production build
- **`.dockerignore`** - Docker build optimization

## Development Workflow

### Branch Naming

Follow these conventions for branch names:

- **Feature branches**: `feature/description-of-feature`
- **Bug fixes**: `fix/description-of-issue`
- **Sprint work**: `sprint-X/description`
- **Documentation**: `docs/description`
- **Refactoring**: `refactor/description`

Example: `feature/multi-carrier-support` or `fix/database-connection-pool`

### Creating a Feature

1. Create a new branch from `main`:

```bash
git checkout -b feature/your-feature-name
```

2. Make your changes across the monorepo packages/apps as needed

3. Test your changes locally:

```bash
pnpm test
pnpm lint
pnpm typecheck
```

4. Commit your changes using [Conventional Commits](#commit-conventions)

5. Push and create a Pull Request

### Local Development Commands

```bash
# Start development servers with hot reload
pnpm dev

# Build all packages and apps
pnpm build

# Run linting across the monorepo
pnpm lint

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Format code with Prettier
pnpm format

# Database operations
pnpm db:generate    # Generate Prisma client
pnpm db:migrate     # Run pending migrations
pnpm db:seed        # Seed database with sample data

# Docker operations
pnpm docker:up      # Start development containers
pnpm docker:down    # Stop development containers
pnpm docker:build   # Build Docker images
```

## Code Style

### TypeScript

We enforce strict TypeScript compilation:

- **Strict mode**: All TypeScript strict compiler options enabled
- **No `any` types**: Avoid using `any`; use proper typing
- **Interfaces over types**: Prefer `interface` for object shapes

### ESLint

Run ESLint to catch style and potential errors:

```bash
pnpm lint
```

ESLint configuration is in `.eslintrc.js` at the root and individual apps.

### Prettier

We use Prettier for code formatting. It's automatically run on commit (pre-commit hook):

```bash
pnpm format
```

All code must pass Prettier formatting before submission.

### Tailwind CSS

Dashboard styling uses **Tailwind CSS v3.4**:

- Use utility classes in components
- Custom colors and spacing defined in `apps/dashboard/tailwind.config.js`
- Mobile-first responsive design
- Dark mode support through Tailwind's dark mode utilities

Example:

```tsx
<div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg shadow">
  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
    Title
  </h1>
</div>
```

### Naming Conventions

- **Components**: PascalCase (e.g., `UserCard.tsx`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_ATTEMPTS`)
- **Types/Interfaces**: PascalCase (e.g., `UserProfile`)

## Testing

### Vitest (Packages)

Packages use **Vitest** for testing:

```bash
cd packages/core
pnpm test
pnpm test --watch
```

**Test file naming**: `*.test.ts` or `*.spec.ts`

Example test:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateDistance } from './calculateDistance';

describe('calculateDistance', () => {
  it('should calculate distance between two coordinates', () => {
    const result = calculateDistance(
      { lat: 40.7128, lon: -74.006 },
      { lat: 34.0522, lon: -118.2437 }
    );
    expect(result).toBeGreaterThan(0);
  });
});
```

### Jest (Apps)

Applications use **Jest** for testing:

```bash
cd apps/api
pnpm test
pnpm test --watch
```

**Test file naming**: `*.test.ts`, `*.spec.ts`, or `__tests__/` directory

Example test:

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createApp } from './app';

describe('API Server', () => {
  let app: any;

  beforeEach(async () => {
    app = await createApp();
  });

  it('should handle health check', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });
    expect(response.statusCode).toBe(200);
  });
});
```

### Test Coverage

Aim for:

- Critical business logic: 80%+ coverage
- Utilities and helpers: 70%+ coverage
- UI components: 50%+ coverage

Run coverage report:

```bash
pnpm test --coverage
```

## Commit Conventions

We use **Conventional Commits** for clear, semantic commit messages:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.) - not Tailwind changes
- **refactor**: Code refactoring without feature changes
- **perf**: Performance improvements
- **test**: Test additions or modifications
- **chore**: Build, dependencies, or tooling changes
- **ci**: CI/CD configuration changes

### Examples

```
feat(auth): add JWT token refresh mechanism

fix(api): resolve database connection pool leak

Fixes #123

docs(contributing): update testing guidelines

refactor(dashboard): extract common layout component

test(validators): add validation tests for user registration
```

### Scope Convention

Use relevant scopes:

- **api** - Backend API changes
- **dashboard** - Admin dashboard changes
- **db** - Database schema or Prisma changes
- **auth** - Authentication/authorization
- **carriers** - Carrier integration
- **drivers** - Driver app features
- **types** - Type definitions
- **workflows** - Workflow changes
- etc.

## Pull Request Guidelines

### Before Submitting

1. **Update from main**:

```bash
git fetch origin
git rebase origin/main
```

2. **Run all checks**:

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

3. **Test your changes**:
   - Manually test in development
   - Write tests for new functionality
   - Verify existing tests pass

4. **Ensure no conflicts** and all CI checks pass

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Fixes #(issue number)

## Testing
Describe how this was tested:
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] No new warnings generated
- [ ] Documentation updated
- [ ] Commit messages follow conventions
```

### PR Review Process

- Minimum 1 approval required before merging
- All CI checks must pass
- No unresolved conversations
- Feature branches must be up-to-date with main

## Architecture Notes

### Database

- **Prisma 6/7** with custom schema folder configuration (`prismaSchemaFolder`)
- Schema files organized by domain in `packages/db/src/schemas/`
- Migration files in `packages/db/migrations/`

### Prisma Schema Organization

When adding models, use the following pattern:

```prisma
// packages/db/src/schemas/user.prisma
model User {
  id String @id @default(cuid())
  email String @unique
  // ... fields
}
```

### Platform Adapter Pattern

Witylogix supports multiple platforms (Shopify, custom integrations, etc.). Use the `PlatformAdapter` interface for platform-specific implementations:

```typescript
interface PlatformAdapter {
  validateWebhook(payload: unknown, signature: string): Promise<boolean>;
  parseOrder(rawOrder: unknown): Promise<Order>;
  notifyCustomer(orderId: string, message: string): Promise<void>;
}
```

Platform-specific adapters are in `packages/carrier-service/src/adapters/`.

### Prisma Metadata Access Pattern

For accessing Prisma model metadata (useful in generics/utilities):

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Type-safe model access
const modelName = (prisma as any).modelName; // e.g., "User"
```

This pattern allows type-safe database operations while working with dynamic schemas.

### Project Structure Best Practices

1. **Isolate packages**: Each package should have a single responsibility
2. **Minimize dependencies**: Reduce circular dependencies between packages
3. **Type safety**: Export types from packages, not just implementations
4. **Clear boundaries**: Apps depend on packages, not vice versa
5. **Testing at package level**: Test business logic in packages, integration in apps

## License

By contributing to Witylogix, you agree that your contributions will be licensed under the [AGPL-3.0-only License](./LICENSE).

## Questions or Need Help?

- Check existing [GitHub Issues](https://github.com/witylogix/witylogix-platform/issues)
- Read the [documentation](./docs/)
- Start a [discussion](https://github.com/witylogix/witylogix-platform/discussions)

---

Thank you for contributing to Witylogix! We appreciate your efforts to improve our platform.
