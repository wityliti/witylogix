# Witylogix API Documentation Suite

Complete API documentation, validation, and health monitoring for the Witylogix platform.

**Last Updated:** 2026-03-16 | **Version:** 1.0.0

---

## Quick Navigation

### 📋 Documentation Files

1. **[ROUTE_MAP.md](./ROUTE_MAP.md)** — Complete API route inventory
   - 187 routes across 18 modules
   - Authentication, rate limiting, validation status for each route
   - Standard status codes and error patterns
   - **Read first for:** API endpoint reference, route structure

2. **[Integration Guide](./INTEGRATION.md)** _(to be created)_
   - Step-by-step integration examples
   - Code samples for common operations
   - Webhook setup and testing

### 💻 Implementation Files

Located in `packages/core/src/api/`:

1. **validation-schemas.ts** — Zod validation schemas
   - Order, Driver, Delivery, Zone, Organization operations
   - Common patterns: pagination, search, bulk actions
   - Type exports for TypeScript integration
   - **Import in routes:** `import { orderCreateSchema } from "@witylogix/core/api/validation-schemas"`

2. **error-catalog.ts** — Standardized error definitions
   - 75+ error codes across 10 domains
   - HTTP status codes and resolution hints
   - ErrorCatalog class for error lookup
   - **Import in middleware:** `import { ErrorCatalog } from "@witylogix/core/api/error-catalog"`

3. **health-dashboard.ts** — API health monitoring
   - System component status (DB, Redis, Queue, Storage)
   - Uptime tracking and error frequency
   - Fastify plugin for monitoring endpoints
   - **Import in server:** `import healthDashboardPlugin from "@witylogix/core/api/health-dashboard"`

4. ****tests**/validation-schemas.test.ts** — Test suite
   - 40+ test cases for validation schemas
   - Edge cases, security tests, error verification
   - **Run tests:** `npm test -- validation-schemas.test.ts`

---

## Module Overview

### Authentication (12 routes)

Login, registration, token refresh, MFA, password reset

- **Key endpoints:** POST /auth/login, POST /auth/register, GET /auth/me
- **Auth required:** Most routes, except registration/password reset

### Orders (18 routes)

Complete order lifecycle from creation to delivery

- **Key endpoints:** GET/POST /orders, PATCH /orders/:id/status, POST /orders/bulk/create
- **Validation:** orderCreateSchema, orderUpdateSchema, orderListSchema
- **Errors:** ORDER_NOT_FOUND, ORDER_INVALID_STATUS_TRANSITION, ORDER_ALREADY_ASSIGNED

### Drivers (14 routes)

Driver management, location tracking, performance metrics

- **Key endpoints:** GET/POST /drivers, POST /drivers/:id/location, GET /drivers/:id/performance
- **Validation:** driverCreateSchema, driverLocationSchema, driverStatusSchema
- **Errors:** DRIVER_NOT_FOUND, DRIVER_INACTIVE, DRIVER_LICENSE_EXPIRED

### Deliveries (16 routes)

Delivery operations, proof collection, status tracking

- **Key endpoints:** GET/POST /deliveries, POST /deliveries/:id/proof, POST /deliveries/:id/complete
- **Validation:** deliveryCreateSchema, deliveryProofSchema, deliveryCompleteSchema
- **Errors:** DELIVERY_NOT_FOUND, DELIVERY_PROOF_REQUIRED, DELIVERY_RECIPIENT_UNREACHABLE

### Zones (8 routes)

Geographic zone management with polygon validation

- **Key endpoints:** GET/POST /zones, POST /zones/:id/validate-point
- **Validation:** zoneCreateSchema, zonePointValidationSchema
- **Errors:** ZONE_INVALID_POLYGON, ZONE_OVERLAPPING, ZONE_STILL_IN_USE

### Organizations (10 routes)

Multi-tenant organization and member management

- **Key endpoints:** GET/POST /organizations, POST /organizations/:id/members/invite
- **Validation:** organizationCreateSchema, inviteMemberSchema
- **Errors:** ORG_DUPLICATE_SLUG, ORG_MEMBER_DUPLICATE, ORG_SUBSCRIPTION_REQUIRED

### Other Modules

- **Integrations** (15 routes) — Third-party service integration
- **Webhooks** (11 routes) — Webhook subscription and delivery
- **Analytics** (13 routes) — Reporting and analytics
- **Billing** (9 routes) — Subscription and payment management
- **Admin** (18 routes) — Platform administration
- **Locations, Customers, Shipping, Users, Notifications, Health** — Supporting modules

---

## Integration Checklist

### In Route Handlers

```typescript
import { orderCreateSchema } from "@witylogix/core/api/validation-schemas";

fastify.post("/orders", async (request, reply) => {
  // Validate request body
  const result = orderCreateSchema.safeParse(request.body);

  if (!result.success) {
    throw new ValidationError("Invalid order data", result.error.issues);
  }

  const order = result.data;
  // ... process order
});
```

### In Error Handler

```typescript
import { ErrorCatalog } from "@witylogix/core/api/error-catalog";

fastify.setErrorHandler((error, request, reply) => {
  if (error.code === "ORDER_NOT_FOUND") {
    const errorDef = ErrorCatalog.get("ORDER_NOT_FOUND");
    reply.status(errorDef.httpStatus).send({
      error: {
        code: errorDef.code,
        message: errorDef.messageTemplate,
        statusCode: errorDef.httpStatus,
      },
    });
  }
});
```

### In Server Setup

```typescript
import healthDashboardPlugin from "@witylogix/core/api/health-dashboard";

async function startServer() {
  const fastify = Fastify();

  // Register health dashboard
  await fastify.register(healthDashboardPlugin);

  // Endpoints automatically available:
  // GET /health (no auth)
  // GET /health/detailed (auth required)
  // GET /health/status (public)
  // GET /version (no auth)
}
```

---

## Validation Patterns

### Common Validators

```typescript
// Single field validators
export const idParam; // UUID validation
export const email; // Email format
export const phone; // Phone number (e.g., +1234567890)
export const date; // YYYY-MM-DD format
export const iso8601DateTime; // ISO 8601 datetime

// Composite validators
export const address; // Full address with coordinates
export const coordinates; // Latitude/longitude
export const polygon; // GeoJSON Polygon for zones
export const pagination; // Page, limit with bounds
export const searchQuery; // Full-text search with pagination
```

### Schema Composition

Schemas can be extended and combined:

```typescript
// Extend pagination for specific queries
const orderListQuery = pagination.extend({
  status: z.enum([...]),
  driverId: z.string().uuid().optional(),
});

// Compose common patterns
const bulkOrders = z.object({
  orders: z.array(orderCreateSchema),
  sendNotifications: z.boolean().default(true),
});
```

---

## Error Handling

### Error Code Format

```
DOMAIN_SPECIFIC_ERROR
```

Examples:

- `AUTH_INVALID_CREDENTIALS` — Authentication domain
- `ORDER_NOT_FOUND` — Order domain
- `DRIVER_INACTIVE` — Driver domain

### Getting Error Information

```typescript
import { ErrorCatalog } from "@witylogix/core/api/error-catalog";

// Get error definition
const error = ErrorCatalog.get("ORDER_NOT_FOUND");
// Returns: {
//   code: "ORDER_NOT_FOUND",
//   httpStatus: 404,
//   messageTemplate: "Order not found",
//   description: "Requested order does not exist or has been deleted",
//   resolutionHint: "Verify order ID and check if order was previously deleted"
// }

// Get formatted error with variables
const error = ErrorCatalog.getFormatted("ORDER_INVALID_STATUS_TRANSITION", {
  currentStatus: "PENDING",
  newStatus: "COMPLETED",
});

// List all errors in domain
const orderErrors = ErrorCatalog.getDomain("ORDER");
```

### Standard Error Response

```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found",
    "statusCode": 404,
    "details": {
      "orderId": "123e4567-e89b-12d3-a456-426614174000"
    },
    "requestId": "req-1234-5678"
  }
}
```

---

## Health Monitoring

### Health Check Endpoints

```bash
# Basic health check (no auth)
curl https://api.witylogix.com/health

# Detailed status (auth required)
curl -H "Authorization: Bearer <token>" \
     https://api.witylogix.com/health/detailed

# Public status page
curl https://api.witylogix.com/health/status

# API version
curl https://api.witylogix.com/version
```

### Health Status Response

```json
{
  "timestamp": "2026-03-16T13:00:00Z",
  "version": "1.0.0",
  "overallStatus": "healthy",
  "services": {
    "database": {
      "status": "healthy",
      "latency": 12,
      "lastCheck": "2026-03-16T13:00:00Z"
    },
    "cache": { ... },
    "queue": { ... },
    "storage": { ... },
    "externalServices": { ... }
  },
  "uptime": {
    "uptime": 86400000,
    "totalRequests": 15234,
    "errorCount": 12,
    "errorRate": 0.079
  },
  "lastErrors": [
    {
      "timestamp": "2026-03-16T12:55:00Z",
      "code": "DATABASE_ERROR",
      "message": "Connection timeout",
      "service": "database",
      "frequency": 2
    }
  ]
}
```

---

## Testing

### Running Validation Tests

```bash
# Run all tests
npm test -- validation-schemas.test.ts

# Run specific test suite
npm test -- validation-schemas.test.ts -t "Order Schemas"

# Run with coverage
npm test -- validation-schemas.test.ts --coverage
```

### Test Coverage

- **Order Schemas:** 10 test cases (valid, invalid, edge cases)
- **Driver Schemas:** 5 test cases (location bounds, date formats)
- **Delivery Schemas:** 5 test cases (time windows, proof validation)
- **Zone Schemas:** 4 test cases (polygon validation, bounds)
- **Organization Schemas:** 3 test cases (slug format, role validation)
- **Search & Pagination:** 5 test cases (limit bounds, page validation)
- **Bulk Operations:** 3 test cases (size limits, batch validation)
- **Export:** 3 test cases (format, filters, date ranges)

---

## Rate Limiting

Four tier system with different request limits:

| Tier       | Requests/Hour | Requests/Day | Burst Limit |
| ---------- | ------------- | ------------ | ----------- |
| Free       | 100           | 1,000        | 10/min      |
| Basic      | 1,000         | 10,000       | 100/min     |
| Pro        | 10,000        | 100,000      | 500/min     |
| Enterprise | Unlimited     | Unlimited    | Unlimited   |

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1647439200
```

### Rate Limit Error

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded: 1000 requests per hour",
    "statusCode": 429,
    "details": {
      "resetIn": 3600
    }
  }
}
```

---

## Standards & Conventions

### Naming Conventions

- Routes: kebab-case (e.g., `/webhook-deliveries`)
- Schema names: camelCase (e.g., `orderCreateSchema`)
- Error codes: SCREAMING_SNAKE_CASE (e.g., `ORDER_NOT_FOUND`)
- Types: PascalCase (e.g., `OrderCreate`, `DriverLocation`)

### Field Naming

- UUIDs: `*Id` (e.g., `orderId`, `driverId`)
- Timestamps: `*At` or `*Date` (e.g., `createdAt`, `scheduledDate`)
- Status fields: `status` (e.g., `orderStatus`, `deliveryStatus`)
- Counts: `*Count` (e.g., `itemCount`, `totalCount`)

### API Versioning

- Current version: `1.0.0`
- Header support: `Accept: application/json; version=1.0`
- Path versioning: Not used (header-based only)

### Pagination

Default page size: 25 items
Max page size: 100 items
Cursor-based pagination: Supported via `cursor` parameter

---

## Common Operations

### Create Order

```bash
POST /orders
Content-Type: application/json
Authorization: Bearer <token>

{
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "US"
  },
  "items": [
    {
      "name": "Widget",
      "sku": "SKU001",
      "quantity": 2,
      "price": 29.99
    }
  ],
  "totalAmount": 59.98,
  "currency": "USD"
}
```

### List Orders with Filters

```bash
GET /orders?status=ASSIGNED&driverId=<uuid>&sortBy=createdAt&sortOrder=desc&page=1&limit=25
Authorization: Bearer <token>
```

### Update Order Status

```bash
PATCH /orders/:id/status
Content-Type: application/json
Authorization: Bearer <token>

{
  "status": "IN_PROGRESS",
  "reason": "Driver dispatched"
}
```

---

## Troubleshooting

### Validation Errors

- **Issue:** "Validation failed: Invalid value for X"
- **Solution:** Check ROUTE_MAP.md for field requirements, use validation schema types

### Rate Limit Exceeded

- **Issue:** 429 Too Many Requests
- **Solution:** Check your plan tier, implement exponential backoff, request upgrade

### Service Unavailable

- **Issue:** 503 Service Unavailable
- **Solution:** Check /health/status page, wait and retry, contact support

### Authentication Failures

- **Issue:** 401 Unauthorized
- **Solution:** Verify token is valid, check expiry, refresh if needed

---

## Support & Resources

- **API Documentation:** See [ROUTE_MAP.md](./ROUTE_MAP.md)
- **Issue Tracking:** Create issue in repository
- **Slack Channel:** #api-support
- **Email:** support@witylogix.com

---

**Last Generated:** 2026-03-16 by RG (Backend Lead)
Sprint 7.0 | API Route Documentation & Validation Audit
