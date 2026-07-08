# ADR-021: Developer Experience & Monorepo Bootability

**Status:** Accepted
**Date:** 2026-03-10
**Deciders:** Witylogix Engineering Team
**Relates to:** ADR-001 (Platform Rewrite — Stack Selection)

## Executive Summary

As the Witylogix platform grows to 6 applications, 9 packages, and 2 extensions within a Turborepo monorepo, developer experience and CI/CD efficiency suffer from:

- **Inconsistent workspace scripts** — each package defines `build`, `dev`, `lint` inconsistently, breaking automation and onboarding
- **Weak Turbo caching** — tasks re-run unnecessarily due to missing `inputs`/`outputs` definitions
- **Unclear boot ports** — developers manually coordinate which dev server runs on which port, causing conflicts
- **Missing validation** — no automated checks for version consistency (e.g., multiple React versions) or missing `.env.example`
- **Brittle dependency ordering** — the build graph is implicit, making it hard to optimize or debug

This ADR standardizes workspace conventions, tunes the Turbo pipeline for fast local development and efficient CI, and introduces runtime validation to prevent common mistakes.

## Context

### Current State

Witylogix Platform is a pnpm Turborepo monorepo with:

- **6 applications:**
  - `@witylogix/api` (Fastify backend, Node.js)
  - `@witylogix/dashboard` (Next.js, React 19)
  - `@witylogix/docs` (Next.js, Fumadocs)
  - `@witylogix/driver-app` (React Native with Expo)
  - `@witylogix/shopify-app` (React Router v7 Shopify app)
  - `@witylogix/tracking-page` (Next.js public tracking)

- **9 utility packages:**
  - `@witylogix/db` (Prisma client, migrations)
  - `@witylogix/core` (business logic, 60+ exports)
  - `@witylogix/types` (TypeScript types, no runtime code)
  - `@witylogix/validators` (Zod schemas)
  - `@witylogix/framework` (Fastify plugins, DI container)
  - `@witylogix/workflows` (async workflow execution)
  - `@witylogix/sdk` (client SDK)
  - `@witylogix/extension-core` (shared extension logic)
  - `@witylogix/carrier-service` (carrier integrations)

- **2 extensions:**
  - `checkout-ui` (Shopify Preact checkout extension)
  - `pos-ui` (Shopify Preact POS extension)

**Current turbo.json** is minimal:

```json
{
  "globalDependencies": ["**/.env.*local"],
  "globalEnv": [
    "NODE_ENV",
    "DATABASE_URL",
    "REDIS_URL",
    "SHOPIFY_API_KEY",
    "SHOPIFY_API_SECRET"
  ],
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "dependsOn": ["^build"], "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"], "env": ["DATABASE_URL"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

**Problems:**

1. No `inputs` declared → Turbo can't know if a file changed, so it caches aggressively or conservatively
2. Missing `db:generate` and `db:push` task definitions → Prisma generation isn't orchestrated
3. No `globalPassThroughEnv` for CI variables (CI, GITHUB_TOKEN, etc.)
4. Build order is implicit (Turbo infers it, but developers can't visualize it)
5. Dev server ports are hardcoded in package.json scripts, with no centralized reference
6. No validation that all packages have `build`, `lint`, `typecheck` scripts
7. No check that `.env.example` exists or is up-to-date

### Scaling Concerns

As the team grows:

- **Onboarding slowdown:** New developers don't know which port runs which app
- **CI inefficiency:** Build pipeline is 2-3 min slower than necessary due to re-runs
- **Silent failures:** A new package added without `build` script breaks the build silently until CI
- **Version sprawl:** Different packages pin `react@19` vs `react@18`, causing bundling issues

## Decision

Standardize the Witylogix monorepo with:

1. **Turbo Pipeline Tuning:** Add `inputs`, `outputs`, and `env` to each task for deterministic, cacheable builds
2. **Workspace Conventions:** Every package must have a consistent set of scripts
3. **TypeScript Project References:** Establish a clear, layered dependency graph
4. **Dev Server Orchestration:** Centralize port assignments with a known mapping
5. **Environment Variable Management:** `.env.example` is the source of truth; validate on boot
6. **Workspace Validation:** Introduce a `scripts/validate-workspace.ts` script to catch issues early

### 1. Turbo Pipeline Design

#### Dependency Graph (Build Order)

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 0: TYPES & VALIDATION              │
│  @witylogix/types  |  @witylogix/validators  |              │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ (^build)
┌─────────────────────────────────────────────────────────────┐
│              LAYER 1: DATABASE & CORE UTILITIES              │
│  @witylogix/db  |  @witylogix/framework  |                  │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ (^build)
┌─────────────────────────────────────────────────────────────┐
│                 LAYER 2: BUSINESS LOGIC                      │
│  @witylogix/core  |  @witylogix/workflows  |                │
│  @witylogix/extension-core  |  @witylogix/carrier-service   │
│  @witylogix/sdk                                             │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ (^build)
┌─────────────────────────────────────────────────────────────┐
│                   LAYER 3: APPLICATIONS                      │
│  @witylogix/api  |  @witylogix/dashboard  |                 │
│  @witylogix/docs  |  @witylogix/driver-app  |               │
│  @witylogix/shopify-app  |  @witylogix/tracking-page  |     │
│  checkout-ui  |  pos-ui                                     │
└─────────────────────────────────────────────────────────────┘
```

#### Task Definitions with Inputs & Outputs

Each task must declare:

- **`inputs`:** Files/globs that trigger a rebuild
- **`outputs`:** Artifacts that are cached
- **`env`:** Environment variables that affect the task
- **`dependsOn`:** Task dependencies (with `^` for workspace dependencies)

#### build task

```json
{
  "build": {
    "dependsOn": ["^build"],
    "inputs": ["src/**/*.ts", "src/**/*.tsx", "tsconfig.json", "package.json"],
    "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
    "env": ["NODE_ENV"],
    "cache": true
  }
}
```

#### dev task

```json
{
  "dev": {
    "dependsOn": ["^build"],
    "cache": false,
    "persistent": true,
    "env": [
      "NODE_ENV",
      "DATABASE_URL",
      "REDIS_URL",
      "JWT_SECRET",
      "NEXT_PUBLIC_API_URL"
    ]
  }
}
```

#### lint task

```json
{
  "lint": {
    "dependsOn": ["^build"],
    "inputs": ["src/**/*.ts", "src/**/*.tsx", ".eslintrc.js", "package.json"],
    "outputs": [],
    "cache": true
  }
}
```

#### typecheck task

```json
{
  "typecheck": {
    "dependsOn": ["^build"],
    "inputs": ["src/**/*.ts", "src/**/*.tsx", "tsconfig.json", "package.json"],
    "outputs": [],
    "cache": true
  }
}
```

#### test task

```json
{
  "test": {
    "dependsOn": ["^build"],
    "inputs": [
      "src/**/*.ts",
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "vitest.config.ts",
      "package.json"
    ],
    "outputs": ["coverage/**"],
    "env": ["DATABASE_URL", "NODE_ENV"],
    "cache": true
  }
}
```

#### db:generate task

```json
{
  "db:generate": {
    "cache": false,
    "inputs": ["prisma/schema.prisma"],
    "outputs": ["node_modules/.prisma/**"]
  }
}
```

#### db:push task

```json
{
  "db:push": {
    "cache": false,
    "dependsOn": ["db:generate"],
    "env": ["DATABASE_URL"]
  }
}
```

#### clean task

```json
{
  "clean": {
    "cache": false,
    "cli": "echo 'Turbo clean delegates to package scripts'"
  }
}
```

#### globalEnv & globalPassThroughEnv

```json
{
  "globalEnv": ["NODE_ENV", "TURBO_TELEMETRY_DISABLED"],
  "globalPassThroughEnv": [
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_SECRET",
    "SHOPIFY_API_KEY",
    "SHOPIFY_API_SECRET",
    "ANTHROPIC_API_KEY",
    "NEXT_PUBLIC_API_URL",
    "CI",
    "GITHUB_TOKEN",
    "GITHUB_SHA",
    "GITHUB_REF"
  ]
}
```

### 2. Workspace Conventions

Every workspace package **must** have `package.json` scripts:

#### Required Scripts (All Packages)

| Script      | Purpose                                  | Notes                                                           |
| ----------- | ---------------------------------------- | --------------------------------------------------------------- |
| `build`     | Compile/transpile to `dist/` or `.next/` | Must produce output that can be depended upon by other packages |
| `lint`      | Run ESLint (or equivalent linter)        | May be a no-op for types-only packages, but must exist          |
| `typecheck` | Run `tsc --noEmit`                       | Catches TypeScript errors without emitting `.js`                |

#### Optional Scripts (As Applicable)

| Script  | Purpose                             | Notes                            |
| ------- | ----------------------------------- | -------------------------------- |
| `dev`   | Start dev server or watch mode      | Only for apps, not for libraries |
| `test`  | Run test suite (vitest, Jest, etc.) | Only if package has tests        |
| `start` | Run compiled/built output           | Only for apps                    |

#### Template package.json

**For libraries (db, core, validators, etc.):**

```json
{
  "name": "@witylogix/library-name",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**For apps (api, dashboard, docs, etc.):**

```json
{
  "name": "@witylogix/app-name",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "...",
    "build": "...",
    "start": "...",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**For db package only:**

```json
{
  "scripts": {
    "build": "prisma generate --schema=./prisma/schema && tsc",
    "db:generate": "prisma generate --schema=./prisma/schema",
    "db:push": "prisma db push --schema=./prisma/schema",
    "db:migrate": "prisma migrate dev --schema=./prisma/schema",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  }
}
```

### 3. TypeScript Project References

TypeScript `compilerOptions.composite` and `references` provide:

- **Type-aware incremental builds** — `tsc` only recompiles changed files and their dependents
- **Clear ownership** — each `tsconfig.json` explicitly lists what it depends on
- **IDE support** — editors can follow dependency boundaries

**Root tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**App tsconfig.json (extends root):**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"],
  "references": [
    { "path": "../../packages/types" },
    { "path": "../../packages/db" },
    { "path": "../../packages/core" }
  ]
}
```

### 4. Dev Server Orchestration

All dev servers must use a **consistent port map** to prevent conflicts:

| Application           | Port | Start Command                                 |
| --------------------- | ---- | --------------------------------------------- |
| **API**               | 3001 | `turbo dev --filter=@witylogix/api`           |
| **Dashboard**         | 3000 | `turbo dev --filter=@witylogix/dashboard`     |
| **Docs**              | 3003 | `turbo dev --filter=@witylogix/docs`          |
| **Tracking Page**     | 3004 | `turbo dev --filter=@witylogix/tracking-page` |
| **Shopify App**       | 3005 | `turbo dev --filter=@witylogix/shopify-app`   |
| **Driver App (Expo)** | 8081 | `turbo dev --filter=@witylogix/driver-app`    |

**Root package.json scripts:**

```json
{
  "scripts": {
    "dev": "turbo dev",
    "dev:api": "turbo dev --filter=@witylogix/api",
    "dev:dashboard": "turbo dev --filter=@witylogix/dashboard",
    "dev:docs": "turbo dev --filter=@witylogix/docs",
    "dev:tracking": "turbo dev --filter=@witylogix/tracking-page"
  }
}
```

**Each app's package.json includes the port:**

```json
{
  "scripts": {
    "dev": "next dev --port 3001"
  }
}
```

### 5. Environment Variable Management

#### `.env.example` as Source of Truth

The root `.env.example` is the canonical list of all environment variables the platform requires:

```bash
# Database
DATABASE_URL="postgresql://..."
POSTGRES_PASSWORD=secret

# Redis
REDIS_URL="redis://..."

# Shopify
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=

# JWT
JWT_SECRET=secret
JWT_EXPIRES_IN=7d

# App
NODE_ENV=development
PORT=8000
NEXT_PUBLIC_API_URL="http://localhost:3001"

# Feature Flags
FEATURE_SMS_NOTIFICATIONS=false
FEATURE_WHATSAPP=false
```

#### Validation on Boot

The `scripts/validate-workspace.ts` script checks:

1. `.env.example` exists at the repository root
2. All required packages have `build`, `lint`, `typecheck` scripts
3. No version conflicts in shared dependencies (react, typescript, next)
4. Exit code 1 if any check fails, 0 if all pass

#### Conditional Environment Loading

Apps load `.env.local` (git-ignored) for local overrides:

```bash
# .env.local (NOT committed)
DATABASE_URL="postgresql://dev@localhost/witylogix_dev"
SHOPIFY_API_KEY="shpat_xxx"
```

At start time, the app must validate that all required environment variables from `.env.example` are set or have defaults.

### 6. CI/CD Implications

#### Build Pipeline

1. **Install:** `pnpm install`
2. **Validate:** `node scripts/validate-workspace.ts`
3. **Build:** `turbo build --filter=...` (only changed workspaces)
4. **Lint:** `turbo lint`
5. **Typecheck:** `turbo typecheck`
6. **Test:** `turbo test`
7. **Output:** Docker image with all apps

#### Caching Strategy

- **Local caching:** `.turbo/` directory (5 GB limit)
- **Remote caching:** Use Turbo Remote Cache (Vercel) to share builds across CI agents
- **Inputs:** File globs + environment variables ensure cache validity
- **Outputs:** `dist/`, `.next/`, `coverage/` are cached

#### Dependency Installation

Turbo can't cache `pnpm install`, but it can:

- Cache `prisma generate` (the slow part of db builds)
- Cache TypeScript compilation (the slow part of non-next builds)

## Consequences

### Positive

1. **Faster local development:** Cached builds mean `pnpm dev` doesn't rebuild everything
2. **Faster CI:** Remote caching + proper inputs/outputs = 40-60% faster pipelines
3. **Easier onboarding:** New developers see the port map and know which app runs where
4. **Fewer silent failures:** Validation catches missing scripts, version mismatches at commit time
5. **Better IDE support:** TypeScript references enable project-aware navigation
6. **Predictable builds:** Explicit dependency graph is visualizable with `turbo graph`

### Negative

1. **Maintenance burden:** Keeping `inputs` and `outputs` in sync as code evolves requires discipline
2. **Validation script:** Must be run/integrated into pre-commit hooks to be effective
3. **Learning curve:** Developers must understand `dependsOn`, `^`, `globalEnv`, etc.
4. **Overhead for small changes:** Updating a comment in a types file still triggers cascading builds (by design, but can feel slow)

### Mitigations

1. **Document in CONTRIBUTING.md:** Explain the conventions with examples
2. **Pre-commit hook:** Automate validation with husky + `scripts/validate-workspace.ts`
3. **Turbo docs:** Maintain a workspace reference in `/docs/guides/monorepo.md`
4. **Linting:** Add ESLint rule to check script presence (future enhancement)

## Validation Checklist

- [ ] All 6 apps have `dev`, `build`, `lint`, `typecheck` scripts
- [ ] All 9 packages have `build`, `lint`, `typecheck` scripts
- [ ] `.env.example` exists and covers all required variables
- [ ] turbo.json defines `inputs` and `outputs` for all tasks
- [ ] `globalPassThroughEnv` includes CI variables (CI, GITHUB_TOKEN)
- [ ] Each app declares its dev server port in package.json
- [ ] TypeScript `references` match actual package dependencies
- [ ] `scripts/validate-workspace.ts` runs in pre-commit hook
- [ ] Documentation updated with dev port map and workspace conventions

## References

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Turborepo Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- ADR-001: Platform Rewrite — Technology Stack Selection

## Appendix: Example Turbo Commands

```bash
# Develop all apps (watches mode)
pnpm dev

# Develop only API
pnpm dev:api

# Build only apps that depend on changed types
pnpm build --filter=@witylogix/types...

# Run tests for changed packages
pnpm test --filter='...[origin/main]'

# Show build graph
pnpm turbo graph

# Validate workspace
node scripts/validate-workspace.ts

# Clean all build artifacts
pnpm clean
```
