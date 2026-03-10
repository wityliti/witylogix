# WooCommerce REST API Adapter — Sprint 4.6 Implementation

## Overview

Complete implementation of a deep WooCommerce integration for Witylogix, enabling bidirectional sync of orders, products, and customers with OAuth 1.0a authentication, rate limiting, retry logic, and webhook handling.

## Architecture

### Core Components

#### 1. **WooCommerce Client** (`wc-client.ts`)
- **OAuth 1.0a Signature Generation**: HMAC-SHA256 based authentication using consumer key + secret
- **HTTP Methods**: GET, POST, PUT, DELETE with typed responses
- **Pagination Support**: page, per_page, offset, orderby, order
- **Rate Limiting**: Sliding window limiter (default 25 req/sec, configurable)
- **Retry Logic**: Exponential backoff (3 retries) for network errors and 5xx responses
- **Request/Response Logging**: All requests logged with timestamps
- **Timeout Configuration**: Defaults to 30 seconds, configurable per request
- **API Endpoints**: Orders, Products, Customers, Webhooks, Variations

Key methods:
```typescript
// Orders
getOrder(orderId): Promise<WCOrder>
getOrders(params): Promise<WCListResponse<WCOrder>>
createOrder(data): Promise<WCOrder>
updateOrder(orderId, data): Promise<WCOrder>
deleteOrder(orderId, force): Promise<WCOrder>

// Products
getProduct(productId): Promise<WCProduct>
getProducts(params): Promise<WCListResponse<WCProduct>>
createProduct(data): Promise<WCProduct>
updateProduct(productId, data): Promise<WCProduct>
deleteProduct(productId, force): Promise<WCProduct>

// Webhooks
getWebhooks(params): Promise<WCListResponse<WCWebhook>>
createWebhook(data): Promise<WCWebhook>
updateWebhook(webhookId, data): Promise<WCWebhook>
deleteWebhook(webhookId, force): Promise<WCWebhook>
```

#### 2. **Order Sync Service** (`order-sync.ts`)
- **Bidirectional Field Mapping**: WC ↔ WL order transformation
- **Status Mapping**:
  - WC → WL: pending, processing, on-hold, completed, cancelled, refunded, failed
  - WL → WC: pending, confirmed, dispatched, out_for_delivery, delivered, cancelled, returned
- **Conflict Resolution**: Last-write-wins using timestamp comparison
- **Meta Field Handling**: Custom field extraction and preservation
- **Validation**: Order completeness checking
- **Summary Calculations**: Item counts, totals, taxes, shipping

Key methods:
```typescript
syncOrderFromWC(wcOrder): Witylogix order format
syncOrderToWC(wlOrder): WC order update format
handleOrderStatusChange(orderId, newStatus, timestamp): sync decision
resolveConflict(wlTime, wcTime, field): winner determination
validateOrder(wcOrder): validation result with errors
calculateOrderSummary(wcOrder): summary metrics
```

#### 3. **Product Sync Service** (`product-sync.ts`)
- **Product Type Mapping**: simple, variable, bundle, digital
- **Variation Handling**: Variable products → product variants
- **Inventory Sync**: stock_quantity, manage_stock, stock_status
- **Image Sync**: featured + gallery images with metadata
- **Attribute Sync**: Product attributes with variation flag
- **Category/Tag Mapping**: Full taxonomy support
- **Pricing**: Regular, sale, on-sale status
- **Validation**: SKU, name, type requirements

Key methods:
```typescript
syncProductFromWC(wcProduct): Witylogix product format
syncProductToWC(wlProduct): WC product update format
syncVariationFromWC(variation, parentId): variation format
syncVariationsFromWC(variations, parentId): variation array
updateVariationInventory(variation, qty, status): update format
mapImage(image): standardized image format
validateProduct(wcProduct): validation result
calculateInventoryStatus(qty, managed): stock status
```

#### 4. **Customer Sync Service** (`customer-sync.ts`)
- **Guest Customer Merge**: Email-based matching for guest orders
- **Address Book Sync**: Billing + shipping addresses
- **Order History Linking**: Connect customers to orders
- **Duplicate Detection**: Identify customers with same email
- **Address Mapping**: WC ↔ WL address transformation
- **Role/Status Tracking**: Paying customer status

Key methods:
```typescript
syncCustomerFromWC(wcCustomer): Witylogix customer format
syncCustomerToWC(wlCustomer): WC customer update format
mergeGuestByEmail(email, customer): merge decision
linkOrderHistory(customerId, orderIds): link result
detectDuplicates(customers): duplicate list
validateCustomer(wcCustomer): validation result
```

#### 5. **Webhook Consumer** (`webhook-consumer.ts`)
- **HMAC-SHA256 Verification**: Signature validation using webhook secret
- **Constant-Time Comparison**: Timing attack prevention
- **Idempotency**: Delivery ID tracking to prevent duplicates
- **Event Handlers**: Topic-based handler registration
- **Topics Supported**:
  - order.created, order.updated, order.deleted
  - product.created, product.updated, product.deleted
  - customer.created, customer.updated
- **Dead Letter Handling**: Failed webhook logging

Key methods:
```typescript
verifyWebhook(payload, signature): verification result
isDeliveryProcessed(deliveryId): boolean
markDeliveryProcessed(deliveryId): void
registerHandler(topic, handler): void
getHandler(topic): handler function
processWebhook(payload, topic): processing result
```

### Database Schema (`45-woocommerce.prisma`)

#### `WooCommerceConnection`
Stores store credentials, sync settings, webhook configuration:
- `storeUrl`: Store domain
- `consumerKey/consumerSecret`: OAuth credentials (encrypted)
- `webhookSecret`: HMAC verification secret (encrypted)
- `lastSyncAt/lastHealthCheckAt`: Sync tracking
- `status`: active | paused | error
- `syncEnabled`: Master toggle
- `ordersSync/productsSync/customersSync`: Per-entity toggles
- `config`: Additional configuration JSON

#### `WooCommerceSyncRecord`
Tracks bidirectional sync state for conflict resolution:
- `entityType`: order | product | customer
- `wcId/wlId`: Cross-reference IDs
- `syncDirection`: wc_to_wl | wl_to_wc | bidirectional
- `wcModifiedAt/wlModifiedAt`: Timestamp tracking for LWW
- `status`: success | pending | failed
- `metadata`: Entity-specific sync data

#### `WooCommerceRegisteredWebhook`
Stores registered webhooks on WC store:
- `wcWebhookId`: ID from WooCommerce
- `topic`: Webhook event topic
- `deliveryUrl`: Callback endpoint
- `status`: active | paused | disabled
- `secret`: Verification secret

#### `WooCommerceWebhookLog`
Audit trail for webhook deliveries:
- `deliveryId`: Unique identifier (idempotency key)
- `payload`: Full webhook data
- `verified`: Signature verification result
- `processed`: Processing status
- `status`: pending | processed | failed | skipped
- `processedAt`: Processing timestamp

### API Routes (`integrations/woocommerce.ts`)

#### POST `/integrations/woocommerce/connect`
Connect a WooCommerce store:
```json
{
  "storeUrl": "https://mystore.com",
  "consumerKey": "ck_...",
  "consumerSecret": "cs_...",
  "webhookSecret": "optional",
  "ordersSync": true,
  "productsSync": true,
  "customersSync": true,
  "webhooksEnabled": true
}
```
- Validates credentials with test API call
- Registers webhooks automatically
- Creates sync tracking records

#### DELETE `/integrations/woocommerce/disconnect?connectionId=...`
Remove a connection:
- Deregisters webhooks from store
- Deletes all sync records
- Cleans up webhook logs

#### GET `/integrations/woocommerce/status?connectionId=...`
Get connection health:
- Current status (active/paused/error)
- Health check result
- Last sync timestamps per entity type
- Webhook registration status

#### POST `/integrations/woocommerce/sync`
Trigger full sync:
```json
{
  "syncOrders": true,
  "syncProducts": true,
  "syncCustomers": true
}
```
- Runs async in background
- Returns immediately with status "pending"
- Fetches all entities and creates sync records
- Updates `lastSyncAt` timestamp

#### POST `/integrations/woocommerce/webhooks`
Webhook receiver:
- Validates HMAC-SHA256 signature
- Checks idempotency with deliveryId
- Logs webhook to audit trail
- Returns 202 Accepted for valid webhooks

#### GET `/integrations/woocommerce/mapping`
Get field mapping configuration:
- Standard order field mappings
- Product field mappings
- Customer field mappings
- Status mapping tables (WC ↔ WL)

#### PUT `/integrations/woocommerce/mapping`
Update field mappings:
- Custom field mapping rules
- Per-tenant configuration

## Type Definitions

### Core Types
```typescript
// WooCommerce API Response Types
WCOrder, WCProduct, WCCustomer, WCWebhook
WCProductVariation, WCProductImage
WCAddress, WCLineItem, WCTaxLine, etc.

// Status Enums
WCOrderStatus: "pending" | "processing" | "on-hold" | "completed" | "cancelled" | "refunded" | "failed"
WLOrderStatus: "pending" | "confirmed" | "dispatched" | "out_for_delivery" | "delivered" | "cancelled" | "returned"
WCProductType: "simple" | "variable" | "grouped" | "external" | "bundle"

// Configuration
WCClientConfig: storeUrl, consumerKey, consumerSecret, version, timeout, rateLimit, retries
WCSyncOptions: syncOrders, syncProducts, syncCustomers, since, conflictResolution

// Results
WCSyncResult: ordersSync, productsSync, customersSync with created/updated/failed counts
WCListResponse<T>: data array with totalItems, page, perPage
```

## Testing Strategy

### Test Coverage

#### WC Client Tests (`wc-client.test.ts`)
- Client creation with valid/invalid config
- OAuth 1.0a signature generation and format
- Rate limiting behavior
- Retry logic with exponential backoff
- Max retry count enforcement
- 4xx vs 5xx error handling
- Request method implementations (GET, POST, PUT, DELETE)
- Pagination parameter handling
- Timeout configuration
- Error handling and validation

#### Order Sync Tests (`order-sync.test.ts`)
- Bidirectional status mapping (complete coverage)
- Field mapping for orders, customers, addresses
- Conflict resolution with timestamp comparison
- Meta field extraction and building
- Order validation (complete, missing ID, missing items)
- Order summary calculations
- Edge cases (null values, missing fields)

### Test Files Location
```
packages/core/src/integrations/woocommerce/__tests__/
├── wc-client.test.ts          # HTTP client tests
├── order-sync.test.ts         # Order mapping tests
└── [additional tests as needed]
```

## Integration Patterns

### Following Existing Patterns
This implementation follows the established patterns from Google and Shopify integrations:

1. **Service Pattern**: Separate service classes for each sync domain
2. **Factory Functions**: Create* functions for service instantiation
3. **Type Exports**: Barrel exports in index.ts
4. **API Route Structure**: Fastify route registration with middleware
5. **Error Handling**: Consistent error response format
6. **Validation**: Zod schemas for request validation
7. **Database Access**: Using Prisma client with (prisma as any).modelName

### Named Imports Only
All imports use named imports (no default imports):
```typescript
import { OrderSyncService, createOrderSyncService } from "./order-sync.js"
import type { WCOrder, WCOrderStatus } from "./types.js"
```

### TypeScript Strict Mode
Full TypeScript strict mode compliance:
- No implicit any
- Explicit return types on all functions
- Complete type annotations

## Deployment Notes

### Environment Variables
Required for webhook registration:
```
API_URL=https://api.example.com (for webhook callback URL)
```

### Credentials Encryption
Consumer secrets and webhook secrets should be encrypted at the application layer before storing in Prisma.

### Rate Limiting
Default 25 requests/second per client instance. Configure via `WCClientConfig.rateLimit`.

### Retry Strategy
- Max 3 retries by default
- Exponential backoff: 1s, 2s, 4s
- Only retries on network errors and 5xx responses
- Never retries on 4xx client errors

### Webhook Verification
All webhooks are verified using HMAC-SHA256 with the stored webhook secret. Invalid signatures are logged but not processed.

### Sync Process
- Runs asynchronously (non-blocking)
- Tracks sync state in `WooCommerceSyncRecord`
- Uses last-write-wins conflict resolution
- Idempotent operations

## Performance Considerations

### Rate Limiting
- Sliding window implementation prevents burst requests
- Respects WooCommerce's 10 req/sec default (configurable)
- Automatic queuing for rate-limited responses

### Pagination
- Default 100 items per page for list endpoints
- Offset-based pagination for efficient iteration
- Client handles pagination headers automatically

### Retry Logic
- Exponential backoff prevents server overload
- Network timeout: 30 seconds (configurable)
- Max 3 retries covers transient failures

### Database Indexing
All critical queries have indexes:
- `connectionId` for lookups
- `entityType` for filtering
- `wcId` and `wlId` for cross-references
- `status` and `timestamp` for monitoring

## Security

### OAuth 1.0a Implementation
- HMAC-SHA256 signature generation
- Timestamp-based nonce
- Constant-time signature comparison
- No credentials in URLs or logs

### Webhook Security
- HMAC-SHA256 verification required
- Timing attack prevention via constant-time comparison
- Delivery ID-based idempotency
- Failed webhooks logged for investigation

### Data Encryption
- Credentials encrypted at application layer
- Webhook secrets encrypted in database
- No secrets in error messages or logs

## Files Created

### Core Integration (`packages/core/src/integrations/woocommerce/`)
1. **types.ts** (500+ lines)
   - Complete WC REST API v3 type definitions
   - Witylogix mapping types
   - Status enums and configuration interfaces

2. **wc-client.ts** (700+ lines)
   - WooCommerceClient class
   - OAuth 1.0a builder
   - Rate limiter
   - HTTP method implementations
   - Error handling and retries

3. **order-sync.ts** (400+ lines)
   - OrderSyncService class
   - Bidirectional field mapping
   - Status mapping (7 WC → 7 WL statuses)
   - Conflict resolution
   - Validation and summary calculations

4. **product-sync.ts** (450+ lines)
   - ProductSyncService class
   - Product and variation mapping
   - Inventory and image sync
   - Attribute handling
   - Type mapping

5. **customer-sync.ts** (350+ lines)
   - CustomerSyncService class
   - Guest customer merge support
   - Address book sync
   - Duplicate detection
   - Validation

6. **webhook-consumer.ts** (250+ lines)
   - WebhookConsumer class
   - HMAC-SHA256 verification
   - Idempotency tracking
   - Event handler registration
   - Topic parsing

7. **index.ts**
   - Barrel exports for all services and types

### Tests (`packages/core/src/integrations/woocommerce/__tests__/`)
1. **wc-client.test.ts** (200+ lines)
   - Client creation tests
   - OAuth signature tests
   - Rate limiting tests
   - Retry logic tests
   - Error handling tests

2. **order-sync.test.ts** (400+ lines)
   - Status mapping tests (complete coverage)
   - Field mapping tests
   - Conflict resolution tests
   - Meta field handling tests
   - Validation tests
   - Summary calculation tests

### Database Schema (`packages/db/prisma/schema/45-woocommerce.prisma`)
- WooCommerceConnection model
- WooCommerceSyncRecord model
- WooCommerceRegisteredWebhook model
- WooCommerceWebhookLog model
- Enums and indexes

### API Routes (`apps/api/src/routes/integrations/woocommerce.ts`)
- POST /connect
- DELETE /disconnect
- GET /status
- POST /sync
- POST /webhooks
- GET /mapping
- PUT /mapping

## Next Steps

1. **Register integration in marketplace**: Add to INTEGRATION_REGISTRY
2. **Run tests**: `npm test packages/core/src/integrations/woocommerce`
3. **Database migration**: Apply Prisma schema changes
4. **Webhook testing**: Verify with test WC store
5. **Performance testing**: Load test rate limiter and retry logic
6. **Documentation**: Add to API docs with examples
7. **Monitoring**: Set up alerts for sync failures

## References

- WooCommerce REST API v3: https://woocommerce.com/document/woocommerce-rest-api/
- OAuth 1.0a: https://tools.ietf.org/html/rfc5849
- HMAC-SHA256: https://tools.ietf.org/html/rfc4868
