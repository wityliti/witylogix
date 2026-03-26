# Contributing to Witylogix

Thank you for your interest in contributing to Witylogix! This document provides guidelines and instructions for contributing to our open-source delivery logistics platform.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style Guide](#code-style-guide)
- [Architecture Overview](#architecture-overview)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Commit Conventions](#commit-conventions)
- [Issue Guidelines](#issue-guidelines)
- [Community Guidelines](#community-guidelines)
- [Recognition & Credits](#recognition--credits)
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

1. **Fork the repository** on GitHub

2. **Clone your fork locally**

```bash
git clone https://github.com/YOUR-USERNAME/witylogix-platform.git
cd witylogix-platform
git remote add upstream https://github.com/witylogix/witylogix-platform.git
```

3. **Install dependencies**

```bash
pnpm install
```

4. **Set up environment variables**

```bash
cp .env.example .env.local
```

Edit `.env.local` with your local development configuration. See `docs/development/SETUP.md` for detailed environment configuration.

5. **Start development services**

```bash
docker compose up -d
```

6. **Generate Prisma client and run migrations**

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

7. **Start development servers**

```bash
pnpm dev
```

## Development Workflow

### Branch Naming Conventions

Follow these conventions for branch names:

- **Feature branches**: `feature/description-of-feature`
- **Bug fixes**: `fix/description-of-issue`
- **Sprint work**: `sprint-X/description`
- **Documentation**: `docs/description`
- **Refactoring**: `refactor/description`
- **Performance**: `perf/description`

Example: `feature/multi-carrier-support`, `fix/database-connection-pool`

### Creating a Feature

1. **Create and checkout a feature branch**

```bash
git checkout -b feature/your-feature-name upstream/main
```

2. **Make your changes** across monorepo packages/apps as needed

3. **Keep your branch up to date**

```bash
git fetch upstream
git rebase upstream/main
```

4. **Test your changes locally**

```bash
pnpm test           # Run all tests
pnpm lint          # Run linting
pnpm typecheck     # Type checking
pnpm format        # Format code
```

5. **Commit with conventional commit messages** (see [Commit Conventions](#commit-conventions))

6. **Push to your fork and create a Pull Request**

```bash
git push origin feature/your-feature-name
```

### Local Development Commands

```bash
# Start development servers with hot reload
pnpm dev

# Build all packages and apps
pnpm build

# Run linting across the monorepo
pnpm lint
pnpm lint --fix    # Auto-fix linting issues

# Run tests
pnpm test
pnpm test --watch

# Type checking
pnpm typecheck

# Format code with Prettier
pnpm format

# Database operations
pnpm db:generate    # Generate Prisma client
pnpm db:migrate     # Run pending migrations
pnpm db:seed        # Seed database with sample data
pnpm db:reset       # Reset database (development only)

# Clean build artifacts
pnpm clean

# Check for unused dependencies
pnpm dependencies:check
```

## Code Style Guide

For detailed code style conventions, see `docs/development/CODE_STYLE.md`. Quick overview:

### TypeScript

- **Strict mode**: All TypeScript strict compiler options enabled
- **No `any` types**: Use proper typing throughout the codebase
- **Named exports**: Prefer named exports over default exports
- **Interfaces for object shapes**: Use `interface` over `type` for object definitions

### React Components

- **Server components by default**: Use React Server Components in Next.js apps
- **Client components sparingly**: Only use `'use client'` when needed for interactivity
- **Component composition**: Break down large components into smaller, reusable pieces

### Tailwind CSS (v3.4)

- **Utility-first approach**: Use Tailwind utilities for styling
- **Custom variables**: Use `--wl-*` CSS variables for Witylogix-specific values
- **Dark mode**: Support dark theme using Tailwind's dark mode utilities
- **cn() utility**: Use the `cn()` helper to conditionally combine classNames

Example:
```tsx
import { cn } from '@/lib/utils';

<div className={cn(
  'flex items-center justify-between p-4 rounded-lg',
  'bg-white dark:bg-gray-900',
  'border border-gray-200 dark:border-gray-800',
  isActive && 'bg-blue-50 dark:bg-blue-900'
)}>
  Content
</div>
```

### File Naming Conventions

- **Components**: PascalCase (e.g., `UserCard.tsx`, `OrderTable.tsx`)
- **Utilities/helpers**: camelCase (e.g., `formatDate.ts`, `calculateDistance.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_ATTEMPTS.ts`)
- **Types/Interfaces**: PascalCase (e.g., `UserProfile.ts`, `OrderStatus.ts`)

### Import Ordering

1. External packages
2. Internal absolute imports (`@/`)
3. Relative imports (`./`, `../`)
4. Side-effect imports (last)

```typescript
import React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/button';
import { formatDate } from './helpers';
import './styles.css';
```

## Architecture Overview

Witylogix is built using a modular monorepo architecture with:

- **Turborepo** for build orchestration
- **pnpm workspaces** for package management
- **Multi-package organization**: Core libraries, utilities, and services
- **Multiple applications**: API, Dashboard, Driver App, Shopify App, Tracking Page

For a detailed architecture overview, see `docs/architecture/ARCHITECTURE.md` and the ADR documents in `docs/adr/`.

Key architectural principles:
- **Separation of concerns**: Business logic separated from presentation
- **Type safety**: Full TypeScript strict mode throughout
- **Plugin architecture**: Extensions and integrations via provider pattern
- **Event-driven workflows**: Async processing with BullMQ and event bus

## Testing Requirements

### Write Tests First

We follow a test-driven development approach where appropriate:

1. Write tests that describe the desired behavior
2. Write implementation code to make tests pass
3. Refactor while maintaining passing tests

### Test Coverage Targets

- **Critical business logic**: 80%+ coverage required
- **Utilities and helpers**: 70%+ coverage target
- **UI components**: 50%+ coverage target (snapshot tests acceptable)

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage report
pnpm test --coverage

# Run tests for a specific package
cd packages/core && pnpm test
```

### Test Frameworks

- **Vitest**: For unit testing packages
- **Jest**: For app-level tests
- **Playwright**: For E2E testing (see `PLAYWRIGHT_INTEGRATION.md`)

### Example Test

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

  it('should handle same coordinates', () => {
    const result = calculateDistance(
      { lat: 40.7128, lon: -74.006 },
      { lat: 40.7128, lon: -74.006 }
    );
    expect(result).toBe(0);
  });
});
```

## Pull Request Process

### Before Submitting

- [ ] Ensure tests pass: `pnpm test`
- [ ] No TypeScript errors: `pnpm typecheck`
- [ ] Code is formatted: `pnpm format`
- [ ] No linting issues: `pnpm lint`
- [ ] Updated relevant documentation
- [ ] Added entry to `CHANGELOG.md`
- [ ] Tests cover new functionality (80%+ coverage)
- [ ] Commit messages follow conventions

### Submitting a PR

1. **Use the pull request template** (automatically provided)
2. **Describe the change clearly**: What does it do and why?
3. **Link related issues**: Use "Fixes #123" to link issues
4. **Provide testing instructions**: How to verify the change
5. **Include screenshots** for UI changes
6. **Request review** from code owners (see `.github/CODEOWNERS`)

### PR Checklist

The template includes:
- Description of changes
- Type of change (feature, bugfix, docs, etc.)
- Testing instructions
- Checklist items to verify before merge

### Code Review

- Reviews from at least 2 maintainers required for merge
- Address feedback promptly
- Keep the PR focused and reasonably sized (< 400 LOC ideally)
- Squash commits before merge if requested

## Commit Conventions

We use **Conventional Commits** for clear, semantic commit messages:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types

- **feat**: New feature or functionality
- **fix**: Bug fix (fix a broken feature)
- **docs**: Documentation changes (README, guides, etc.)
- **style**: Code style changes (formatting, semicolons) - NOT Tailwind changes
- **refactor**: Code refactoring without feature changes
- **perf**: Performance improvements
- **test**: Test additions or modifications
- **chore**: Build, dependencies, or tooling changes
- **ci**: CI/CD configuration changes

### Scope Convention

Use relevant scopes:

- **api** - Backend API changes
- **dashboard** - Admin dashboard changes
- **db** - Database schema or Prisma changes
- **auth** - Authentication/authorization
- **carriers** - Carrier integration
- **drivers** - Driver app features
- **types** - Type definitions
- **workflows** - Workflow orchestration
- **core** - Core utilities and business logic

### Examples

```
feat(auth): add JWT token refresh mechanism

- Implement refresh token rotation
- Add refresh endpoint to auth controller
- Update authentication middleware

Fixes #123

fix(api): resolve database connection pool leak

Ensure connections are properly closed in error cases

docs(contributing): update testing guidelines

refactor(dashboard): extract common layout component

test(validators): add comprehensive validation tests for user registration
```

## Issue Guidelines

### Reporting Bugs

Use the bug report template when creating an issue:

1. **Title**: Clear, concise description of the bug
2. **Environment**: Node version, OS, relevant software versions
3. **Steps to reproduce**: Exact steps to reproduce the issue
4. **Expected behavior**: What should happen
5. **Actual behavior**: What actually happens
6. **Screenshots/logs**: Attach relevant logs or screenshots
7. **Additional context**: Any other relevant information

### Requesting Features

Use the feature request template:

1. **Title**: Clear description of the desired feature
2. **Problem statement**: What problem does this solve?
3. **Proposed solution**: How should it work?
4. **Alternatives considered**: Any other approaches?
5. **Additional context**: Use cases, examples, references

### Requesting Integrations

Use the integration request template:

1. **Integration name**: Name of the service/platform
2. **Use case**: Why is this integration needed?
3. **Documentation**: Link to service documentation
4. **Priority**: Impact and urgency level
5. **Example implementation**: Any reference implementations?

## Community Guidelines

### Code of Conduct

All contributors must adhere to our Code of Conduct:

- Be respectful and inclusive
- Provide constructive feedback
- Respect different opinions and experiences
- Report violations to conduct@witylogix.com

### Communication

- Use clear, professional language
- Be patient with new contributors
- Help others learn and grow
- Celebrate successes and learnings

### Attribution

We value all contributions, no matter how small. Contributors will be:

- Added to `CONTRIBUTORS.md`
- Mentioned in release notes for significant contributions
- Given credit in relevant documentation

## Recognition & Credits

We recognize contributions in multiple ways:

1. **Contributor listing**: All contributors listed in `CONTRIBUTORS.md`
2. **Release notes**: Significant contributors mentioned in releases
3. **Commit history**: Your commits preserved in the git history
4. **Community recognition**: Highlighted in monthly community updates

### Contributing Paths

- **Code contributions**: Core features, bug fixes, performance improvements
- **Documentation**: Guides, tutorials, ADRs, API documentation
- **Community**: Issue triage, testing, helping other developers
- **Integration**: Adding new provider support or integrations
- **Testing**: E2E tests, test coverage improvements

## License

By contributing to Witylogix, you agree that your contributions will be licensed under the AGPL-3.0 License. See `LICENSE` for details.

---

## Getting Help

- **Documentation**: https://docs.witylogix.com
- **Discord Community**: https://discord.gg/witylogix
- **Discussions**: https://github.com/witylogix/witylogix-platform/discussions
- **Issues**: https://github.com/witylogix/witylogix-platform/issues

Thank you for contributing to Witylogix!
