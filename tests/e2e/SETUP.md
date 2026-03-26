# Playwright E2E Test Framework - Setup & Usage

## Quick Start

### 1. Install Dependencies

```bash
cd /path/to/witylogix-platform
pnpm install
npx playwright install
```

### 2. Configure Environment

Create or update `.env.test`:

```env
BASE_URL=http://localhost:3002
API_URL=http://localhost:3001
TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=admin123
```

### 3. Start Services

In separate terminals:

```bash
# Terminal 1: API
cd apps/api
npm run dev  # Runs on port 3001

# Terminal 2: Dashboard
cd apps/dashboard
npm run dev  # Runs on port 3002
```

### 4. Run Tests

```bash
# From project root
pnpm test:e2e              # Run all tests
pnpm test:e2e:ui          # Interactive UI mode
pnpm test:e2e:headed      # Show browser
pnpm test:e2e:debug       # Debug mode
```

## File Structure

```
tests/e2e/
├── playwright.config.ts       # Main configuration
├── global-setup.ts            # Pre-test setup (auth, data seeding)
├── global-teardown.ts         # Post-test cleanup
├── tsconfig.json              # TypeScript configuration
├── README.md                  # Comprehensive documentation
├── SETUP.md                   # This file
├── .gitignore                 # Test artifacts to ignore
│
├── pages/                     # Page Object Models (4 files)
│   ├── login.page.ts          # Login form
│   ├── dashboard.page.ts      # Dashboard navigation
│   ├── orders.page.ts         # Order management
│   └── drivers.page.ts        # Driver operations
│
├── fixtures/                  # Test fixtures (1 file)
│   └── auth.fixture.ts        # Authentication & role fixtures
│
├── utils/                     # Helper functions (1 file)
│   └── helpers.ts             # Common utilities
│
└── specs/                     # Test specifications (5 files)
    ├── auth.spec.ts           # Authentication (9 tests)
    ├── order-lifecycle.spec.ts# Order CRUD (7 tests)
    ├── driver-management.spec.ts# Driver ops (9 tests)
    ├── tracking.spec.ts       # Tracking (7 tests)
    └── webhooks.spec.ts       # Webhooks (9 tests)

Total: 41 Critical Flow Tests
```

## Test Categories

### Authentication Flow (auth.spec.ts) - 9 Tests
1. Login with valid credentials
2. Login with invalid email
3. Login with invalid credentials
4. Login with empty credentials
5. Logout successfully
6. Session persistence
7. Protected route redirect
8. Different role content
9. Remember me functionality

### Order Lifecycle (order-lifecycle.spec.ts) - 7 Tests
1. Create order with all fields
2. Create order with minimal fields
3. Edit order details
4. Assign driver to order
5. Track order status changes
6. Filter orders by status
7. Search orders by tracking ID
8. Cancel order

### Driver Management (driver-management.spec.ts) - 9 Tests
1. View driver list with pagination
2. Filter drivers by availability
3. Filter drivers by unavailable status
4. Search for driver by name
5. View driver status
6. Update driver status
7. View driver details
8. View driver routes
9. Display performance metrics

### Order Tracking (tracking.spec.ts) - 7 Tests
1. Navigate to tracking page
2. Search shipment by tracking ID
3. Display full tracking timeline
4. Show status updates in timeline
5. Display estimated delivery time
6. Show current location for in-transit orders
7. Show driver information during transit
8. Verify status progression is logical
9. Display proof of delivery

### Webhook Management (webhooks.spec.ts) - 9 Tests
1. Navigate to webhook management page
2. Display webhook list
3. Create webhook endpoint
4. View webhook details
5. View webhook delivery log
6. Display delivery status in log
7. Retry failed delivery
8. Update webhook settings
9. Disable webhook

## Configuration Details

### playwright.config.ts
- **Base URL:** `http://localhost:3002` (Dashboard)
- **API URL:** `http://localhost:3001`
- **Projects:** Chromium, Firefox, WebKit
- **Retries:** 2 (CI), 0 (local)
- **Reporters:** HTML, List
- **Screenshots:** On failure
- **Videos:** On first retry
- **Timeout:** 30 seconds per test

### Page Object Models

#### LoginPage
```typescript
navigate()
fillCredentials(email, password)
submit()
login(email, password)
getErrorMessage()
expectErrorMessage(expectedText?)
setRememberMe(checked)
clickForgotPassword()
```

#### DashboardPage
```typescript
navigate()
waitForPageLoad()
waitForDataLoad()
navigateToSection(sectionName)
navigateToOrders()
navigateToDrivers()
navigateToWebhooks()
navigateToTracking()
getSidebarLinks()
getStatsCards()
search(query)
logout()
```

#### OrdersPage
```typescript
navigateToList()
clickCreateOrder()
fillOrderForm(data)
submitOrderForm()
createOrder(data)
getOrderByTrackingId(trackingId)
openOrderDetails(trackingId)
editOrder(trackingId, updates)
deleteOrder(trackingId)
filterByStatus(status)
searchByTrackingId(trackingId)
getOrderRow(index)
getOrderCount()
getOrderDetails(index)
```

#### DriversPage
```typescript
navigateToList()
getDriverByName(name)
openDriverDetails(name)
getDriverStatus(name)
updateDriverStatus(name, newStatus)
assignDriver(driverName, orderId?)
filterByAvailability(availability)
searchDriver(query)
getAllDrivers()
getDriverCount()
```

### Fixtures & Utilities

#### Authentication Fixture (auth.fixture.ts)
- `authenticatedPage` - Pre-authenticated admin page
- `adminPage` - Admin-role page
- `dispatcherPage` - Dispatcher-role page
- `driverPage` - Driver-role page

Test users:
```typescript
{
  admin: { email: 'admin@test.com', password: 'admin123', role: 'admin' },
  dispatcher: { email: 'dispatcher@test.com', password: 'dispatcher123', role: 'dispatcher' },
  driver: { email: 'driver@test.com', password: 'driver123', role: 'driver' }
}
```

#### Helper Utilities (helpers.ts)
- `generateTrackingId()` - Create unique tracking IDs
- `generateTestEmail()` - Create unique emails
- `generatePhoneNumber()` - Random US phone numbers
- `generateAddress()` - Random US addresses
- `getTableData()` - Extract table rows as objects
- `confirmModal()` - Handle modal dialogs
- `getErrorMessage()` - Get error text
- `waitForNetworkIdle()` - Wait for network completion
- And 10+ more utility functions

## Running Specific Tests

```bash
# Run single file
npx playwright test tests/e2e/specs/auth.spec.ts

# Run by test name
npx playwright test -g "should login with valid credentials"

# Run multiple files
npx playwright test auth.spec.ts order-lifecycle.spec.ts

# Run specific project
npx playwright test --project=chromium

# Run with specific browser count
npx playwright test --workers=1
```

## Debugging Tips

### View HTML Report
```bash
npx playwright show-report tests/e2e/results/html
```

### Screenshot Failures
All failure screenshots saved to `tests/e2e/results/`

### Video Recordings
Videos automatically recorded on failure

### Trace Viewer
```bash
npx playwright show-trace tests/e2e/results/trace.zip
```

### Debug Mode
```bash
pnpm test:e2e:debug

# Pause test at specific point
await page.pause();
```

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: pnpm install
      - run: npx playwright install --with-deps
      - run: pnpm test:e2e
        env:
          CI: true
          TEST_ADMIN_EMAIL: ${{ secrets.TEST_ADMIN_EMAIL }}
          TEST_ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: tests/e2e/results/html
```

## Troubleshooting

### Tests Timeout
```bash
# Increase timeout in playwright.config.ts
timeout: 60000 // 60 seconds
```

### Port Already in Use
```bash
lsof -ti:3002 | xargs kill -9  # Kill port 3002
lsof -ti:3001 | xargs kill -9  # Kill port 3001
```

### Auth Fails
1. Check credentials in `.env.test`
2. Clear `tests/e2e/auth.json`
3. Verify API is running and responding
4. Check test user exists in database

### Flaky Tests
- Add explicit waits: `await page.waitForLoadState('networkidle')`
- Verify element visibility before interaction
- Use `expect()` with timeout
- Avoid hard-coded delays

## Best Practices

1. **Use Page Objects** - Never use selectors directly in tests
2. **Test Independence** - Each test should be runnable alone
3. **Meaningful Names** - Describe what the test does
4. **Explicit Waits** - Always wait for elements/network
5. **Error Messages** - Add context to assertions
6. **Data Cleanup** - Tests should not depend on previous data
7. **Single Responsibility** - One assertion per test when possible
8. **Avoid Race Conditions** - Use `waitForLoadState` not `wait()`

## Next Steps

1. Run all tests: `pnpm test:e2e`
2. View results: `npx playwright show-report`
3. Debug failures: `pnpm test:e2e:debug`
4. Add new tests following the same patterns
5. Integrate into CI/CD pipeline

## Support

- [Playwright Docs](https://playwright.dev/)
- [Test Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- See `README.md` for comprehensive documentation
