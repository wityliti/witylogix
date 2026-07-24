# Database Data Dictionary

## Enums & Status Values

### Order Status

```
PENDING       → Order created, awaiting confirmation
ACCEPTED      → Shop accepted order for fulfillment
ASSIGNED      → Driver assigned to deliver order
PICKED_UP     → Order picked from warehouse/store
OUT_FOR_DELIVERY → Driver en route to customer
ARRIVED       → Driver at delivery location
DELIVERED     → Order successfully delivered + POD captured
FAILED        → Delivery attempt failed (wrong address, customer unavailable, etc.)
RETURNED      → Order returned to warehouse
CANCELLED     → Order cancelled by customer or shop
```

**Workflow:** PENDING → ACCEPTED → ASSIGNED → PICKED_UP → OUT_FOR_DELIVERY → ARRIVED → DELIVERED (or FAILED)

---

### Shipment Status

```
PENDING           → Shipment created, awaiting processing
PROCESSING        → Being prepared at origin warehouse
READY_FOR_PICKUP  → Packaged and ready, awaiting driver/carrier pickup
PICKED_UP         → Driver/carrier collected from origin
IN_TRANSIT        → In transit to destination
OUT_FOR_DELIVERY  → Final-mile delivery in progress
ARRIVED           → Driver at delivery location
DELIVERED         → Successfully delivered + POD captured
FAILED            → Delivery attempt failed
RETURNED          → Returned to origin warehouse
CANCELLED         → Cancelled before delivery
```

**Workflow:** PENDING → PROCESSING → READY_FOR_PICKUP → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → ARRIVED → DELIVERED (or FAILED → RETURNED)

---

### Delivery Method

```
LOCAL_DELIVERY     → In-house fleet delivers (use Driver table)
STORE_PICKUP       → Customer picks up from physical store
STANDARD_SHIPPING  → Third-party carrier (UPS, FedEx, etc.) - standard speed
EXPRESS_SHIPPING   → Third-party carrier - expedited/overnight
SAME_DAY           → Same-day in-house delivery
```

---

### Driver Status

```
OFFLINE            → Not available (off-duty, break time)
AVAILABLE          → Ready to accept deliveries
ON_ROUTE           → Currently delivering orders
ON_BREAK           → Break/meal period (can resume if needed)
```

---

### Vehicle Type

```
BICYCLE            → Bike delivery (for last-mile urban delivery)
MOTORCYCLE         → Motorbike (fast, lightweight)
CAR                → Standard car (typical)
VAN                → Large van (bulk deliveries)
TRUCK              → Large truck (bulk/wholesale)
```

---

### Route Status

```
DRAFT              → Route created but not optimized
OPTIMIZED          → Route optimized, stops sequenced efficiently
ASSIGNED           → Route assigned to driver
IN_PROGRESS        → Driver started delivery route
COMPLETED          → All stops completed
CANCELLED          → Route cancelled
```

---

### Stop Type & Status

**Stop Type:**

```
PICKUP             → Pickup from warehouse/vendor
DELIVERY           → Delivery to customer
RETURN             → Return pickup (RMA, refund, etc.)
DEPOT              → Depot/warehouse stop (break, fuel, etc.)
```

**Stop Status:**

```
PENDING            → Not yet started
EN_ROUTE           → Driver en route to stop
ARRIVED            → Driver at stop location
COMPLETED          → Stop completed (delivered, picked up, etc.)
SKIPPED            → Stop skipped (unavailable customer, vehicle full, etc.)
FAILED             → Stop failed (delivery refused, address error, etc.)
```

---

### User Role

```
SUPER_ADMIN        → Platform admin (all shops)
ADMIN              → Shop admin (manage shop, drivers, zones)
DISPATCHER         → Route and delivery management
VIEWER             → Read-only access to dashboard
```

---

### Organization Role

```
OWNER              → Full control: billing, add/remove shops, manage members
ADMIN              → Manage all shops, drivers, zones within org
MEMBER             → Access only assigned shops (via shop_ids field)
```

---

### Message Channel

```
EMAIL              → Email (standard SMTP)
SMS                → Short Message Service (text)
WHATSAPP           → WhatsApp Business API
PUSH               → Push notification (mobile app)
IN_APP             → In-application notification
```

---

### Message Delivery Status

```
QUEUED             → Waiting in queue to be sent
SENDING            → Currently being sent to provider
SENT               → Accepted by provider (not yet confirmed delivered)
DELIVERED          → Confirmed delivered by provider
FAILED             → Permanent failure after retries
BOUNCED            → Email or SMS bounced (invalid address)
OPENED             → Email opened (if tracking enabled)
CLICKED            → Email link clicked or push tapped
```

---

### Message Priority

```
LOW                → Non-urgent (newsletter, digest, etc.)
NORMAL             → Standard message (order updates, etc.)
HIGH               → Important (urgent delivery issue, etc.)
URGENT             → Critical (security alert, payment issue, etc.)
```

---

### Plan Tier

```
FREE               → Free/trial plan (limited features, quota)
STARTER            → Entry-level paid plan
GROWTH             → Mid-tier paid plan
ENTERPRISE         → Custom enterprise plan (unlimited, dedicated support)
```

---

### Subscription Status

```
trialing           → Free trial period (no payment yet)
active             → Active subscription, current on payments
past_due           → Payment overdue (still has grace period)
cancelled          → Subscription cancelled by user or system
expired            → Subscription period ended
```

---

### Invoice Status

```
draft              → Invoice created but not finalized
finalized          → Invoice locked, awaiting payment
paid               → Payment received in full
failed             → Payment attempt failed
refunded           → Invoice refunded (partial or full)
```

---

### MFA Type

```
TOTP               → Time-based One-Time Password (Google Authenticator, Authy)
SMS                → SMS OTP sent to phone
EMAIL              → Email OTP sent to email address
```

---

### Integration Category

```
COMMUNICATION      → Email, SMS, WhatsApp, push notifications
ROUTING            → Route optimization, geocoding, mapping
ORDER_MANAGEMENT   → Inventory, fulfillment, order sync
INVENTORY          → Stock management, warehouse systems
PAYMENT            → Payment processing, billing
ANALYTICS          → Reporting, BI, analytics platforms
```

---

### Integration Auth Type

```
API_KEY            → Simple API key authentication
OAUTH              → OAuth 2.0 flow (e.g., Google, Facebook)
NONE               → No authentication needed
MULTI_CREDENTIAL   → Multiple credential types (username + password, API key + secret, etc.)
```

---

### Integration Status

```
AVAILABLE          → Ready for installation and use
COMING_SOON        → Coming in future release (visible but not installable)
BETA               → Beta/experimental (use at own risk)
DEPRECATED         → Deprecated (will be removed in future version)
```

---

### Integration Health Status

```
HEALTHY            → Integration working normally
DEGRADED           → Working but with reduced functionality or slow performance
ERROR              → Integration not working (sync failed, API error, etc.)
UNKNOWN            → Health status not yet determined or recently changed
```

---

### Integration Event Type

```
INSTALL            → Integration installed
UNINSTALL          → Integration uninstalled
SYNC               → Sync operation (e.g., pull inventory, push orders)
WEBHOOK            → Webhook received from integration
HEALTH_CHECK       → Health check performed
METER              → Usage/billing event
CONFIG_UPDATE      → Configuration changed
```

---

### Deployment Type

```
CLOUD              → Cloud-hosted deployment
SELF_MANAGED       → Self-hosted/on-premises deployment
```

---

### Distance Unit

```
KM                 → Kilometers
MILES              → Miles
```

---

### Weight Unit

```
KG                 → Kilograms
LBS                → Pounds
```

---

### Invitation Status

```
PENDING            → Invitation sent, awaiting response
ACCEPTED           → Invitation accepted by recipient
EXPIRED            → Invitation expiration deadline passed
REVOKED            → Invitation revoked by sender
```

---

### Webhook Signature Algorithm

```
HMAC_SHA256        → HMAC with SHA-256 hash
HMAC_SHA512        → HMAC with SHA-512 hash
```

---

## Special Field Types

### Geometry Fields (PostGIS)

Fields: `delivery_location`, `current_location`, `boundary`

**Format:** JSON object with latitude/longitude

```json
{
  "lat": 40.7128,
  "lng": -74.006
}
```

**PostGIS Column Type (Production):**

```
geometry(Point, 4326)    — Point with EPSG:4326 coordinate system (WGS84)
geometry(Polygon, 4326)  — Polygon for delivery zones
```

**Usage:**

```sql
-- Spatial queries (with PostGIS)
SELECT * FROM orders
WHERE ST_DWithin(
  ST_GeomFromText('POINT(-74.0060 40.7128)', 4326),
  delivery_location,
  5000  -- 5km radius
);

-- Distance calculation
SELECT order_id, ST_Distance(
  delivery_location::geography,
  ST_GeomFromText('POINT(-74.0060 40.7128)', 4326)::geography
) as distance_meters
FROM orders;
```

---

### JSON Fields

Fields: `settings`, `metadata`, `credentials`, `config`, `line_items`, `dimensions`

**Example: line_items (Order/Shipment)**

```json
[
  {
    "sku": "ITEM-001",
    "name": "T-Shirt",
    "quantity": 2,
    "price": 29.99,
    "variantId": "gid://shopify/ProductVariant/123"
  },
  {
    "sku": "ITEM-002",
    "name": "Jeans",
    "quantity": 1,
    "price": 79.99,
    "variantId": "gid://shopify/ProductVariant/456"
  }
]
```

**Example: dimensions (Shipment)**

```json
{
  "length": 30,
  "width": 20,
  "height": 15,
  "unit": "cm"
}
```

**Example: settings (Organization/Shop)**

```json
{
  "enableSameDay": true,
  "maxDeliveryRadius": 50,
  "autoAssignDriver": false,
  "notificationPreferences": {
    "sms": true,
    "email": true,
    "whatsapp": false
  }
}
```

**Querying JSON Fields:**

```sql
-- Extract nested value
SELECT order_id, line_items->0->>'name' as first_item_name
FROM orders;

-- Check if key exists
SELECT * FROM shops WHERE settings ? 'enableSameDay';

-- Filter by JSON value
SELECT * FROM campaigns WHERE settings->>'type' = 'promotional';
```

---

### Encrypted Fields

Fields: `shopify_access_token`, `password`, `secret`, `credentials`, `access_token`, `webhook_secret`

**Storage:** Encrypted at application layer (never stored in plaintext)

**Encryption Strategy:**

```
1. At application layer: AES-256-GCM or similar
2. Key management: Use environment variables or external KMS
3. Never log or expose in queries
4. Always transmit over HTTPS
```

**Best Practices:**

```sql
-- Don't return encrypted field unless necessary
SELECT id, shopify_domain, shopify_shop_id FROM shops;  -- Good
-- vs.
SELECT * FROM shops;  -- Avoid (includes encrypted token)

-- For auditing, use hash instead
SELECT id, SHA256(shopify_access_token) FROM shops;
```

---

### Array Fields

Fields: `tags`, `shop_ids`, `scopes`, `day_of_week`, `goals`, `completed_steps`, `backup_codes`

**Format:** PostgreSQL `TEXT[]` or `UUID[]`

**Example: tags (Order/Shipment)**

```
['rush', 'fragile', 'signature_required']
```

**Example: scopes (API Key)**

```
['shipments:read', 'routes:write', 'webhooks:*', 'drivers:read']
```

**Example: daysOfWeek (TimeSlot)**

```
[0, 1, 2, 3, 4]  -- Sunday through Thursday
-- or --
[1, 2, 3, 4, 5]  -- Monday through Friday
```

**Querying Array Fields:**

```sql
-- Check if element exists
SELECT * FROM orders WHERE 'rush' = ANY(tags);

-- Array length
SELECT order_id, array_length(tags, 1) as tag_count FROM orders;

-- Remove element
UPDATE orders SET tags = array_remove(tags, 'processed') WHERE id = '...';

-- Add element
UPDATE orders SET tags = array_append(tags, 'archived') WHERE id = '...';
```

---

## Naming Conventions

### Table Names

- **Plural, snake_case:** `orders`, `shipments`, `delivery_zones`
- **Junction tables:** `org_members`, `role_permissions` (both entities named)

### Column Names

- **Snake_case:** `created_at`, `updated_at`, `shop_id`
- **FK columns:** `<entity>_id` (e.g., `order_id`, `driver_id`)
- **Boolean fields:** `is_*` or `has_*` (e.g., `is_active`, `is_verified`, `has_signature`)
- **Timestamp fields:** `*_at` (e.g., `created_at`, `delivered_at`, `last_location_at`)
- **Rate/price fields:** Decimal(10,2) with `_rate` or `_price` suffix (e.g., `base_rate`, `total_price`)
- **Quantity/count fields:** Integer with no suffix or `_count` (e.g., `item_count`, `max_capacity`)

### Index Naming (Auto-Generated by Prisma)

```
<table>_<column1>_<column2>_idx  (e.g., orders_shop_id_status_idx)
<table>_<column>_key             (unique index)
```

---

## Soft Delete Patterns

### Pattern 1: `is_active` Flag (Boolean)

Most entities use this pattern:

```prisma
model Organization {
  id        String   @id
  isActive  Boolean  @default(true) @map("is_active")
}
```

**Query Pattern:**

```sql
-- Always filter soft-deleted records
SELECT * FROM organizations WHERE is_active = true;

-- OR use view
CREATE OR REPLACE VIEW organizations_active AS
SELECT * FROM organizations WHERE is_active = true;

-- Then query view
SELECT * FROM organizations_active;
```

### Pattern 2: `deleted_at` Timestamp (Explicit Date)

Used for compliance/audit tracking:

```prisma
model AuditLog {
  id        String    @id
  deletedAt DateTime? @map("deleted_at")
}
```

**Query Pattern:**

```sql
-- Soft-deleted
SELECT * FROM audit_logs WHERE deleted_at IS NULL;

-- Permanently deleted (before retention period)
SELECT * FROM audit_logs WHERE deleted_at < NOW() - INTERVAL '90 days';
```

### Pattern 3: `uninstalled_at` (Shop-Specific)

Shop has explicit uninstall timestamp:

```prisma
model Shop {
  uninstalledAt DateTime? @map("uninstalled_at")
}
```

**Indicates:** Shop uninstalled the app (soft delete) on this date

---

## Timestamp Conventions

### Standard Fields (All Models)

| Column       | Type     | Mutable | Purpose                                  |
| ------------ | -------- | ------- | ---------------------------------------- |
| `created_at` | DateTime | No      | Creation timestamp, set once             |
| `updated_at` | DateTime | Yes     | Last modification, updated automatically |

**Timezone:** UTC (stored as timestamp with timezone)

**Format:** ISO 8601 (2026-03-16T14:30:00Z)

**Example:**

```sql
SELECT order_id, created_at, updated_at FROM orders LIMIT 1;
-- order_id          | created_at                | updated_at
-- xxxxxxxx...      | 2026-03-15T10:30:00+00:00 | 2026-03-16T14:30:00+00:00
```

### Event-Specific Timestamps

| Event           | Column             | Purpose                              |
| --------------- | ------------------ | ------------------------------------ |
| Order delivered | `actual_delivery`  | When POD was captured                |
| Shipment picked | `picked_up_at`     | When driver collected from warehouse |
| Route started   | `started_at`       | When driver began route              |
| Route completed | `completed_at`     | When driver finished route           |
| Driver location | `last_location_at` | Last GPS position update             |
| Invoice paid    | `paid_at`          | When payment received                |
| Session login   | `last_activity_at` | Last user action                     |

---

## Cross-Reference Queries

### Find Orders with Shipments

```sql
SELECT o.id, o.external_order_id, o.status,
       COUNT(s.id) as shipment_count,
       ARRAY_AGG(s.status) as shipment_statuses
FROM orders o
LEFT JOIN shipments s ON o.id = s.order_id
WHERE o.shop_id = 'SHOP_UUID'
GROUP BY o.id
ORDER BY o.created_at DESC;
```

### Find Drivers with Active Routes

```sql
SELECT d.id, d.name, d.status,
       COUNT(DISTINCT r.id) as active_routes,
       COUNT(DISTINCT rs.id) as remaining_stops
FROM drivers d
LEFT JOIN routes r ON d.id = r.driver_id AND r.status IN ('IN_PROGRESS', 'OPTIMIZED')
LEFT JOIN route_stops rs ON r.id = rs.route_id AND rs.status != 'COMPLETED'
WHERE d.shop_id = 'SHOP_UUID'
GROUP BY d.id
ORDER BY d.name;
```

### Find Orders in Delivery Zone

```sql
SELECT o.id, o.customer_name, o.address_line1,
       dz.name as zone_name, dz.base_rate
FROM orders o
JOIN delivery_zones dz ON o.shop_id = dz.shop_id
WHERE o.shop_id = 'SHOP_UUID'
  AND o.delivery_location <> 'null'
  -- Requires PostGIS:
  -- AND ST_Contains(dz.boundary::geometry, o.delivery_location::geometry)
ORDER BY o.delivery_date;
```

---

## Data Validation Rules

### Order

- `external_order_id`: Not null, unique per shop+platform
- `customer_phone`: Must be valid phone format (E.164 or regional)
- `postal_code`: Must match country/region format
- `total_price`: Must be >= 0
- `status`: Must be valid OrderStatus enum

### Shipment

- `shipment_number`: Unique per shop, human-readable (SHP-1001)
- `tracking_number`: If set, must be unique per carrier
- `weight`: Must be > 0 if set
- `item_count`: Must be >= 1
- `status`: Must be valid ShipmentStatus enum

### Driver

- `phone`: Must be valid, unique per org/shop
- `max_capacity`: Must be > 0
- `vehicle_type`: Must be valid VehicleType enum
- `status`: Must be valid DriverStatus enum

### User

- `email`: Valid email format, unique per shop
- `role`: Must be valid UserRole enum
- `password`: Must meet security requirements (if not OAuth)

### API Key

- `prefix`: First 8 chars of key, must be unique
- `key_hash`: Bcrypt/Argon2 hash, never plaintext
- `scopes`: Must match known permission scopes
- `expires_at`: If set, must be in future

---

## Performance Tips

### Indexes for Common Queries

```sql
-- Shop isolation (RLS primary index)
CREATE INDEX idx_orders_shop_id ON orders(shop_id);

-- Status filtering
CREATE INDEX idx_orders_status ON orders(status);

-- Date range queries
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Combined queries (most common)
CREATE INDEX idx_orders_shop_status_date ON orders(shop_id, status, created_at DESC);

-- Unique lookups
CREATE UNIQUE INDEX idx_orders_tracking_token ON orders(tracking_token);
```

### Query Optimization

```sql
-- ✅ Good: Indexed columns only
SELECT * FROM orders WHERE shop_id = 'X' AND status = 'DELIVERED' ORDER BY created_at DESC LIMIT 10;

-- ❌ Bad: Unindexed JSON field in WHERE clause
SELECT * FROM orders WHERE metadata->>'priority' = 'high';

-- ✅ Better: Use computed column or materialized view
CREATE INDEX idx_orders_priority ON orders USING GIN ((metadata->>'priority'));
```

---

## Common Data Issues & Fixes

### Issue: Duplicate Order Imports

**Symptom:** Same `external_order_id` from Shopify imported multiple times

**Fix:**

```sql
-- Find duplicates
SELECT external_order_id, COUNT(*) FROM orders
WHERE shop_id = 'X'
GROUP BY external_order_id
HAVING COUNT(*) > 1;

-- Keep latest, delete older
DELETE FROM orders o
WHERE id IN (
  SELECT id FROM orders
  WHERE external_order_id IN (SELECT external_order_id FROM orders WHERE shop_id = 'X' GROUP BY external_order_id HAVING COUNT(*) > 1)
  AND id NOT IN (
    SELECT DISTINCT ON (external_order_id) id FROM orders
    WHERE shop_id = 'X'
    ORDER BY external_order_id, created_at DESC
  )
);
```

### Issue: Stale Delivery Zones

**Symptom:** Orders assigned to inactive zones

**Fix:**

```sql
-- Find orders in inactive zones
SELECT o.id FROM orders o
JOIN delivery_zones dz ON dz.id = o.zone_id
WHERE dz.is_active = false AND o.status IN ('PENDING', 'ASSIGNED');

-- Reassign or update zone
UPDATE orders SET zone_id = NULL WHERE id IN (...);
```

---

## Data Export/Import

### Safe Export (PII Redaction)

```sql
-- Export orders without sensitive customer data
SELECT order_id, status, total_price, created_at
FROM orders
WHERE shop_id = 'X'
  AND created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 10000;

-- Export to CSV
\copy (SELECT ...) TO '/tmp/orders.csv' WITH CSV HEADER;
```

### Bulk Import

```sql
-- COPY from CSV (fastest)
COPY orders(id, shop_id, external_order_id, status, created_at)
FROM '/tmp/orders.csv'
WITH (FORMAT CSV, HEADER);

-- Or use Prisma for validation
pnpm ts-node scripts/bulk-import-orders.ts < orders.csv
```
