# ADR-019: CI/CD Pipeline & Release Strategy

**Status:** Accepted

**Date:** 2026-03-09

**Deciders:** Witylogix Engineering Team (Arjun — CTO)

## Context

The Witylogix platform consists of multiple interconnected services:
- **API** (Fastify backend with Prisma ORM)
- **Dashboard** (Next.js frontend)
- **Database Package** (Prisma schemas & migrations)
- **Shared Packages** (Core, Types, Validators, Framework, Workflows, Extensions, Carrier Service)

Current deployment workflow has gaps:
1. No Docker image generation for CI pipeline — manual builds for production
2. Prisma client generation happens redundantly across jobs without caching
3. No structured test coverage reporting — tests pass/fail but coverage trends unknown
4. No automated deployment of preview environments for pull requests
5. Build artifacts not cached effectively across pipeline stages
6. Release process lacks automation — manual versioning, tagging, and image pushing
7. No distinction between CI (testing) and CD (deployment) stages

The team needs a robust CI/CD pipeline that:
- Validates code quality through automated linting, type-checking, and testing
- Produces Docker images that are always verified and tested
- Tracks test coverage regressions to maintain code quality standards
- Deploys preview environments for PR validation
- Enables fast, reliable production releases
- Integrates Docker builds into the CI workflow rather than as a separate manual process

## Decision

Implement a **comprehensive GitHub Actions CI/CD pipeline** with the following architecture:

### 1. Pipeline Architecture

```
GitHub Event (Push/PR)
    ↓
    ├─→ [lint] ──────────────────────────────────────┐
    │   ESLint validation                             │
    │   Caches: pnpm store                            │
    │                                                  │
    └─→ [type-check] ────────────────────────────────┤
        TypeScript type checking                      │
        Caches: pnpm store                            │
                                                       │
    ┌──────────────────────────────────────────────────┘
    ↓
[test] ────────────────────────────────────────────────
    Vitest with coverage reporting
    Services: PostgreSQL + Redis
    Caches: pnpm store, Prisma client
    Coverage threshold enforcement:
        - Statements: 80%
        - Branches: 70%
    Uploads coverage artifacts
    Outputs: coverage.xml, coverage report

    ├─ Generate Prisma Client (cached by schema hash)
    ├─ Run tests with --coverage flag
    └─ Upload coverage to artifact storage
                    ↓
    ┌─────────────────────────────────────────────────
    │  [docker] ─────────────────────────────────────
    │  Depends on: test
    │  Build Dockerfile for witylogix-platform
    │  Tag: witylogix-platform:ci-${{ github.sha }}
    │  Output: Docker image ready for deployment
    └─────────────────────────────────────────────────
```

### 2. CI/CD Pipeline Stages

#### Stage 1: Lint (ESLint)
- **Trigger:** On push to main, all PRs
- **Job:** `lint`
- **Steps:**
  - Checkout code with full history
  - Setup Node.js 20 + pnpm
  - Cache pnpm store by lock file hash
  - Install dependencies with frozen lock file
  - Run `pnpm lint`
- **Purpose:** Catch style violations, unused variables, import issues
- **Failure:** Blocks subsequent jobs via dependency

#### Stage 2: Type Check (TypeScript)
- **Trigger:** On push to main, all PRs
- **Job:** `type-check`
- **Steps:**
  - Checkout code
  - Setup Node.js 20 + pnpm
  - Cache pnpm store
  - Install dependencies
  - Run `pnpm --filter @witylogix/api typecheck`
  - Run `pnpm --filter @witylogix/dashboard typecheck`
- **Purpose:** Verify TypeScript correctness before runtime
- **Failure:** Blocks subsequent jobs

#### Stage 3: Test with Coverage (Vitest)
- **Trigger:** After lint + type-check pass
- **Job:** `test`
- **Services:**
  - PostgreSQL 16 (postgis) for database tests
  - Redis 7 for cache tests
- **Steps:**
  1. Checkout code
  2. Setup Node.js 20 + pnpm
  3. Cache pnpm store
  4. Install dependencies with frozen lock file
  5. Cache Prisma client by schema hash (`packages/db/prisma/schema.prisma`)
     - Cache key: `${{ runner.os }}-prisma-${{ hashFiles('packages/db/prisma/schema.prisma') }}`
  6. Generate Prisma client with database URL
  7. Run tests: `pnpm test --run --coverage`
     - Vitest outputs coverage to `coverage/` directory
     - Coverage formats: LCOV + JSON
  8. Enforce coverage thresholds:
     - Statements: ≥80%
     - Branches: ≥70%
     - Functions: ≥80%
     - Lines: ≥80%
  9. Upload coverage artifact for review
  10. Comment coverage report on PRs (via coverage bot)
- **Environment Variables:**
  - `DATABASE_URL`: PostgreSQL test database
  - `REDIS_URL`: Redis test instance
- **Artifacts:**
  - `coverage/coverage-final.json`
  - `coverage/lcov.info`
  - `coverage/index.html` (HTML report)
- **Failure:** Blocks Docker build job

#### Stage 4: Build Applications (Turbo)
- **Trigger:** After test passes
- **Job:** `build`
- **Steps:**
  - Checkout code
  - Setup Node.js 20 + pnpm
  - Cache pnpm store
  - Install dependencies
  - Cache Turbo build artifacts: `.turbo/`
  - Cache Next.js build: `apps/dashboard/.next/cache`
  - Generate Prisma client
  - Run `pnpm build`
- **Artifacts:** Built applications ready for containerization
- **Failure:** Blocks Docker job

#### Stage 5: Docker Build & Push (New)
- **Trigger:** After test + build pass
- **Job:** `docker`
- **Depends on:** `test` job (ensures only tested code is containerized)
- **Steps:**
  1. Checkout code
  2. Setup Docker (with buildx for multi-platform support)
  3. Set Docker metadata:
     - Image name: `witylogix-platform`
     - Tags: `ci-${{ github.sha }}` (always), `latest` (on main only)
  4. Build Dockerfile with test context
     - Leverages multi-stage build in Dockerfile
     - Reuses layer cache from previous builds
  5. Load image to Docker daemon (for local testing in CI)
  6. On main branch: Push to container registry (e.g., Docker Hub, ECR)
- **Image Tags:**
  - CI: `witylogix-platform:ci-{sha}` (commit SHA)
  - Main: `witylogix-platform:ci-{sha}` + `witylogix-platform:latest`
- **Environment:**
  - `DOCKER_REGISTRY_USERNAME` (secret)
  - `DOCKER_REGISTRY_PASSWORD` (secret)
  - `DOCKER_REGISTRY_URL` (e.g., docker.io, ECR, GCR)

### 3. Caching Strategy

**pnpm Store Cache:**
- Key: `${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}`
- Path: `$PNPM_HOME/store`
- Hit rate: High (only invalidates on lock file changes)
- Shared across all jobs

**Prisma Client Cache:**
- Key: `${{ runner.os }}-prisma-${{ hashFiles('packages/db/prisma/schema.prisma') }}`
- Path: `node_modules/.prisma`
- Hit rate: Medium (invalidates on schema changes)
- Used in test job to avoid regenerating on every run
- Also used in build job (separate cache entry)

**Turbo Cache:**
- Key: `${{ runner.os }}-turbo-${{ github.sha }}`
- Path: `.turbo/`
- Hit rate: Low (unique per commit, but layers cached)
- Restore keys allow partial hits on previous commits

**Next.js Cache:**
- Key: `${{ runner.os }}-nextjs-${{ github.sha }}`
- Path: `apps/dashboard/.next/cache`
- Hit rate: Medium (invalidates on source changes)

### 4. Test Coverage Enforcement

Vitest configuration in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['**/*.test.ts', '**/*.spec.ts'],
      exclude: ['node_modules', 'dist'],
      all: true,
      lines: 80,
      statements: 80,
      branches: 70,
      functions: 80,
      watermarks: {
        lines: [70, 90],
        statements: [70, 90],
        functions: [70, 90],
        branches: [50, 90]
      }
    }
  }
})
```

**Threshold Enforcement:**
- Vitest fails if coverage falls below thresholds
- CI job fails, blocking Docker build
- Coverage report uploaded as artifact for PR review
- Coverage bot comments on PRs with delta analysis

### 5. Deployment Preview Environments (Future)

For pull requests, after Docker build succeeds:
- Deploy preview container to staging environment
- Generate preview URL and comment on PR
- Destroy preview after PR closes/merges

### 6. Release Process (Main Branch Only)

On push to `main` after all jobs pass:
1. Docker image tagged with commit SHA
2. Image also tagged as `latest` for quick reference
3. Image pushed to production registry
4. Optional: Semantic versioning and GitHub release creation
5. Optional: Trigger deployment workflow to production

### 7. Concurrency Control

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

- Cancels previous runs on new push to same branch
- Separate groups for PRs vs. main branch
- Reduces GitHub Actions minutes consumption

## Consequences

### Positive

1. **Fast Feedback Loops**
   - Parallel lint + type-check start immediately
   - Developers get feedback within 2-3 minutes
   - Blocks bad code before it lands in main

2. **Tested Docker Images Always**
   - Docker image only built after tests pass
   - No production deployments of untested code
   - Guarantees image quality

3. **Coverage Regression Prevention**
   - Test coverage tracked across commits
   - Coverage report on every PR
   - Prevents coverage from degrading below 80%
   - Team can see impact of changes on test coverage

4. **Reduced Build Times**
   - Prisma client caching saves 30-60 seconds per test run
   - pnpm store caching avoids re-downloading packages
   - Turbo caching reuses built artifacts
   - Estimated total time: 8-12 minutes for full pipeline

5. **Reproducible Builds**
   - Frozen lock file (`--frozen-lockfile`) ensures exact versions
   - Multi-stage Dockerfile produces identical images
   - No environment-dependent builds

6. **Scalable to Multiple Services**
   - Monorepo structure with pnpm workspaces
   - Each package can run tests independently
   - Turbo parallelizes builds across packages

7. **Container-Ready Workflow**
   - Docker images generated per commit
   - Easy rollback: just deploy previous image tag
   - Staging deployments validate images before production

### Negative

1. **Increased GitHub Actions Minutes**
   - Full pipeline ~8-12 minutes per PR
   - Docker build adds 3-5 minutes
   - Multiple runs on force-pushes consume minutes
   - Mitigation: Concurrency cancellation, caching

2. **Docker Registry Storage**
   - New image per commit = rapid storage growth
   - Mitigation: Retention policy (keep last 30 images, prune old ones)

3. **Complexity in CI Configuration**
   - YAML file grows to 300+ lines
   - Requires understanding of GitHub Actions syntax
   - Mitigation: Well-commented workflow, runbooks

4. **Service Dependencies in Test Job**
   - PostgreSQL + Redis startup adds 10-20 seconds
   - Requires GitHub-hosted runners with sufficient resources
   - Mitigation: Cache dependencies, use service containers

5. **Coverage Thresholds Can Be Too Strict**
   - 80% statements might block some PRs unfairly
   - Requires discipline to maintain test quality
   - Mitigation: Gradual rollout (warn first, enforce later)

## Implementation Plan

### Phase 1: Update CI Workflow (Sprint 4.0)
- Add test coverage flag to Vitest
- Implement Prisma schema caching
- Add coverage artifact upload
- Document coverage thresholds

### Phase 2: Docker Build Integration (Sprint 4.0)
- Add Docker build job to CI workflow
- Implement image tagging strategy
- Test multi-stage Dockerfile
- Verify layer caching works

### Phase 3: Registry Integration (Sprint 4.1)
- Configure Docker registry credentials (GitHub Secrets)
- Push images to registry on main branch
- Create image retention policy
- Document deployment from images

### Phase 4: Preview Deployments (Sprint 4.2)
- Deploy preview containers for PRs
- Automated cleanup on PR close
- Preview URL comment on PR

### Phase 5: Release Automation (Sprint 4.2)
- Semantic versioning in CI
- GitHub release creation
- Changelog generation

## Alternatives Considered

### 1. GitLab CI
- **Rejected:** Witylogix uses GitHub, switching would require migration
- **Reason:** GitHub Actions tightly integrated with GitHub, no additional vendor

### 2. Jenkins On-Premise
- **Rejected:** Requires infrastructure management
- **Reason:** GitHub Actions is managed, cheaper for small team

### 3. Separate Docker Build Step (Not in CI)
- **Rejected:** Manual Docker builds decouple from CI tests
- **Reason:** Can push untested code to production

### 4. Heroku/Vercel Deployment
- **Rejected:** Limited control over Docker build process
- **Reason:** Team wants custom multi-stage build, layer caching

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vitest Coverage Configuration](https://vitest.dev/config/#coverage)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Prisma Client Generation](https://www.prisma.io/docs/reference/api-reference/command-reference#generate)
- [pnpm Monorepo Support](https://pnpm.io/workspaces)
- [Turbo Caching Documentation](https://turbo.build/repo/docs/core-concepts/caching)

## Status

- **Date Accepted:** 2026-03-09
- **Implementation Start:** Sprint 4.0
- **Target Completion:** End of Sprint 4.2
