# End-to-End Smoke Test Suite

Comprehensive Playwright smoke tests covering critical user paths and system health for the Witylogix platform.

## Overview

This smoke test suite validates critical end-to-end functionality across the Witylogix delivery platform, including:
- User authentication and authorization flows
- Complete onboarding workflow
- Core delivery lifecycle (zone → driver → order → delivery)
- System health and SLA compliance
- Integration health checks

## Test Files

### Spec Files

1. **critical-path.spec.ts** (~250 lines)
   - Complete delivery lifecycle from registration to delivery confirmation
   - Full end-to-end flow with all critical steps
   - Validates workspace provisioning and dashboard functionality
   - Tests driver assignment, pickup, delivery, and proof of delivery

2. **auth-flows.spec.ts** (~270 lines)
   - Login with email/password
   - Registration and email verification
   - Password reset flow
   - Magic link authentication
   - Session management and expiry
   - MFA setup and verification
   - Logout and access control

3. **onboarding-complete.spec.ts** (~250 lines)
   - Email verification step
   - Deployment selection (cloud/self-hosted)
   - Company information entry
   - Industry selection
   - Business goals selection (3+ goals)
   - Integration selection (Shopify, Stripe, etc.)
   - Dashboard layout selection
   - Data import (skip option)
   - Workspace provisioning verification
   - Navigation between onboarding steps

4. **integration-health.spec.ts** (~200 lines)
   - API health endpoint (200 OK)
   - Database connection health
   - Redis connection health
   - API response time SLA (< 500ms)
   - Static asset loading
   - Security headers validation
   - CORS configuration
   - Gzip compression support
   - Service discovery

### Page Objects

1. **page-objects/auth.page.ts** (~124 lines)
   - `SmokeAuthPage` class with methods for:
     - Login/Register flows
     - Password reset
     - MFA verification
     - Email verification
     - Error/success message handling
     - Page navigation

2. **page-objects/dashboard.page.ts** (~191 lines)
   - `SmokeDashboardPage` class with methods for:
     - Dashboard navigation
     - Delivery zone creation
     - Driver creation
     - Order creation
     - Stats card retrieval
     - User menu and logout
     - Page load verification

3. **page-objects/onboarding.page.ts** (~171 lines)
   - `SmokeOnboardingPage` class with methods for:
     - Email verification
     - Deployment selection
     - Company information entry
     - Industry selection
     - Goals selection
     - Integration selection
     - Layout selection
     - Step navigation (next/previous/skip)
     - Progress tracking

### Fixtures

**fixtures/test-data.ts** (~89 lines)
- Centralized test data including:
  - New account credentials
  - Delivery zone configuration
  - Driver information
  - Order data (sender/receiver)
  - Onboarding selections
  - MFA test data
  - Timeout configurations
- Helper functions:
  - `generateTestEmail()` - Create unique test emails
  - `generateTrackingId()` - Create unique order IDs

### Configuration

**playwright.smoke.config.ts** (~54 lines)
- Smoke test-specific configuration:
  - Single worker for sequential execution
  - HTML, JSON, and JUnit reporting
  - Screenshot on failure
  - Video recording for failed tests
  - Global setup/teardown
  - Chromium browser only

## Running the Tests

### Run All Smoke Tests
```bash
npm run test:smoke
# or
npx playwright test --config=tests/e2e/smoke/playwright.smoke.config.ts
```

### Run Specific Test File
```bash
npx playwright test tests/e2e/smoke/critical-path.spec.ts
npx playwright test tests/e2e/smoke/auth-flows.spec.ts
npx playwright test tests/e2e/smoke/onboarding-complete.spec.ts
npx playwright test tests/e2e/smoke/integration-health.spec.ts
```

### Run Single Test
```bash
npx playwright test tests/e2e/smoke/critical-path.spec.ts -g "should complete full delivery lifecycle"
```

### Debug Mode
```bash
npx playwright test --config=tests/e2e/smoke/playwright.smoke.config.ts --debug
```

### Headed Mode (see browser)
```bash
npx playwright test --config=tests/e2e/smoke/playwright.smoke.config.ts --headed
```

## Environment Setup

### Required Environment Variables
```env
# .env.test or .env
TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=admin123
TEST_DISPATCHER_EMAIL=dispatcher@test.com
TEST_DISPATCHER_PASSWORD=dispatcher123
TEST_DRIVER_EMAIL=driver@test.com
TEST_DRIVER_PASSWORD=driver123

# Web and API URLs
WEB_URL=http://localhost:3002
API_URL=http://localhost:3001
```

### Services Required
- Web application running on localhost:3002
- API running on localhost:3001
- Database (for onboarding tests)
- Redis (optional, tested if available)

## Test Structure

### Critical Path Test Stages
1. **Registration** - New account creation
2. **Email Verification** - Email verification step
3. **Onboarding** - Complete onboarding flow
4. **Dashboard** - Verify workspace provisioning
5. **Delivery Zone** - Create first zone
6. **Driver** - Create first driver
7. **Order** - Create first order
8. **Assignment** - Assign driver to order
9. **Acceptance** - Driver accepts order
10. **Pickup** - Driver picks up package
11. **Delivery** - Driver delivers package
12. **Proof of Delivery** - Verify POD captured
13. **Completion** - Verify order marked complete
14. **Notifications** - Verify notifications sent
15. **Dashboard State** - Verify stats updated

### Auth Flow Stages
- Email/password login
- Invalid credentials handling
- Registration flow
- Password reset
- Magic link authentication
- Session expiry
- MFA setup and verification
- Logout functionality
- Protected route access control
- Password requirements validation

### Onboarding Stages
- Email verification
- Deployment selection
- Company information
- Industry selection
- Business goals
- Integrations
- Layout selection
- Data import
- Review and submit
- Workspace verification
- Navigation validation

### Health Check Stages
- API health endpoints
- Database connectivity
- Redis connectivity
- Response time SLA
- Static asset loading
- Security headers
- CORS validation
- Compression support

## Assertions and Validations

### Page Visibility Assertions
- All key page elements are visible
- Loading spinners disappear after data load
- Notifications appear for success/error states

### Navigation Assertions
- Correct page URLs after navigation
- Sidebar links are functional
- Modal forms open and close correctly

### Data Assertions
- Form fields are populated correctly
- Selections persist through steps
- Stats cards contain valid data
- Status updates reflect actions

### Performance Assertions
- API responds within 500ms SLA
- Pages load within acceptable time
- No console errors on page load

### Security Assertions
- Auth tokens are properly validated
- Protected routes redirect to login
- Session expiry is enforced
- CORS headers are present
- Security headers are set

## Test Data Management

### Unique Test Data
Each test generates unique identifiers to avoid conflicts:
- `generateTestEmail()` - Creates unique emails with timestamp
- `generateTrackingId()` - Creates unique order IDs
- Test passwords are configured in `SMOKE_TEST_DATA`

### Test Data Cleanup
- Tests use isolated test accounts
- Data is created fresh for each test run
- Database cleanup is handled by teardown scripts

## Reporting

### Report Outputs
- **HTML Report**: `tests/e2e/results/smoke/index.html`
- **JSON Report**: `tests/e2e/results/smoke/results.json`
- **JUnit Report**: `tests/e2e/results/smoke/junit.xml`
- **Console List**: Output to terminal

### View Reports
```bash
# Open HTML report
npx playwright show-report tests/e2e/results/smoke

# View video/screenshots on failure
# Available in tests/e2e/results/smoke/ directory
```

## CI/CD Integration

### GitHub Actions
Tests run automatically on:
- Pull requests
- Commits to main/develop
- Schedule (daily at 2 AM UTC)

### Configuration
- Parallel workers disabled (runs sequentially)
- Retries enabled (1 retry on CI)
- Screenshots on failure
- Video on failure
- Full trace on first retry

## Best Practices

1. **Test Independence**
   - Each test is self-contained
   - Tests don't depend on execution order
   - Tests clean up their own data

2. **Waits and Timeouts**
   - Use appropriate wait timeouts
   - Wait for network idle before assertions
   - Avoid hardcoded sleeps

3. **Selectors**
   - Prefer data-testid attributes
   - Use semantic HTML selectors
   - Avoid brittle CSS selectors

4. **Error Handling**
   - Gracefully handle optional features
   - Use try-catch for non-critical steps
   - Provide meaningful error messages

5. **Maintenance**
   - Keep page objects DRY
   - Update test data in fixtures
   - Review and update selectors regularly

## Troubleshooting

### Tests Timing Out
- Increase timeout in playwright.config
- Check if services are running
- Verify network connectivity

### Selector Not Found
- Verify page elements with data-testid
- Check for dynamic content loading
- Use waitFor with increased timeout

### Login Failures
- Verify test credentials in .env
- Check if test users exist
- Verify database connectivity

### Flaky Tests
- Add explicit waits for data load
- Increase element visibility timeout
- Check for race conditions

## Architecture Notes

### Page Object Model (POM)
- All page interactions encapsulated in page objects
- Reduces brittle selector references
- Improves test maintainability

### Fixture Pattern
- Centralized test data in fixtures/test-data.ts
- Generate unique data to avoid conflicts
- Easy to update test data across tests

### Test Isolation
- Each test creates fresh test data
- No test interdependencies
- Can run tests in any order

## Future Enhancements

- Add visual regression testing
- Implement accessibility testing
- Add performance monitoring
- Expand geographic testing
- Add multi-user scenario tests
- Implement API contract testing
- Add webhook verification
- Expand integration test coverage
