# Platform Bridge

Multi-platform e-commerce integration abstraction layer for Witylogix. Provides unified data normalization and webhook handling for Shopify, WooCommerce, Magento, and custom platforms.

## Overview

The Platform Bridge is a critical abstraction that normalizes data from different e-commerce platforms into a unified schema. This enables Witylogix to support multiple platforms without duplicating business logic.

## Architecture

### Core Concepts

**Platform Source**: Enum identifying the e-commerce platform

- `SHOPIFY` - Shopify Plus/Standard
- `WOOCOMMERCE` - WooCommerce
- `MAGENTO` - Adobe Commerce/Magento
- `CUSTOM` - Custom platform

**Unified Types**: Common schema for all platforms

- `UnifiedOrder` - Normalized order
- `UnifiedProduct` - Normalized product
- `UnifiedCustomer` - Normalized customer
- `UnifiedWebhookEvent` - Normalized webhook event

## Components

### 1. DataNormalizer

Converts platform-specific data to unified format.

#### Usage

```typescript
import { DataNormalizer } from "@witylogix/core/integrations/platform-bridge";

// Normalize WooCommerce order
const wcOrder = {
  /* WC order data */
};
const result = DataNormalizer.normalizeOrder("woocommerce", wcOrder);

if (result.success) {
  const unifiedOrder: UnifiedOrder = result.data;
  // Use unified order across system
} else {
  console.error("Normalization failed:", result.errors);
}

// Normalize product
const wcProduct = {
  /* WC product data */
};
const productResult = DataNormalizer.normalizeProduct("woocommerce", wcProduct);

// Normalize customer
const wcCustomer = {
  /* WC customer data */
};
const customerResult = DataNormalizer.normalizeCustomer(
  "woocommerce",
  wcCustomer,
);
```

#### Supported Conversions

**WooCommerce → Unified**

- Order status: `pending|processing|on-hold|completed|cancelled|refunded|failed` → `pending|confirmed|dispatched|out_for_delivery|delivered|cancelled|returned`
- Pricing: String prices converted to cents (integers)
- Addresses: Normalized to common schema
- Meta data: Extracted to metadata object
- Line items: Full mapping with product/variant IDs

**Shopify → Unified**

- (Placeholder for future implementation)

**Magento → Unified**

- (Placeholder for future implementation)

### 2. WebhookNormalizer

Converts platform-specific webhook events to unified format.

#### Usage

```typescript
import { WebhookNormalizer } from "@witylogix/core/integrations/platform-bridge";

// Identify platform from headers
const headers = {
  "x-wc-webhook-id": "123",
  "x-wc-webhook-topic": "order.created",
};
const platform = WebhookNormalizer.identifyPlatform(headers);
// Returns: 'woocommerce'

// Normalize webhook event
const event = WebhookNormalizer.normalizeWebhookEvent(
  "woocommerce",
  "order.created",
  wcOrderPayload,
);

if (event) {
  // Process unified webhook event
  handleOrderCreated(event);
}

// Map topic to unified format
const unifiedTopic = WebhookNormalizer.getUnifiedTopic(
  "woocommerce",
  "order.created",
);
// Returns: 'order.created'

// Verify webhook signature
const isValid = WebhookNormalizer.verifyWebhookSignature(
  "woocommerce",
  payload,
  signature,
  secret,
);
```

#### Webhook Topic Mapping

**WooCommerce Topics**

- `order.created` → Unified: `order.created`
- `order.updated` → Unified: `order.updated`
- `order.deleted` → Unified: `order.deleted`
- `product.created` → Unified: `product.created`
- `customer.created` → Unified: `customer.created`

**Shopify Topics** (Conversion)

- `orders/created` → Unified: `order.created`
- `products/create` → Unified: `product.created`
- `customers/create` → Unified: `customer.created`

## Unified Schema

### UnifiedOrder

```typescript
interface UnifiedOrder {
  id: string; // Internal ID (e.g., "wc-order-123")
  externalId: string; // Platform-specific ID
  platform: PlatformSource; // Source platform
  number: string; // Order number/reference
  status: OrderStatus; // Normalized status
  currency: string; // ISO 4217 code
  createdAt: Date; // Order creation timestamp
  modifiedAt: Date; // Last modification timestamp
  customer: UnifiedCustomer; // Customer object
  lineItems: UnifiedLineItem[]; // Ordered products
  shippingAddress: UnifiedAddress; // Delivery address
  billingAddress: UnifiedAddress; // Billing address
  paymentMethod: string; // Payment method name
  subtotal: number; // Pre-tax subtotal in cents
  taxTotal: number; // Total tax in cents
  shippingTotal: number; // Shipping cost in cents
  discountTotal: number; // Discount amount in cents
  total: number; // Grand total in cents
  notes: string; // Customer notes
  metadata: Record<string, unknown>; // Platform-specific metadata
}
```

### UnifiedProduct

```typescript
interface UnifiedProduct {
  id: string; // Internal ID
  externalId: string; // Platform ID
  platform: PlatformSource; // Source platform
  name: string; // Product name
  description: string; // Full description
  sku: string; // Stock keeping unit
  price: number; // Current price in cents
  compareAtPrice?: number; // Regular/compare price in cents
  cost?: number; // Cost price in cents
  weight?: number; // Weight in pounds/kg
  status: "draft" | "active" | "archived"; // Product status
  createdAt: Date; // Creation timestamp
  modifiedAt: Date; // Modification timestamp
  images: UnifiedImage[]; // Product images
  variants: UnifiedProductVariant[]; // Product variants
  categories: string[]; // Category names
  tags: string[]; // Product tags
  metadata: Record<string, unknown>; // Platform-specific metadata
}
```

### UnifiedCustomer

```typescript
interface UnifiedCustomer {
  id: string; // Internal ID
  externalId: string; // Platform ID
  platform: PlatformSource; // Source platform
  email: string; // Email address
  firstName: string; // First name
  lastName: string; // Last name
  phone?: string; // Phone number
  defaultAddress?: UnifiedAddress; // Primary address
  shippingAddresses: UnifiedAddress[]; // All shipping addresses
  billingAddress?: UnifiedAddress; // Billing address
  totalOrders: number; // Lifetime order count
  totalSpent: number; // Lifetime spending in cents
  isVerified: boolean; // Email verified flag
  createdAt: Date; // Account creation date
  modifiedAt: Date; // Last modified date
  metadata: Record<string, unknown>; // Platform-specific metadata
}
```

### UnifiedAddress

```typescript
interface UnifiedAddress {
  id?: string;
  firstName: string;
  lastName: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string; // State/Province code
  postalCode: string; // ZIP/Postal code
  country: string; // Country code (ISO 3166-1 alpha-2)
  email?: string;
  phone?: string;
  isDefault?: boolean;
}
```

### UnifiedWebhookEvent

```typescript
interface UnifiedWebhookEvent {
  id: string; // Unique event ID
  platform: PlatformSource; // Source platform
  topic: string; // Platform-specific topic
  eventType: "created" | "updated" | "deleted" | "action_required";
  resourceType: "order" | "product" | "customer" | "fulfillment";
  resourceId: string; // ID of affected resource
  data: UnifiedOrder | UnifiedProduct | UnifiedCustomer; // Normalized data
  timestamp: Date; // Event timestamp
  metadata: Record<string, unknown>; // Platform-specific metadata
}
```

## Data Type Conversions

### Pricing

All monetary values are stored as **cents (integers)** in unified schema to avoid floating-point precision issues.

```typescript
// Input: WooCommerce (decimal strings)
wcOrder.total = "147.50";

// Conversion
total = Math.round(parseFloat("147.50") * 100); // 14750 cents

// Output: Unified (integer cents)
unifiedOrder.total = 14750;
```

### Dates

All dates are converted to JavaScript `Date` objects.

```typescript
// Input: ISO 8601 string
wcOrder.date_created = "2024-01-15T10:30:00"

// Conversion
createdAt = new Date("2024-01-15T10:30:00")

// Output: Date object
unifiedOrder.createdAt = Date(...)
```

### Status Mapping

Order statuses are normalized to unified statuses:

| WooCommerce  | Unified     |
| ------------ | ----------- |
| `pending`    | `pending`   |
| `processing` | `confirmed` |
| `on-hold`    | `pending`   |
| `completed`  | `delivered` |
| `cancelled`  | `cancelled` |
| `refunded`   | `returned`  |
| `failed`     | `cancelled` |

## Error Handling

Normalizers return `NormalizationResult<T>` with errors:

```typescript
interface NormalizationResult<T> {
  success: boolean;
  data?: T;
  errors?: NormalizationError[];
}

interface NormalizationError {
  field: string; // Field that failed
  value: unknown; // The problematic value
  reason: string; // Error description
}
```

Example error handling:

```typescript
const result = DataNormalizer.normalizeOrder("woocommerce", rawOrder);

if (!result.success) {
  result.errors?.forEach((error) => {
    console.error(`Field ${error.field}: ${error.reason}`);
  });
}
```

## Integration Patterns

### Order Processing

```typescript
import { DataNormalizer } from "@witylogix/core/integrations/platform-bridge";

async function processOrder(platform, rawOrder) {
  // Normalize to unified schema
  const result = DataNormalizer.normalizeOrder(platform, rawOrder);

  if (!result.success) {
    throw new Error(`Normalization failed: ${result.errors?.[0].reason}`);
  }

  const order = result.data;

  // Process with unified order
  await submitToDispatch(order);
  await updateInventory(order.lineItems);
  await notifyCustomer(order.customer.email);
}
```

### Webhook Handling

```typescript
import { WebhookNormalizer } from "@witylogix/core/integrations/platform-bridge";

async function handleWebhook(headers, body, signature) {
  // Identify platform
  const platform = WebhookNormalizer.identifyPlatform(headers);
  if (!platform) throw new Error("Unknown platform");

  // Verify signature
  if (
    !WebhookNormalizer.verifyWebhookSignature(platform, body, signature, secret)
  ) {
    throw new Error("Invalid signature");
  }

  // Normalize event
  const topic = headers["x-wc-webhook-topic"] || headers["x-shopify-topic"];
  const event = WebhookNormalizer.normalizeWebhookEvent(
    platform,
    topic,
    JSON.parse(body),
  );

  if (!event) return; // Could not normalize

  // Route by event type
  switch (event.eventType) {
    case "created":
      await handleCreated(event);
      break;
    case "updated":
      await handleUpdated(event);
      break;
  }
}
```

## Testing

Comprehensive test suites are included:

- `data-normalizer.test.ts` - Tests for order/product/customer normalization
- `webhook-normalizer.test.ts` - Tests for webhook event handling

Run tests:

```bash
npm test --workspace=@witylogix/core
```

## Extending the Platform Bridge

To add a new platform:

1. Create normalizer methods in `DataNormalizer`:

   ```typescript
   private static normalizeNewPlatformOrder(order: any): NormalizationResult<UnifiedOrder> {
     // Implementation
   }
   ```

2. Add webhook handler in `WebhookNormalizer`:

   ```typescript
   static normalizeNewPlatformWebhook(topic: string, payload: any): UnifiedWebhookEvent | null {
     // Implementation
   }
   ```

3. Add to `PlatformWebhookTopics` type
4. Add tests for new platform

## Performance Considerations

- Normalizers are stateless and safe for concurrent use
- Field mapping is cached (consider memoization for large datasets)
- Webhook signature verification uses constant-time comparison
- Error handling doesn't throw (returns result objects)

## Security

- Input validation on all normalizers
- Webhook signature verification required
- Sensitive data (API keys) handled via environment variables
- Field mapping prevents data leakage
- Type safety via TypeScript

## Future Enhancements

- [ ] Shopify complete implementation
- [ ] Magento implementation
- [ ] BigCommerce support
- [ ] Reverse normalization (unified → platform-specific)
- [ ] Bi-directional sync support
- [ ] Batch normalization with progress tracking
- [ ] Performance metrics and monitoring
- [ ] Schema versioning for API compatibility

## Support

For integration questions or issues:

- Email: integrations@witylogix.com
- Docs: https://docs.witylogix.com/platform-bridge
- Issues: https://github.com/witylogix/platform-bridge/issues

## License

Proprietary - Witylogix Inc.
