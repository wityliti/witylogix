# API Changelog

All notable changes to the Witylogix API are documented here. This file follows the [Keep a Changelog](https://keepachangelog.com/) format.

## [2.0.0] - 2025-03-01

### Added

#### New Authentication Endpoints
- `POST /api/v4/auth/login` — Dashboard user login with email/password
- `POST /api/v4/auth/driver/login` — Driver app login with phone/password
- `POST /api/v4/auth/refresh` — Refresh access token using refresh token
- `POST /api/v4/auth/logout` — Logout and invalidate refresh token
- `POST /api/v4/auth/mfa/setup` — Initialize multi-factor authentication (TOTP)
- `POST /api/v4/auth/mfa/verify` — Verify TOTP code and enable 2FA
- `POST /api/v4/auth/password/reset` — Request password reset email
- `POST /api/v4/auth/password/reset-confirm` — Confirm password reset with token

#### New Onboarding Flow Endpoints
- `POST /api/v4/onboarding/start` — Initiate onboarding process
- `GET /api/v4/onboarding/progress` — Get current onboarding step progress
- `POST /api/v4/onboarding/company` — Set company details during onboarding
- `POST /api/v4/onboarding/verify-email` — Verify email during onboarding
- `POST /api/v4/onboarding/complete` — Complete onboarding and activate account

#### Tenant Management Endpoints
- `GET /api/v4/tenants/resolve` — Resolve tenant from domain/identifier
- `GET /api/v4/tenants/config` — Get tenant configuration
- `GET /api/v4/api-keys` — List API keys for tenant
- `POST /api/v4/api-keys` — Create new API key
- `DELETE /api/v4/api-keys/{keyId}` — Revoke API key
- `GET /api/v4/tenants/usage` — Get usage metrics for current plan

#### Core API Endpoints
- `GET /api/v4/orders` — List orders with pagination and filtering
- `POST /api/v4/orders` — Create new order
- `GET /api/v4/orders/{orderId}` — Get single order
- `PATCH /api/v4/orders/{orderId}` — Update order fields
- `PATCH /api/v4/orders/{orderId}/status` — Update order status (state machine)
- `PATCH /api/v4/orders/{orderId}/assign` — Assign order to driver
- `GET /api/v4/orders/{orderId}/timeline` — Get order status history

#### Driver Management Endpoints
- `GET /api/v4/drivers` — List drivers
- `POST /api/v4/drivers` — Create new driver
- `GET /api/v4/drivers/{driverId}` — Get driver details
- `PATCH /api/v4/drivers/{driverId}` — Update driver info
- `PATCH /api/v4/drivers/{driverId}/status` — Update driver operational status
- `POST /api/v4/drivers/{driverId}/location` — Update driver GPS location

#### Zone Management Endpoints
- `GET /api/v4/zones` — List delivery zones
- `POST /api/v4/zones` — Create delivery zone
- `GET /api/v4/zones/{zoneId}` — Get zone details
- `POST /api/v4/zones/{zoneId}/check-point` — Check if point is in zone
- `GET /api/v4/zones/{zoneId}/rates` — Get delivery rates for zone

#### Route Planning Endpoints
- `GET /api/v4/routes` — List routes
- `POST /api/v4/routes` — Create new route
- `GET /api/v4/routes/{routeId}` — Get route with stops
- `PATCH /api/v4/routes/{routeId}` — Update route metadata
- `PATCH /api/v4/routes/{routeId}/status` — Update route status
- `POST /api/v4/routes/{routeId}/stops` — Add stops to route
- `PATCH /api/v4/routes/{routeId}/stops/{stopId}` — Update stop status
- `POST /api/v4/routes/{routeId}/optimize` — Trigger route optimization

#### Integration Management Endpoints
- `GET /api/v4/integrations` — List installed integrations
- `POST /api/v4/integrations` — Install new integration
- `PATCH /api/v4/integrations/{integrationId}` — Update integration config
- `DELETE /api/v4/integrations/{integrationId}` — Uninstall integration
- `GET /api/v4/integrations/{integrationId}/health` — Check integration health

#### Webhook Management Endpoints
- `GET /api/v4/webhooks` — List webhook endpoints
- `POST /api/v4/webhooks` — Create webhook endpoint
- `PATCH /api/v4/webhooks/{endpointId}` — Update webhook endpoint
- `DELETE /api/v4/webhooks/{endpointId}` — Delete webhook endpoint
- `GET /api/v4/webhooks/{endpointId}/deliveries` — List webhook deliveries
- `POST /api/v4/webhooks/deliveries/{deliveryId}/retry` — Retry failed delivery
- `GET /api/v4/webhooks/dlq` — Access dead letter queue

#### Admin Endpoints
- `GET /api/v4/admin/users` — List all users
- `PATCH /api/v4/admin/users/{userId}` — Update user
- `DELETE /api/v4/admin/users/{userId}` — Deactivate user
- `GET /api/v4/admin/orgs` — List organizations
- `GET /api/v4/admin/health` — System health status
- `GET /api/v4/admin/metrics` — System metrics and usage

### Changed

#### Authentication
- Migrated from session-based to JWT tokens for improved API usability
- All authenticated endpoints now require `Authorization: Bearer <token>` header
- Added support for API Key authentication (`X-API-Key` header)
- Implemented refresh token rotation for enhanced security

#### Response Format
- Standardized all successful responses to use `{ data: {...} }` wrapper
- Error responses now follow `{ error: { code, message, details } }` format
- Added `requestId` to all error responses for debugging
- Added support for cursor-based pagination (legacy offset-based still supported)

#### Rate Limiting
- Moved from per-IP to per-tenant rate limiting
- Added `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
- Plan-based rate limits: FREE (100/min), PRO (1000/min), ENTERPRISE (10000/min)

### Fixed
- Fixed race condition in order status transitions with pessimistic locking
- Fixed webhook delivery retry logic to use exponential backoff
- Fixed tenant isolation by ensuring all queries filter by shopId

### Security

#### New Security Features
- HMAC-SHA256 signature verification for webhook payloads
- TOTP-based multi-factor authentication support
- API key scoping with granular permissions
- Automatic session invalidation on password change
- Audit logging for all admin operations

### Deprecated

- **Legacy Shopify App Routes** — Use embedded app via App Bridge instead
  - Removal planned for v3.0.0
- **Session Cookies** — Migrate to JWT tokens
  - Timeline: 90 days grace period

### Migration Guide

#### From v1.0 to v2.0

1. **Update Authentication**
   ```bash
   # Old: POST /auth/login with email/password → sets httpOnly cookie
   curl -X POST https://api.witylogix.com/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "password": "secret"}'

   # New: POST /api/v4/auth/login → returns JWT tokens
   curl -X POST https://api.witylogix.com/api/v4/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user@example.com",
       "password": "secret",
       "shopDomain": "mystore.myshopify.com"
     }'
   ```

2. **Update Headers**
   ```bash
   # Old: Authorization: Token <api-key>
   # New: Authorization: Bearer <jwt-token>
   curl https://api.witylogix.com/api/v4/orders \
     -H "Authorization: Bearer eyJhbGc..."
   ```

3. **Update Response Handling**
   ```typescript
   // Old: Direct array/object
   // const orders = await res.json();

   // New: Wrapped in data field
   const { data: orders } = await res.json();
   ```

4. **Implement Token Refresh**
   ```typescript
   // Store both access and refresh tokens
   const { accessToken, refreshToken } = await loginResponse.json();

   // Use refresh endpoint when access token expires
   const newTokens = await fetch('/api/v4/auth/refresh', {
     method: 'POST',
     body: JSON.stringify({ refreshToken })
   });
   ```

## [1.0.0] - 2024-09-01

### Initial API Release

- Core order management CRUD
- Driver assignment and tracking
- Shopify webhook integration
- Basic authentication via email/password
- Rate limiting
- Error handling

---

## Notes for v2.1 Planning

- [ ] Add GraphQL endpoint for complex queries
- [ ] Implement event streaming for real-time updates
- [ ] Add batch operation endpoints
- [ ] Support for custom fields on orders/drivers
- [ ] Webhook signature rotation
- [ ] Improved error codes documentation
