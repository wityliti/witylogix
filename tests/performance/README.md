# Performance & Load Testing Suite

Comprehensive k6-based load testing infrastructure for the Witylogix platform.

## Overview

This suite provides production-ready performance testing scenarios covering:

- **Authentication** - Login, registration, token refresh, password reset
- **Onboarding** - Multi-step wizard completion and resume flows
- **CRUD Operations** - Orders, drivers, deliveries with pagination and concurrency
- **Webhooks** - Event emission, delivery, retries, and dead letter queue
- **Multi-Tenant Isolation** - Data isolation and security under load

## Directory Structure

```
tests/performance/
├── k6/
│   ├── auth-load.js                 # Auth endpoint load tests (~240 lines)
│   ├── onboarding-load.js           # Onboarding flow tests (~260 lines)
│   ├── api-crud-load.js             # CRUD operations tests (~370 lines)
│   ├── webhook-load.js              # Webhook delivery tests (~290 lines)
│   ├── tenant-isolation-load.js     # Multi-tenant isolation tests (~300 lines)
│   └── helpers/
│       ├── auth.js                  # Auth helper functions (~370 lines)
│       └── data-generators.js       # Test data generation (~420 lines)
├── config/
│   ├── thresholds.json              # SLA thresholds and limits
│   └── environments.json            # Environment configurations
├── baselines/
│   └── baseline-v6.2.json           # Performance baseline metrics
├── scripts/
│   ├── run-perf-suite.sh           # Test runner script
│   └── generate-report.js           # HTML report generator
├── results/                         # Test results (generated)
└── README.md                        # This file
```

## Quick Start

### Prerequisites

- **k6** (load testing tool)

  ```bash
  # macOS
  brew install k6

  # Ubuntu/Debian
  sudo apt-get install k6

  # Docker
  docker run -v $(pwd):/scripts -it grafana/k6:latest run /scripts/tests/performance/k6/auth-load.js
  ```

- **Node.js** (for report generation)
  ```bash
  node --version  # v14+
  ```

### Running Tests

#### Simple Test Run

```bash
# Run authentication load test
k6 run tests/performance/k6/auth-load.js

# Run all tests
./tests/performance/scripts/run-perf-suite.sh staging all

# Run specific test
k6 run -e API_BASE_URL=http://localhost:3000 tests/performance/k6/auth-load.js
```

#### With Environment Variables

```bash
k6 run \
  -e API_BASE_URL=http://localhost:3000 \
  -e API_EMAIL=test@example.com \
  -e API_PASSWORD=TestPassword123! \
  tests/performance/k6/auth-load.js
```

#### Generate Reports

```bash
# Run tests and capture JSON output
k6 run \
  --out json=results/test-output.json \
  tests/performance/k6/auth-load.js

# Generate HTML report
node tests/performance/scripts/generate-report.js results/20260316_120000
```

## Test Scenarios

### 1. Authentication Load Test (`auth-load.js`)

**Purpose:** Test login, registration, token refresh, and password reset operations under load.

**Configuration:**

- Ramp-up: 0→50 VUs over 30s
- Sustained: 50 VUs for 2 minutes
- Ramp-down: 50→0 VUs over 30s

**Thresholds:**

- p95 login duration < 500ms
- p99 login duration < 1s
- Error rate < 1%
- Token refresh p95 < 300ms
- Rate limit enforcement > 80%

**Scenarios:**

- Login flow with email/password
- User registration with unique data
- Token refresh with validity checks
- Password reset request flow
- Multiple rapid login attempts
- Concurrent authentication requests

**Custom Metrics:**

- `login_duration` - Login operation time
- `token_refresh_duration` - Token refresh time
- `password_reset_duration` - Password reset time
- `rate_limit_violations` - 429 responses received
- `successful_logins` - Successful login rate
- `invalid_tokens` - Invalid JWT count

---

### 2. Onboarding Load Test (`onboarding-load.js`)

**Purpose:** Test multi-step onboarding wizard completion and state persistence.

**Configuration:**

- 20 concurrent VUs for 5 minutes
- Mix of full completions and partial saves

**Thresholds:**

- p95 per step < 800ms
- Total flow < 30s
- Error rate < 1%
- Success rate > 95%

**Scenarios:**

- Complete onboarding flow (5 steps)
- Partial save and resume
- Step validation
- Data persistence checks

**Custom Metrics:**

- `onboarding_step_duration` - Time per step
- `onboarding_total_duration` - Total completion time
- `step_save_failures` - Failed progress saves
- `successful_completions` - Completion rate

---

### 3. CRUD Operations Load Test (`api-crud-load.js`)

**Purpose:** Test Create, Read, Update, Delete operations across orders, drivers, and deliveries.

**Configuration:**

- Ramp-up: 0→30 VUs over 30s
- Sustained: 30 VUs for 2 minutes
- Ramp-down: 30→0 VUs over 30s

**Workload:**

- 80% read operations (GET, LIST)
- 20% write operations (POST, PUT, DELETE)

**Thresholds:**

- Read p95 < 200ms
- Write p95 < 500ms
- Pagination p95 < 300ms
- Error rate < 1%
- Concurrency conflicts < 5%

**Scenarios:**

- Order CRUD with status changes
- Driver CRUD with location updates
- Delivery CRUD with tracking
- Paginated listing (offset and cursor-based)
- Bulk operations (100 orders)
- Complex filtering and sorting
- Concurrent modifications with optimistic locking

**Custom Metrics:**

- `read_duration` - Read operation time
- `write_duration` - Write operation time
- `pagination_duration` - Pagination request time
- `bulk_operation_duration` - Bulk operation time
- `concurrency_conflicts` - Conflict count (409, 422)

---

### 4. Webhook Delivery Load Test (`webhook-load.js`)

**Purpose:** Test high-throughput webhook event emission and delivery under load.

**Configuration:**

- Ramp-up: 50 VUs over 30s
- Spike: Scale to 100 VUs over 1 minute
- Sustained: 100 VUs for 3 minutes
- Ramp-down: 30s

**Target Throughput:** 1000 events/minute

**Thresholds:**

- Delivery p95 < 2 seconds
- Retry success rate > 95%
- Dead letter queue growth < 1%
- Error rate < 2%

**Scenarios:**

- Standard webhook delivery
- Concurrent webhook emission
- Retry storm simulation
- Dead letter queue monitoring
- Batch event emission (50 events)
- Webhook statistics collection

**Custom Metrics:**

- `webhook_delivery_duration` - Delivery time
- `webhook_retry_duration` - Retry time
- `delivery_success_rate` - Successful delivery rate
- `retry_success_rate` - Retry success rate
- `dead_letter_queue_growth` - DLQ size increase

---

### 5. Multi-Tenant Isolation Load Test (`tenant-isolation-load.js`)

**Purpose:** Verify data isolation and security with 10 concurrent tenants.

**Configuration:**

- 10 concurrent VUs (one per tenant)
- Run for 3 minutes
- Ramp-up: 30s, Ramp-down: 30s

**Thresholds:**

- p95 response time < 300ms
- Error rate < 1%
- Cross-tenant violations = 0 (critical)
- Rate limit enforcement = 100%
- Unauthorized access = 0 (critical)

**Scenarios:**

- Concurrent tenant operations
- Data isolation verification
- Per-tenant rate limiting
- API key authentication
- Cross-tenant access prevention
- Resource filtering by tenant

**Custom Metrics:**

- `tenant_operation_duration` - Tenant op time
- `data_isolation_checks` - Isolation validations
- `cross_tenant_violations` - Security breaches
- `rate_limit_enforcements` - Rate limit hits
- `unauthorized_attempts_blocked` - Blocked attempts

---

## Configuration Files

### `environments.json`

Defines environment-specific settings and test profiles.

**Environments:**

- `dev` - Local development (10 VUs, 1 min test)
- `staging` - Staging environment (50 VUs, 5 min test)
- `production` - Production (100 VUs, 10 min test, read-only)

**Test Profiles:**

- `loadTest` - Moderate load testing
- `stressTest` - High stress (200 VUs)
- `spikeTest` - Spike testing (500 VUs)
- `soakTest` - Long-running soak test (2 hours)
- `smokeTest` - Quick validation (5 VUs, 1 min)
- `cicd` - CI/CD pipeline (10 VUs, 2 min)

### `thresholds.json`

SLA thresholds and performance limits for all endpoints.

**Sections:**

- Global response time, error rate, success rate
- Per-endpoint thresholds (auth, orders, drivers, webhooks)
- Database query time limits
- Rate limiting configuration
- Multi-tenant security requirements

### `baseline-v6.2.json`

Recorded baseline metrics for v6.2 release.

Used for:

- Performance regression detection
- Threshold validation
- Historical comparison

---

## Helper Libraries

### `helpers/auth.js`

Authentication utilities for load tests.

**Functions:**

- `login(email, password)` - User login
- `register(email, password, name, shopDomain)` - Registration
- `refreshToken(refreshToken)` - Token refresh
- `requestPasswordReset(email)` - Reset request
- `authenticatedRequest(method, path, body, token)` - Authenticated requests
- `generateTestUser(suffix)` - Generate unique test user
- `parseJWT(token)` - Parse JWT payload
- `isTokenValid(token)` - Check token expiration
- `extractAuthContext(token)` - Get auth claims

### `helpers/data-generators.js`

Test data generation utilities.

**Functions:**

- `generateOrder(customerId, shopId)` - Order data
- `generateDriver(shopId)` - Driver data
- `generateDelivery(orderId, driverId)` - Delivery data
- `generateAddress()` - US address
- `generateEmail(domain)` - Unique email
- `generatePhone(areaCode)` - Phone number
- `generateName()` - Person name
- `randomInt(min, max)` - Random integer
- `randomFloat(min, max, decimals)` - Random float
- `randomFromArray(array)` - Random array element
- `generateWebhookEvent(eventType, resourceId, data)` - Webhook event

---

## Running Tests

### Command Line Interface

```bash
# Run specific test
k6 run tests/performance/k6/auth-load.js

# Run with custom VU count and duration
k6 run --vus 100 --duration 5m tests/performance/k6/api-crud-load.js

# Run with environment variables
k6 run \
  -e API_BASE_URL=http://localhost:3000 \
  -e API_EMAIL=test@example.com \
  tests/performance/k6/auth-load.js

# Run with JSON output
k6 run \
  --out json=results/test-results.json \
  tests/performance/k6/auth-load.js

# Run with HTML report (requires reporter)
k6 run \
  --out cloud \
  tests/performance/k6/auth-load.js
```

### Using the Test Runner Script

```bash
# Make script executable
chmod +x tests/performance/scripts/run-perf-suite.sh

# Run all tests for staging
./tests/performance/scripts/run-perf-suite.sh staging all

# Run specific scenario
./tests/performance/scripts/run-perf-suite.sh dev auth

# Available scenarios
# - all: All tests
# - auth: Authentication only
# - onboarding: Onboarding only
# - crud: CRUD operations only
# - webhook: Webhooks only
# - tenant-isolation: Multi-tenant only
# - smoke: Smoke test (minimal)
# - ci: CI/CD pipeline test
```

### Docker Execution

```bash
# Run test in Docker
docker run -v $(pwd):/scripts -it grafana/k6:latest \
  run /scripts/tests/performance/k6/auth-load.js

# With environment variables
docker run -v $(pwd):/scripts -it grafana/k6:latest \
  run -e API_BASE_URL=http://host.docker.internal:3000 \
  /scripts/tests/performance/k6/auth-load.js
```

---

## Performance Thresholds

### API Response Times (Global)

- p50: 100ms
- p95: 500ms
- p99: 1000ms
- Average: 250ms

### Error Rates

- Maximum acceptable: 1%
- Success rate minimum: 99%

### By Endpoint Category

**Authentication:**

- Login p95 < 500ms
- Register p95 < 800ms
- Token refresh p95 < 300ms

**Read Operations:**

- p95 < 200ms (GET single)
- p95 < 300ms (LIST with pagination)

**Write Operations:**

- p95 < 500ms (POST/PUT)
- Bulk p95 < 5 seconds (100 items)

**Webhooks:**

- Delivery p95 < 2000ms
- Retry success > 95%

**Multi-Tenant:**

- Cross-tenant violations: 0 (critical)
- Unauthorized access: 0 (critical)

---

## Results and Reports

### Output Files

- `results/<timestamp>/` - Test results directory
- `results/<timestamp>/<test>-results.json` - Raw k6 metrics
- `results/<timestamp>/report.html` - Generated HTML report

### Report Contents

- Test summary (total requests, errors)
- Response time distribution
- Endpoint-specific metrics
- Threshold pass/fail status
- Baseline comparison
- Performance trends

### Comparing Against Baseline

```bash
# After running tests, view baseline
cat tests/performance/baselines/baseline-v6.2.json

# Key metrics to compare:
# - p95 response times
# - Error rates
# - Throughput (requests/second)
# - Resource utilization
```

---

## Troubleshooting

### Test Failures

**Common Issues:**

1. **Connection refused**
   - Ensure API server is running
   - Check `API_BASE_URL` environment variable
   - Verify network connectivity

2. **Authentication failures**
   - Validate test user credentials
   - Check JWT token validity
   - Verify API key configuration

3. **Rate limiting (429 errors)**
   - Expected in rate limit tests
   - Reduce VU count if not testing limits
   - Check per-user/per-tenant thresholds

4. **Timeout errors (> 30s)**
   - Increase timeout in environment config
   - Check API server performance
   - Reduce concurrent users

### Debug Mode

```bash
# Run with verbose logging
k6 run -v tests/performance/k6/auth-load.js

# Run with HTTP debug
k6 run --http-debug=body tests/performance/k6/auth-load.js

# Run single iteration
k6 run --iterations 1 tests/performance/k6/auth-load.js
```

---

## Best Practices

1. **Start Small** - Begin with smoke tests before full load
2. **Use Baselines** - Compare against established baselines
3. **Isolate Variables** - Test one scenario at a time
4. **Monitor Resources** - Watch CPU, memory, and connections
5. **Gradual Ramp-up** - Ramp VUs gradually to identify breaking points
6. **Real Data** - Use realistic test data for accurate results
7. **Multiple Runs** - Run tests multiple times for consistency
8. **Document Results** - Keep records for trend analysis

---

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Performance Tests
  run: |
    ./tests/performance/scripts/run-perf-suite.sh staging ci
```

### Expected Results

- All threshold checks pass
- Error rate < 1%
- p95 response time < 500ms
- No cross-tenant violations

---

## References

- [K6 Documentation](https://k6.io/docs/)
- [K6 JavaScript API](https://k6.io/docs/javascript-api/)
- [Load Testing Best Practices](https://k6.io/docs/test-types/)

---

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review k6 documentation
3. Check test logs and JSON output
4. Verify environment configuration

---

**Last Updated:** 2026-03-16
**Version:** 1.0.0
**Maintained by:** QA Team
