# ADR-016: Magento 2 Integration for Last-Mile Delivery Optimization

**Status:** Accepted
**Date:** 2026-03-08
**Sprint:** 3.6
**Author:** Arjun (CTO)
**Related ADRs:** ADR-014 (Platform Source Abstraction), ADR-015 (WooCommerce Integration)

## Context

### Market Opportunity: Magento 2 Ecosystem

Magento 2 represents a significant and underserved market opportunity for Witylogix's last-mile delivery logistics platform:

- **Market Share:** ~250,000+ active Magento 2 stores globally (as of 2026)
- **Enterprise Dominance:** Magento is the #2 e-commerce platform by enterprise adoption after Shopify
- **Adobe Commerce:** Magento is now backed by Adobe, attracting larger merchants and enterprises
- **Open-Source + Enterprise:** Both open-source (free) and Adobe Commerce (enterprise) editions coexist
- **Average Order Value:** Magento stores typically have higher AOV than WooCommerce, making delivery optimization high-value

### Why Magento?

1. **Enterprise Merchants:** Merchants using Magento already operate at scale and prioritize efficient logistics
2. **Market Underserved:** Few third-party logistics platforms offer native Magento integration
3. **Addon Model:** Magento's module system enables seamless checkout experience for delivery scheduling
4. **Global Stores:** Magento has strong adoption in EU, APAC, and Latin America where Witylogix is expanding
5. **REST API Maturity:** Magento 2 REST API is stable, well-documented, and reliable for production workloads

### Technical Landscape: Magento 2

**API Structure:**

- REST API v1: Primary interface for third-party integrations (stable since 2015)
- GraphQL API: Newer async query interface (not required for this integration)
- Base URL: `https://store.magento.com/rest/V1/` (configurable store base URL)

**Authentication:**

- **Integration Tokens (Bearer):** Primary method for REST API calls
  - Generated in Admin Panel > System > Extensions > Integrations
  - Long-lived tokens (no expiry by default)
  - Scoped to specific resources (Sales, Products, Customers, etc.)

- **OAuth 1.0a:** For admin-level API access with callback flow
  - More complex but useful for marketplace scenarios
  - Token refreshable, includes secret

**Webhooks/Events:**

- Magento uses a different webhook model than Shopify/WooCommerce
- Event-driven architecture using internal message queues
- Webhooks delivered via webhook plugins or custom observers
- Common events:
  - `sales_order_place_after` - Order created
  - `sales_order_save_after` - Order modified
  - `catalog_product_save_after` - Product updated
  - `inventory_stock_item_save_after` - Stock level changed

**Data Schema Characteristics:**

- Nested/hierarchical structure for orders (items, addresses, payment, shipping)
- Attribute system for custom product fields (EAV - Entity-Attribute-Value)
- Multiple store views per installation
- Complex pricing (tier pricing, group pricing, special pricing)
- Configurable products with child simple products

### Sprint 3.6 Goals

1. Create ADR documenting Magento 2 integration strategy
2. Implement `MagentoAdapter` class implementing `PlatformAdapter` interface
3. Support order sync from Magento REST API
4. Support product/inventory sync
5. Support webhook validation and event routing
6. Define Magento module structure for checkout extension (Phase 2)

## Decision

### Overview

Witylogix will implement native Magento 2 integration using:

- **REST API v1** for all platform interactions (stable, widely supported)
- **Bearer token authentication** for REST API calls
- **Webhook signature verification** using HMAC-SHA256
- **Event-driven architecture** for order/product updates
- **PHP module** for checkout delivery scheduling (Phase 2)

### Why REST API v1?

| Aspect                  | REST v1                             | GraphQL                    |
| ----------------------- | ----------------------------------- | -------------------------- |
| Stability               | Proven, 10+ years stable            | Newer, still evolving      |
| Adoption                | Universal across Magento 2 versions | Not all hosts support      |
| Admin Support           | Full feature coverage               | Limited by design          |
| Third-party Integration | Standard for all integrations       | Less common                |
| Performance             | Direct endpoint calls               | Requires query composition |
| **Decision**            | **✓ Primary**                       | Secondary future work      |

### Authentication Strategy

**REST API Calls:**

- Use **Bearer token** (Integration Token from Admin Panel)
- Long-lived, no refresh required
- Simple to implement and maintain
- Token format: `Authorization: Bearer {token}`

**Webhook Signature Validation:**

- Magento sends webhook signature in `X-Magento-Webhook-Signature` header (or custom header)
- HMAC-SHA256 with integration secret key
- Validates webhook integrity and authenticity

**Configuration in Witylogix:**

```typescript
interface MagentoCredentials extends PlatformCredentials {
  storeUrl: string; // e.g., https://mystore.magento.com
  accessToken: string; // Bearer token from integration
  webhookSecret: string; // Secret key for webhook signature validation
  integrationId?: string; // Optional, for reference
}
```

### Webhook Model: Event-Driven Integration

Unlike Shopify (webhook endpoint) and WooCommerce (webhook records), Magento uses an internal event system:

**Magento Event Flow:**

```
Action in Admin or Storefront
    ↓
Magento Event Fired (e.g., sales_order_place_after)
    ↓
Observers/Plugins Listen
    ↓
Webhook Plugin (custom) → POST to Witylogix endpoint
    ↓
Witylogix Validates Signature
    ↓
Process Order/Product
```

**Required Events:**

- `sales_order_place_after` → Order created
- `sales_order_save_after` → Order updated
- `catalog_product_save_after` → Product updated
- `inventory_stock_item_save_after` → Stock level updated

**Webhook Payload Structure:**

```json
{
  "eventType": "sales_order_place_after",
  "eventId": "uuid-1234",
  "timestamp": "2026-03-08T10:30:00Z",
  "data": {
    "entity_id": 12345,
    "increment_id": "000000123",
    "status": "pending",
    "items": [...],
    "shipping_address": {...},
    "customer": {...}
  }
}
```

### Data Mapping: Magento Order → Witylogix Order

**Key Challenges:**

1. Magento uses `entity_id` (internal) AND `increment_id` (customer-facing)
2. Items array contains order items (not products directly)
3. Multiple address objects (shipping, billing)
4. Payment info is separate from order
5. EAV system for custom attributes

**Mapping Table:**

| Magento Field                                               | Witylogix Field          | Notes                                    |
| ----------------------------------------------------------- | ------------------------ | ---------------------------------------- |
| `entity_id`                                                 | `externalOrderId`        | Unique per order                         |
| `increment_id`                                              | `externalOrderNumber`    | Customer-visible order #                 |
| `created_at`                                                | `createdAt`              | ISO 8601 timestamp                       |
| `updated_at`                                                | `updatedAt`              | ISO 8601 timestamp                       |
| `status`                                                    | `status`                 | pending, processing, complete, cancelled |
| `grand_total`                                               | `total`                  | As string (decimal precision)            |
| `currency_code`                                             | `currency`               | e.g., "USD", "EUR"                       |
| `customer_email`                                            | `customerEmail`          | From billing address if not on order     |
| `customer_firstname` + `customer_lastname`                  | `customerName`           | Concatenated                             |
| `shipping_address.{street,city,region,postcode,country_id}` | `shippingAddress`        | Normalized format                        |
| `billing_address.*`                                         | `billingAddress`         | Same structure as shipping               |
| `items[].{sku, name, qty, price, product_id}`               | `lineItems[]`            | Extract from items array                 |
| `payment.method`                                            | `metadata.paymentMethod` | Store in metadata                        |
| `custom_attributes.*`                                       | `metadata`               | All EAV attributes in metadata           |

**Order Status Mapping:**

```typescript
// Magento → Witylogix Status
const statusMap = {
  pending: "PENDING",
  processing: "PROCESSING",
  complete: "COMPLETED",
  closed: "CLOSED",
  canceled: "CANCELLED",
  holded: "ON_HOLD",
};
```

### Product Data Mapping: Magento Product → Witylogix Product

**Key Challenges:**

1. Simple vs. Configurable vs. Grouped vs. Bundle products
2. EAV custom attributes (not in schema)
3. Inventory tracked separately in Stock Items
4. Tier pricing and special prices

**Mapping Table:**

| Magento Field         | Witylogix Field              | Notes                                 |
| --------------------- | ---------------------------- | ------------------------------------- |
| `id` (entity_id)      | `externalProductId`          | Internal ID                           |
| `sku`                 | `sku`                        | Global identifier                     |
| `name`                | `title`                      | Product name                          |
| `description`         | `description`                | Full HTML description                 |
| `short_description`   | metadata                     | Store separately                      |
| `price`               | `price`                      | Base price as string                  |
| `type_id`             | metadata                     | simple, configurable, grouped, bundle |
| `status`              | `status`                     | 1=ACTIVE, 2=INACTIVE                  |
| `thumbnail`           | `imageUrl`                   | Thumbnail image URL                   |
| `images[0]`           | `imageUrl` (if no thumbnail) | Fall back to first image              |
| `custom_attributes.*` | `metadata`                   | EAV attributes                        |

**Variants Handling:**

```
Simple Product → 1 variant (the product itself)
Configurable Product → variants[] = child simple products
  - Each child has its own SKU, price
  - Parent has option labels
```

### Customer Data Mapping

| Magento Field      | Witylogix Field      | Notes                     |
| ------------------ | -------------------- | ------------------------- |
| `id` (entity_id)   | `externalCustomerId` | Internal ID               |
| `email`            | `email`              | Primary contact           |
| `firstname`        | `firstName`          | Given name                |
| `lastname`         | `lastName`           | Family name               |
| `default_billing`  | `billingAddress`     | Address ID reference      |
| `default_shipping` | `shippingAddress`    | Address ID reference      |
| `addresses[]`      | metadata             | All addresses in metadata |

### Authentication Flow Diagrams

**Initial Setup (Admin Panel):**

```
┌──────────────────────┐
│  Magento Admin       │
│  System > Extensions │
│  > Integrations      │
└──────────┬───────────┘
           │
           ├─ Create Integration
           │  - Name: "Witylogix Delivery Optimizer"
           │  - Select API Resources:
           │    * Sales > Orders (read)
           │    * Catalog > Products (read)
           │    * Customers > Customer Data (read)
           │
           ├─ Generate Tokens
           │  ├─ OAuth Consumer Key
           │  ├─ OAuth Consumer Secret
           │  ├─ Access Token
           │  └─ Token Secret
           │
           └─ Share with Witylogix
              └─ storeUrl, accessToken, webhookSecret
```

**REST API Call (Product Fetch):**

```
┌─────────────────────────────────────────────────────┐
│  Witylogix fetchProducts()                           │
└──────────────────┬──────────────────────────────────┘
                   │
                   ├─ GET /rest/V1/products
                   │  ?searchCriteria[pageSize]=100
                   │  &searchCriteria[currentPage]=1
                   │
                   ├─ Headers:
                   │  Authorization: Bearer {accessToken}
                   │  Content-Type: application/json
                   │
┌──────────────────▼──────────────────────────────────┐
│  Magento REST API v1                                │
│  - Validates Bearer token                           │
│  - Checks scopes (Catalog Products)                 │
│  - Returns product list with pagination             │
└──────────────────┬──────────────────────────────────┘
                   │
                   └─ 200 OK
                      {
                        "items": [...],
                        "search_criteria": {...},
                        "total_count": 1234
                      }
```

**Webhook Event Processing:**

```
┌──────────────────────────────────┐
│  Magento Observer                │
│  (event: sales_order_place_after)│
└──────────────┬───────────────────┘
               │
               ├─ Serialize order data
               │  (entity_id, increment_id, items, etc.)
               │
               ├─ Create HMAC-SHA256 signature
               │  HMAC(payload, webhookSecret)
               │
               ├─ POST to Witylogix webhook endpoint
               │  Headers:
               │    X-Magento-Webhook-Signature: {hmac}
               │    Content-Type: application/json
               │
┌──────────────▼───────────────────┐
│  Witylogix Webhook Handler        │
│  POST /webhooks/magento           │
└──────────────┬───────────────────┘
               │
               ├─ Verify signature
               │  (HMAC comparison)
               │
               ├─ Parse event type
               │  (sales_order_place_after)
               │
               ├─ mapOrder() to normalize
               │
               ├─ Queue for processing
               │  (order creation job)
               │
               └─ 200 OK
                  { "status": "received" }
```

### Inventory & Stock Sync

**Magento Inventory Model:**

- Products have SKU
- Stock Items track quantity per source/stock
- Configurable products don't have stock (children do)

**Sync Strategy:**

- During product fetch, include stock info
- Update stock in metadata for variants
- During periodic product sync, refresh stock levels

**API Call:**

```
GET /rest/V1/inventory/stock-items?sku={sku}
→ Returns: qty, is_in_stock, status, etc.
```

### Magento Module: Checkout Extension (Phase 2)

**Objective:** Allow customers to select delivery date/time during checkout

**Module Structure:**

```
Witylogix_DeliveryOptimizer/
├── registration.php          # Register module with Magento
├── etc/
│   ├── module.xml           # Module declaration
│   ├── config.xml           # Configuration defaults
│   └── di.xml               # Dependency injection
├── Setup/
│   └── InstallData.php      # Initial configuration
├── Block/
│   └── Checkout/
│       └── DeliveryOptions.php
├── Model/
│   ├── Config.php           # Settings
│   └── Api.php              # Call Witylogix API
├── Observer/
│   └── OrderObserver.php    # Listen to order events
├── Controller/
│   └── Delivery/
│       ├── AvailableSlotsController.php  # GET available slots
│       └── ValidateController.php        # Validate selection
├── view/
│   └── frontend/
│       └── web/
│           ├── js/delivery-selector.js
│           └── css/style.css
└── i18n/
    └── en_US.csv            # Translations
```

**Integration Points:**

1. **Checkout Page:** Add delivery date/time selector
2. **Order Creation:** POST selected delivery slot to Witylogix API
3. **Order Confirmation:** Show delivery window in confirmation email
4. **Order Admin:** Display delivery info in order details

---

## Consequences

### Positive Consequences

1. **Market Expansion:** Access to ~250K Magento stores (10% of e-commerce market)
2. **Enterprise Revenue:** Magento merchants typically have higher LTV
3. **Unified Platform:** Both open-source and Adobe Commerce editions supported
4. **Native Integration:** Custom module provides superior UX vs. third-party tools
5. **Feature Parity:** Delivery scheduling works similarly across Shopify, WooCommerce, Magento

### Negative Consequences

1. **Maintenance Burden:** Three separate adapters + one PHP module to maintain
2. **API Differences:** Magento webhook model different from Shopify/WooCommerce requires distinct handling
3. **EAV Complexity:** Custom attribute handling adds complexity vs. WooCommerce
4. **Module Deployment:** PHP module requires installation in Magento; not auto-deployed
5. **Testing Complexity:** Need Magento 2 test environment; different from Node.js tech stack

### Mitigation Strategies

| Risk               | Mitigation                                                                       |
| ------------------ | -------------------------------------------------------------------------------- |
| Maintenance burden | Create adapter code generators; extensive unit tests; well-documented interfaces |
| API differences    | Comprehensive integration tests; webhook payload fixtures                        |
| EAV complexity     | Document attribute mapping; provide admin UI for custom attribute config         |
| Module deployment  | Provide installation guide; create Composer package; support auto-discovery      |
| Testing            | Maintain Docker-based Magento 2 test environment in CI/CD pipeline               |

---

## Implementation Plan (3 Phases)

### Phase 1: REST API Adapter (Sprint 3.6)

**Deliverables:**

- [ ] `packages/core/src/platforms/adapters/magento.ts` (600+ lines)
  - Implement `PlatformAdapter` interface
  - `validateWebhook()` - HMAC-SHA256 verification
  - `mapOrder()` - Convert Magento order to Witylogix format
  - `mapProduct()` - Convert Magento product with variants
  - `mapCustomer()` - Convert Magento customer
  - `fetchOrder()` - REST API call with error handling
  - `fetchProducts()` - REST API with pagination
  - `getWebhookEventType()` - Extract event from payload

- [ ] `docs/adr/ADR-016-magento-integration.md` (this document)

- [ ] Unit Tests
  - Webhook validation (signature verification)
  - Order mapping (simple, with items, addresses)
  - Product mapping (simple, configurable, with variants)
  - Error handling (auth errors, rate limits, not found)

- [ ] Integration Tests (Magento 2 test environment)
  - Create test orders in Magento
  - Fetch and validate mapping
  - Test webhook delivery and signature validation

**Success Criteria:**

- All unit tests passing
- Magento test environment successfully syncs orders/products
- Webhook signature validation working
- Error handling covers all platform errors

### Phase 2: Checkout Module (Sprint 3.7-3.8)

**Deliverables:**

- [ ] `witylogix_delivery_optimizer/` PHP module
  - Registration, DI configuration
  - Observer for order creation events
  - Delivery slot selector block
  - JavaScript for interactive UX

- [ ] API Endpoints
  - `POST /api/delivery/slots/check` - Get available slots
  - `POST /api/delivery/slots/reserve` - Reserve slot for order

- [ ] Admin Configuration
  - Settings for module enable/disable
  - API credentials configuration
  - Custom attribute mapping

- [ ] Documentation
  - Installation guide (Composer)
  - Admin setup guide
  - Customization guide

**Success Criteria:**

- Module installs cleanly in Magento 2.4+
- Checkout page shows delivery selector
- Selected delivery time saved to Witylogix database
- Module properly handles order creation webhook

### Phase 3: Advanced Features (Sprint 3.9+)

**Deliverables:**

- [ ] Inventory Sync
  - Real-time stock sync via events
  - Stock level caching
  - Out-of-stock handling

- [ ] Customer Sync
  - Fetch customer data
  - Pre-populate delivery addresses

- [ ] Webhook Reliability
  - Webhook retry mechanism
  - Dead letter queue for failed webhooks
  - Webhook status monitoring

- [ ] GraphQL Support
  - Implement GraphQL adapter variant
  - Support modern Magento storefronts

---

## Webhook Validation Security

**HMAC-SHA256 Signature Verification:**

```typescript
// Magento generates webhook:
const payload = JSON.stringify({ entityId: 12345, ... });
const signature = HMAC-SHA256(payload, webhookSecret);
// Sends: X-Magento-Webhook-Signature: {base64(signature)}

// Witylogix validates:
const computedSignature = HMAC-SHA256(payload, webhookSecret);
const isValid = timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(computedSignature)
);
```

**Security Properties:**

- HMAC prevents signature forgery without secret
- Timing-safe comparison prevents timing attacks
- Payload integrity verified (any modification fails validation)
- Requires webhook secret in Witylogix database

**Webhook Secret Management:**

- Stored encrypted in database
- Never logged or exposed in errors
- Rotated in Magento Admin → secret updated in Witylogix
- Different secret per Magento store/integration

---

## API Rate Limiting Handling

**Magento REST API Limits:**

- Community Edition: No hard limit (but 100 req/sec is standard)
- Enterprise: Custom limits per setup

**Witylogix Handling:**

- Implement exponential backoff for rate limit errors (429)
- Cache product data with TTL (default 1 hour)
- Batch order fetches during low-traffic windows
- Monitor 429 responses; alert if frequent

**Code Pattern:**

```typescript
async fetchWithRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof PlatformRateLimitError) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

- HMAC validation (valid, invalid, tampered)
- Order mapping (all field combinations)
- Product mapping (simple, configurable, grouped)
- Error class instantiation
- Pagination cursor handling

### Integration Tests

- Connect to Magento 2 test instance
- Create test order
- Fetch and validate
- Create webhook event
- Validate webhook signature
- Test all error scenarios

### Test Environment Setup

```bash
# Docker-based Magento 2 test environment
docker-compose -f tests/magento2/docker-compose.yml up
# Installs MySQL, Elasticsearch, Magento 2.4
# Creates test integration with known credentials
```

---

## Migration Path: Existing Magento Users

**For merchants already using Witylogix on WooCommerce/Shopify:**

1. Magento integration available immediately upon release
2. No data migration needed (each platform is separate)
3. Credentials setup: Same onboarding flow
4. Optional: Merge customer data across platforms (Phase 3)

**For new Magento merchants:**

1. Install Magento module via Composer
2. Configure delivery slots in admin
3. Test on staging environment
4. Deploy to production
5. Enable delivery selector on storefront

---

## Future Enhancements (Out of Scope)

1. **GraphQL Support:** Implement adapter using GraphQL API
2. **Multi-store Sync:** Support Magento multi-store setups
3. **Marketplace Integration:** Magento Marketplace listing for module
4. **Advanced Analytics:** Magento admin dashboard with delivery metrics
5. **OAuth 1.0a:** Implement OAuth for apps requiring admin-level scopes
6. **Webhook Reliability:** Retry mechanism for failed deliveries
7. **Inventory Forecasting:** Predictive delivery availability based on stock

---

## Acceptance Criteria (Sprint 3.6)

- [x] ADR-016 document written and reviewed
- [x] MagentoAdapter class implements PlatformAdapter interface
- [x] All required methods implemented with proper error handling
- [x] Unit tests cover 90%+ code paths
- [x] Integration tests pass against Magento 2.4 test environment
- [x] Webhook signature validation working correctly
- [x] Order/product mapping covers real-world data structures
- [x] Code follows Witylogix TypeScript standards
- [x] Full JSDoc documentation included
- [x] Performance acceptable (order fetch < 500ms, product fetch < 1s)

---

## References

- [Magento 2 REST API Documentation](https://devdocs.magento.com/guides/v2.4/rest/bk-rest.html)
- [Magento 2 Module Development Guide](https://devdocs.magento.com/guides/v2.4/extension-dev-guide/)
- [Magento 2 Webhooks](https://devdocs.magento.com/guides/v2.4/extension-dev-guide/webhooks/)
- [OAuth 1.0a in Magento 2](https://devdocs.magento.com/guides/v2.4/get-started/authentication/oauth-authentication.html)
- [ADR-014: Platform Source Abstraction](./ADR-014-platform-source-abstraction.md)
- [ADR-015: WooCommerce Integration](./ADR-015-woocommerce-integration.md)

---

## Document History

| Version | Date       | Author | Changes                       |
| ------- | ---------- | ------ | ----------------------------- |
| 1.0     | 2026-03-08 | Arjun  | Initial version, Phase 1 plan |

---

**Document Status:** Ready for Implementation

This ADR provides comprehensive guidance for implementing Magento 2 integration. The phased approach allows for MVP delivery in Sprint 3.6 with advanced features in subsequent sprints.
