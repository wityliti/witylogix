# Sprint 4.5 E2E Test Suites - Witylogix Platform

Comprehensive end-to-end test suite for Dispatch Dashboard, Checkout Widget, Customer Portal, POD Capture, and Notification Delivery features.

## Overview

This test suite includes full E2E coverage for Sprint 4.5 features using Playwright, with realistic mock data and API mocking for isolated testing.

## Project Structure

```
tests/e2e/
├── pages/
│   ├── dispatch.page.ts              # Dispatch dashboard page object
│   ├── checkout-widget.page.ts       # Checkout widget page object
│   └── customer-portal.page.ts       # Customer portal page object
├── fixtures/
│   ├── dispatch-fixtures.ts          # Mock dispatch data
│   ├── checkout-fixtures.ts          # Mock checkout data
│   └── auth.fixture.ts               # Authentication fixture (existing)
├── helpers/
│   └── mock-api.ts                   # API mocking helper
├── specs/
│   ├── dispatch/
│   │   └── dispatch-dashboard.spec.ts # Dispatch tests (14 tests)
│   ├── checkout/
│   │   └── checkout-widget.spec.ts   # Checkout tests (18 tests)
│   ├── portal/
│   │   └── customer-portal.spec.ts   # Portal tests (18 tests)
│   ├── pod/
│   │   └── pod-capture.spec.ts       # POD tests (12 tests)
│   └── notifications/
│       └── notification-delivery.spec.ts # Notification tests (11 tests)
```

## Page Objects

### DispatchPage (`pages/dispatch.page.ts`)

Encapsulates all dispatch dashboard interactions.

**Key Methods:**
- `navigateToDispatch()` - Navigate to dispatch dashboard
- `getStatsBar()` - Get dashboard statistics (drivers, stops, km, time)
- `getRouteTimeline()` - Get route information with driver details
- `getDriverCards()` - Get list of drivers with their info
- `selectDriver(name)` - Select and highlight a driver
- `getMapMarkers()` - Get all map markers with coordinates
- `dragStopToRoute(stopId, routeId)` - Drag stop to different route
- `clickPlanRoutes()` - Trigger route optimization
- `toggleTab(tabName)` - Switch between unscheduled/scheduled tabs
- `getUnscheduledCount()` / `getScheduledCount()` - Get stop counts
- `clickStopCard(stopId)` - Click to view stop details
- `getStopDetails()` - Get details of selected stop
- `waitForStatsUpdate()` - Wait for real-time updates

### CheckoutWidgetPage (`pages/checkout-widget.page.ts`)

Encapsulates checkout flow interactions.

**Key Methods:**
- `waitForWidgetLoad()` - Wait for widget initialization
- `enterAddress(address)` - Enter delivery address
- `validateZipcode(zip)` - Validate postal code
- `selectDeliveryMethod(method)` - Choose delivery method
- `selectDate(date)` - Select delivery date
- `getAvailableDates()` - Get list of available delivery dates
- `getAvailableSlots()` - Get time slots for selected date
- `selectTimeSlot(time)` - Choose delivery time
- `getCapacityIndicator(slotId)` - Get slot capacity info
- `getDeliveryRate()` - Get delivery cost
- `getOrderSummary()` - Get order totals and details
- `completeCheckout()` - Complete the checkout flow
- `isOutsideDeliveryZone()` - Check delivery zone
- `hasCutoffWarning()` - Check order deadline warning

### CustomerPortalPage (`pages/customer-portal.page.ts`)

Encapsulates customer portal interactions.

**Key Methods:**
- `login(email, password)` - Login to portal
- `navigateToOrders()` / `navigateToTrack()` / `navigateToPreferences()` - Navigate sections
- `getOrderList()` - Get list of customer orders
- `getOrderDetail(orderId)` - Get detailed order information
- `getDeliveryTimeline(orderId)` - Get delivery status timeline
- `clickReschedule(orderId)` - Start rescheduling
- `selectNewDate(date)` - Select new delivery date
- `confirmReschedule()` - Confirm rescheduling
- `updatePreferences(prefs)` - Save delivery preferences
- `rateDelivery(orderId, stars, feedback)` - Rate a delivery
- `getTrackingInfo(orderId)` - Get live tracking data
- `getPODImage(orderId)` - Get proof of delivery image
- `logout()` - Logout from portal

## Fixtures

### Dispatch Fixtures (`fixtures/dispatch-fixtures.ts`)

Mock data for dispatch testing:
- `mockDrivers` - Array of 3 test drivers with details
- `mockRoutes` - Array of 2 sample routes with stops
- `mockUnscheduledStops` - Unscheduled deliveries for assignment
- `mockMapMarkers` - Map markers with coordinates
- `mockDispatchStats` - Dashboard statistics
- `routeOptimizationResponse` - Route optimization results
- `realtimeStatsUpdate` - Real-time stats for updates
- `mockStopDetail` - Single stop detail response

**Usage:**
```typescript
import { getDispatchTestData, mockDrivers } from './fixtures/dispatch-fixtures';

const testData = getDispatchTestData();
```

### Checkout Fixtures (`fixtures/checkout-fixtures.ts`)

Mock data for checkout testing:
- `mockDeliveryZones` - 3 delivery zones with rates
- `mockAvailableDates` - Sample dates with availability
- `mockTimeSlots` - Time slots with capacity
- `mockAddresses` - Test addresses (valid and outside zone)
- `mockCheckoutCart` - Sample shopping cart
- `mockCheckoutSession` - Checkout session data
- `mockCheckoutErrors` - Error responses
- `mockBlackoutDates` - Unavailable dates

**Usage:**
```typescript
import { getCheckoutTestData, mockDeliveryZones } from './fixtures/checkout-fixtures';

const testData = getCheckoutTestData();
```

## Mock API Helper (`helpers/mock-api.ts`)

Provides API mocking functions for isolated testing.

**Key Functions:**
- `setupDispatchMocks(page)` - Setup all dispatch API mocks
- `setupCheckoutMocks(page)` - Setup checkout API mocks
- `setupPortalMocks(page)` - Setup portal API mocks
- `setupErrorMocks(page, errorType)` - Setup error scenarios
- `setupRealtimeUpdates(page)` - Setup real-time mock updates
- `clearAllMocks(page)` - Clean up all routes

**Error Types:**
- `'outside-zone'` - Address outside delivery zone
- `'invalid-zipcode'` - Invalid postal code
- `'no-slots'` - No available time slots
- `'network-error'` - Network failure

**Usage:**
```typescript
import { setupDispatchMocks, clearAllMocks } from './helpers/mock-api';

test.beforeEach(async ({ page }) => {
  await setupDispatchMocks(page);
});

test.afterEach(async ({ page }) => {
  await clearAllMocks(page);
});
```

## Test Specifications

### Dispatch Dashboard Tests (`specs/dispatch/dispatch-dashboard.spec.ts`)

**14 test cases** covering:
1. Stats bar display (drivers, stops, km, time)
2. Color-coded routes on map
3. Route timeline with driver information
4. Tab toggling (unscheduled/scheduled)
5. Stop details on click
6. Drag-and-drop stop reassignment
7. Route optimization (Plan Routes)
8. Real-time stats updates
9. Driver card display
10. Driver selection and highlighting
11. Map marker display
12. Empty state handling
13. Network error handling
14. Route metrics calculation

**Run:**
```bash
npx playwright test specs/dispatch/dispatch-dashboard.spec.ts
```

### Checkout Widget Tests (`specs/checkout/checkout-widget.spec.ts`)

**18 test cases** covering:
1. Address validation and zone detection
2. Available dates display with capacity
3. Blackout dates disabled
4. Time slots with capacity indicators
5. Delivery rate calculation
6. Order deadline/cutoff enforcement
7. Complete checkout flow (5 steps)
8. Outside delivery zone handling
9. Invalid zipcode errors
10. Capacity indicator details
11. Order total calculation
12. Different delivery method rates
13. Address persistence through steps
14. Network error handling
15. Address format validation
16. Back button navigation
17. Order summary display
18. Unavailable time slot disabling

**Run:**
```bash
npx playwright test specs/checkout/checkout-widget.spec.ts
```

### Customer Portal Tests (`specs/portal/customer-portal.spec.ts`)

**18 test cases** covering:
1. Customer login
2. Order history display with status badges
3. Delivery status timeline with timestamps
4. POD photos for delivered orders
5. Rescheduling with date/time selection
6. Delivery preference saving (safe place, access code)
7. Delivery rating with stars and feedback
8. Live tracking map with driver position
9. Logout functionality
10. Order items display in detail
11. Estimated delivery date/time
12. Contact information display
13. Section navigation
14. Empty order history handling
15. Timeline events in correct order
16. Driver information on in-transit orders
17. Preference persistence across sessions
18. Login error handling

**Run:**
```bash
npx playwright test specs/portal/customer-portal.spec.ts
```

### POD Capture Tests (`specs/pod/pod-capture.spec.ts`)

**12 test cases** covering:
1. Photo POD upload with thumbnail generation
2. E-signature capture and SVG storage
3. QR code validation
4. Delivery timeline with all events
5. Delivery completion after POD
6. Offline POD capture handling
7. POD data sync when connection restored
8. POD photos in delivery history
9. POD data editing before submission
10. POD data validation before final submission
11. Large photo upload handling
12. Offline indicator display

**Run:**
```bash
npx playwright test specs/pod/pod-capture.spec.ts
```

### Notification Delivery Tests (`specs/notifications/notification-delivery.spec.ts`)

**11 test cases** covering:
1. Email notification on order confirmation
2. SMS with tracking link on out-for-delivery
3. Notification preference respect
4. Webhook firing on status change
5. Notification template variables
6. Failed notification retry
7. Notification history display
8. Batch notification sending
9. Unsubscribe via link
10. Notification error handling
11. Multiple notification channels

**Run:**
```bash
npx playwright test specs/notifications/notification-delivery.spec.ts
```

## Running Tests

### Run All Sprint 4.5 Tests
```bash
npx playwright test specs/dispatch/ specs/checkout/ specs/portal/ specs/pod/ specs/notifications/
```

### Run Specific Test Suite
```bash
# Dispatch only
npx playwright test specs/dispatch/dispatch-dashboard.spec.ts

# Checkout only
npx playwright test specs/checkout/checkout-widget.spec.ts

# Portal only
npx playwright test specs/portal/customer-portal.spec.ts

# POD only
npx playwright test specs/pod/pod-capture.spec.ts

# Notifications only
npx playwright test specs/notifications/notification-delivery.spec.ts
```

### Run Specific Test
```bash
npx playwright test -g "should display stats bar"
```

### Run with Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run with UI Mode
```bash
npx playwright test --ui
```

### Run with Debug Mode
```bash
npx playwright test --debug
```

### Generate HTML Report
```bash
npx playwright test
npx playwright show-report
```

## Test Data

### Mock Users
- **Admin**: admin@test.com / admin123
- **Dispatcher**: dispatcher@test.com / dispatcher123
- **Driver**: driver@test.com / driver123
- **Customer**: customer@example.com / password123

### Mock Orders
- **ORD-001**: Delivered
- **ORD-002**: In-transit
- **ORD-003-008**: Various statuses

### Mock Drivers
- **driver-001**: John Smith (Rating: 4.8)
- **driver-002**: Maria Garcia (Rating: 4.9)
- **driver-003**: Ahmed Hassan (Rating: 4.6)

### Mock Zones
- **Zone 001 (Downtown)**: Zipcode 10001-10005, Rate $5.99
- **Zone 002 (Midtown)**: Zipcode 10016-10022, Rate $6.99
- **Zone 003 (Uptown)**: Zipcode 10023-10027, Rate $8.99

## Configuration

### Playwright Config (`playwright.config.ts`)

```typescript
{
  testDir: './tests/e2e/specs',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  baseURL: 'http://localhost:3002',
  timeout: 30000,
  expect: { timeout: 5000 }
}
```

## Best Practices

1. **Always use Page Objects** - Encapsulate element selectors in page objects
2. **Use Test Fixtures** - Leverage auth fixtures for role-based testing
3. **Mock External APIs** - Use mock-api helper to intercept network calls
4. **Wait for Network** - Always wait for networkidle after navigation
5. **Meaningful Assertions** - Use descriptive assertion messages
6. **Test Data Cleanup** - Use afterEach hooks to clean up
7. **Error Handling** - Test both success and error scenarios
8. **Avoid Hard Waits** - Use proper wait strategies (networkidle, visibility)
9. **Parallel Testing** - Tests run in parallel when possible
10. **Accessibility** - Use data-testid attributes for reliable element selection

## Debugging

### Run Tests in Debug Mode
```bash
npx playwright test --debug
```

### View Test Traces
```bash
npx playwright show-trace trace.zip
```

### View Network Activity
Check browser dev tools in headed mode:
```bash
npx playwright test --headed
```

### Screenshot on Failure
Automatically captured in `tests/e2e/results/screenshots/`

## Performance Considerations

- All tests use mocked APIs (no network latency)
- Parallel execution reduces total test time
- Average suite execution time: ~5-10 minutes
- Individual test average: 10-30 seconds

## CI/CD Integration

Tests are configured to run in CI with:
- Serial execution (1 worker)
- 2 retries on failure
- HTML and List reporters
- Screenshot/video on failure

```bash
# CI environment
CI=true npx playwright test
```

## Maintenance

### Adding New Tests
1. Create test file in appropriate `specs/` subdirectory
2. Import page object and fixtures
3. Use `setupMocks()` in beforeEach
4. Add `clearAllMocks()` in afterEach
5. Follow naming convention: `should [action] [expected result]`

### Updating Mock Data
1. Edit fixture files in `fixtures/`
2. Ensure mock data matches actual API responses
3. Keep fixture data realistic and comprehensive

### Updating Page Objects
1. Add new methods for new UI elements
2. Keep selectors in constructor
3. Add wait strategies for async operations
4. Document method purpose and return types

## Troubleshooting

### Tests Timeout
- Increase timeout in playwright.config.ts
- Check if API mocks are returning properly
- Verify waitForLoadState('networkidle') calls

### Flaky Tests
- Use proper wait strategies instead of fixed delays
- Ensure data-testid attributes exist on elements
- Check mock API responses match expectations

### Element Not Found
- Verify selector in test using Playwright Inspector
- Check element visibility in dev tools
- Ensure proper wait before interaction

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Page Object Model](https://playwright.dev/docs/pom)
- [Test Fixtures](https://playwright.dev/docs/test-fixtures)
