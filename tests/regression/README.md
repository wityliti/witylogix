# Regression Test Suite

## Overview

The regression test suite provides comprehensive testing coverage for the Witylogix platform, ensuring that critical functionality remains intact across releases and deployments. These tests validate core business flows, authentication, API contracts, and visual consistency.

## Purpose & Scope

This suite is designed to catch regressions in:

- **Critical Paths**: Complete end-to-end business workflows (order lifecycle, driver lifecycle, delivery lifecycle, payment flows, integrations)
- **Authentication**: Login, registration, token management, MFA, password reset, SSO, and session management
- **API Contracts**: CRUD operations, pagination, filtering, sorting, rate limiting, error handling
- **Visual Regression**: Layout consistency, styling, and responsive design across viewports

## Running Regression Tests

### Local Execution

Run the full regression suite locally:

```bash
# Run all regression tests
npm run test:regression

# Run specific test category
npx playwright test --config=tests/regression/playwright.regression.config.ts tests/regression/critical-paths.spec.ts

# Run with specific browser
npx playwright test --project=chromium tests/regression/

# Run with headed browser (visible)
npx playwright test --config=tests/regression/playwright.regression.config.ts --headed

# Run in debug mode
npx playwright test --config=tests/regression/playwright.regression.config.ts --debug
```

### CI Execution

The regression suite runs nightly via GitHub Actions:

- **Schedule**: 2:00 AM UTC daily
- **Sharding**: 4 parallel workers
- **Browsers**: Chromium, Firefox, WebKit
- **Artifacts**: Test reports, screenshots, and videos on failure

View the workflow: `.github/workflows/regression.yml`

### Nightly Scheduling

Nightly regression tests execute automatically and report results to Slack on failure. No manual action required.

## Test Categories

Tests are organized by category and tagged with decorators:

### @smoke

Basic smoke tests validating critical paths work:

- Quick execution (<5 min)
- Core functionality only
- Use in pre-release validation

### @regression

Full regression test suite:

- Complete path coverage
- Data consistency checks
- Edge cases and error scenarios
- Runs nightly in CI

### @critical

Tests for business-critical flows:

- Order lifecycle
- Payment processing
- Driver registration
- Delivery fulfillment
- Integration activation

### @visual

Visual regression tests:

- Screenshot comparison
- Responsive design validation
- Baseline management
- Multiple viewport sizes

## Test Structure

Each regression test file follows this pattern:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Feature Name", () => {
  let pageName: PageClass;

  test.beforeEach(({ page }) => {
    pageName = new PageClass(page);
  });

  test("@regression should validate scenario", async ({ page }) => {
    // Setup test data
    test.step("Setup", async () => {
      // Initialize data
    });

    // Execute test flow
    test.step("Execute", async () => {
      // Perform actions
    });

    // Assert expectations
    test.step("Assert", async () => {
      expect(result).toBe(expected);
    });

    // Cleanup
    test.step("Cleanup", async () => {
      // Remove test data
    });
  });
});
```

## Test Files

### critical-paths.spec.ts

Tests complete end-to-end workflows:

- Order lifecycle: create → edit → assign → deliver → complete → archive
- Driver lifecycle: register → verify → activate → assign → complete → rate
- Delivery lifecycle: assign → pickup → transit → deliver → POD → confirm
- Payment flow: create invoice → send → pay → reconcile
- Integration lifecycle: install → configure → test → activate → usage → deactivate

### auth-regression.spec.ts

Tests authentication and authorization:

- Login with valid/invalid credentials
- Token refresh before/after expiry
- MFA enrollment and verification
- Password reset complete flow
- Magic link authentication
- SSO redirect flows
- Concurrent session management
- Role-based access control (RBAC)

### api-regression.spec.ts

Tests API contracts and consistency:

- CRUD operations on all endpoints
- Pagination (cursor, offset)
- Filter combinations and edge cases
- Sort ordering (ascending, descending)
- Rate limit headers
- Error response formats
- Content-Type enforcement

### visual/visual-regression.spec.ts

Tests UI consistency across changes:

- Dashboard home page
- Orders list and detail
- Driver list
- Delivery map
- Settings pages
- Multiple viewport sizes

## Adding New Tests

### 1. Create Test File

Add new test file to `tests/regression/` with `.spec.ts` extension.

### 2. Use Page Objects

Create reusable page objects in `page-objects/` directory:

```typescript
export class MyPage {
  constructor(private page: Page) {}

  async navigateTo() {
    await this.page.goto("/path");
  }

  async performAction() {
    // Implement action
  }
}
```

### 3. Organize with Test Steps

Use `test.step()` for logical grouping and better reporting:

```typescript
test("scenario", async ({ page }) => {
  test.step("Setup data", async () => {
    // Setup
  });

  test.step("Execute action", async () => {
    // Action
  });

  test.step("Verify result", async () => {
    // Assertion
  });
});
```

### 4. Tag Tests Appropriately

Use tags to categorize tests:

```typescript
test("@regression @critical should validate critical flow", async () => {
  // Test
});
```

### 5. Add to CI

Tag tests in `grep` patterns in `.github/workflows/regression.yml` if filtering needed.

## Baseline Management

### Visual Regression Baselines

Visual regression tests compare screenshots against baseline images stored in `tests/regression/visual/baselines/`.

**Update baselines** after intentional UI changes:

```bash
npx playwright test --config=tests/regression/playwright.regression.config.ts --update-snapshots
```

**Accept baseline** in CI:

Push to GitHub with `[update-baselines]` in commit message to update visual baselines.

**Review baselines** before accepting:

1. Check diffs in test report
2. Verify changes are intentional
3. Run locally with `--update-snapshots`

## Configuration

See `playwright.regression.config.ts` for:

- Browser configuration (Chromium, Firefox, WebKit)
- Timeout settings (30s per test, 5s per assertion)
- Parallel workers (4 for sharding)
- Reporter formats (HTML, JUnit, JSON)
- Retry strategy (2 retries in CI)

## Troubleshooting

### Tests Timeout

- Check if services are running (API, web server)
- Increase timeout in playwright.regression.config.ts
- Check for network issues or slow tests

### Flaky Tests

- Add retry logic with `test.setTimeout()`
- Use explicit waits instead of sleeps
- Check for timing-dependent test data

### Visual Baseline Mismatches

- Review screenshot diffs in HTML report
- Update baselines if changes are intentional
- Check viewport sizes match expected values

### API Test Failures

- Verify database is seeded correctly
- Check API is accessible and responding
- Review error messages in test output

## Performance

Target regression test execution times:

- **Critical paths**: <5 min
- **Full suite**: <30 min
- **Visual tests**: <10 min

Tests run in parallel (4 workers) to optimize execution time.

## CI/CD Integration

Regression tests integrate with:

- **Pull Requests**: Manual trigger via CI workflow
- **Nightly Schedule**: Automatic 2:00 AM UTC daily
- **Release Pipeline**: Pre-release validation
- **Slack Notifications**: Failure alerts to #platform-qa

See `.github/workflows/regression.yml` for full CI configuration.

## Maintenance

- Review test coverage quarterly
- Update test data fixtures with new API schemas
- Refactor page objects as UI changes
- Baseline visual tests after major UI releases
- Archive old baseline images

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Test Guide](../TEST_GUIDE.md)
- [CI Pipeline](../../.github/workflows/ci.yml)
- [Regression Workflow](../../.github/workflows/regression.yml)
