# E2E Test Suite - Witylogix Platform

This directory contains end-to-end tests for the Witylogix platform using Playwright Test Framework.

## Setup

### Prerequisites

- Node.js >= 20.0.0
- pnpm package manager
- Running API server (port 3001)
- Running Dashboard server (port 3002)

### Installation

```bash
# Install Playwright and dependencies
pnpm install

# Install Playwright browsers
npx playwright install
```

## Configuration

### Environment Variables

Create a `.env.test` file in the project root with the following variables:

```env
# Dashboard and API URLs
BASE_URL=http://localhost:3002
API_URL=http://localhost:3001

# Test User Credentials
TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=admin123

TEST_DISPATCHER_EMAIL=dispatcher@test.com
TEST_DISPATCHER_PASSWORD=dispatcher123

TEST_DRIVER_EMAIL=driver@test.com
TEST_DRIVER_PASSWORD=driver123

# CI/CD Settings
CI=false
```

### Playwright Configuration

Configuration is defined in `playwright.config.ts`:

- **Base URL:** http://localhost:3002 (Dashboard)
- **API URL:** http://localhost:3001
- **Projects:** Chromium, Firefox, WebKit
- **Retries:** 2 (CI), 0 (local)
- **Reporters:** HTML and List
- **Screenshots:** On failure
- **Video:** On first retry

## Running Tests

### All Tests

```bash
pnpm test:e2e
```

### Run in UI Mode (Interactive)

```bash
pnpm test:e2e:ui
```

### Run in Headed Mode (Visible Browser)

```bash
pnpm test:e2e:headed
```

### Debug Mode

```bash
pnpm test:e2e:debug
```

### Run Specific Test File

```bash
npx playwright test tests/e2e/specs/auth.spec.ts
```

### Run Tests Matching Pattern

```bash
npx playwright test -g "login with valid credentials"
```

### Run Tests in Specific Project

```bash
npx playwright test --project=chromium
```

## Test Structure

### Page Objects

Page objects abstract UI interactions and locators. Located in `tests/e2e/pages/`:

- **login.page.ts** - Login form interactions
- **dashboard.page.ts** - Dashboard navigation and data
- **orders.page.ts** - Order management CRUD operations
- **drivers.page.ts** - Driver management operations

### Fixtures

Custom fixtures provide authenticated pages and test users. Located in `tests/e2e/fixtures/`:

- **auth.fixture.ts** - Authentication helpers and role-based fixtures

### Test Specs

Test specifications organized by feature. Located in `tests/e2e/specs/`:

- **auth.spec.ts** - Authentication and session flow (9 tests)
- **order-lifecycle.spec.ts** - Order CRUD operations (7 tests)
- **driver-management.spec.ts** - Driver operations (9 tests)
- **tracking.spec.ts** - Order tracking and timeline (7 tests)
- **webhooks.spec.ts** - Webhook management (9 tests)

## Test Coverage

### Authentication Flow (9 Tests)
- Login with valid credentials
- Login with invalid email
- Login with invalid credentials
- Login with empty credentials
- Logout successfully
- Session persistence
- Protected route redirect
- Different role content
- Remember me functionality

### Order Lifecycle (7 Tests)
- Create order with all fields
- Create order with minimal fields
- Edit order details
- Assign driver to order
- Track order status changes
- Filter orders by status
- Search orders by tracking ID
- Cancel order

### Driver Management (9 Tests)
- View driver list
- Filter by availability
- Filter by unavailable status
- Search for driver
- View driver status
- Update driver status
- View driver details
- View driver routes
- Display performance metrics

### Order Tracking (7 Tests)
- Navigate to tracking page
- Search shipment by tracking ID
- Display tracking timeline
- Show status updates
- Display estimated delivery time
- Show current location for in-transit orders
- Show driver information during transit
- Verify status progression logic
- Display proof of delivery

### Webhook Management (9 Tests)
- Navigate to webhook page
- Display webhook list
- Create webhook endpoint
- View webhook details
- View delivery log
- Display delivery status
- Retry failed delivery
- Update webhook settings
- Disable webhook

**Total: 41 Critical Flow Tests**

## Global Setup/Teardown

### Global Setup (`global-setup.ts`)
1. Waits for API and Dashboard services to be ready
2. Authenticates with admin credentials
3. Saves authentication state for test reuse
4. Seeds test data (optional)

### Global Teardown (`global-teardown.ts`)
1. Cleans up test data (optional)

## Best Practices

### Test Isolation
- Each test is independent and doesn't depend on other tests
- Tests clean up after themselves
- Database should be reset between test runs

### Explicit Waits
```typescript
await page.waitForURL('/dashboard', { timeout: 10000 });
await page.waitForLoadState('networkidle');
```

### Use Page Objects
Always use page objects instead of direct selectors:

```typescript
// Good
const loginPage = new LoginPage(page);
await loginPage.login('email@test.com', 'password');

// Avoid
await page.click('input[type="email"]');
```

### Meaningful Assertions
```typescript
// Good
await expect(page.locator('h1')).toContainText('Dashboard');

// Avoid
await expect(page.locator('h1')).toBeTruthy();
```

### Error Messages
```typescript
// Helpful for debugging
await expect(loginPage.submitButton).toBeEnabled();
```

## Debugging

### View Test Report

```bash
npx playwright show-report tests/e2e/results/html
```

### Enable Trace Viewer

Tests automatically record traces on first retry. View them:

```bash
npx playwright show-trace tests/e2e/results/trace.zip
```

### Screenshots on Failure

Screenshots are automatically saved to `tests/e2e/results/` when tests fail.

### Video Recording

Videos are retained only on failures for debugging:

```bash
npx playwright test --video=on
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run E2E tests
  run: pnpm test:e2e
  env:
    CI: true
    TEST_ADMIN_EMAIL: ${{ secrets.TEST_ADMIN_EMAIL }}
    TEST_ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3002
lsof -ti:3002 | xargs kill -9

# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

### Tests Timeout
- Increase `timeout` in playwright.config.ts
- Check if services are running and responsive
- Verify network connectivity

### Authentication Fails
- Verify `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD` are correct
- Check if auth endpoint is responding
- Clear `tests/e2e/auth.json` and re-run setup

### Flaky Tests
- Add explicit waits instead of arbitrary delays
- Use `waitForLoadState` for network idle
- Verify element visibility before interaction

## Performance Tips

### Run Tests in Parallel

```bash
npx playwright test --workers=4
```

### Run Tests on Specific Project Only

```bash
npx playwright test --project=chromium
```

### Skip WebKit/Firefox for Local Development

Edit `playwright.config.ts` and comment out unused projects.

## Adding New Tests

### 1. Create Test File

```typescript
// tests/e2e/specs/feature.spec.ts
import { test, expect } from '../fixtures/auth.fixture';
import { SomePage } from '../pages/some.page';

test.describe('Feature', () => {
  test('should do something', async ({ adminPage }) => {
    const page = new SomePage(adminPage);
    // Test code
  });
});
```

### 2. Create Page Object (if needed)

```typescript
// tests/e2e/pages/some.page.ts
import { Page, Locator } from '@playwright/test';

export class SomePage {
  readonly page: Page;
  readonly someElement: Locator;

  constructor(page: Page) {
    this.page = page;
    this.someElement = page.locator('[data-testid="some-element"]');
  }

  async navigate(): Promise<void> {
    await this.page.goto('/some-route');
  }
}
```

### 3. Run Tests

```bash
npx playwright test tests/e2e/specs/feature.spec.ts
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Test Guide](https://playwright.dev/docs/intro)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
