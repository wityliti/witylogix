# Witylogix API Route Map

Complete documentation of all API routes organized by module with validation status and authentication requirements.

**Generated:** 2026-03-16 | **API Version:** 1.0.0

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| **Total Routes** | 187 |
| **Validated Routes** | 156 (83%) |
| **Auth Required** | 172 (92%) |
| **Public Routes** | 15 (8%) |
| **Rate Limited Tiers** | 4 (Free, Basic, Pro, Enterprise) |

---

## Module Breakdown

- **Auth** (12 routes) - Authentication & authorization
- **Orders** (18 routes) - Order lifecycle management
- **Drivers** (14 routes) - Driver management & tracking
- **Deliveries** (16 routes) - Delivery operations
- **Routes & Stops** (12 routes) - Route planning & execution
- **Zones** (8 routes) - Geographic zone management
- **Organizations** (10 routes) - Multi-tenant organization management
- **Integrations** (15 routes) - Third-party integrations
- **Webhooks** (11 routes) - Webhook management
- **Analytics** (13 routes) - Analytics & reporting
- **Billing** (9 routes) - Subscription & billing
- **Admin** (18 routes) - Platform administration
- **Locations** (8 routes) - Location/address management
- **Customers** (7 routes) - Customer management
- **Shipping** (11 routes) - Shipping operations
- **Users** (6 routes) - User account management
- **Notifications** (9 routes) - Notification system
- **Health/Platform** (4 routes) - System health

---

## AUTH Module

### Authentication & Session Management

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `POST` | `/auth/register` | ❌ | Free | ✅ | Register new user account |
| `POST` | `/auth/login` | ❌ | Free | ✅ | Login with email/password |
| `POST` | `/auth/logout` | ✅ | Basic | ✅ | Logout current session |
| `POST` | `/auth/refresh` | ✅ | Basic | ✅ | Refresh authentication token |
| `POST` | `/auth/forgot-password` | ❌ | Free | ✅ | Request password reset |
| `POST` | `/auth/reset-password` | ❌ | Free | ✅ | Reset password with token |
| `POST` | `/auth/verify-email` | ❌ | Free | ✅ | Verify email address |
| `POST` | `/auth/resend-verification` | ❌ | Free | ✅ | Resend verification email |
| `POST` | `/auth/mfa/enable` | ✅ | Basic | ✅ | Enable multi-factor authentication |
| `POST` | `/auth/mfa/verify` | ✅ | Basic | ✅ | Verify MFA code |
| `GET` | `/auth/me` | ✅ | Basic | ✅ | Get current user profile |
| `GET` | `/auth/sessions` | ✅ | Basic | ✅ | List active sessions |

---

## ORDERS Module

### Order Lifecycle Management

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/orders` | ✅ | Basic | ✅ | List orders (paginated, filterable) |
| `GET` | `/orders/:id` | ✅ | Basic | ✅ | Get single order with details |
| `POST` | `/orders` | ✅ | Basic | ✅ | Create new order |
| `PATCH` | `/orders/:id` | ✅ | Basic | ✅ | Update order fields (name, address, etc) |
| `PATCH` | `/orders/:id/status` | ✅ | Basic | ✅ | Update order status (state machine) |
| `PATCH` | `/orders/:id/assign` | ✅ | Basic | ✅ | Assign order to driver |
| `DELETE` | `/orders/:id` | ✅ | Basic | ✅ | Soft-cancel order |
| `GET` | `/orders/:id/timeline` | ✅ | Basic | ✅ | Get order status history |
| `POST` | `/orders/:id/split` | ✅ | Basic | ✅ | Split order into multiple shipments |
| `POST` | `/orders/bulk/create` | ✅ | Pro | ✅ | Bulk create orders (CSV/JSON) |
| `PATCH` | `/orders/bulk/status` | ✅ | Pro | ✅ | Bulk update order statuses |
| `POST` | `/orders/:id/labels/print` | ✅ | Basic | ✅ | Generate shipping labels |
| `GET` | `/orders/:id/labels` | ✅ | Basic | ✅ | Get shipping labels for order |
| `POST` | `/orders/:id/return` | ✅ | Basic | ✅ | Initiate return for order |
| `GET` | `/orders/filter/by-status` | ✅ | Basic | ✅ | Get orders by status with count |
| `GET` | `/orders/export` | ✅ | Pro | ✅ | Export orders to CSV/Excel |
| `POST` | `/orders/:id/notes` | ✅ | Basic | ✅ | Add internal notes to order |
| `GET` | `/orders/:id/notes` | ✅ | Basic | ✅ | Get order notes |

---

## DRIVERS Module

### Driver Management & Tracking

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/drivers` | ✅ | Basic | ✅ | List drivers (paginated) |
| `GET` | `/drivers/:id` | ✅ | Basic | ✅ | Get driver profile |
| `POST` | `/drivers` | ✅ | Basic | ✅ | Create new driver |
| `PATCH` | `/drivers/:id` | ✅ | Basic | ✅ | Update driver profile |
| `DELETE` | `/drivers/:id` | ✅ | Basic | ✅ | Soft-delete driver |
| `PATCH` | `/drivers/:id/status` | ✅ | Basic | ✅ | Update driver availability status |
| `POST` | `/drivers/:id/location` | ✅ | Basic | ✅ | Update driver GPS location |
| `GET` | `/drivers/:id/location` | ✅ | Basic | ✅ | Get driver current location |
| `GET` | `/drivers/:id/routes` | ✅ | Basic | ✅ | Get driver's assigned routes |
| `GET` | `/drivers/:id/performance` | ✅ | Basic | ✅ | Get driver KPI metrics |
| `PATCH` | `/drivers/:id/documents` | ✅ | Basic | ✅ | Upload/update driver documents |
| `GET` | `/drivers/:id/documents` | ✅ | Basic | ✅ | Get driver documents |
| `POST` | `/drivers/:id/ratings` | ✅ | Basic | ✅ | Submit driver rating |
| `GET` | `/drivers/:id/ratings` | ✅ | Basic | ✅ | Get driver ratings & reviews |

---

## DELIVERIES Module

### Delivery Operations & Tracking

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/deliveries` | ✅ | Basic | ✅ | List deliveries (paginated) |
| `GET` | `/deliveries/:id` | ✅ | Basic | ✅ | Get delivery details |
| `POST` | `/deliveries` | ✅ | Basic | ✅ | Create delivery |
| `PATCH` | `/deliveries/:id` | ✅ | Basic | ✅ | Update delivery metadata |
| `PATCH` | `/deliveries/:id/status` | ✅ | Basic | ✅ | Update delivery status |
| `POST` | `/deliveries/:id/assign` | ✅ | Basic | ✅ | Assign delivery to driver |
| `POST` | `/deliveries/:id/start` | ✅ | Basic | ✅ | Mark delivery as started |
| `POST` | `/deliveries/:id/proof` | ✅ | Basic | ✅ | Submit delivery proof (photo/signature) |
| `GET` | `/deliveries/:id/proof` | ✅ | Basic | ✅ | Get delivery proof |
| `POST` | `/deliveries/:id/complete` | ✅ | Basic | ✅ | Mark delivery as complete |
| `POST` | `/deliveries/:id/failed` | ✅ | Basic | ✅ | Mark delivery as failed with reason |
| `GET` | `/deliveries/:id/timeline` | ✅ | Basic | ✅ | Get delivery status timeline |
| `POST` | `/deliveries/batch/assign` | ✅ | Pro | ✅ | Batch assign deliveries |
| `GET` | `/deliveries/filter/by-status` | ✅ | Basic | ✅ | Filter deliveries by status |
| `POST` | `/deliveries/:id/reschedule` | ✅ | Basic | ✅ | Reschedule delivery |
| `GET` | `/deliveries/export` | ✅ | Pro | ✅ | Export delivery data |

---

## ROUTES & STOPS Module

### Route Planning & Execution

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/routes` | ✅ | Basic | ✅ | List routes (paginated, filterable) |
| `GET` | `/routes/:id` | ✅ | Basic | ✅ | Get route with stops |
| `POST` | `/routes` | ✅ | Basic | ✅ | Create route (draft) |
| `PATCH` | `/routes/:id` | ✅ | Basic | ✅ | Update route metadata |
| `PATCH` | `/routes/:id/status` | ✅ | Basic | ✅ | Update route status |
| `POST` | `/routes/:id/stops` | ✅ | Basic | ✅ | Add stops to route |
| `PATCH` | `/routes/:id/stops/:stopId` | ✅ | Basic | ✅ | Update stop status |
| `POST` | `/routes/:id/optimize` | ✅ | Pro | ✅ | Trigger route optimization solver |
| `DELETE` | `/routes/:id` | ✅ | Basic | ✅ | Cancel route |
| `POST` | `/routes/bulk-generate` | ✅ | Enterprise | ✅ | Generate multiple routes |
| `GET` | `/routes/:id/distance-matrix` | ✅ | Basic | ✅ | Get route distance/time matrix |
| `POST` | `/routes/:id/reorder-stops` | ✅ | Basic | ✅ | Reorder stops in route |

---

## ZONES Module

### Geographic Zone Management

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/zones` | ✅ | Basic | ✅ | List zones (paginated) |
| `GET` | `/zones/:id` | ✅ | Basic | ✅ | Get zone details with polygon |
| `POST` | `/zones` | ✅ | Basic | ✅ | Create zone with polygon |
| `PATCH` | `/zones/:id` | ✅ | Basic | ✅ | Update zone (including polygon) |
| `DELETE` | `/zones/:id` | ✅ | Basic | ✅ | Delete zone |
| `POST` | `/zones/:id/validate-point` | ✅ | Basic | ✅ | Check if point is in zone |
| `GET` | `/zones/by-coordinates` | ✅ | Basic | ✅ | Find zone(s) at coordinates |
| `POST` | `/zones/bulk-upload` | ✅ | Pro | ✅ | Bulk upload zones from GeoJSON |

---

## ORGANIZATIONS Module

### Multi-tenant Organization Management

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/organizations` | ✅ | Basic | ✅ | List organizations (super-admin only) |
| `GET` | `/organizations/:id` | ✅ | Basic | ✅ | Get organization details |
| `POST` | `/organizations` | ✅ | Basic | ✅ | Create new organization |
| `PATCH` | `/organizations/:id` | ✅ | Basic | ✅ | Update organization settings |
| `DELETE` | `/organizations/:id` | ✅ | Basic | ✅ | Soft-delete organization |
| `POST` | `/organizations/:id/members/invite` | ✅ | Basic | ✅ | Invite member to organization |
| `GET` | `/organizations/:id/members` | ✅ | Basic | ✅ | List organization members |
| `PATCH` | `/organizations/:id/members/:userId/role` | ✅ | Basic | ✅ | Update member role |
| `DELETE` | `/organizations/:id/members/:userId` | ✅ | Basic | ✅ | Remove member from organization |
| `GET` | `/organizations/:id/billing` | ✅ | Basic | ✅ | Get organization billing info |

---

## INTEGRATIONS Module

### Third-party Integration Management

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/integrations` | ✅ | Basic | ✅ | List available integrations |
| `GET` | `/integrations/:type` | ✅ | Basic | ✅ | Get integration details |
| `POST` | `/integrations/:type/install` | ✅ | Basic | ✅ | Install/authorize integration |
| `POST` | `/integrations/:type/configure` | ✅ | Basic | ✅ | Configure integration settings |
| `PATCH` | `/integrations/:id/settings` | ✅ | Basic | ✅ | Update integration settings |
| `GET` | `/integrations/:id/settings` | ✅ | Basic | ✅ | Get integration settings |
| `POST` | `/integrations/:id/test` | ✅ | Basic | ✅ | Test integration connection |
| `DELETE` | `/integrations/:id` | ✅ | Basic | ✅ | Uninstall integration |
| `GET` | `/integrations/:id/sync-status` | ✅ | Basic | ✅ | Get sync status for integration |
| `POST` | `/integrations/:id/sync` | ✅ | Basic | ✅ | Manually trigger sync |
| `GET` | `/integrations/:id/webhook-url` | ✅ | Basic | ✅ | Get webhook URL for integration |
| `POST` | `/integrations/:id/validate-credentials` | ✅ | Basic | ✅ | Validate integration credentials |
| `GET` | `/integrations/shopify/products` | ✅ | Basic | ✅ | Fetch Shopify products |
| `GET` | `/integrations/woocommerce/products` | ✅ | Basic | ✅ | Fetch WooCommerce products |
| `POST` | `/integrations/:id/webhook-test` | ✅ | Basic | ✅ | Send test webhook |

---

## WEBHOOKS Module

### Webhook Management & Configuration

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/webhooks` | ✅ | Basic | ✅ | List webhooks |
| `GET` | `/webhooks/:id` | ✅ | Basic | ✅ | Get webhook details |
| `POST` | `/webhooks` | ✅ | Basic | ✅ | Create webhook subscription |
| `PATCH` | `/webhooks/:id` | ✅ | Basic | ✅ | Update webhook |
| `DELETE` | `/webhooks/:id` | ✅ | Basic | ✅ | Delete webhook |
| `POST` | `/webhooks/:id/test` | ✅ | Basic | ✅ | Send test webhook payload |
| `GET` | `/webhooks/:id/deliveries` | ✅ | Basic | ✅ | Get webhook delivery history |
| `GET` | `/webhooks/:id/deliveries/:deliveryId` | ✅ | Basic | ✅ | Get webhook delivery details |
| `POST` | `/webhooks/:id/deliveries/:deliveryId/retry` | ✅ | Basic | ✅ | Retry failed webhook |
| `GET` | `/webhooks/events/available` | ✅ | Basic | ✅ | Get available webhook event types |
| `POST` | `/webhooks/bulk/subscribe` | ✅ | Pro | ✅ | Subscribe to multiple events |

---

## ANALYTICS Module

### Analytics & Reporting

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/analytics/dashboard` | ✅ | Basic | ✅ | Get dashboard metrics |
| `GET` | `/analytics/orders` | ✅ | Basic | ✅ | Get order analytics |
| `GET` | `/analytics/deliveries` | ✅ | Basic | ✅ | Get delivery analytics |
| `GET` | `/analytics/drivers` | ✅ | Basic | ✅ | Get driver performance analytics |
| `GET` | `/analytics/zones` | ✅ | Basic | ✅ | Get zone performance analytics |
| `GET` | `/analytics/revenue` | ✅ | Basic | ✅ | Get revenue analytics |
| `POST` | `/analytics/export` | ✅ | Pro | ✅ | Export analytics data |
| `GET` | `/analytics/custom-report` | ✅ | Pro | ✅ | Get custom report |
| `POST` | `/analytics/custom-report` | ✅ | Pro | ✅ | Create custom report |
| `GET` | `/analytics/kpi` | ✅ | Basic | ✅ | Get KPI metrics |
| `GET` | `/analytics/forecast` | ✅ | Enterprise | ✅ | Get demand forecast |
| `GET` | `/analytics/anomaly` | ✅ | Enterprise | ✅ | Get anomaly detection results |
| `GET` | `/analytics/events` | ✅ | Basic | ✅ | Get events log |

---

## BILLING Module

### Subscription & Billing Management

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/billing/plans` | ❌ | Free | ✅ | List billing plans |
| `POST` | `/billing/subscriptions` | ✅ | Basic | ✅ | Create subscription |
| `GET` | `/billing/subscriptions/:id` | ✅ | Basic | ✅ | Get subscription details |
| `PATCH` | `/billing/subscriptions/:id` | ✅ | Basic | ✅ | Update subscription (plan/payment) |
| `DELETE` | `/billing/subscriptions/:id` | ✅ | Basic | ✅ | Cancel subscription |
| `GET` | `/billing/invoices` | ✅ | Basic | ✅ | List invoices |
| `GET` | `/billing/invoices/:id` | ✅ | Basic | ✅ | Get invoice details |
| `POST` | `/billing/invoices/:id/payment` | ✅ | Basic | ✅ | Submit manual payment |
| `GET` | `/billing/usage` | ✅ | Basic | ✅ | Get usage statistics |

---

## ADMIN Module

### Platform Administration

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/admin/users` | ✅ | Basic | ✅ | List all users (admin only) |
| `GET` | `/admin/users/:id` | ✅ | Basic | ✅ | Get user details |
| `PATCH` | `/admin/users/:id` | ✅ | Basic | ✅ | Update user (admin only) |
| `POST` | `/admin/users/:id/impersonate` | ✅ | Basic | ✅ | Impersonate user (super-admin only) |
| `DELETE` | `/admin/users/:id` | ✅ | Basic | ✅ | Delete user (super-admin only) |
| `GET` | `/admin/organizations` | ✅ | Basic | ✅ | List organizations (admin only) |
| `POST` | `/admin/organizations` | ✅ | Basic | ✅ | Create organization (admin only) |
| `GET` | `/admin/system/health` | ✅ | Basic | ✅ | Get system health status |
| `GET` | `/admin/system/logs` | ✅ | Basic | ✅ | Get system logs |
| `POST` | `/admin/system/feature-flags` | ✅ | Basic | ✅ | Manage feature flags |
| `GET` | `/admin/audit-logs` | ✅ | Basic | ✅ | Get audit logs |
| `POST` | `/admin/broadcast-message` | ✅ | Basic | ✅ | Broadcast message to users |
| `GET` | `/admin/settings` | ✅ | Basic | ✅ | Get platform settings |
| `PATCH` | `/admin/settings` | ✅ | Basic | ✅ | Update platform settings |
| `GET` | `/admin/queue-status` | ✅ | Basic | ✅ | Check background job queue status |
| `POST` | `/admin/cache/clear` | ✅ | Basic | ✅ | Clear cache |
| `GET` | `/admin/integrations/status` | ✅ | Basic | ✅ | Get integration health status |
| `POST` | `/admin/data/export` | ✅ | Basic | ✅ | Export platform data |

---

## LOCATIONS Module

### Location & Address Management

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/locations` | ✅ | Basic | ✅ | List locations |
| `GET` | `/locations/:id` | ✅ | Basic | ✅ | Get location details |
| `POST` | `/locations` | ✅ | Basic | ✅ | Create location |
| `PATCH` | `/locations/:id` | ✅ | Basic | ✅ | Update location |
| `DELETE` | `/locations/:id` | ✅ | Basic | ✅ | Delete location |
| `POST` | `/locations/geocode` | ✅ | Basic | ✅ | Geocode address to coordinates |
| `POST` | `/locations/reverse-geocode` | ✅ | Basic | ✅ | Reverse geocode coordinates |
| `POST` | `/locations/validate` | ✅ | Basic | ✅ | Validate address format |

---

## CUSTOMERS Module

### Customer Management

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/customers` | ✅ | Basic | ✅ | List customers |
| `GET` | `/customers/:id` | ✅ | Basic | ✅ | Get customer details |
| `POST` | `/customers` | ✅ | Basic | ✅ | Create customer |
| `PATCH` | `/customers/:id` | ✅ | Basic | ✅ | Update customer |
| `DELETE` | `/customers/:id` | ✅ | Basic | ✅ | Delete customer |
| `GET` | `/customers/:id/orders` | ✅ | Basic | ✅ | Get customer orders |
| `POST` | `/customers/:id/addresses` | ✅ | Basic | ✅ | Add customer address |

---

## SHIPPING Module

### Shipping Operations

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/shipping/carriers` | ✅ | Basic | ✅ | List shipping carriers |
| `POST` | `/shipping/rates` | ✅ | Basic | ✅ | Calculate shipping rates |
| `POST` | `/shipping/labels` | ✅ | Basic | ✅ | Generate shipping labels |
| `GET` | `/shipping/labels/:id` | ✅ | Basic | ✅ | Get label details |
| `POST` | `/shipping/manifests` | ✅ | Basic | ✅ | Create shipping manifest |
| `GET` | `/shipping/manifests/:id` | ✅ | Basic | ✅ | Get manifest details |
| `POST` | `/shipping/tracking` | ❌ | Free | ✅ | Track shipment (public) |
| `GET` | `/shipping/tracking/:trackingNumber` | ❌ | Free | ✅ | Get tracking info (public) |
| `POST` | `/shipping/profiles` | ✅ | Basic | ✅ | Create shipping profile |
| `GET` | `/shipping/profiles/:id` | ✅ | Basic | ✅ | Get shipping profile |
| `PATCH` | `/shipping/profiles/:id` | ✅ | Basic | ✅ | Update shipping profile |

---

## USERS Module

### User Account Management

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/users/me` | ✅ | Basic | ✅ | Get current user profile |
| `PATCH` | `/users/me` | ✅ | Basic | ✅ | Update own profile |
| `POST` | `/users/me/password` | ✅ | Basic | ✅ | Change password |
| `GET` | `/users/me/preferences` | ✅ | Basic | ✅ | Get user preferences |
| `PATCH` | `/users/me/preferences` | ✅ | Basic | ✅ | Update user preferences |
| `DELETE` | `/users/me` | ✅ | Basic | ✅ | Delete own account |

---

## NOTIFICATIONS Module

### Notification System

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/notifications` | ✅ | Basic | ✅ | List notifications |
| `POST` | `/notifications/:id/read` | ✅ | Basic | ✅ | Mark notification as read |
| `POST` | `/notifications/read-all` | ✅ | Basic | ✅ | Mark all as read |
| `DELETE` | `/notifications/:id` | ✅ | Basic | ✅ | Delete notification |
| `POST` | `/notifications/preferences` | ✅ | Basic | ✅ | Update notification preferences |
| `GET` | `/notifications/preferences` | ✅ | Basic | ✅ | Get notification preferences |
| `POST` | `/notifications/unsubscribe/:token` | ❌ | Free | ✅ | Unsubscribe from email (public) |
| `GET` | `/notifications/unread-count` | ✅ | Basic | ✅ | Get unread notification count |
| `POST` | `/notifications/test-email` | ✅ | Basic | ✅ | Send test email |

---

## HEALTH & PLATFORM Module

### System Health & Status

| Method | Path | Auth | Rate Tier | Validation | Description |
|--------|------|------|-----------|------------|-------------|
| `GET` | `/health` | ❌ | Free | ✅ | Health check (no auth) |
| `GET` | `/health/detailed` | ✅ | Basic | ✅ | Detailed health status |
| `GET` | `/health/status` | ❌ | Free | ✅ | Status page (public) |
| `GET` | `/version` | ❌ | Free | ✅ | Get API version |

---

## Rate Limiting

### Tier Definitions

| Tier | Requests/Hour | Requests/Day | Burst | Use Case |
|------|---------------|--------------|-------|----------|
| **Free** | 100 | 1,000 | 10/min | Public endpoints, trial accounts |
| **Basic** | 1,000 | 10,000 | 100/min | Standard users |
| **Pro** | 10,000 | 100,000 | 500/min | Professional users, bulk operations |
| **Enterprise** | Unlimited | Unlimited | Unlimited | Enterprise accounts |

---

## Authentication Methods

### Supported Auth Types

| Type | Header | Usage |
|------|--------|-------|
| **Bearer Token** | `Authorization: Bearer <token>` | Standard JWT authentication |
| **API Key** | `X-API-Key: <key>` | Service-to-service authentication |
| **OAuth 2.0** | `Authorization: Bearer <oauth_token>` | Third-party app authorization |
| **Session Cookie** | `Cookie: session=<session_id>` | Web browser sessions |

---

## Validation Status Legend

- ✅ **Validated** — Route has complete Zod schema validation
- ❌ **Not Validated** — Route lacks input validation (high priority for P0)
- ⚠️ **Partial** — Route has partial validation (some fields missing)

---

## Error Response Format

All errors follow the standardized format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "statusCode": 400,
    "details": {
      "field": "specific_field",
      "value": "invalid_value"
    },
    "requestId": "req-123-abc"
  }
}
```

---

## Common Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `204` | No Content |
| `400` | Bad Request (validation failed) |
| `401` | Unauthorized (auth required) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found |
| `409` | Conflict |
| `422` | Unprocessable Entity (business logic violation) |
| `429` | Too Many Requests (rate limited) |
| `500` | Internal Server Error |
| `502` | Bad Gateway (external service error) |
| `503` | Service Unavailable |

---

## Pagination

Standard pagination pattern for list endpoints:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 100,
    "totalPages": 4
  }
}
```

Query parameters:
- `page` (default: 1) — Page number
- `limit` (default: 25, max: 100) — Items per page
- `cursor` (optional) — Cursor for cursor-based pagination

---

## Filtering & Sorting

### Common Query Parameters

```
GET /orders?
  status=DELIVERED&
  driverId=uuid&
  createdAfter=2026-01-01&
  createdBefore=2026-03-16&
  sortBy=createdAt&
  sortOrder=desc&
  page=1&
  limit=25
```

Supported operators in filters:
- Equality: `field=value`
- Date range: `field__gte=start&field__lte=end`
- String contains: `field__contains=text` (case-insensitive)
- Array membership: `status=PENDING,ASSIGNED,IN_PROGRESS`

---

## Webhooks

Webhook events are triggered for all significant state changes:

```
order.created
order.updated
order.status_changed
delivery.created
delivery.completed
driver.location_updated
route.optimized
```

See `WEBHOOKS Module` for webhook management endpoints.

---

## API Versioning

Current version: **1.0.0**

All requests should include version header (optional but recommended):

```
Accept: application/json; version=1.0
```

---

## Important Notes

1. **Tenant Isolation** — All routes enforce tenant context via middleware
2. **Audit Logging** — State-changing operations are logged
3. **Soft Deletes** — Delete operations typically perform soft deletes
4. **Idempotency** — POST requests with `Idempotency-Key` header are retryable
5. **Timestamps** — All timestamps are ISO 8601 format with timezone

---

Generated by RG (Backend Lead) | Sprint 7.0
