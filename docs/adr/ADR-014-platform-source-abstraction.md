# ADR-014: Platform Source Abstraction

**Status:** Accepted
**Date:** 2026-03-08
**Deciders:** Arjun (CTO)
**Supersedes:** None
**Relates to:** ADR-012 (Notification Provider Architecture), ADR-010 (Event Bus Architecture), ADR-009 (Medusa-Inspired Architecture), ADR-008 (Auth Provider Abstraction)

---

## Executive Summary

This decision documents the **platform source abstraction strategy** to decouple Witylogix from Shopify-specific field names and enable support for multiple e-commerce platforms (WooCommerce, Magento, custom storefronts).

**Current Problem:**
- Data models contain Shopify-specific fields: `shopifyOrderId`, `shopifyProductId`, `shopifyCustomerId`, `shopifyCollectionId`
- Prevents supporting WooCommerce and Magento without code changes
- Competitive disadvantage (Fleetbase is platform-agnostic)

**Key Changes:**
1. Rename Shopify-specific fields to generic names:
   - `shopifyOrderId` → `externalOrderId`
   - `shopifyProductId` → `externalProductId`
   - `shopifyCustomerId` → `externalCustomerId`
   - `shopifyCollectionId` → `externalCollectionId`
   - `shopifyOrderNumber` → `externalOrderNumber`

2. Add `source` enum to Order, Product, Customer, Collection models
   - Values: `SHOPIFY | WOOCOMMERCE | MAGENTO | CUSTOM`
   - Enables platform-agnostic queries and future platform support

3. Queue payloads become platform-generic with `source` discriminator
   - Webhook handlers (Shopify, WooCommerce) normalize to generic format
   - Consumers don't need to know platform details

**Outcome:**
- Supports multi-platform without model duplication
- Type-safe platform discrimination
- Maintains Shopify-first stability (default source = SHOPIFY)
- Unblocks Q2 roadmap (WooCommerce integration)

---

## Context

### Current State: Shopify Coupling

The Witylogix data model is tightly coupled to Shopify:

**Order Model (packages/db/prisma/schema/04-orders.prisma):**
```prisma
model Order {
  id                  String  @id
  shopId              String
  externalOrderId     String  @map("external_order_id")  // Was: shopifyOrderId
  externalOrderNumber String? @map("external_order_number")  // Was: shopifyOrderNumber
  source              String  @default("SHOPIFY")
  // ... rest of fields
  @@unique([shopId, shopifyOrderId])  // PROBLEM: Still references old field
}
```

**Product Model (packages/db/prisma/schema/25-cache-models.prisma):**
```prisma
model Product {
  id               String @id
  shopId           String
  shopifyProductId String  // PROBLEM: Shopify-specific
  // ... rest of fields
  @@unique([shopId, shopifyProductId])
}
```

**Customer Model:**
```prisma
model Customer {
  id                String @id
  shopId            String
  shopifyCustomerId String  // PROBLEM: Shopify-specific
  // ... rest of fields
  @@unique([shopId, shopifyCustomerId])
}
```

**Consequences:**
1. **Adding WooCommerce requires:**
   - New `woocommerceProductId`, `woocommerceCustomerId` fields
   - Separate unique constraints for each platform
   - Platform-specific business logic scattered throughout codebase
   - Database schema explosion

2. **Query Complexity:**
   ```typescript
   // Current: Only works for Shopify
   const product = await db.product.findUnique({
     where: { shopId_shopifyProductId: { ... } }
   });

   // Future: Need separate queries per platform
   const wooProduct = await db.product.findUnique({
     where: { shopId_wooProductId: { ... } }  // Doesn't exist yet
   });
   ```

3. **Webhook Processing:**
   - Shopify webhooks inject `shopifyOrderId` directly
   - WooCommerce webhooks need transformation step
   - No consistent normalization across platforms

### Competitive Analysis

**Fleetbase** (logistics competitor):
- Supports 40+ e-commerce platforms (Shopify, WooCommerce, Magento, BigCommerce, Custom)
- Generic `externalId` and `source` on all models
- Single set of business logic works across all platforms
- Massive TAM advantage over Shopify-only solutions

**Impact on Witylogix:**
- Current: Can only serve Shopify merchants
- Target: Serve entire mid-market e-commerce segment
- Roadmap: WooCommerce (40% of e-commerce), Magento (15%), Custom (10%)

### Roadmap Alignment

**Q1 2026 (Sprint 3.4):** ADR-014 decision + Phase 1 implementation
- Rename fields and add source enum
- Update unique constraints
- Update all consumer code
- Maintain backward compatibility via migration

**Q2 2026:** Phase 2 implementation + WooCommerce adapter
- Build WooCommerce webhook normalizer
- Implement WooCommerce product sync
- Test multi-platform order workflows

**H2 2026:** Magento + Custom integrations

### Existing Patterns

**ADR-008: Auth Provider Abstraction** shows similar approach:
```typescript
enum AuthProvider {
  GOOGLE = "GOOGLE",
  GITHUB = "GITHUB",
  OKTA = "OKTA",
}

interface AuthConfig {
  provider: AuthProvider;
  credentials: unknown;  // Provider-specific
}
```

This ADR follows same pattern for e-commerce platforms.

### Breaking Change Assessment

**Migration Scope:**
- Prisma schema: Update 4 models + 8 indexes
- Database migration: Rename columns, drop old unique constraints, add new ones
- Consumer code: Update 40+ query sites (findUnique with new constraint names)
- Webhook handlers: No change to Shopify (still maps to `externalOrderId`)
- Tests: Update ~30 test files with new model fields

**Risk Level:** Medium-High
- Data-affecting change (columns rename)
- Must maintain transactional integrity during migration
- Requires comprehensive testing before production

---

## Decision

### 1. Field Renaming Strategy

**Order Model Changes:**
```prisma
model Order {
  id                  String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  shopId              String      @map("shop_id") @db.Uuid

  // CHANGE: Renamed Shopify-specific fields to generic
  externalOrderId     String      @map("external_order_id")      // Was: shopifyOrderId
  externalOrderNumber String?     @map("external_order_number")  // Was: shopifyOrderNumber
  source              String      @default("SHOPIFY") @map("source")  // NEW

  // ... all other fields unchanged

  // CHANGE: Update unique constraint
  @@unique([shopId, externalOrderId, source])  // Was: [shopId, shopifyOrderId]
  @@index([shopId, status, createdAt(sort: Desc)])
}
```

**Product Model Changes:**
```prisma
model Product {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  shopId           String   @map("shop_id") @db.Uuid

  // CHANGE: Rename Shopify-specific field
  externalProductId String  @map("external_product_id")  // Was: shopifyProductId
  source           String  @default("SHOPIFY") @map("source")  // NEW

  // ... all other fields unchanged

  // CHANGE: Update unique constraint
  @@unique([shopId, externalProductId, source])  // Was: [shopId, shopifyProductId]
  @@map("products")
}
```

**Customer Model Changes:**
```prisma
model Customer {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  shopId           String   @map("shop_id") @db.Uuid

  // CHANGE: Rename Shopify-specific field
  externalCustomerId String @map("external_customer_id")  // Was: shopifyCustomerId
  source           String  @default("SHOPIFY") @map("source")  // NEW

  // ... all other fields unchanged

  // CHANGE: Update unique constraint
  @@unique([shopId, externalCustomerId, source])  // Was: [shopId, shopifyCustomerId]
  @@map("customers")
}
```

**Collection Model (if exists):**
```prisma
model Collection {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  shopId           String   @map("shop_id") @db.Uuid

  externalCollectionId String @map("external_collection_id")  // Was: shopifyCollectionId
  source           String  @default("SHOPIFY") @map("source")  // NEW

  @@unique([shopId, externalCollectionId, source])
}
```

### 2. Platform Source Enum

**Location:** `packages/types/src/platform.ts` (new file)

```typescript
/**
 * PlatformSource enum defines all supported e-commerce platforms
 */
export enum PlatformSource {
  SHOPIFY = "SHOPIFY",
  WOOCOMMERCE = "WOOCOMMERCE",
  MAGENTO = "MAGENTO",
  CUSTOM = "CUSTOM",  // For custom/self-hosted storefronts
}

/**
 * Type guard for PlatformSource
 */
export function isPlatformSource(value: string): value is PlatformSource {
  return Object.values(PlatformSource).includes(value as PlatformSource);
}

/**
 * ExternalReference interface for platform-agnostic external IDs
 * Used in event payloads, queue messages, and external integrations
 */
export interface ExternalReference {
  externalId: string;        // Platform-specific ID (e.g., "1234567890")
  source: PlatformSource;    // Which platform this ID came from
  externalNumber?: string;   // Optional order/customer number (e.g., "#1001")
}

/**
 * Union type for external reference with discriminator
 */
export type ExternalEntity<T extends PlatformSource = PlatformSource> = {
  source: T;
  externalId: string;
  externalNumber?: string;
  [key: string]: unknown;
};
```

### 3. Queue Payload Normalization

**Before (Shopify-specific):**
```typescript
interface OrderCreatedPayload {
  shopId: string;
  shopifyOrderId: string;
  shopifyOrderNumber: string;
  // ... Shopify-specific fields
}
```

**After (Platform-generic):**
```typescript
interface OrderCreatedPayload {
  shopId: string;
  source: PlatformSource;
  externalOrderId: string;
  externalOrderNumber: string;
  // ... platform-agnostic fields
}
```

**Webhook Normalization:**
```typescript
// Shopify webhook handler
async function handleShopifyOrderCreated(payload: ShopifyOrderPayload) {
  // Transform Shopify payload to generic format
  const normalized: OrderCreatedPayload = {
    shopId: getShopIdFromShopifyDomain(payload.domain),
    source: PlatformSource.SHOPIFY,
    externalOrderId: payload.id.toString(),
    externalOrderNumber: payload.order_number.toString(),
    // ... map other fields
  };

  await eventBus.emit("order.created", normalized);
}

// WooCommerce webhook handler (future)
async function handleWooOrderCreated(payload: WooOrderPayload) {
  const normalized: OrderCreatedPayload = {
    shopId: getShopIdFromWooUrl(payload.site_url),
    source: PlatformSource.WOOCOMMERCE,
    externalOrderId: payload.id.toString(),
    externalOrderNumber: payload.number,
    // ... map other fields
  };

  await eventBus.emit("order.created", normalized);
}
```

**Queue Consumer (Platform-agnostic):**
```typescript
// Consumer doesn't care which platform order came from
async function processOrderCreated(payload: OrderCreatedPayload) {
  const order = await db.order.create({
    data: {
      shopId: payload.shopId,
      source: payload.source,
      externalOrderId: payload.externalOrderId,
      externalOrderNumber: payload.externalOrderNumber,
      // ... other fields
    },
  });

  // Emit downstream events (shipping, notifications, etc.)
  // All downstream services use same payload format
  await notificationQueue.enqueue({
    orderId: order.id,
    source: order.source,  // Available for platform-specific logic if needed
    // ...
  });
}
```

### 4. Consumer Code Updates

**Before (Shopify-specific queries):**
```typescript
// apps/api/src/services/order.ts
const order = await db.order.findUnique({
  where: {
    shopId_shopifyOrderId: {  // PROBLEM: Hardcoded Shopify constraint
      shopId,
      shopifyOrderId,
    },
  },
});
```

**After (Platform-agnostic queries):**
```typescript
// apps/api/src/services/order.ts
const order = await db.order.findUnique({
  where: {
    shopId_externalOrderId_source: {  // NEW: Source discriminator
      shopId,
      externalOrderId,
      source: PlatformSource.SHOPIFY,  // Explicitly specified
    },
  },
});
```

**Or with helper function:**
```typescript
// packages/core/src/db/helpers.ts
export function getOrderByExternalId(
  shopId: string,
  externalOrderId: string,
  source: PlatformSource = PlatformSource.SHOPIFY
) {
  return db.order.findUnique({
    where: {
      shopId_externalOrderId_source: { shopId, externalOrderId, source },
    },
  });
}

// Usage
const order = await getOrderByExternalId(shopId, externalOrderId);
```

### 5. Type Safety with TypeScript

**Discriminated Union Pattern (for future platform-specific logic):**
```typescript
type OrderByPlatform =
  | { source: PlatformSource.SHOPIFY; shopifyMetadata: ShopifyOrderMeta }
  | { source: PlatformSource.WOOCOMMERCE; wooMetadata: WooOrderMeta }
  | { source: PlatformSource.MAGENTO; magentoMetadata: MagentoOrderMeta };

function processPlatformSpecificLogic(order: OrderByPlatform) {
  if (order.source === PlatformSource.SHOPIFY) {
    // order.shopifyMetadata is available here
    console.log(order.shopifyMetadata);
  } else if (order.source === PlatformSource.WOOCOMMERCE) {
    console.log(order.wooMetadata);
  }
}
```

**Optional: Extend Order type per platform:**
```typescript
// Future: If needed for platform-specific fields
interface Order {
  id: string;
  source: PlatformSource;
  // ... shared fields
  metadata: Record<string, unknown>;  // Platform-specific data stored here
}
```

### 6. Migration Strategy

**Phase 1 (Sprint 3.4): Data Model + Basic Refactoring**
1. Create Prisma migration: rename columns, add source enum
2. Update Prisma schema
3. Generate new Prisma client
4. Update all Query sites (findUnique, findMany, etc.)
5. Update all Create sites (insert new orders, products)
6. Update tests
7. Shopify webhook handler: no changes (already uses externalOrderId)
8. Deploy Phase 1 with feature flag

**Phase 2 (Q2 2026): WooCommerce Integration**
1. Build WooCommerce webhook normalizer
2. Add WooCommerce configuration to Shop model
3. Implement WooCommerce OAuth flow
4. Test end-to-end WooCommerce order processing
5. Deploy Phase 2

**Database Migration (Detailed):**
```sql
-- Step 1: Add new columns
ALTER TABLE orders ADD COLUMN external_order_id TEXT;
ALTER TABLE orders ADD COLUMN external_order_number TEXT;
ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'SHOPIFY';

-- Step 2: Copy data from old columns
UPDATE orders SET external_order_id = shopify_order_id;
UPDATE orders SET external_order_number = shopify_order_number;

-- Step 3: Drop old unique constraint
ALTER TABLE orders DROP CONSTRAINT orders_shop_id_shopify_order_id_key;

-- Step 4: Add new unique constraint with source
ALTER TABLE orders ADD UNIQUE (shop_id, external_order_id, source);

-- Step 5: Make new columns non-nullable
ALTER TABLE orders ALTER COLUMN external_order_id SET NOT NULL;

-- Step 6: Drop old columns (after verification)
ALTER TABLE orders DROP COLUMN shopify_order_id;
ALTER TABLE orders DROP COLUMN shopify_order_number;

-- Repeat for products, customers, collections
```

### 7. Default Platform = SHOPIFY

**Key Decision:** Default `source = SHOPIFY` for backward compatibility
- Existing Shopify shops don't need migration of the source column
- Queries will include Shopify default if not specified
- WooCommerce shops explicitly set `source = WOOCOMMERCE`

```typescript
// Shopify orders implicitly have source = SHOPIFY
const shopifyOrders = await db.order.findMany({
  where: {
    shopId,
    source: PlatformSource.SHOPIFY,  // Can be explicit
  },
});

// Can also query by source
const allOrders = await db.order.findMany({
  where: { shopId },
  // Returns all sources (SHOPIFY, WOOCOMMERCE, etc.)
});
```

---

## Consequences

### Positive

1. **Multi-Platform Support Enabled**
   - Single data model supports Shopify, WooCommerce, Magento, Custom
   - No schema explosion (no `wooCustomerId`, `magentoCustomerId` columns)
   - Query logic remains constant across platforms

2. **Type Safety**
   - `PlatformSource` enum prevents string typos
   - `isPlatformSource()` guard validates at runtime
   - TypeScript discriminated unions for platform-specific logic

3. **Competitive Parity**
   - Matches Fleetbase's platform-agnostic architecture
   - Enables sales pitch: "Works with all e-commerce platforms"
   - Positions Witylogix for mid-market growth

4. **Clearer Semantics**
   - `externalOrderId` is unambiguous (works for any platform)
   - `shopifyOrderId` was confusing (which shop? Shopify or Witylogix?)
   - Code intent is clearer

5. **Easier Testing**
   - Can test same business logic with different platform sources
   - Eliminates Shopify-specific test branches
   - Mocks work identically across platforms

6. **Future-Proof**
   - Adding new platform only needs normalizer (no schema change)
   - Consumer code doesn't change when new platform added
   - Event payloads work identically for all platforms

### Negative

1. **Breaking Change to Schema**
   - Existing unique constraints must be updated
   - All queries referencing `shopifyOrderId` break until updated
   - Database migration must be executed carefully
   - Risk: Data corruption if migration runs twice

   **Mitigation:**
   - Comprehensive pre-migration backup
   - Test migration in staging first
   - Rolled-out migration with rollback plan
   - Monitor order lookups post-deployment

2. **Query Complexity Increases Slightly**
   - Unique constraint now includes `source` discriminator
   - Queries must always specify source (or use helper)
   - Risk: Forgetting to add source filter returns wrong data

   **Mitigation:**
   - Add TypeScript linter rule to catch missing source
   - Create `getOrderByExternalId()` helper function
   - Code review checklist: "Does query include source?"

3. **Consumer Code Refactoring**
   - 40+ locations need query updates
   - 20+ test files need updates
   - Risk: Missed locations cause runtime errors

   **Mitigation:**
   - Automated search/replace for common patterns
   - Comprehensive integration testing
   - Staged rollout with feature flag

4. **Dual Maintenance During Phase 1**
   - Code must support both old field names and new ones temporarily
   - Adds complexity: migration shim layer
   - Risk: Bugs in shim affect all platforms

   **Mitigation:**
   - Keep shim minimal (only field rename, not logic)
   - Remove shim immediately after Phase 1

### Trade-offs

| Aspect | With Abstraction | Without Abstraction |
|--------|------------------|---------------------|
| **Schema Cleanliness** | Single table per entity | Duplicate columns per platform |
| **Query Complexity** | Slightly higher (include source) | Simple (platform-agnostic) |
| **Adding New Platform** | Update normalizer only | Update schema + consumers |
| **TAM** | 60+ platforms possible | Shopify only (15% market) |
| **Competitive Position** | Parity with Fleetbase | Behind competitors |
| **Refactoring Effort** | High (Phase 1) | Zero |

---

## Alternatives Considered

### A1: Keep Shopify-Specific Model, Separate Tables per Platform

**Approach:** Create `Order`, `WooOrder`, `MagentoOrder` tables with shared interface

**Pros:**
- Minimal schema changes
- Shopify logic isolated
- Easy to add platform-specific fields

**Cons:**
- Table explosion (3 tables per entity: Order, WooOrder, MagentoOrder)
- Consumer code must know which table to query
- Duplication of indexes and constraints
- Difficult cross-platform queries
- **Rejected because:** Violates DRY, doesn't scale to 10+ platforms, consumer complexity

### A2: Generic JSON Blob for Platform IDs

**Approach:** Store all external IDs in JSON, no `source` column

```prisma
model Order {
  externalIds Json  // { "shopify": "123", "woo": "456" }
}
```

**Pros:**
- No schema changes needed
- Platform IDs co-located

**Cons:**
- No type safety (runtime errors)
- Can't index on external ID (no unique constraint)
- Queries become complex (JSON path syntax)
- Can't use in findUnique()
- **Rejected because:** No type safety, difficult to query, can't enforce uniqueness

### A3: Platform-Specific Subclasses

**Approach:** Use inheritance (ShopifyOrder extends Order)

**Pros:**
- Encapsulation of platform-specific logic
- OOP pattern

**Cons:**
- Prisma doesn't support inheritance well
- Adds table complexity
- Queries become complex
- **Rejected because:** Not a good fit for Prisma ORM

### A4: Keep Both Names (shopifyOrderId + externalOrderId)

**Approach:** Support both field names during transition

```prisma
model Order {
  externalOrderId String
  shopifyOrderId  String  // Deprecated alias
  source          String
}
```

**Pros:**
- Zero-downtime transition
- Gradual deprecation
- Backwards compatibility

**Cons:**
- Database bloat (duplicate data)
- Confusing for new developers
- Migration complexity (keep in sync)
- **Rejected because:** Adds permanent technical debt, not worth the complexity

### A5: Separate Database per Platform (Multi-Tenancy)

**Approach:** Each platform has own database shard

**Pros:**
- Complete platform isolation
- Easier scaling per platform

**Cons:**
- Operational complexity (manage multiple DBs)
- Cross-platform queries impossible
- Deployment complexity
- **Rejected because:** Overkill for current scale, doesn't match architecture

---

## Implementation Plan

### Phase 1: Data Model + Refactoring (Sprint 3.4)

**Week 1: Preparation**
1. Create feature branch: `adr-014/phase-1-abstraction`
2. Create Prisma migration file
3. Update schema files:
   - `/packages/db/prisma/schema/04-orders.prisma`
   - `/packages/db/prisma/schema/25-cache-models.prisma` (Product, Customer)
4. Create `/packages/types/src/platform.ts` with enums and helpers
5. Regenerate Prisma client: `pnpm db:generate`

**Week 2: Consumer Updates**
1. Find all `shopifyOrderId` references:
   ```bash
   grep -r "shopifyOrderId\|shopifyProductId\|shopifyCustomerId" \
     --include="*.ts" --include="*.tsx" apps/ packages/
   ```
2. Update queries to use new constraint names and `source` parameter
3. Update webhook handlers (ensure they already use `externalOrderId`)
4. Create migration shim if needed for backward compatibility

**Week 3: Testing**
1. Update unit tests: 30+ test files
   - Order creation tests
   - Product sync tests
   - Customer lookup tests
2. Update integration tests
3. Add new tests for source field
4. Load testing: 1000 order lookups/sec

**Week 4: Deployment**
1. Code review and approval
2. Merge to main
3. Deploy to staging (no schema changes yet)
4. Run full integration tests in staging
5. Prepare database migration script
6. Deploy to production with migration
7. Monitor for errors

### Phase 2: WooCommerce Integration (Q2 2026)

1. Build WooCommerce webhook normalizer
2. Add WooCommerce source handling in consumers
3. End-to-end testing with staging WooCommerce shop

### Test Coverage

**Unit Tests:**
- `PlatformSource` enum: All values valid
- `isPlatformSource()` guard: Validates correctly
- Order creation: source defaults to SHOPIFY
- Product lookup: respects source parameter
- Customer queries: filters by source

**Integration Tests:**
- Order created with source=SHOPIFY: findUnique works
- Product sync with source=SHOPIFY: cache works
- Customer lookup: finds correct source
- Migration preserves data: before/after counts match

**Migration Tests:**
- Data migration: 100% of records have source = SHOPIFY
- Unique constraints: no duplicates on (shopId, externalId, source)
- Old unique constraint removed: no orphaned indexes
- Rollback: old data restored correctly

---

## Validation and Testing

### Unit Test Examples

```typescript
// packages/types/src/platform.test.ts
describe("PlatformSource", () => {
  test("isPlatformSource validates enum values", () => {
    expect(isPlatformSource("SHOPIFY")).toBe(true);
    expect(isPlatformSource("WOOCOMMERCE")).toBe(true);
    expect(isPlatformSource("invalid")).toBe(false);
  });

  test("PlatformSource has all expected values", () => {
    expect(Object.keys(PlatformSource)).toEqual([
      "SHOPIFY",
      "WOOCOMMERCE",
      "MAGENTO",
      "CUSTOM",
    ]);
  });
});

// apps/api/src/services/order.test.ts
describe("getOrderByExternalId", () => {
  test("finds order by external ID and source", async () => {
    const order = await db.order.create({
      data: {
        shopId: "shop-123",
        externalOrderId: "gid://shopify/Order/123",
        source: "SHOPIFY",
      },
    });

    const found = await getOrderByExternalId("shop-123", "gid://shopify/Order/123");
    expect(found).toEqual(order);
  });

  test("includes source in query", async () => {
    // Verify that source is required in findUnique
    const query = db.order.findUnique({
      where: {
        shopId_externalOrderId_source: {
          shopId: "shop-123",
          externalOrderId: "gid://shopify/Order/123",
          source: "SHOPIFY",
        },
      },
    });

    expect(query).toBeDefined();
  });
});
```

### Integration Test Examples

```typescript
// apps/api/src/workers/webhook.test.ts
describe("Webhook Normalization", () => {
  test("Shopify webhook handler normalizes payload", async () => {
    const shopifyPayload = {
      id: "123456789",
      order_number: 1001,
      domain: "test-shop.myshopify.com",
    };

    const normalized = await normalizeShopifyOrder(shopifyPayload);

    expect(normalized).toEqual({
      shopId: expect.any(String),
      source: "SHOPIFY",
      externalOrderId: "123456789",
      externalOrderNumber: "1001",
    });
  });

  test("Order created from normalized payload has source", async () => {
    const normalized = {
      shopId: "shop-123",
      source: "SHOPIFY",
      externalOrderId: "123",
      externalOrderNumber: "1001",
    };

    const order = await db.order.create({
      data: {
        ...normalized,
      },
    });

    expect(order.source).toBe("SHOPIFY");
    expect(order.externalOrderId).toBe("123");
  });
});
```

### Migration Verification

```typescript
// scripts/verify-migration.ts
async function verifyMigration() {
  // Check: All orders have source set
  const nullSources = await db.order.count({
    where: { source: null },
  });
  console.assert(nullSources === 0, "Found orders with null source");

  // Check: Unique constraint on new field
  const duplicates = await db.$queryRaw`
    SELECT shop_id, external_order_id, source, COUNT(*) as count
    FROM orders
    GROUP BY shop_id, external_order_id, source
    HAVING COUNT(*) > 1
  `;
  console.assert(
    duplicates.length === 0,
    "Found duplicate (shopId, externalOrderId, source)"
  );

  // Check: Old column removed
  const hasOldColumn = await db.$queryRaw`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'orders'
      AND column_name = 'shopify_order_id'
    )
  `;
  console.assert(!hasOldColumn, "Old column not removed");

  console.log("Migration verification passed");
}
```

---

## Reference

### Related ADRs

- **ADR-012** — Notification Provider Architecture (similar pattern: provider abstraction)
- **ADR-010** — Event Bus Architecture (event normalization)
- **ADR-009** — Medusa-Inspired Architecture (service structure)
- **ADR-008** — Auth Provider Abstraction (enum-based provider selection)

### Implementation Files

**Schema:**
- `/packages/db/prisma/schema/04-orders.prisma` — Order model changes
- `/packages/db/prisma/schema/25-cache-models.prisma` — Product, Customer changes

**Types:**
- `/packages/types/src/platform.ts` — PlatformSource enum and helpers (NEW)
- `/packages/types/src/index.ts` — Export PlatformSource

**Consumers:**
- `/apps/api/src/services/order.ts` — Order queries
- `/apps/api/src/services/product.ts` — Product queries
- `/apps/api/src/services/customer.ts` — Customer queries
- `/apps/api/src/workers/webhook.ts` — Webhook handlers
- `/packages/core/src/db/helpers.ts` — Query helpers (NEW)

**Tests:**
- `/apps/api/src/**/*.test.ts` — All consumer tests
- `/packages/types/src/platform.test.ts` — Enum tests (NEW)

**Database:**
- `/packages/db/prisma/migrations/[timestamp]_platform_source_abstraction/` — Migration (NEW)

### External References

- [Prisma Unique Constraints](https://www.prisma.io/docs/orm/reference/prisma-schema-reference#unique)
- [Prisma Enums](https://www.prisma.io/docs/orm/reference/prisma-schema-reference#enum)
- [TypeScript Discriminated Unions](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions)
- [Fleetbase Architecture](https://fleetbase.io/docs)

---

## Approval and Timeline

- **Approved By:** Arjun (CTO)
- **Approved Date:** 2026-03-08
- **Implementation Start:** Sprint 3.4 (2026-03-08)
- **Phase 1 Deadline:** End of Sprint 3.4 (2026-03-22)
- **Phase 2 Deadline:** End of Q2 (2026-06-30)
- **Rollout:** Phase 1 → staging (2026-03-20) → production (2026-03-22)
- **WooCommerce Launch:** Q2 2026 (2026-06-30)

---

## Decision Record

**Approved:** Yes ✓
**Implementation:** Phase 1 (Sprint 3.4) → Phase 2 (Q2 2026)
**Impact:** Breaking change to data model, significant refactoring, high strategic value
**Risk:** Medium-High (data migration, query updates)
**Monitoring:** Order lookup performance, source distribution across platforms
