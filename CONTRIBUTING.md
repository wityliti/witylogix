# Contributing to Witylogix

Thank you for your interest in contributing to Witylogix, the open-source delivery logistics platform. Every contribution, whether it is a bug report, a documentation improvement, or a new feature, helps make last-mile delivery more accessible and transparent for everyone.

We value clarity, quality, and respect. This guide explains how to get involved.

## Code of Conduct

All participants in this project are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing. We are committed to providing a welcoming and inclusive environment for everyone.

## Ways to Contribute

There are many ways to help, regardless of your experience level:

- **Bug reports** -- found something broken? Open an issue with reproduction steps.
- **Feature requests** -- have an idea? Start a discussion or open an issue.
- **Code** -- fix bugs, implement features, or improve performance.
- **Documentation** -- improve guides, add examples, fix typos.
- **Translations** -- help localize the customer portal, tracking page, or driver app.
- **Extensions** -- build Shopify extensions, carrier integrations, or webhook handlers.
- **Tests** -- increase coverage, add edge-case tests, or improve E2E flows.

## Development Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 20.0.0 | Runtime |
| pnpm | 9.15 | Package manager |
| Docker | Latest | PostgreSQL, Redis, and other services |
| Git | Latest | Version control |

### Getting Started

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/<your-username>/witylogix-platform.git
   cd witylogix-platform
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in the required values. Never commit `.env` files.

4. **Start infrastructure services**

   ```bash
   pnpm docker:up
   ```

5. **Set up the database**

   ```bash
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed
   ```

6. **Start the development server**

   ```bash
   pnpm dev
   ```

   This starts all apps and packages in development mode via Turborepo.

## Project Structure

```
witylogix-platform/
  apps/
    api/                 # Fastify 5 REST API
    dashboard/           # Next.js 15 admin dashboard
    customer-portal/     # Next.js 15 customer-facing portal
    docs/                # Next.js + Fumadocs documentation site
    tracking-page/       # Vite + React public tracking page
    shopify-app/         # React Router v7 Shopify integration
    driver-app/          # React Native / Expo driver application
  packages/
    core/                # Shared business logic
    db/                  # Prisma schema, migrations, and client
    types/               # Shared TypeScript type definitions
    validators/          # Input validation schemas
    framework/           # Internal framework utilities
    workflows/           # Workflow engine and definitions
    sdk/                 # Public SDK for API consumers
    carrier-service/     # Carrier integration abstractions
    checkout-widget/     # Embeddable checkout widget
    extension-core/      # Extension system core
  infra/                 # Docker Compose, deploy scripts
  tests/                 # Shared test utilities and E2E tests
```

## Making Changes

### Branching Strategy

All work happens on feature branches created from `main`.

```bash
git checkout main
git pull origin main
git checkout -b feat/my-feature
```

Branch naming conventions:

- `feat/description` -- new features
- `fix/description` -- bug fixes
- `refactor/description` -- code refactoring
- `docs/description` -- documentation changes
- `test/description` -- test additions or fixes
- `chore/description` -- maintenance tasks

Keep branches focused on a single concern. If a change grows large, break it into smaller pull requests.

## Coding Standards

### TypeScript

- **Strict mode** is enabled across the entire monorepo. Do not use `any` unless absolutely unavoidable, and add a comment explaining why.
- Use `readonly` properties and `ReadonlyArray` where applicable.
- Prefer `interface` for object shapes and `type` for unions and intersections.

### Immutability

Always create new objects instead of mutating existing ones:

```typescript
// Correct: return a new object
const updated = { ...order, status: 'delivered' };

// Wrong: mutate in place
order.status = 'delivered';
```

### File Size Limits

- Keep files under **500 lines**. If a file exceeds this, extract related logic into separate modules.
- Keep functions under **50 lines**.
- Avoid nesting deeper than **4 levels**.

### General Principles

- Use meaningful, descriptive names for variables, functions, and types.
- Handle errors explicitly at every level. Never silently swallow errors.
- Validate all input at system boundaries using schemas from the `validators` package.
- Never hardcode secrets, API keys, or credentials in source code.

## Testing Requirements

We require a minimum of **80% test coverage** for all new code.

### Test-Driven Development

Follow the TDD cycle for all new features and bug fixes:

1. **RED** -- Write a failing test that describes the expected behavior.
2. **GREEN** -- Write the minimal implementation to make the test pass.
3. **REFACTOR** -- Clean up the code while keeping tests green.

### Test Frameworks

| Type | Framework | Command |
|------|-----------|---------|
| Unit | Vitest | `pnpm test` |
| E2E | Playwright | `pnpm test:e2e` |

### Guidelines

- Test edge cases and error paths, not just the happy path.
- Mock external dependencies (databases, APIs, third-party services).
- Keep tests fast and isolated. Each test should be independent of others.
- Place unit tests alongside source files or in a `__tests__` directory within the same package.
- Place E2E tests in the top-level `tests/` directory.

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/). Every commit message must follow this format:

```
<type>(<optional scope>): <description>

<optional body>
```

### Types

| Type | When to Use |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies, or tooling changes |
| `perf` | Performance improvement |
| `ci` | CI/CD configuration changes |

### Examples

```
feat(api): add real-time delivery ETA endpoint

fix(customer-portal): correct timezone offset in delivery timeline

refactor(db): extract query builders into separate modules

docs: add webhook integration guide

test(core): add unit tests for rate calculation engine
```

### Scope

Use the app or package name as the scope when the change is limited to one workspace (e.g., `api`, `dashboard`, `core`, `db`).

## Pull Request Process

1. **Before opening a PR**, make sure:
   - All tests pass: `pnpm test`
   - The build succeeds: `pnpm build`
   - Linting passes: `pnpm lint`
   - Your branch is up to date with `main`

2. **Open a pull request** against `main` with:
   - A clear, concise title (under 70 characters)
   - A description that explains **what** changed and **why**
   - A test plan describing how the change was verified
   - Links to any related issues

3. **PR template** -- your description should include:

   ```markdown
   ## Summary
   - Brief description of changes

   ## Test Plan
   - [ ] Unit tests added/updated
   - [ ] E2E tests added/updated (if applicable)
   - [ ] Manual testing steps

   ## Related Issues
   Closes #<issue-number>
   ```

4. **Review requirements**:
   - At least one approving review from a maintainer
   - All CI checks must pass (build, lint, tests, type checking)
   - No unresolved review comments

5. **Merging**: Maintainers will merge approved PRs. We use squash merges to keep the history clean.

## Security Issues

**Do not open a public issue for security vulnerabilities.**

Please report security issues responsibly by following the process described in [SECURITY.md](SECURITY.md). We take all security reports seriously and will respond promptly.

## License

Witylogix is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).

By submitting a contribution to this project, you agree that:

- Your contribution is your original work, or you have the right to submit it.
- You grant the project maintainers a perpetual, worldwide, non-exclusive, royalty-free license to use, reproduce, and distribute your contribution under the AGPL-3.0 license.
- You understand that your contribution will be publicly available under the AGPL-3.0 license terms, which require that derivative works also be distributed under the same license.

## Getting Help

If you get stuck or have questions:

- **GitHub Discussions** -- ask questions, share ideas, and connect with other contributors at [github.com/witylogix/witylogix-platform/discussions](https://github.com/witylogix/witylogix-platform/discussions).
- **Discord** -- join our community server for real-time chat and support at [discord.gg/witylogix](https://discord.gg/witylogix).
- **Issues** -- browse existing issues or open a new one at [github.com/witylogix/witylogix-platform/issues](https://github.com/witylogix/witylogix-platform/issues).

We are glad to help you get started. Welcome to the project.
