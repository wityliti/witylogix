# Sprint 9.0 — Test Hardening, i18n Foundation & Order Kanban Board

**Date:** 2026-03-18
**Branch:** `sprint-9.0-test-hardening-api-wiring`
**Theme:** Improve test pass rate, add internationalization infrastructure, and deliver a Fleetbase-inspired Kanban board for order management.
**Skills Applied:** tdd-workflow, frontend-patterns, api-design, backend-patterns

## Agent Contributions

### AR (CTO) — Auth Module Test Hardening [tdd-workflow]

- Fixed duplicate exports in `packages/core/src/auth/types.ts` (InvalidCredentialsError, TokenExpiredError)
- Migrated 5 auth test files from `@jest/globals` → vitest imports
- Fixed session-manager mock initialization order
- Fixed provider-registry mock hoisting

### RG (Backend Lead) — Queue & Monitoring Test Fixes [tdd-workflow]

- Fixed queue tests: `processJob()` → `executeJob()` API alignment
- Added `createJobMetadata()` helper for proper QueueJobMetadata construction
- Fixed monitoring test expectations and constructor issues
- **Monitoring:** 58→6 failures (89.7% reduction)
- **Queue:** 79→35 failures (55.7% reduction)

### PK (Sr. Backend) — Notifications & Onboarding Test Fixes [tdd-workflow]

- Fixed mock hoisting order in orchestrator.test.ts and worker-integration.test.ts
- Fixed onboarding-service.test.ts and workspace-provisioner.test.ts mock order
- Fixed payments tests (square-adapter, paypal-adapter) mock hoisting
- **Notifications:** 40→20 failures (50% reduction)

### SP (Full-stack) — Platform Bridge & Auth Test Migration [tdd-workflow]

- Migrated data-normalizer.test.ts and webhook-normalizer.test.ts to vitest
- Fixed sso-providers.test.ts and password-service.test.ts imports

### NK (Frontend Lead) — i18n Foundation [frontend-patterns]

- `packages/core/src/i18n/index.ts` — Translation engine with nested key lookup, parameter interpolation, RTL detection
- 4 locale files: `en.json`, `es.json`, `fr.json`, `ar.json` — 120+ keys each across 12 categories
- `packages/core/src/i18n/__tests__/i18n.test.ts` — 44 passing tests
- Complete README with setup guide, React integration examples, and troubleshooting

### DM (Frontend) — Order Kanban Board [frontend-patterns]

- `apps/dashboard/src/app/(dashboard)/orders/board/page.tsx` — Full Kanban board with 8 status columns
- Top bar: search, driver filter, sort toggle, auto-refresh, statistics
- Native HTML5 drag-and-drop for order status transitions
- 15+ realistic mock orders distributed across statuses
- Responsive horizontal scroll on mobile

### VS (Component Dev) — Kanban Components [frontend-patterns]

- `apps/dashboard/src/components/orders/kanban-card.tsx` — Order card with priority border, driver avatar, time formatting
- `apps/dashboard/src/components/orders/kanban-column.tsx` — Column with count badge, total value, collapse toggle, sort options
- Dark theme using `--wl-*` CSS variables, hover tooltips, click-to-navigate

## Stats

- **Files added/modified:** 31
- **New source lines:** ~3,400
- **Test improvements:** Monitoring 89.7% reduction, Queue 55.7%, Notifications 50%
- **i18n:** 4 locales, 120+ keys, 44 tests
- **UI:** 3 new components (board page, card, column)
- **Languages supported:** English, Spanish, French, Arabic (RTL)

## Key Decisions

1. **Native HTML5 DnD** over external library — Zero bundle impact, sufficient for Kanban use case
2. **Lightweight i18n** without next-intl — Simpler, zero-dependency approach that can be swapped later
3. **vi.mock() hoisting pattern** — All mocks placed before imports for correct vitest behavior
4. **Mock helper functions** — createJobMetadata() pattern for reusable test fixtures
