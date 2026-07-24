# Witylogix Database Schema Documentation

## Overview

The Witylogix platform uses **PostgreSQL 16** with **Prisma 6** as the ORM. The schema is modular, split across multiple `.prisma` files for maintainability. PostGIS is enabled in production for geospatial queries (geometry types for delivery zones and locations).

**Current Stats:**

- ~55+ Prisma models
- Multi-tenant architecture with Organizations → Shops → Data hierarchy
- Row-Level Security (RLS) policies via SQL migrations
- Soft-delete patterns via `deletedAt` timestamps
- Enum-based status tracking for complex entities

**Key Features:**

- Multi-shop merchant support via Organization grouping
- Org-level and shop-level entity scoping (drivers, zones, shipments)
- Comprehensive auth system with MFA, sessions, and API keys
- Integrated billing, messaging, and integration marketplace
- Webhook and integration event tracking for audit trails

---

## Core Models (Tenant Hierarchy)

### Organization

**Table:** `organizations`

Represents a business entity that can manage multiple Shopify stores or standalone shops.

| Column       | Type     | Nullable | Default             | Description                                          |
| ------------ | -------- | -------- | ------------------- | ---------------------------------------------------- |
| `id`         | UUID     | No       | `gen_random_uuid()` | Primary key                                          |
| `name`       | String   | No       | —                   | Organization legal name                              |
| `slug`       | String   | No       | —                   | URL-safe unique identifier (e.g., "acme-logistics")  |
| `email`      | String   | Yes      | —                   | Billing contact email                                |
| `plan_tier`  | Enum     | No       | `FREE`              | Subscription tier: FREE, STARTER, GROWTH, ENTERPRISE |
| `settings`   | JSON     | No       | `{}`                | Org-wide configuration: branding, notification prefs |
| `is_active`  | Boolean  | No       | `true`              | Soft activation flag                                 |
| `created_at` | DateTime | No       | `now()`             | Creation timestamp                                   |
| `updated_at` | DateTime | No       | `now()`             | Last modification timestamp                          |

**Indexes:**

- Primary: `id`
- Unique: `slug`

**RLS Policy:** `app.current_org_id = org_id`

**Relations:**

- `shops` (one-to-many): Shops within this org
- `orgMembers` (one-to-many): Users with org access
- `drivers` (one-to-many): Shared drivers across shops
- `deliveryZones` (one-to-many): Org-level delivery zones
- `locations` (one-to-many): Shared origin/depot locations
- `authProviders` (one-to-many): SSO configurations
- `tenantConfig` (one-to-one): Tenant domain and feature flags
- `apiKeys` (one-to-many): API credentials for integrations
- `usageRecords` (one-to-many): API usage audit trail
- `webhookSecrets` (one-to-many): Webhook signing keys

---

### Shop

**Table:** `shops`

Represents a Shopify store or standalone e-commerce shop. Always the primary RLS boundary for data isolation.

| Column                 | Type     | Nullable | Default             | Description                                    |
| ---------------------- | -------- | -------- | ------------------- | ---------------------------------------------- |
| `id`                   | UUID     | No       | `gen_random_uuid()` | Primary key                                    |
| `org_id`               | UUID     | Yes      | —                   | Link to parent org (null = standalone shop)    |
| `shopify_domain`       | String   | No       | —                   | Shopify domain (e.g., "example.myshopify.com") |
| `shopify_access_token` | String   | No       | —                   | OAuth token (encrypted at app layer)           |
| `shopify_shop_id`      | String   | No       | —                   | Shopify numeric shop ID                        |
| `name`                 | String   | No       | —                   | Display name                                   |
| `email`                | String   | Yes      | —                   | Shop contact email                             |
| `phone`                | String   | Yes      | —                   | Shop phone number                              |
| `timezone`             | String   | No       | `UTC`               | Display timezone (e.g., "America/New_York")    |
| `currency`             | String   | No       | `USD`               | Currency code (ISO 4217)                       |
| `plan_tier`            | Enum     | No       | `FREE`              | Plan tier (overridden by org tier if linked)   |
| `settings`             | JSON     | No       | `{}`                | Shop-specific settings overrides               |
| `is_active`            | Boolean  | No       | `true`              | Soft activation flag                           |
| `installed_at`         | DateTime | No       | `now()`             | OAuth installation timestamp                   |
| `uninstalled_at`       | DateTime | Yes      | —                   | App uninstall timestamp (soft delete)          |
| `created_at`           | DateTime | No       | `now()`             | Creation timestamp                             |
| `updated_at`           | DateTime | No       | `now()`             | Last modification timestamp                    |

**Indexes:**

- Primary: `id`
- Unique: `shopify_domain`, `shopify_shop_id`
- Composite: `(org_id)`

**RLS Policy:** `app.current_shop_id = shop_id`

**Relations:**

- `organization` (many-to-one): Parent org
- `orders` (one-to-many): Orders in this shop
- `drivers` (one-to-many): Shop-specific drivers
- `deliveryZones` (one-to-many): Shop-specific zones
- `timeSlots` (one-to-many): Delivery time slots
- `routes` (one-to-many): Delivery routes
- `users` (one-to-many): Dashboard users
- `locations` (one-to-many): Origin/warehouse locations
- `shipments` (one-to-many): Shipments from this shop
- `messages` (one-to-many): Transactional messages
- `campaigns` (one-to-many): Marketing campaigns

---

### User

**Table:** `users`

Dashboard user account. Always created in a shop context; can optionally have org-level access via OrgMember.

| Column       | Type     | Nullable | Default             | Description                                       |
| ------------ | -------- | -------- | ------------------- | ------------------------------------------------- |
| `id`         | UUID     | No       | `gen_random_uuid()` | Primary key                                       |
| `shop_id`    | UUID     | No       | —                   | Primary shop (where created)                      |
| `email`      | String   | No       | —                   | Email address                                     |
| `name`       | String   | No       | —                   | Display name                                      |
| `role`       | Enum     | No       | `ADMIN`             | Role: SUPER_ADMIN, ADMIN, DISPATCHER, VIEWER      |
| `password`   | String   | Yes      | —                   | Bcrypt-hashed password (null = Shopify auth user) |
| `is_active`  | Boolean  | No       | `true`              | Soft activation flag                              |
| `last_login` | DateTime | Yes      | —                   | Last successful login                             |
| `created_at` | DateTime | No       | `now()`             | Creation timestamp                                |
| `updated_at` | DateTime | No       | `now()`             | Last modification timestamp                       |

**Indexes:**

- Primary: `id`
- Unique: `(shop_id, email)`
- Standard: `email` (for cross-shop lookups)

**RLS Policy:** `app.current_shop_id = shop_id`

**Relations:**

- `shop` (many-to-one): Primary shop
- `orgMembers` (one-to-many): Org-level access records
- `authSessions` (one-to-many): Active sessions
- `loginAttempts` (one-to-many): Login audit trail
- `mfaDevices` (one-to-many): 2FA configurations
- `platformAdmin` (one-to-one): If user is platform admin

**Enums:**

```
UserRole: SUPER_ADMIN | ADMIN | DISPATCHER | VIEWER
OrgRole: OWNER | ADMIN | MEMBER
```

---

### OrgMember

**Table:** `org_members`

Junction model for user org access with role and shop-level filtering.

| Column       | Type     | Nullable | Default             | Description                    |
| ------------ | -------- | -------- | ------------------- | ------------------------------ |
| `id`         | UUID     | No       | `gen_random_uuid()` | Primary key                    |
| `org_id`     | UUID     | No       | —                   | Organization reference         |
| `user_id`    | UUID     | No       | —                   | User reference                 |
| `role`       | Enum     | No       | `MEMBER`            | Org role: OWNER, ADMIN, MEMBER |
| `shop_ids`   | UUID[]   | No       | `[]`                | Allowed shops (empty = all)    |
| `is_active`  | Boolean  | No       | `true`              | Soft activation                |
| `created_at` | DateTime | No       | `now()`             | Creation timestamp             |
| `updated_at` | DateTime | No       | `now()`             | Last modification timestamp    |

**Indexes:**

- Primary: `id`
- Unique: `(org_id, user_id)`
- Standard: `org_id`, `user_id`

**Relations:**

- `organization` (many-to-one): Parent org
- `user` (many-to-one): User account

---

## Orders & Delivery Models

### Order

**Table:** `orders`

Represents a single e-commerce order from any platform (Shopify, WooCommerce, etc.). Immutable after delivery confirmation.

| Column                  | Type          | Nullable | Default             | Description                       |
| ----------------------- | ------------- | -------- | ------------------- | --------------------------------- |
| `id`                    | UUID          | No       | `gen_random_uuid()` | Primary key                       |
| `shop_id`               | UUID          | No       | —                   | Shop that owns this order         |
| `external_order_id`     | String        | No       | —                   | Original platform order ID        |
| `external_order_number` | String        | Yes      | —                   | Display order number              |
| `source`                | String        | No       | `SHOPIFY`           | Order source platform             |
| `status`                | Enum          | No       | `PENDING`           | Order status (see enum below)     |
| `customer_name`         | String        | Yes      | —                   | Snapshot of customer name         |
| `customer_email`        | String        | Yes      | —                   | Snapshot of customer email        |
| `customer_phone`        | String        | Yes      | —                   | Snapshot of customer phone        |
| `address_line1`         | String        | Yes      | —                   | Delivery street address           |
| `address_line2`         | String        | Yes      | —                   | Delivery address line 2           |
| `city`                  | String        | Yes      | —                   | Delivery city                     |
| `province`              | String        | Yes      | —                   | Delivery state/province           |
| `postal_code`           | String        | Yes      | —                   | Delivery postal code              |
| `country`               | String        | Yes      | —                   | Delivery country                  |
| `delivery_location`     | JSON          | Yes      | —                   | PostGIS point: `{lat, lng}`       |
| `delivery_date`         | DateTime      | Yes      | —                   | Requested delivery date           |
| `time_slot_id`          | UUID          | Yes      | —                   | Assigned time slot                |
| `driver_id`             | UUID          | Yes      | —                   | Assigned driver                   |
| `route_stop_id`         | UUID          | Yes      | —                   | Route position                    |
| `estimated_arrival`     | DateTime      | Yes      | —                   | ETA to customer                   |
| `actual_delivery`       | DateTime      | Yes      | —                   | Actual delivery timestamp         |
| `total_price`           | Decimal(12,2) | Yes      | —                   | Order total (from platform)       |
| `total_weight`          | Decimal(10,2) | Yes      | —                   | Total weight (kg)                 |
| `item_count`            | Int           | No       | `1`                 | Number of line items              |
| `line_items`            | JSON          | No       | `[]`                | Line item snapshots               |
| `tracking_token`        | String        | Yes      | —                   | Public tracking URL token         |
| `fulfillment_id`        | String        | Yes      | —                   | Shopify fulfillment ID            |
| `tags`                  | String[]      | No       | `[]`                | Order tags                        |
| `notes`                 | String        | Yes      | —                   | Internal notes                    |
| `metadata`              | JSON          | No       | `{}`                | Custom fields (platform-specific) |
| `created_at`            | DateTime      | No       | `now()`             | Creation timestamp                |
| `updated_at`            | DateTime      | No       | `now()`             | Last modification timestamp       |

**Indexes:**

- Primary: `id`
- Unique: `(shop_id, external_order_id, source)`, `tracking_token`
- Composite: `(shop_id, status, created_at DESC)`, `(shop_id, driver_id)`, `(shop_id, delivery_date)`

**RLS Policy:** `app.current_shop_id = shop_id`

**Relations:**

- `shop` (many-to-one): Shop that owns order
- `driver` (many-to-one): Assigned driver
- `timeSlot` (many-to-one): Delivery slot
- `proofOfDelivery` (one-to-one): POD record after delivery
- `shipments` (one-to-many): One or more shipments (split delivery)
- `notificationLogs` (one-to-many): Delivery notifications sent
- `paymentTransactions` (one-to-many): Payment records (COD, etc.)

**Enums:**

```
OrderStatus:
  PENDING → ACCEPTED → ASSIGNED → PICKED_UP → OUT_FOR_DELIVERY
  → ARRIVED → DELIVERED | FAILED | RETURNED | CANCELLED
```

---

### Shipment

**Table:** `shipments`

Represents a single fulfillment unit. One order can have multiple shipments (e.g., items from different warehouses).

| Column                 | Type          | Nullable | Default             | Description                                                     |
| ---------------------- | ------------- | -------- | ------------------- | --------------------------------------------------------------- |
| `id`                   | UUID          | No       | `gen_random_uuid()` | Primary key                                                     |
| `shop_id`              | UUID          | No       | —                   | Shop that owns shipment                                         |
| `order_id`             | UUID          | No       | —                   | Parent order                                                    |
| `location_id`          | UUID          | Yes      | —                   | Origin warehouse/location                                       |
| `driver_id`            | UUID          | Yes      | —                   | Assigned delivery driver                                        |
| `route_stop_id`        | UUID          | Yes      | —                   | Position in delivery route                                      |
| `shipment_number`      | String        | No       | —                   | Human-readable (SHP-1001)                                       |
| `tracking_number`      | String        | Yes      | —                   | Carrier tracking number                                         |
| `status`               | Enum          | No       | `PENDING`           | Shipment status (see enum below)                                |
| `delivery_method`      | Enum          | No       | `LOCAL_DELIVERY`    | Method: LOCAL_DELIVERY, STORE_PICKUP, STANDARD/EXPRESS_SHIPPING |
| `recipient_name`       | String        | Yes      | —                   | Actual recipient (may differ from order)                        |
| `recipient_phone`      | String        | Yes      | —                   | Recipient contact phone                                         |
| `recipient_email`      | String        | Yes      | —                   | Recipient contact email                                         |
| `address_line1`        | String        | Yes      | —                   | Delivery address line 1                                         |
| `address_line2`        | String        | Yes      | —                   | Delivery address line 2                                         |
| `city`                 | String        | Yes      | —                   | Delivery city                                                   |
| `province`             | String        | Yes      | —                   | Delivery state/province                                         |
| `postal_code`          | String        | Yes      | —                   | Delivery postal code                                            |
| `country`              | String        | Yes      | —                   | Delivery country                                                |
| `delivery_location`    | JSON          | Yes      | —                   | PostGIS point: `{lat, lng}`                                     |
| `delivery_date`        | DateTime      | Yes      | —                   | Scheduled delivery date                                         |
| `time_slot_id`         | UUID          | Yes      | —                   | Scheduled time slot                                             |
| `estimated_arrival`    | DateTime      | Yes      | —                   | ETA to customer                                                 |
| `actual_delivery`      | DateTime      | Yes      | —                   | Actual delivery timestamp                                       |
| `picked_up_at`         | DateTime      | Yes      | —                   | Pickup from warehouse timestamp                                 |
| `weight`               | Decimal(10,2) | Yes      | —                   | Package weight (kg)                                             |
| `dimensions`           | JSON          | Yes      | —                   | `{length, width, height, unit}`                                 |
| `item_count`           | Int           | No       | `1`                 | Number of items in package                                      |
| `line_items`           | JSON          | No       | `[]`                | Items in shipment                                               |
| `shipping_cost`        | Decimal(12,2) | Yes      | —                   | Shipping charge                                                 |
| `cod_amount`           | Decimal(12,2) | Yes      | —                   | COD collection amount                                           |
| `insurance_amount`     | Decimal(12,2) | Yes      | —                   | Insurance charge                                                |
| `label_url`            | String        | Yes      | —                   | Shipping label PDF URL                                          |
| `fulfillment_id`       | String        | Yes      | —                   | Shopify fulfillment ID                                          |
| `carrier`              | String        | Yes      | —                   | External carrier name                                           |
| `carrier_tracking_url` | String        | Yes      | —                   | Carrier tracking page URL                                       |
| `tags`                 | String[]      | No       | `[]`                | Shipment tags                                                   |
| `notes`                | String        | Yes      | —                   | Internal notes                                                  |
| `metadata`             | JSON          | No       | `{}`                | Custom fields                                                   |
| `failure_reason`       | String        | Yes      | —                   | Reason if delivery failed                                       |
| `created_at`           | DateTime      | No       | `now()`             | Creation timestamp                                              |
| `updated_at`           | DateTime      | No       | `now()`             | Last modification timestamp                                     |

**Indexes:**

- Primary: `id`
- Unique: `(shop_id, shipment_number)`, `tracking_number`
- Composite: `(shop_id, status, created_at DESC)`, `(shop_id, order_id)`, `(shop_id, driver_id)`, `(shop_id, delivery_date)`

**RLS Policy:** `app.current_shop_id = shop_id`

**Relations:**

- `shop` (many-to-one): Shop that owns shipment
- `order` (many-to-one): Parent order
- `location` (many-to-one): Origin location
- `driver` (many-to-one): Assigned driver
- `timeSlot` (many-to-one): Delivery time slot
- `proofOfDelivery` (one-to-one): POD record
- `activityLogs` (one-to-many): Status change audit trail
- `paymentTransactions` (one-to-many): Payment records

**Enums:**

```
ShipmentStatus:
  PENDING → PROCESSING → READY_FOR_PICKUP → PICKED_UP → IN_TRANSIT
  → OUT_FOR_DELIVERY → ARRIVED → DELIVERED | FAILED | RETURNED | CANCELLED

DeliveryMethod:
  LOCAL_DELIVERY | STORE_PICKUP | STANDARD_SHIPPING | EXPRESS_SHIPPING | SAME_DAY
```

---

### ProofOfDelivery (Orders) & ShipmentProof (Shipments)

**Tables:** `proof_of_delivery`, `shipment_proofs`

Capture delivery verification. ProofOfDelivery is linked to orders (legacy); ShipmentProof to shipments (current).

| Column                     | Type     | Nullable | Default             | Description                    |
| -------------------------- | -------- | -------- | ------------------- | ------------------------------ |
| `id`                       | UUID     | No       | `gen_random_uuid()` | Primary key                    |
| `order_id` / `shipment_id` | UUID     | No       | —                   | Parent order/shipment (unique) |
| `photo_urls`               | String[] | No       | —                   | Delivery photos                |
| `signature_url`            | String   | Yes      | —                   | Digital signature URL          |
| `recipient_name`           | String   | Yes      | —                   | Who received it                |
| `delivery_location`        | JSON     | Yes      | —                   | GPS point at delivery          |
| `notes`                    | String   | Yes      | —                   | Driver notes                   |
| `delivered_at`             | DateTime | No       | `now()`             | Delivery timestamp             |
| `created_at`               | DateTime | No       | `now()`             | Creation timestamp             |

---

## Delivery Models

### DeliveryZone

**Table:** `delivery_zones`

Service area for delivery with pricing and capacity.

| Column        | Type          | Nullable | Default             | Description                             |
| ------------- | ------------- | -------- | ------------------- | --------------------------------------- |
| `id`          | UUID          | No       | `gen_random_uuid()` | Primary key                             |
| `org_id`      | UUID          | Yes      | —                   | Org-level zone (shared)                 |
| `shop_id`     | UUID          | Yes      | —                   | Shop-specific zone                      |
| `name`        | String        | No       | —                   | Zone name (e.g., "Downtown")            |
| `boundary`    | JSON          | Yes      | —                   | PostGIS polygon: `{coordinates: [...]}` |
| `base_rate`   | Decimal(10,2) | No       | `0`                 | Base shipping fee                       |
| `per_km_rate` | Decimal(10,2) | No       | `0`                 | Per-km surcharge                        |
| `min_order`   | Decimal(10,2) | No       | `0`                 | Minimum order value                     |
| `free_above`  | Decimal(10,2) | Yes      | —                   | Free shipping above amount              |
| `is_active`   | Boolean       | No       | `true`              | Soft activation                         |
| `priority`    | Int           | No       | `0`                 | Sort order for zone matching            |
| `metadata`    | JSON          | No       | `{}`                | Custom fields                           |
| `created_at`  | DateTime      | No       | `now()`             | Creation timestamp                      |
| `updated_at`  | DateTime      | No       | `now()`             | Last modification timestamp             |

**Indexes:**

- Composite: `(org_id, is_active)`, `(shop_id, is_active)`

**RLS Policy:** `(app.current_org_id = org_id) OR (app.current_shop_id = shop_id)`

---

### TimeSlot

**Table:** `time_slots`

Delivery time windows (e.g., "9 AM - 12 PM on weekdays").

| Column             | Type          | Nullable | Default             | Description                         |
| ------------------ | ------------- | -------- | ------------------- | ----------------------------------- |
| `id`               | UUID          | No       | `gen_random_uuid()` | Primary key                         |
| `shop_id`          | UUID          | No       | —                   | Shop that owns this slot            |
| `delivery_zone_id` | UUID          | Yes      | —                   | Zone constraint (optional)          |
| `name`             | String        | No       | —                   | Display name (e.g., "Morning Slot") |
| `start_time`       | String        | No       | —                   | Start time (HH:MM format)           |
| `end_time`         | String        | No       | —                   | End time (HH:MM format)             |
| `days_of_week`     | Int[]         | No       | —                   | Bitmask: 0=Sun, 1=Mon, ..., 6=Sat   |
| `max_capacity`     | Int           | No       | `50`                | Max orders in slot                  |
| `cutoff_minutes`   | Int           | No       | `120`               | Order cutoff (minutes before start) |
| `surcharge`        | Decimal(10,2) | No       | `0`                 | Additional fee for this slot        |
| `is_active`        | Boolean       | No       | `true`              | Soft activation                     |
| `created_at`       | DateTime      | No       | `now()`             | Creation timestamp                  |
| `updated_at`       | DateTime      | No       | `now()`             | Last modification timestamp         |

**Indexes:**

- Composite: `(shop_id, is_active)`

---

### Route

**Table:** `routes`

Collection of delivery stops for a driver on a specific date.

| Column            | Type          | Nullable | Default             | Description                          |
| ----------------- | ------------- | -------- | ------------------- | ------------------------------------ |
| `id`              | UUID          | No       | `gen_random_uuid()` | Primary key                          |
| `shop_id`         | UUID          | No       | —                   | Shop that owns this route            |
| `driver_id`       | UUID          | Yes      | —                   | Assigned driver                      |
| `name`            | String        | Yes      | —                   | Route name (e.g., "Route A - North") |
| `status`          | Enum          | No       | `DRAFT`             | Route status (see enum below)        |
| `date`            | Date          | No       | —                   | Date of route                        |
| `start_address`   | String        | Yes      | —                   | Depot/start location                 |
| `optimized_order` | JSON          | No       | `[]`                | Route optimization order IDs         |
| `total_distance`  | Decimal(12,2) | Yes      | —                   | Total route distance (km)            |
| `total_duration`  | Int           | Yes      | —                   | Total estimated time (minutes)       |
| `started_at`      | DateTime      | Yes      | —                   | When driver started route            |
| `completed_at`    | DateTime      | Yes      | —                   | When route was completed             |
| `created_at`      | DateTime      | No       | `now()`             | Creation timestamp                   |
| `updated_at`      | DateTime      | No       | `now()`             | Last modification timestamp          |

**Indexes:**

- Composite: `(shop_id, date, status)`, `(shop_id, driver_id)`

**Enums:**

```
RouteStatus: DRAFT | OPTIMIZED | ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED
```

---

### RouteStop

**Table:** `route_stops`

Individual stop on a route (delivery or pickup).

| Column              | Type     | Nullable | Default             | Description                           |
| ------------------- | -------- | -------- | ------------------- | ------------------------------------- |
| `id`                | UUID     | No       | `gen_random_uuid()` | Primary key                           |
| `route_id`          | UUID     | No       | —                   | Parent route                          |
| `order_id`          | UUID     | Yes      | —                   | Associated order (if delivery)        |
| `driver_id`         | UUID     | Yes      | —                   | Driver assigned to this stop          |
| `sequence`          | Int      | No       | —                   | Position in route (1, 2, 3, ...)      |
| `stop_type`         | Enum     | No       | `DELIVERY`          | Type: PICKUP, DELIVERY, RETURN, DEPOT |
| `status`            | Enum     | No       | `PENDING`           | Stop status (see enum below)          |
| `estimated_arrival` | DateTime | Yes      | —                   | Calculated ETA                        |
| `actual_arrival`    | DateTime | Yes      | —                   | When driver arrived                   |
| `departed_at`       | DateTime | Yes      | —                   | When driver left stop                 |
| `notes`             | String   | Yes      | —                   | Stop-specific notes                   |
| `created_at`        | DateTime | No       | `now()`             | Creation timestamp                    |
| `updated_at`        | DateTime | No       | `now()`             | Last modification timestamp           |

**Indexes:**

- Composite: `(route_id, sequence)`

**Enums:**

```
StopType: PICKUP | DELIVERY | RETURN | DEPOT
StopStatus: PENDING | EN_ROUTE | ARRIVED | COMPLETED | SKIPPED | FAILED
```

---

## Fleet Models

### Driver

**Table:** `drivers`

Delivery personnel. Can be org-level (shared) or shop-level.

| Column             | Type          | Nullable | Default             | Description                                           |
| ------------------ | ------------- | -------- | ------------------- | ----------------------------------------------------- |
| `id`               | UUID          | No       | `gen_random_uuid()` | Primary key                                           |
| `org_id`           | UUID          | Yes      | —                   | Org-level driver (shared across shops)                |
| `shop_id`          | UUID          | Yes      | —                   | Shop-specific driver                                  |
| `name`             | String        | No       | —                   | Driver name                                           |
| `email`            | String        | Yes      | —                   | Driver email                                          |
| `phone`            | String        | No       | —                   | Driver phone (unique per org/shop)                    |
| `vehicle_type`     | Enum          | No       | `CAR`               | Vehicle: BICYCLE, MOTORCYCLE, CAR, VAN, TRUCK         |
| `vehicle_plate`    | String        | Yes      | —                   | License plate                                         |
| `max_capacity`     | Int           | No       | `20`                | Max orders per route                                  |
| `max_weight`       | Decimal(10,2) | Yes      | —                   | Max carrying capacity (kg)                            |
| `status`           | Enum          | No       | `OFFLINE`           | Status: OFFLINE, AVAILABLE, ON_ROUTE, ON_BREAK        |
| `is_active`        | Boolean       | No       | `true`              | Soft activation                                       |
| `current_location` | JSON          | Yes      | —                   | Last known PostGIS point: `{lat, lng}`                |
| `last_location_at` | DateTime      | Yes      | —                   | Last location update                                  |
| `heading`          | Float         | Yes      | —                   | Direction (0-360 degrees)                             |
| `fcm_token`        | String        | Yes      | —                   | Firebase Cloud Messaging token for push notifications |
| `password`         | String        | Yes      | —                   | Driver app password (hashed)                          |
| `refresh_token`    | String        | Yes      | —                   | Driver app refresh token                              |
| `created_at`       | DateTime      | No       | `now()`             | Creation timestamp                                    |
| `updated_at`       | DateTime      | No       | `now()`             | Last modification timestamp                           |

**Indexes:**

- Unique: `(org_id, phone)` or `(shop_id, phone)`
- Composite: `(org_id, status)`, `(shop_id, status)`

**RLS Policy:** `(app.current_org_id = org_id) OR (app.current_shop_id = shop_id)`

**Enums:**

```
DriverStatus: OFFLINE | AVAILABLE | ON_ROUTE | ON_BREAK
VehicleType: BICYCLE | MOTORCYCLE | CAR | VAN | TRUCK
```

---

## Shipping Models

### Location

**Table:** `locations`

Warehouses, depots, or distribution centers (origin points for shipments).

| Column          | Type     | Nullable | Default             | Description                            |
| --------------- | -------- | -------- | ------------------- | -------------------------------------- |
| `id`            | UUID     | No       | `gen_random_uuid()` | Primary key                            |
| `org_id`        | UUID     | Yes      | —                   | Org-level location (shared)            |
| `shop_id`       | UUID     | Yes      | —                   | Shop-specific location                 |
| `name`          | String   | No       | —                   | Location name (e.g., "Main Warehouse") |
| `address_line1` | String   | No       | —                   | Street address                         |
| `address_line2` | String   | Yes      | —                   | Address line 2                         |
| `city`          | String   | Yes      | —                   | City                                   |
| `province`      | String   | Yes      | —                   | State/province                         |
| `postal_code`   | String   | Yes      | —                   | Postal code                            |
| `country`       | String   | Yes      | —                   | Country                                |
| `coordinates`   | JSON     | Yes      | —                   | PostGIS point: `{lat, lng}`            |
| `is_active`     | Boolean  | No       | `true`              | Soft activation                        |
| `created_at`    | DateTime | No       | `now()`             | Creation timestamp                     |
| `updated_at`    | DateTime | No       | `now()`             | Last modification timestamp            |

---

## Messaging Models

### Message

**Table:** `messages`

Single message instance with full delivery lifecycle tracking.

| Column         | Type     | Nullable | Default             | Description                                   |
| -------------- | -------- | -------- | ------------------- | --------------------------------------------- |
| `id`           | UUID     | No       | `gen_random_uuid()` | Primary key                                   |
| `tenant_id`    | UUID     | No       | —                   | Tenant identifier                             |
| `shop_id`      | UUID     | Yes      | —                   | Shop (optional, may be null for org messages) |
| `channel`      | Enum     | No       | —                   | Channel: EMAIL, SMS, WHATSAPP, PUSH, IN_APP   |
| `recipient`    | String   | No       | —                   | Phone, email, or user ID                      |
| `sender`       | String   | Yes      | —                   | Sender identifier                             |
| `subject`      | String   | Yes      | —                   | Email subject only                            |
| `body`         | String   | No       | —                   | Message content                               |
| `template_id`  | UUID     | Yes      | —                   | Message template used                         |
| `status`       | Enum     | No       | `QUEUED`            | Delivery status                               |
| `priority`     | Enum     | No       | `NORMAL`            | Priority: LOW, NORMAL, HIGH, URGENT           |
| `external_id`  | String   | Yes      | —                   | Provider message ID                           |
| `sent_at`      | DateTime | Yes      | —                   | When provider accepted                        |
| `delivered_at` | DateTime | Yes      | —                   | When delivered (provider-confirmed)           |
| `failed_at`    | DateTime | Yes      | —                   | When delivery failed                          |
| `error`        | String   | Yes      | —                   | Error description                             |
| `retry_count`  | Int      | No       | `0`                 | Number of retry attempts                      |
| `metadata`     | JSON     | Yes      | —                   | Provider metadata                             |
| `created_at`   | DateTime | No       | `now()`             | Creation timestamp                            |
| `updated_at`   | DateTime | No       | `now()`             | Last modification timestamp                   |

**Indexes:**

- Composite: `(tenant_id, channel, status)`, `(shop_id, created_at DESC)`, `(status, created_at DESC)`

**Enums:**

```
MessageChannel: EMAIL | SMS | WHATSAPP | PUSH | IN_APP
MessageDeliveryStatus: QUEUED | SENDING | SENT | DELIVERED | FAILED | BOUNCED | OPENED | CLICKED
MessagePriority: LOW | NORMAL | HIGH | URGENT
```

---

### MessageTemplate

**Table:** `message_templates`

Reusable message templates with variable substitution.

| Column       | Type     | Nullable | Default             | Description                                      |
| ------------ | -------- | -------- | ------------------- | ------------------------------------------------ |
| `id`         | UUID     | No       | `gen_random_uuid()` | Primary key                                      |
| `tenant_id`  | UUID     | No       | —                   | Tenant identifier                                |
| `shop_id`    | UUID     | Yes      | —                   | Shop (optional)                                  |
| `channel`    | Enum     | No       | —                   | Channel (EMAIL, SMS, WHATSAPP, PUSH, IN_APP)     |
| `name`       | String   | No       | —                   | Template identifier (e.g., "order_confirmation") |
| `subject`    | String   | Yes      | —                   | Email subject (optional)                         |
| `body`       | String   | No       | —                   | Template body with `{{variable}}` placeholders   |
| `variables`  | JSON     | No       | `[]`                | Array of variable names                          |
| `is_active`  | Boolean  | No       | `true`              | Soft activation                                  |
| `created_at` | DateTime | No       | `now()`             | Creation timestamp                               |
| `updated_at` | DateTime | No       | `now()`             | Last modification timestamp                      |

**Indexes:**

- Unique: `(tenant_id, channel, name)`
- Composite: `(tenant_id, channel, is_active)`

---

## Billing Models

### BillingPlan

**Table:** `billing_plans`

Available subscription plans with pricing and feature flags.

| Column       | Type          | Nullable | Default   | Description                                          |
| ------------ | ------------- | -------- | --------- | ---------------------------------------------------- |
| `id`         | String        | No       | `cuid()`  | Primary key                                          |
| `name`       | String        | No       | —         | Plan name (e.g., "Starter")                          |
| `slug`       | String        | No       | —         | URL slug (e.g., "starter")                           |
| `price`      | Decimal(10,2) | No       | —         | Monthly/yearly price                                 |
| `interval`   | String        | No       | `monthly` | Billing interval: "monthly" or "yearly"              |
| `features`   | JSON          | No       | `{}`      | Feature flags: `{feature_key: boolean}`              |
| `limits`     | JSON          | No       | `{}`      | Quota limits: `{orders: 1000, shipments: 5000, ...}` |
| `trial_days` | Int           | No       | `0`       | Trial period (0 = no trial)                          |
| `is_active`  | Boolean       | No       | `true`    | Available for purchase                               |
| `sort_order` | Int           | No       | `0`       | Display order                                        |
| `created_at` | DateTime      | No       | `now()`   | Creation timestamp                                   |
| `updated_at` | DateTime      | No       | `now()`   | Last modification timestamp                          |

**Indexes:**

- Unique: `name`, `slug`

---

### BillingSubscription

**Table:** `billing_subscriptions`

Active subscription tied to a shop.

| Column                 | Type     | Nullable | Default    | Description                                            |
| ---------------------- | -------- | -------- | ---------- | ------------------------------------------------------ |
| `id`                   | String   | No       | `cuid()`   | Primary key                                            |
| `shop_id`              | UUID     | No       | —          | Shop subscribed                                        |
| `plan_id`              | String   | No       | —          | Billing plan                                           |
| `status`               | String   | No       | `trialing` | Status: trialing, active, past_due, cancelled, expired |
| `current_period_start` | DateTime | No       | —          | Billing period start                                   |
| `current_period_end`   | DateTime | No       | —          | Billing period end                                     |
| `trial_end`            | DateTime | Yes      | —          | Trial end date                                         |
| `cancelled_at`         | DateTime | Yes      | —          | Cancellation timestamp                                 |
| `cancel_at_period_end` | Boolean  | No       | `false`    | Cancel after current period                            |
| `payment_method_id`    | String   | Yes      | —          | Payment method reference                               |
| `created_at`           | DateTime | No       | `now()`    | Creation timestamp                                     |
| `updated_at`           | DateTime | No       | `now()`    | Last modification timestamp                            |

**Indexes:**

- Unique: `shop_id`
- Composite: `plan_id`, `status`

---

### Invoice

**Table:** `invoices`

Line-item invoices for subscription charges and overages.

| Column            | Type          | Nullable | Default  | Description                                      |
| ----------------- | ------------- | -------- | -------- | ------------------------------------------------ |
| `id`              | String        | No       | `cuid()` | Primary key                                      |
| `subscription_id` | String        | No       | —        | Subscription                                     |
| `shop_id`         | UUID          | No       | —        | Shop for reference                               |
| `amount`          | Decimal(10,2) | No       | —        | Total amount due                                 |
| `currency`        | String        | No       | `usd`    | Currency code                                    |
| `status`          | String        | No       | `draft`  | Status: draft, finalized, paid, failed, refunded |
| `line_items`      | JSON          | No       | `[]`     | Items: `[{description, amount, quantity}, ...]`  |
| `discount_amount` | Decimal(10,2) | Yes      | —        | Discount applied                                 |
| `coupon_code`     | String        | Yes      | —        | Coupon code used                                 |
| `paid_at`         | DateTime      | Yes      | —        | Payment timestamp                                |
| `due_date`        | DateTime      | No       | —        | Due date                                         |
| `created_at`      | DateTime      | No       | `now()`  | Creation timestamp                               |
| `updated_at`      | DateTime      | No       | `now()`  | Last modification timestamp                      |

**Indexes:**

- Composite: `subscription_id`, `shop_id`, `status`

---

### StoreQuotaUsage

**Table:** `store_quota_usage`

Track resource consumption per billing period.

| Column            | Type     | Nullable | Default  | Description                                                   |
| ----------------- | -------- | -------- | -------- | ------------------------------------------------------------- |
| `id`              | String   | No       | `cuid()` | Primary key                                                   |
| `subscription_id` | String   | No       | —        | Subscription                                                  |
| `shop_id`         | UUID     | No       | —        | Shop                                                          |
| `resource`        | String   | No       | —        | Resource type: orders, shipments, api_calls, storage, drivers |
| `current_usage`   | Int      | No       | `0`      | Current usage count                                           |
| `period_start`    | DateTime | No       | —        | Billing period start                                          |
| `period_end`      | DateTime | No       | —        | Billing period end                                            |
| `created_at`      | DateTime | No       | `now()`  | Creation timestamp                                            |
| `updated_at`      | DateTime | No       | `now()`  | Last modification timestamp                                   |

**Indexes:**

- Unique: `(subscription_id, resource, period_start)`
- Composite: `subscription_id`, `shop_id`

---

## Authentication Models

### AuthSession

**Table:** `auth_sessions`

Tracks active user sessions with device fingerprinting.

| Column             | Type     | Nullable | Default             | Description                 |
| ------------------ | -------- | -------- | ------------------- | --------------------------- |
| `id`               | UUID     | No       | `gen_random_uuid()` | Primary key                 |
| `user_id`          | UUID     | No       | —                   | User                        |
| `org_id`           | UUID     | No       | —                   | Organization context        |
| `provider_id`      | UUID     | No       | —                   | Auth provider used          |
| `token`            | String   | No       | —                   | Encrypted session token     |
| `ip_address`       | String   | Yes      | —                   | Client IP (geo-awareness)   |
| `user_agent`       | String   | Yes      | —                   | Browser/client info         |
| `device_id`        | String   | Yes      | —                   | Device fingerprint          |
| `expires_at`       | DateTime | No       | —                   | Session expiration          |
| `mfa_verified`     | Boolean  | No       | `false`             | Whether MFA was satisfied   |
| `mfa_verified_at`  | DateTime | Yes      | —                   | When MFA was verified       |
| `is_revoked`       | Boolean  | No       | `false`             | Revocation flag             |
| `revoked_at`       | DateTime | Yes      | —                   | Revocation timestamp        |
| `last_activity_at` | DateTime | No       | `now()`             | Last activity timestamp     |
| `created_at`       | DateTime | No       | `now()`             | Creation timestamp          |
| `updated_at`       | DateTime | No       | `now()`             | Last modification timestamp |

**Indexes:**

- Unique: `(user_id, device_id)`
- Composite: `user_id`, `org_id`, `expires_at`, `mfa_verified`

---

### MfaDevice

**Table:** `mfa_devices`

MFA configurations (TOTP, SMS, EMAIL).

| Column         | Type     | Nullable | Default             | Description                          |
| -------------- | -------- | -------- | ------------------- | ------------------------------------ |
| `id`           | UUID     | No       | `gen_random_uuid()` | Primary key                          |
| `user_id`      | UUID     | No       | —                   | User                                 |
| `type`         | Enum     | No       | —                   | Type: TOTP, SMS, EMAIL               |
| `secret`       | String   | Yes      | —                   | Encrypted TOTP secret (base32)       |
| `phone_number` | String   | Yes      | —                   | For SMS                              |
| `email`        | String   | Yes      | —                   | For EMAIL verification               |
| `is_verified`  | Boolean  | No       | `false`             | Verified status                      |
| `is_default`   | Boolean  | No       | `false`             | Primary MFA device                   |
| `last_used_at` | DateTime | Yes      | —                   | Last usage                           |
| `backup_codes` | String   | Yes      | —                   | Encrypted JSON array of backup codes |
| `created_at`   | DateTime | No       | `now()`             | Creation timestamp                   |
| `updated_at`   | DateTime | No       | `now()`             | Last modification timestamp          |

**Enums:**

```
MfaType: TOTP | SMS | EMAIL
```

---

### LoginAttempt

**Table:** `login_attempts`

Audit trail for login attempts (success + failure).

| Column           | Type     | Nullable | Default             | Description                                                    |
| ---------------- | -------- | -------- | ------------------- | -------------------------------------------------------------- |
| `id`             | UUID     | No       | `gen_random_uuid()` | Primary key                                                    |
| `user_id`        | UUID     | Yes      | —                   | User (null if failed before identification)                    |
| `email`          | String   | Yes      | —                   | Attempted email                                                |
| `ip_address`     | String   | No       | —                   | Client IP                                                      |
| `user_agent`     | String   | Yes      | —                   | Browser info                                                   |
| `success`        | Boolean  | No       | —                   | Success flag                                                   |
| `failure_reason` | String   | Yes      | —                   | Reason if failed: INVALID_PASSWORD, USER_NOT_FOUND, MFA_FAILED |
| `mfa_method`     | String   | Yes      | —                   | MFA method attempted                                           |
| `created_at`     | DateTime | No       | `now()`             | Timestamp                                                      |

**Indexes:**

- Composite: `user_id`, `email`, `ip_address`, `created_at`, `success`

---

### ApiKey

**Table:** `api_keys`

Organization-level API keys for programmatic access.

| Column         | Type     | Nullable | Default             | Description                                          |
| -------------- | -------- | -------- | ------------------- | ---------------------------------------------------- |
| `id`           | UUID     | No       | `gen_random_uuid()` | Primary key                                          |
| `org_id`       | UUID     | No       | —                   | Organization                                         |
| `name`         | String   | No       | —                   | Friendly name                                        |
| `prefix`       | String   | No       | —                   | Public identifier (first 8 chars)                    |
| `key_hash`     | String   | No       | —                   | Bcrypt/Argon2 hash                                   |
| `scopes`       | String[] | No       | `[]`                | Permissions: ["shipments:read", "routes:write", ...] |
| `is_active`    | Boolean  | No       | `true`              | Active flag                                          |
| `last_used_at` | DateTime | Yes      | —                   | Last usage                                           |
| `expires_at`   | DateTime | Yes      | —                   | Expiration (null = never)                            |
| `created_by`   | UUID     | No       | —                   | Creator user                                         |
| `created_at`   | DateTime | No       | `now()`             | Creation timestamp                                   |
| `updated_at`   | DateTime | No       | `now()`             | Last modification timestamp                          |

**Indexes:**

- Unique: `prefix`
- Composite: `org_id`, `expires_at`, `is_active`

---

### Permission

**Table:** `permissions`

Fine-grained permission definitions.

| Column        | Type     | Nullable | Default             | Description                                               |
| ------------- | -------- | -------- | ------------------- | --------------------------------------------------------- |
| `id`          | UUID     | No       | `gen_random_uuid()` | Primary key                                               |
| `resource`    | String   | No       | —                   | Resource (e.g., "shipments", "routes")                    |
| `action`      | String   | No       | —                   | Action (e.g., "create", "read", "update", "delete", "\*") |
| `description` | String   | Yes      | —                   | Human-readable description                                |
| `is_built_in` | Boolean  | No       | `false`             | Platform-defined vs custom                                |
| `created_at`  | DateTime | No       | `now()`             | Creation timestamp                                        |

**Indexes:**

- Unique: `(resource, action)`
- Composite: `resource`, `is_built_in`

---

## Integration Models

### IntegrationApp

**Table:** `integration_apps`

Marketplace catalog of available integrations.

| Column              | Type     | Nullable | Default             | Description                                      |
| ------------------- | -------- | -------- | ------------------- | ------------------------------------------------ |
| `id`                | UUID     | No       | `gen_random_uuid()` | Primary key                                      |
| `slug`              | String   | No       | —                   | Unique slug (e.g., "sendgrid")                   |
| `name`              | String   | No       | —                   | Display name                                     |
| `description`       | String   | No       | —                   | Short description                                |
| `long_description`  | String   | Yes      | —                   | Detailed markdown                                |
| `category`          | Enum     | No       | —                   | Category (COMMUNICATION, ROUTING, etc.)          |
| `subcategory`       | String   | Yes      | —                   | Subcategory (e.g., "email")                      |
| `logo_url`          | String   | Yes      | —                   | Logo URL                                         |
| `website_url`       | String   | Yes      | —                   | Provider website                                 |
| `docs_url`          | String   | Yes      | —                   | Documentation URL                                |
| `auth_type`         | Enum     | No       | `API_KEY`           | Auth: API_KEY, OAUTH, NONE, MULTI_CREDENTIAL     |
| `credential_schema` | JSON     | No       | `[]`                | Array of credential field definitions            |
| `capabilities`      | JSON     | No       | `[]`                | What the integration can do                      |
| `status`            | Enum     | No       | `AVAILABLE`         | Status: AVAILABLE, COMING_SOON, BETA, DEPRECATED |
| `is_built_in`       | Boolean  | No       | `true`              | Platform-managed                                 |
| `version`           | String   | No       | `1.0.0`             | Version                                          |
| `created_at`        | DateTime | No       | `now()`             | Creation timestamp                               |
| `updated_at`        | DateTime | No       | `now()`             | Last modification timestamp                      |

**Indexes:**

- Unique: `slug`
- Composite: `(category, status)`, `status`

**Enums:**

```
IntegrationCategory: COMMUNICATION | ROUTING | ORDER_MANAGEMENT | INVENTORY | PAYMENT | ANALYTICS
IntegrationAuthType: API_KEY | OAUTH | NONE | MULTI_CREDENTIAL
IntegrationStatus: AVAILABLE | COMING_SOON | BETA | DEPRECATED
```

---

### Integration

**Table:** `integrations`

Per-shop installation of an integration.

| Column                 | Type     | Nullable | Default             | Description                               |
| ---------------------- | -------- | -------- | ------------------- | ----------------------------------------- |
| `id`                   | UUID     | No       | `gen_random_uuid()` | Primary key                               |
| `shop_id`              | UUID     | No       | —                   | Shop                                      |
| `app_slug`             | String   | No       | —                   | FK to IntegrationApp.slug                 |
| `is_enabled`           | Boolean  | No       | `true`              | Active flag                               |
| `credentials`          | JSON     | No       | `{}`                | Encrypted credentials                     |
| `config`               | JSON     | No       | `{}`                | Non-secret configuration                  |
| `last_sync_at`         | DateTime | Yes      | —                   | Last sync timestamp                       |
| `last_health_check_at` | DateTime | Yes      | —                   | Last health check                         |
| `health_status`        | Enum     | No       | `UNKNOWN`           | Status: HEALTHY, DEGRADED, ERROR, UNKNOWN |
| `installed_at`         | DateTime | No       | `now()`             | Installation timestamp                    |
| `updated_at`           | DateTime | No       | `now()`             | Last modification timestamp               |

**Indexes:**

- Unique: `(shop_id, app_slug)`
- Composite: `shop_id`, `app_slug`, `(shop_id, health_status)`

---

### IntegrationEvent

**Table:** `integration_events`

Unified event log for integration activity.

| Column           | Type     | Nullable | Default             | Description                                                                 |
| ---------------- | -------- | -------- | ------------------- | --------------------------------------------------------------------------- |
| `id`             | UUID     | No       | `gen_random_uuid()` | Primary key                                                                 |
| `shop_id`        | UUID     | No       | —                   | Shop                                                                        |
| `app_slug`       | String   | No       | —                   | Integration app                                                             |
| `integration_id` | UUID     | Yes      | —                   | Integration instance                                                        |
| `event_type`     | Enum     | No       | —                   | Type: INSTALL, UNINSTALL, SYNC, WEBHOOK, HEALTH_CHECK, METER, CONFIG_UPDATE |
| `operation`      | String   | Yes      | —                   | Operation (e.g., "send", "route", "geocode")                                |
| `used_fallback`  | Boolean  | No       | `false`             | Fallback used flag                                                          |
| `metadata`       | JSON     | No       | `{}`                | Event-specific data                                                         |
| `timestamp`      | DateTime | No       | `now()`             | Event timestamp                                                             |

**Indexes:**

- Composite: `(shop_id, timestamp)`, `(app_slug, timestamp)`, `(shop_id, event_type, timestamp)`

**Enums:**

```
IntegrationEventType: INSTALL | UNINSTALL | SYNC | WEBHOOK | HEALTH_CHECK | METER | CONFIG_UPDATE
IntegrationHealthStatus: HEALTHY | DEGRADED | ERROR | UNKNOWN
```

---

## Onboarding & Tenant Models

### OnboardingProgress

**Table:** `onboarding_progress`

Tracks user journey through setup flow.

| Column             | Type     | Nullable | Default             | Description                            |
| ------------------ | -------- | -------- | ------------------- | -------------------------------------- |
| `id`               | UUID     | No       | `gen_random_uuid()` | Primary key                            |
| `user_id`          | UUID     | No       | —                   | User                                   |
| `org_id`           | UUID     | Yes      | —                   | Organization                           |
| `current_step`     | String   | No       | —                   | Current step name (e.g., "BASIC_INFO") |
| `current_sub_step` | String   | Yes      | —                   | Optional sub-step                      |
| `completed_steps`  | String[] | No       | `[]`                | Array of completed step names          |
| `data`             | JSON     | No       | `{}`                | Form data and configurations           |
| `started_at`       | DateTime | No       | `now()`             | Start timestamp                        |
| `completed_at`     | DateTime | Yes      | —                   | Completion timestamp                   |
| `abandoned_at`     | DateTime | Yes      | —                   | Abandonment timestamp                  |
| `is_active`        | Boolean  | No       | `true`              | Active flag                            |
| `created_at`       | DateTime | No       | `now()`             | Creation timestamp                     |
| `updated_at`       | DateTime | No       | `now()`             | Last modification timestamp            |

**Indexes:**

- Unique: `user_id`
- Composite: `user_id`, `org_id`, `(is_active, created_at)`

---

### Workspace

**Table:** `workspaces`

Deployment unit owned by organization.

| Column                  | Type     | Nullable | Default             | Description                    |
| ----------------------- | -------- | -------- | ------------------- | ------------------------------ |
| `id`                    | UUID     | No       | `gen_random_uuid()` | Primary key                    |
| `org_id`                | UUID     | No       | —                   | Organization                   |
| `name`                  | String   | No       | —                   | Workspace name                 |
| `slug`                  | String   | No       | —                   | URL-safe identifier            |
| `deployment_type`       | Enum     | No       | `CLOUD`             | Type: CLOUD, SELF_MANAGED      |
| `industry`              | String   | Yes      | —                   | Industry classification        |
| `goals`                 | String[] | No       | `[]`                | Business goals                 |
| `selected_integrations` | String[] | No       | `[]`                | Selected integration slugs     |
| `dashboard_layout`      | JSON     | Yes      | —                   | Custom dashboard configuration |
| `settings`              | JSON     | No       | `{}`                | Workspace settings             |
| `provisioned_at`        | DateTime | Yes      | —                   | Provisioning timestamp         |
| `is_active`             | Boolean  | No       | `true`              | Active flag                    |
| `created_at`            | DateTime | No       | `now()`             | Creation timestamp             |
| `updated_at`            | DateTime | No       | `now()`             | Last modification timestamp    |

**Indexes:**

- Unique: `(org_id, slug)`
- Composite: `org_id`, `(is_active, created_at)`

**Enums:**

```
DeploymentType: CLOUD | SELF_MANAGED
DistanceUnit: KM | MILES
WeightUnit: KG | LBS
```

---

### TenantConfig

**Table:** `tenant_configs`

Tenant-level configuration including custom domains.

| Column          | Type     | Nullable | Default             | Description                                |
| --------------- | -------- | -------- | ------------------- | ------------------------------------------ |
| `id`            | UUID     | No       | `gen_random_uuid()` | Primary key                                |
| `org_id`        | UUID     | No       | —                   | Organization (unique)                      |
| `subdomain`     | String   | No       | —                   | Subdomain (e.g., "acme")                   |
| `custom_domain` | String   | Yes      | —                   | Custom domain (e.g., "logistics.acme.com") |
| `features`      | JSON     | No       | `{}`                | Feature flags per plan                     |
| `limits`        | JSON     | No       | `{}`                | Resource limits                            |
| `is_active`     | Boolean  | No       | `true`              | Active flag                                |
| `created_at`    | DateTime | No       | `now()`             | Creation timestamp                         |
| `updated_at`    | DateTime | No       | `now()`             | Last modification timestamp                |

**Indexes:**

- Unique: `org_id`, `subdomain`, `custom_domain`

---

## Tenant Configuration Models

### ApiKey (Tenant-level)

**Table:** `api_keys`

Organization-level API credentials for external integrations.

| Column         | Type     | Nullable | Default             | Description                             |
| -------------- | -------- | -------- | ------------------- | --------------------------------------- |
| `id`           | UUID     | No       | `gen_random_uuid()` | Primary key                             |
| `org_id`       | UUID     | No       | —                   | Organization                            |
| `name`         | String   | No       | —                   | Key name (e.g., "Shopify Integration")  |
| `key_hash`     | String   | No       | —                   | SHA-256 hash                            |
| `prefix`       | String   | No       | —                   | Public identifier (first 8 chars)       |
| `scopes`       | String[] | No       | `[]`                | Permissions: ["READ", "WRITE", "ADMIN"] |
| `permissions`  | JSON     | No       | `{}`                | Fine-grained resource permissions       |
| `rate_limit`   | Int      | No       | `100`               | Requests per minute                     |
| `last_used_at` | DateTime | Yes      | —                   | Last usage                              |
| `last_used_ip` | String   | Yes      | —                   | Last IP                                 |
| `expires_at`   | DateTime | Yes      | —                   | Expiration date                         |
| `is_active`    | Boolean  | No       | `true`              | Active flag                             |
| `created_by`   | UUID     | No       | —                   | Creator user                            |
| `created_at`   | DateTime | No       | `now()`             | Creation timestamp                      |
| `updated_at`   | DateTime | No       | `now()`             | Last modification timestamp             |

**Indexes:**

- Unique: `(org_id, prefix)`
- Composite: `org_id`, `created_at`

---

### UsageRecord

**Table:** `usage_records`

Individual API request log for billing and analytics.

| Column                | Type     | Nullable | Default             | Description                           |
| --------------------- | -------- | -------- | ------------------- | ------------------------------------- |
| `id`                  | UUID     | No       | `gen_random_uuid()` | Primary key                           |
| `org_id`              | UUID     | No       | —                   | Organization                          |
| `api_key_id`          | UUID     | Yes      | —                   | API key (null if JWT)                 |
| `endpoint`            | String   | No       | —                   | API endpoint (e.g., "/api/v1/routes") |
| `method`              | String   | No       | —                   | HTTP method                           |
| `status_code`         | Int      | No       | —                   | HTTP status                           |
| `response_time_ms`    | Int      | No       | —                   | Response time in ms                   |
| `request_size_bytes`  | Int      | No       | `0`                 | Request size                          |
| `response_size_bytes` | Int      | No       | `0`                 | Response size                         |
| `ip_address`          | String   | No       | —                   | Client IP                             |
| `timestamp`           | DateTime | No       | `now()`             | Request timestamp                     |

**Indexes:**

- Composite: `org_id`, `api_key_id`, `timestamp`, `endpoint`, `status_code`

---

### UsageSummary

**Table:** `usage_summaries`

Pre-aggregated daily metrics for reporting.

| Column                 | Type     | Nullable | Default             | Description                 |
| ---------------------- | -------- | -------- | ------------------- | --------------------------- |
| `id`                   | UUID     | No       | `gen_random_uuid()` | Primary key                 |
| `org_id`               | UUID     | No       | —                   | Organization                |
| `period`               | Date     | No       | —                   | Date (YYYY-MM-DD)           |
| `request_count`        | Int      | No       | `0`                 | Total requests              |
| `bandwidth_bytes`      | BigInt   | No       | `0`                 | Total bandwidth             |
| `error_count`          | Int      | No       | `0`                 | 4xx/5xx responses           |
| `avg_response_time_ms` | Int      | No       | `0`                 | Mean response time          |
| `unique_endpoints`     | Int      | No       | `0`                 | Distinct endpoints          |
| `top_endpoints`        | JSON     | No       | `[]`                | Top 10 endpoints            |
| `created_at`           | DateTime | No       | `now()`             | Creation timestamp          |
| `updated_at`           | DateTime | No       | `now()`             | Last modification timestamp |

**Indexes:**

- Unique: `(org_id, period)`
- Composite: `org_id`, `period`

---

### WebhookSecret

**Table:** `webhook_secrets`

HMAC secrets for signing outbound webhooks.

| Column       | Type     | Nullable | Default             | Description                         |
| ------------ | -------- | -------- | ------------------- | ----------------------------------- |
| `id`         | UUID     | No       | `gen_random_uuid()` | Primary key                         |
| `org_id`     | UUID     | No       | —                   | Organization                        |
| `endpoint`   | String   | No       | —                   | Webhook URL                         |
| `secret`     | String   | No       | —                   | Base64-encoded HMAC secret          |
| `algorithm`  | Enum     | No       | `HMAC_SHA256`       | Algorithm: HMAC_SHA256, HMAC_SHA512 |
| `is_active`  | Boolean  | No       | `true`              | Active flag                         |
| `rotated_at` | DateTime | Yes      | —                   | Last rotation                       |
| `created_at` | DateTime | No       | `now()`             | Creation timestamp                  |
| `updated_at` | DateTime | No       | `now()`             | Last modification timestamp         |

**Indexes:**

- Unique: `(org_id, endpoint)`
- Composite: `org_id`, `endpoint`

**Enums:**

```
WebhookSignatureAlgo: HMAC_SHA256 | HMAC_SHA512
```

---

## Soft Delete & Timestamp Conventions

### Standard Soft Delete Pattern

Many models use `is_active` (Boolean, default true) to implement soft deletes. Queries filter with `WHERE is_active = true`.

Some models may also have explicit `deleted_at` timestamps.

### Timestamp Conventions

All tables follow this pattern:

- **`created_at`:** Immutable creation timestamp, set to `now()` by default
- **`updated_at`:** Modified on every update via `@updatedAt` annotation
- **`*_at`** fields: ISO 8601 timestamps with timezone info

---

## Index Strategy

**Performance Indexes:**

- Composite indexes on frequently filtered columns: `(shop_id, status, created_at DESC)`
- Foreign key indexes: `(org_id)`, `(user_id)`, etc.
- Unique constraints for data integrity

**RLS Indexes:**

- Columns used in RLS policies are indexed for fast evaluation

---

## PostgreSQL Extensions

In production:

- **PostGIS:** For geometry types (Point, Polygon) in delivery zones, locations, and order coordinates
- **pgcrypto:** For UUID generation (`gen_random_uuid()`) and encryption
- **uuid-ossp:** For UUID functions (aliased to native UUID support in PostgreSQL 16)

---

## Next Steps for Schema Evolution

1. **PostGIS Restoration:** Uncomment geometry columns when PostGIS is enabled
2. **Additional Models:** Watch for new models in `schema/` folder (numbered prefixes)
3. **RLS Policies:** Stored in SQL migrations; audit in `migrations/` directory
4. **Performance Tuning:** Monitor slow queries; consider materialized views for reporting
