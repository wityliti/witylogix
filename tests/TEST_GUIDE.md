# Test Guide for Witylogix Platform

This guide outlines the testing strategy, patterns, and best practices for the Witylogix delivery logistics platform.

## Table of Contents

1. [Test Philosophy](#test-philosophy)
2. [Test Categories](#test-categories)
3. [Writing Tests](#writing-tests)
4. [Running Tests](#running-tests)
5. [Coverage Requirements](#coverage-requirements)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Mocking Guide](#mocking-guide)
8. [Test Data Factories](#test-data-factories)
9. [Common Patterns](#common-patterns)

## Test Philosophy

Our testing strategy is built on the **Testing Pyramid** with the following distribution:

- **Unit Tests (60%):** Fast, isolated, no external dependencies
- **Integration Tests (25%):** Multiple components working together
- **E2E Tests (10%):** Real browser/API scenarios
- **Load/Performance Tests (5%):** System capacity and performance

We test behavior, not implementation. Tests should be clear, maintainable, and provide confidence in the codebase.

### Core Principles

- Tests should be **independent** - no test should depend on another
- Tests should be **deterministic** - same input = same output always
- Tests should be **fast** - unit tests < 100ms, integration < 5s
- Tests should be **readable** - anyone can understand test intent
- Tests should be **focused** - one assertion per test when possible

## Test Categories

### Unit Tests

Located in: `tests/unit/`

Test individual functions, classes, and components in isolation.

**Characteristics:**

- No external dependencies (databases, APIs, file system)
- Mocked when external calls are needed
- Run in < 100ms typically
- Highest coverage target: 85%

**Examples:**

- Service logic (calculations, transformations)
- Utility functions
- State management (reducers, hooks)
- Form validation

### Integration Tests

Located in: `tests/integration/`

Test multiple components working together, including with databases and services.

**Characteristics:**

- Uses test database or mocked services
- Tests actual business flows
- May involve multiple modules
- Run in < 10s typically
- Coverage target: 60%

**Examples:**

- API endpoint flows
- Database operations with validation
- Multi-step workflows
- Service integrations

### E2E Tests

Located in: `tests/e2e/`

Test complete user workflows through the browser.

**Characteristics:**

- Uses real browser automation (Playwright)
- Tests full feature flows
- Runs against staging/test environment
- Slower but highest confidence
- Coverage target: 40%

**Examples:**

- User signup/login flows
- Complete delivery workflows
- UI interactions
- Real API calls

### Load Tests

Located in: `tests/load/`

Test system performance under load.

**Characteristics:**

- Simulates concurrent users
- Measures response times
- Identifies bottlenecks
- No coverage requirements

**Examples:**

- API capacity testing
- Database connection pool limits
- Concurrent delivery operations
- Cache behavior under load

### Performance Tests

Located in: `tests/performance/`

Benchmark critical operations.

**Characteristics:**

- Measures execution time
- Tracks performance regressions
- Runs on isolated environment
- No coverage requirements

**Examples:**

- Route calculation performance
- Search query performance
- Large list rendering
- Data transformation speed

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("PodService", () => {
  let service: PodService;

  beforeEach(() => {
    service = new PodService();
  });

  afterEach(() => {
    // Cleanup
  });

  it("should calculate delivery POD correctly", () => {
    // Arrange
    const input = {
      signature: "test.png",
      photo: "delivery.jpg",
      timestamp: new Date(),
    };

    // Act
    const result = service.generatePOD(input);

    // Assert
    expect(result).toHaveProperty("id");
    expect(result.verified).toBe(true);
  });

  it("should handle missing signature gracefully", () => {
    const input = { signature: null, photo: "delivery.jpg" };
    expect(() => service.generatePOD(input)).toThrow("Signature required");
  });
});
```

### Naming Conventions

- Describe blocks: Use noun (the thing being tested): `describe("PodService", ...)`
- Test names: Use "should..." format: `it("should calculate delivery POD correctly", ...)`
- Variables: Use clear, domain-specific names: `deliveryPod`, not `result`

### Assertion Patterns

```typescript
// Equality
expect(value).toBe(5);
expect(obj).toEqual({ id: "1" });

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(array).toHaveLength(3);

// Arrays
expect(array).toContain(item);
expect(array).toEqual(expect.arrayContaining([1, 2]));

// Objects
expect(obj).toHaveProperty("id");
expect(obj).toMatchObject({ id: "1", status: "active" });

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrow("Expected error");

// Async
await expect(promise).resolves.toEqual(value);
await expect(promise).rejects.toThrow();
```

### Testing Async Code

```typescript
it("should fetch delivery data", async () => {
  const mockData = { id: "1", status: "delivered" };
  vi.mocked(api.getDelivery).mockResolvedValueOnce(mockData);

  const result = await service.fetchDelivery("1");

  expect(result).toEqual(mockData);
  expect(api.getDelivery).toHaveBeenCalledWith("1");
});

// For callbacks
it("should handle delivery callback", (done) => {
  service.onDeliveryComplete(() => {
    expect(service.status).toBe("completed");
    done();
  });

  service.completeDelivery();
});
```

## Running Tests

### Commands

```bash
# Run all tests
npm test

# Run specific category
npm test -- --run unit
npm test -- --run integration
npm test -- --run e2e

# Watch mode
npm test -- --watch

# With UI
npm test -- --ui

# Coverage report
npm test -- --coverage

# Specific file
npm test -- tests/unit/pod/pod-service.test.ts

# Match pattern
npm test -- -t "should calculate"
```

### Playwright E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# UI mode (interactive)
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Headed mode (visible browser)
npm run test:e2e:headed

# Specific test file
npx playwright test tests/e2e/delivery-flow.test.ts

# Specific test
npx playwright test -g "should complete delivery"
```

## Coverage Requirements

### Global Requirements

- **Unit Tests:** 85% (line, function, statement coverage)
- **Integration Tests:** 60% (line coverage)
- **E2E Tests:** 40% (critical paths)

### Coverage Calculation

Coverage is calculated per module/package:

```typescript
// Example: API package
- Statements: 82/100 = 82%
- Branches: 65/75 = 87%
- Functions: 45/50 = 90%
- Lines: 82/100 = 82%

// Pass if all >= threshold
```

### Improving Coverage

1. **Identify gaps:** `npm test -- --coverage`
2. **Add tests for untested paths:** Focus on branches, not just lines
3. **Test error cases:** Most gaps are error handling
4. **Test edge cases:** Null, empty, large values

```typescript
// BAD: Low coverage
it("should calculate cost", () => {
  expect(calculateCost(10)).toBe(100);
});

// GOOD: Better coverage
it("should calculate cost for valid price", () => {
  expect(calculateCost(10)).toBe(100);
});

it("should throw for negative price", () => {
  expect(() => calculateCost(-10)).toThrow("Price must be positive");
});

it("should throw for null price", () => {
  expect(() => calculateCost(null)).toThrow("Price required");
});
```

## CI/CD Pipeline

Tests run automatically on:

1. **Pull Request:** Unit + Integration tests
2. **Pre-commit:** Quick unit tests (fast failures)
3. **Main branch merge:** Full suite including E2E
4. **Nightly:** Load and performance tests

### CI Configuration

Located in `.github/workflows/tests.yml`

- Runs on every commit
- Fails if coverage drops below threshold
- Generates coverage reports
- Comments on PRs with results

## Mocking Guide

### Using Vitest Mocks

```typescript
import { vi } from "vitest";

// Mock a module
vi.mock("./database", () => ({
  db: {
    delivery: {
      findById: vi.fn(),
    },
  },
}));

// Mock a function
const mockFetch = vi.fn();

// Set return value
mockFetch.mockReturnValue("data");
mockFetch.mockResolvedValue(Promise.resolve("data"));

// Track calls
expect(mockFetch).toHaveBeenCalled();
expect(mockFetch).toHaveBeenCalledWith("arg");
expect(mockFetch).toHaveBeenCalledTimes(1);

// Mock implementation
mockFetch.mockImplementation((arg) => arg.toUpperCase());
```

### Prisma Mocking

```typescript
import { vi } from "vitest";
import * as prisma from "@prisma/client";

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => ({
    delivery: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  })),
}));

// In test
const mockPrisma = vi.mocked(prisma.PrismaClient);
mockPrisma().delivery.findUnique.mockResolvedValue(mockDelivery);
```

### Redis Mocking

```typescript
import { vi } from "vitest";

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  expire: vi.fn(),
};

vi.mock("redis", () => ({
  createClient: () => mockRedis,
}));
```

### HTTP Mocking

```typescript
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer(
  http.get("/api/delivery/:id", () => {
    return HttpResponse.json({ id: "1", status: "delivered" });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Test Data Factories

Use factories to create consistent test data:

```typescript
// factories/delivery.factory.ts
export const deliveryFactory = {
  create(overrides?: Partial<Delivery>): Delivery {
    return {
      id: "delivery-" + Math.random(),
      status: "pending",
      origin: { lat: 40.7128, lon: -74.006 },
      destination: { lat: 34.0522, lon: -118.2437 },
      driver: null,
      createdAt: new Date(),
      ...overrides,
    };
  },

  createMany(count: number): Delivery[] {
    return Array.from({ length: count }, (_, i) =>
      this.create({ id: `delivery-${i}` }),
    );
  },

  createDelivered(): Delivery {
    return this.create({ status: "delivered" });
  },
};

// Usage in tests
it("should complete delivery", () => {
  const delivery = deliveryFactory.create({ status: "out_for_delivery" });
  service.complete(delivery.id);
  expect(service.getStatus(delivery.id)).toBe("delivered");
});
```

## Common Patterns

### Testing React Components

```typescript
import { render, screen } from "@testing-library/react";
import { DeliveryCard } from "./DeliveryCard";

it("should render delivery status", () => {
  const delivery = deliveryFactory.create({ status: "delivered" });

  render(<DeliveryCard delivery={delivery} />);

  expect(screen.getByText("Delivered")).toBeInTheDocument();
});

it("should call onUpdate when status changes", async () => {
  const onUpdate = vi.fn();
  const delivery = deliveryFactory.create();

  const { user } = render(
    <DeliveryCard delivery={delivery} onUpdate={onUpdate} />
  );

  await user.click(screen.getByRole("button", { name: /complete/i }));

  expect(onUpdate).toHaveBeenCalledWith({
    ...delivery,
    status: "delivered",
  });
});
```

### Testing API Endpoints

```typescript
import { createServer } from "http";

it("should get delivery", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/api/delivery/1") {
      res.writeHead(200);
      res.end(JSON.stringify({ id: "1", status: "delivered" }));
    }
  });

  server.listen(3001);

  const response = await fetch("http://localhost:3001/api/delivery/1");
  const data = await response.json();

  expect(data.id).toBe("1");

  server.close();
});
```

### Testing Error Handling

```typescript
it("should handle API error", async () => {
  const mockError = new Error("Network error");
  vi.mocked(api.fetchDelivery).mockRejectedValueOnce(mockError);

  const result = await service.getDelivery("1").catch((e) => e);

  expect(result).toEqual(mockError);
  expect(logger.error).toHaveBeenCalledWith("Failed to fetch delivery", {
    id: "1",
    error: mockError,
  });
});
```

## Best Practices Checklist

- [ ] Tests have descriptive names
- [ ] One logical assertion per test
- [ ] No test dependencies (can run in any order)
- [ ] Fast execution (< 100ms for unit)
- [ ] Deterministic (same result every run)
- [ ] Clear Arrange-Act-Assert structure
- [ ] Proper cleanup in afterEach/afterAll
- [ ] Mocks isolated to relevant tests
- [ ] Error cases tested
- [ ] Edge cases covered
- [ ] Comments explain "why", not "what"
- [ ] No hardcoded timeouts
- [ ] No console.log in test assertions

## Troubleshooting

### Test Timeout

```typescript
// Increase timeout for specific test
it("should process large batch", { timeout: 30000 }, async () => {
  // test code
});

// Or in setup
export const config = {
  testTimeout: 30000,
};
```

### Flaky Test

1. Check for uncontrolled timing (use `vi.useFakeTimers()`)
2. Ensure proper async handling
3. Mock external dependencies
4. Use factories instead of database
5. Add explicit waits for state changes

### Coverage Not Updating

```bash
# Clear cache
npm run test -- --clearCache

# Regenerate
npm run test -- --coverage
```

## Resources

- [Vitest Documentation](https://vitest.dev)
- [Playwright Documentation](https://playwright.dev)
- [Testing Library Best Practices](https://testing-library.com/docs)
- Internal docs: `docs/testing/`

## Questions?

Reach out to the QA team or open an issue in the testing GitHub discussion.
