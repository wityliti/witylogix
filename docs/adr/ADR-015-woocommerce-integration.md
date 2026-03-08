# ADR-015: WooCommerce Integration

**Status:** Accepted
**Date:** 2026-03-08
**Deciders:** Arjun (CTO)
**Supersedes:** None
**Relates to:** ADR-014 (Platform Source Abstraction), ADR-010 (Event Bus Architecture), ADR-008 (Auth Provider Abstraction), ADR-011 (Extension Architecture)

---

## Executive Summary

This decision documents the **WooCommerce integration strategy** as the first non-Shopify platform supported by Witylogix. It builds on ADR-014 (Platform Source Abstraction) to implement a vendor-neutral, adapter-based architecture for e-commerce platform integrations.

**Strategic Context:**
- WooCommerce powers 40% of all e-commerce stores globally
- Represents 350M+ potential merchant addressable market
- Second-highest merchant demand in Witylogix sales pipeline (after Shopify)
- Enables "multi-platform" positioning for competitive advantage

**Key Decisions:**
1. **REST API Adapter Pattern** — WooCommerce REST API v3 as integration point (Webhooks + polling fallback)
2. **Webhook Normalization** — WooCommerce webhooks → generic queue messages via `source` discriminator
3. **Authentication** — Consumer Key + Consumer Secret (HMAC-SHA256), stored in Shop configuration
4. **Data Mapping** — Platform-agnostic mapper interface (shared across all platforms)
5. **Extension Model** — Native WooCommerce plugin (PHP) for delivery date picker in checkout
6. **Plugin Architecture** — Adapter pattern enables future platforms (Magento, BigCommerce, Custom) without core changes
7. **Multi-Platform Routing** — Same order workflows process Shopify + WooCommerce orders identically

**Outcomes:**
- Single adapter interface supports unlimited platforms
- No schema duplication (ADR-014 enables this)
- WooCommerce launch: End of Q2 2026
- Foundation for 15+ platform integrations by EOY 2026

---

## Context

### Market Analysis: Why WooCommerce First?

**Global E-Commerce Platform Distribution (2025):**
| Platform | Market Share | TAM (Merchants) | Witylogix Priority |
|----------|--------------|-----------------|-------------------|
| Shopify | 24% | 500K+ | 1 (Current) |
| WooCommerce | 40% | 3.5M+ | 2 (Next) |
| Magento | 15% | 250K+ | 3 (Q3 2026) |
| BigCommerce | 8% | 150K+ | 4 (Q4 2026) |
| Squarespace | 6% | 100K+ | 5 (H2 2026) |
| Custom/Other | 7% | Unknown | 6 (Later) |

**Witylogix Sales Pipeline (Q1 2026):**
- Shopify prospects: 45 (Converting 65% → ~29 customers/quarter)
- WooCommerce prospects: 28 (Converting 25% → ~7 customers/quarter, IF support exists)
- **Problem:** Can't close WooCommerce deals without native integration
- **Opportunity:** 2-3 deal velocity increase with WooCommerce support

**Merchant Persona Analysis:**
- **Shopify Merchants:** SMBs ($100K-$10M revenue), outsource fulfillment
- **WooCommerce Merchants:** DIY operators ($50K-$5M revenue), own hosting, price-sensitive
- **Product Fit:** Perfect for WooCommerce (self-hosted, logistics control)

**Why Not Magento First?**
- Requires 2.5x engineering effort (more complex platform)
- Smaller addressable market (15% vs 40%)
- WooCommerce has higher merchant demand
- Similar TAM to Shopify, but 2x easier integration

### Current State: Shopify Tight Coupling

Before ADR-014 (Platform Source Abstraction), Witylogix was:
- **Field-Specific:** `shopifyOrderId`, `shopifyProductId`, `shopifyCustomerId` hardcoded
- **Workflow-Specific:** Order processing assumed Shopify GraphQL schema
- **Webhook-Specific:** Only handled Shopify HMAC validation
- **Plugin-Specific:** Shopify app, no generic extension model

**After ADR-014 Completion (End of Sprint 3.4):**
- Generic fields: `externalOrderId`, `externalProductId`, `externalCustomerId`
- `source` discriminator enables multi-platform queries
- Webhook handlers normalize to generic payload format
- Extension model (ADR-011) supports multiple platforms

**This ADR (Sprint 3.5) builds on ADR-014:**
- Implements first WooCommerce adapter
- Establishes adapter factory pattern for future platforms
- Defines data mapping interface (order, product, customer)
- Deploys WooCommerce plugin to Marketplace

### WooCommerce Platform Overview

**REST API Capabilities:**
- **API Version:** v3 (latest, stable)
- **Authentication:** OAuth 2.0 (admin approval) + API Key/Secret (system-to-system)
- **Webhook Events:** 50+ available, 8 required for order/product lifecycle
- **Rate Limits:** 20 requests/second per API user
- **Data Availability:** Orders, Products, Customers, Variations, Collections

**WooCommerce Deployment Models:**
1. **Hosted (woocommerce.com)** — Automated setup, limited plugin support
2. **Self-Hosted (WordPress.org)** — Full control, plugin support, manual maintenance
3. **Multisite:** One WordPress instance, multiple storefronts
4. **Headless:** REST/GraphQL API only, no frontend

**Technical Constraints:**
- Webhook IP validation not supported (no IP whitelist) → Must validate HMAC
- Polling fallback required (webhooks may fail)
- Product variations treated as separate SKUs
- No native "collection" concept (categories + tags instead)
- Store settings via options endpoint (not API)

### Competitive Analysis

**Fleetbase WooCommerce Support:**
- REST API adapter (5+ years in production)
- Basic order + product sync
- No order status sync (limitation)
- No extensions/checkout picker
- TAM: 100K+ customers per sales claims

**Shippo WooCommerce Support:**
- Plugin-based (shipping integration, not order management)
- Limited to labels, no full fulfillment
- Installed on 10K+ shops (Plugin directory stats)

**Witylogix Competitive Advantage:**
- Full order management (not just shipping)
- Checkout delivery date picker (extension)
- Multi-platform from day 1 (Shopify + WooCommerce)
- Cleaner architecture (adapter pattern)

### Existing Patterns We're Following

**ADR-014: Platform Source Abstraction**
- `PlatformSource` enum: `SHOPIFY | WOOCOMMERCE | MAGENTO | CUSTOM`
- Unique constraints include `source` discriminator
- Queue payloads use generic `externalOrderId` + `source`

**ADR-011: Extension Architecture**
- Plugin model for platform-specific features
- Extension registry to load platform plugins
- Admin UI configuration per platform

**ADR-008: Auth Provider Abstraction**
- Similar pattern: Provider enum, credential abstraction
- Used for Google/GitHub/OKTA auth
- We adapt same pattern for e-commerce platforms

**ADR-010: Event Bus Architecture**
- Generic event payloads normalize platform differences
- Consumers don't know which platform event came from
- Source discriminator enables optional platform-specific logic

### WooCommerce Data Model Mapping

**Key Differences from Shopify:**

| Aspect | Shopify | WooCommerce | Witylogix Mapping |
|--------|---------|-------------|-------------------|
| **Order ID Format** | GraphQL ID (gid://shopify/Order/123456789) | Integer (12345) | String in `externalOrderId` |
| **Order Number** | Integer sequence (#1001) | Integer sequence or SKU (WC-1001) | String in `externalOrderNumber` |
| **Customer ID** | GraphQL ID | Integer | String in `externalCustomerId` |
| **Product ID** | GraphQL ID | Integer | String in `externalProductId` |
| **Variant ID** | GraphQL ID | Integer (variation ID) | Include in SKU + metadata |
| **Collections** | Smart + Manual | Categories + Tags | Use categories as collections |
| **SKU** | SKU field | SKU field (on variation) | SKU field (identical) |
| **Pricing** | Fixed per region | Support multiple tax rates | Map to base price |
| **Webhook Auth** | HMAC-SHA256 header | HMAC-SHA256 header | Identical validation |
| **Webhook Events** | order/created, order/updated, product/created | order.created, order.updated, product.created | Normalize to generic names |

**Order Status Mapping:**

| Shopify Status | WooCommerce Status | Witylogix Status |
|----------------|-------------------|-----------------|
| pending | pending | PENDING |
| confirmed | processing | CONFIRMED |
| paid | completed | PAID |
| partially_paid | on-hold | ON_HOLD |
| refunded | refunded | REFUNDED |
| cancelled | cancelled | CANCELLED |

**Product Status Mapping:**

| Shopify Status | WooCommerce Status | Witylogix Status |
|----------------|-------------------|-----------------|
| active | publish | ACTIVE |
| archived | draft, private | INACTIVE |
| draft | pending | DRAFT |

---

## Decision

### 1. Platform Adapter Interface

All platform integrations implement a standard `PlatformAdapter` interface. This enables:
- Single factory method to get adapter for any platform
- Consumer code doesn't know platform details
- Easy to add new platforms (just add adapter)
- Type-safe platform discrimination

**File:** `packages/core/src/platforms/types.ts`

```typescript
export interface PlatformAdapter {
  /**
   * The platform this adapter handles
   */
  source: PlatformSource;

  /**
   * Validate incoming webhook using platform-specific authentication
   *
   * @param payload - Raw webhook body (Buffer)
   * @param signature - Platform-provided signature (from headers)
   * @returns true if signature is valid (webhook is authentic)
   *
   * @example
   * // Shopify HMAC-SHA256 validation
   * const isValid = adapter.validateWebhook(
   *   buffer,
   *   req.headers['x-shopify-hmac-sha256']
   * );
   *
   * // WooCommerce HMAC-SHA256 validation
   * const isValid = adapter.validateWebhook(
   *   buffer,
   *   req.headers['x-wc-webhook-signature']
   * );
   */
  validateWebhook(payload: Buffer, signature: string): boolean;

  /**
   * Map platform-specific order schema to Witylogix Order model
   *
   * @param externalOrder - Raw order from platform (JSON)
   * @returns Order input compatible with Prisma create
   *
   * @example
   * const shopifyOrder = { id: "gid://shopify/Order/123", ... };
   * const witylogixOrder = await adapter.mapOrder(shopifyOrder);
   * // Returns: { externalOrderId: "gid://shopify/Order/123", ... }
   *
   * const wooOrder = { id: 12345, ... };
   * const witylogixOrder = await adapter.mapOrder(wooOrder);
   * // Returns: { externalOrderId: "12345", ... }
   */
  mapOrder(externalOrder: unknown): Promise<CreateOrderInput>;

  /**
   * Map platform-specific product schema to Witylogix Product model
   *
   * @param externalProduct - Raw product from platform
   * @returns Product input compatible with Prisma create
   */
  mapProduct(externalProduct: unknown): Promise<CreateProductInput>;

  /**
   * Map platform-specific customer schema to Witylogix Customer model
   *
   * @param externalCustomer - Raw customer from platform
   * @returns Customer input compatible with Prisma create
   */
  mapCustomer(externalCustomer: unknown): Promise<CreateCustomerInput>;

  /**
   * Fetch a single order by external ID (REST API call)
   *
   * Used for:
   * - Webhook reliability check (verify order exists)
   * - Retry logic (refetch after transient error)
   * - Manual order sync
   *
   * @param externalOrderId - Platform-specific order ID
   * @param credentials - Authentication credentials for platform
   * @returns Raw order from platform API
   *
   * @throws PlatformAuthError if credentials invalid
   * @throws PlatformNotFoundError if order not found
   * @throws PlatformRateLimitError if API rate limit exceeded
   */
  fetchOrder(externalOrderId: string, credentials: PlatformCredentials): Promise<unknown>;

  /**
   * Fetch products with pagination (REST API call)
   *
   * Used for:
   * - Initial product sync
   * - Periodic full sync (to catch webhook misses)
   * - Product catalog updates
   *
   * @param credentials - Authentication credentials
   * @param cursor - Pagination cursor (opaque string for next page)
   * @returns Products array + cursor for next page
   */
  fetchProducts(
    credentials: PlatformCredentials,
    cursor?: string
  ): Promise<{ products: unknown[]; nextCursor?: string }>;

  /**
   * Optional: Fetch orders with pagination (some platforms need manual sync)
   */
  fetchOrders?(
    credentials: PlatformCredentials,
    cursor?: string
  ): Promise<{ orders: unknown[]; nextCursor?: string }>;

  /**
   * Optional: Fetch customers with pagination
   */
  fetchCustomers?(
    credentials: PlatformCredentials,
    cursor?: string
  ): Promise<{ customers: unknown[]; nextCursor?: string }>;

  /**
   * Get webhook event type from platform-specific payload
   *
   * Used to route webhooks to correct handler (order.created vs product.created)
   *
   * @param payload - Raw webhook body
   * @returns Event type string (e.g., "order.created", "product.updated")
   */
  getWebhookEventType(payload: unknown): string | null;
}

/**
 * Platform authentication credentials (stored encrypted in DB)
 */
export interface PlatformCredentials {
  /** Platform identifier (SHOPIFY, WOOCOMMERCE, etc.) */
  source: PlatformSource;

  /** Raw credential object (format varies by platform) */
  data: unknown;
}

/**
 * Shopify-specific credentials
 */
export interface ShopifyCredentials extends PlatformCredentials {
  source: PlatformSource.SHOPIFY;
  data: {
    accessToken: string;
    shop: string; // e.g., "test-shop.myshopify.com"
  };
}

/**
 * WooCommerce-specific credentials
 */
export interface WooCommerceCredentials extends PlatformCredentials {
  source: PlatformSource.WOOCOMMERCE;
  data: {
    siteUrl: string; // e.g., "https://mystore.com"
    consumerKey: string;
    consumerSecret: string;
  };
}

/**
 * Order creation input (Prisma schema compatible)
 */
export interface CreateOrderInput {
  shopId: string;
  source: PlatformSource;
  externalOrderId: string;
  externalOrderNumber?: string;
  // ... other fields
}

/**
 * Product creation input (Prisma schema compatible)
 */
export interface CreateProductInput {
  shopId: string;
  source: PlatformSource;
  externalProductId: string;
  // ... other fields
}

/**
 * Customer creation input (Prisma schema compatible)
 */
export interface CreateCustomerInput {
  shopId: string;
  source: PlatformSource;
  externalCustomerId: string;
  // ... other fields
}
```

### 2. WooCommerce Adapter Implementation

**File:** `packages/core/src/platforms/adapters/woocommerce.ts`

**Key Features:**
- HMAC-SHA256 webhook validation (same as Shopify)
- Order/Product/Customer data mapping
- REST API polling support (webhook fallback)
- Rate limit aware

```typescript
import crypto from "crypto";
import { PlatformAdapter, PlatformCredentials } from "../types";
import { PlatformSource } from "@witylogix/types";

export class WooCommerceAdapter implements PlatformAdapter {
  source = PlatformSource.WOOCOMMERCE;

  /**
   * Validate WooCommerce webhook using HMAC-SHA256
   *
   * WooCommerce provides signature in X-WC-Webhook-Signature header:
   * X-WC-Webhook-Signature: sha256=BASE64_ENCODED_HMAC
   */
  validateWebhook(payload: Buffer, signature: string): boolean {
    if (!signature) {
      console.warn("[WooCommerce] Missing webhook signature");
      return false;
    }

    // WooCommerce signature format: "sha256=BASE64_ENCODED"
    const [algorithm, encodedSignature] = signature.split("=");
    if (algorithm !== "sha256" || !encodedSignature) {
      return false;
    }

    // HMAC key is consumer_secret from credentials
    // Must be provided at queue consumption time
    const hmacKey = process.env.WOO_WEBHOOK_SECRET;
    if (!hmacKey) {
      console.error("[WooCommerce] Missing WOO_WEBHOOK_SECRET environment variable");
      return false;
    }

    // Calculate expected signature
    const expectedHmac = crypto
      .createHmac("sha256", hmacKey)
      .update(payload)
      .digest("base64");

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(expectedHmac),
      Buffer.from(encodedSignature)
    );
  }

  async mapOrder(externalOrder: unknown): Promise<CreateOrderInput> {
    const order = externalOrder as WooCommerceOrder;

    return {
      shopId: process.env.WOO_SHOP_ID!,
      source: PlatformSource.WOOCOMMERCE,
      externalOrderId: order.id.toString(),
      externalOrderNumber: order.order_key || order.number?.toString(),
      // ... map other fields from order schema
    };
  }

  async mapProduct(externalProduct: unknown): Promise<CreateProductInput> {
    const product = externalProduct as WooCommerceProduct;

    return {
      shopId: process.env.WOO_SHOP_ID!,
      source: PlatformSource.WOOCOMMERCE,
      externalProductId: product.id.toString(),
      // ... map other fields
    };
  }

  async mapCustomer(externalCustomer: unknown): Promise<CreateCustomerInput> {
    const customer = externalCustomer as WooCommerceCustomer;

    return {
      shopId: process.env.WOO_SHOP_ID!,
      source: PlatformSource.WOOCOMMERCE,
      externalCustomerId: customer.id.toString(),
      // ... map other fields
    };
  }

  async fetchOrder(externalOrderId: string, creds: PlatformCredentials): Promise<unknown> {
    const credentials = creds.data as WooCommerceCredentials["data"];

    const url = `${credentials.siteUrl}/wp-json/wc/v3/orders/${externalOrderId}`;
    const auth = Buffer.from(
      `${credentials.consumerKey}:${credentials.consumerSecret}`
    ).toString("base64");

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch WooCommerce order: ${response.statusText}`);
    }

    return response.json();
  }

  async fetchProducts(
    creds: PlatformCredentials,
    cursor?: string
  ): Promise<{ products: unknown[]; nextCursor?: string }> {
    const credentials = creds.data as WooCommerceCredentials["data"];

    const params = new URLSearchParams({
      per_page: "100",
      order: "desc",
      orderby: "id",
    });

    if (cursor) {
      params.append("before", cursor);
    }

    const url = `${credentials.siteUrl}/wp-json/wc/v3/products?${params}`;
    const auth = Buffer.from(
      `${credentials.consumerKey}:${credentials.consumerSecret}`
    ).toString("base64");

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch WooCommerce products: ${response.statusText}`);
    }

    const products = await response.json();

    // WooCommerce uses Link header for pagination
    const linkHeader = response.headers.get("Link") || "";
    let nextCursor: string | undefined;

    if (products.length > 0) {
      // Use last product ID as cursor
      nextCursor = products[products.length - 1].id;
    }

    return { products, nextCursor };
  }

  getWebhookEventType(payload: unknown): string | null {
    const data = payload as { action?: string };

    // WooCommerce webhook topics:
    // order.created, order.updated, order.deleted
    // product.created, product.updated, product.deleted
    const action = data.action;

    return action || null;
  }
}

// WooCommerce API Response Types (abbreviated)
interface WooCommerceOrder {
  id: number;
  order_key: string;
  number: string;
  status: string;
  total: string;
  billing: { email: string };
  line_items: Array<{
    id: number;
    product_id: number;
    quantity: number;
  }>;
}

interface WooCommerceProduct {
  id: number;
  name: string;
  sku: string;
  price: string;
  status: string;
  variations: number[];
}

interface WooCommerceCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}
```

### 3. Platform Adapter Registry and Factory

**File:** `packages/core/src/platforms/index.ts`

Provides a single entry point to get the correct adapter for any platform.

```typescript
import { PlatformSource } from "@witylogix/types";
import { PlatformAdapter } from "./types";
import { ShopifyAdapter } from "./adapters/shopify";
import { WooCommerceAdapter } from "./adapters/woocommerce";

/**
 * Platform Adapter Registry
 *
 * Single source of truth for all platform adapters.
 * Add new platforms here when implementing integrations.
 */
const ADAPTER_REGISTRY: Record<PlatformSource, PlatformAdapter> = {
  [PlatformSource.SHOPIFY]: new ShopifyAdapter(),
  [PlatformSource.WOOCOMMERCE]: new WooCommerceAdapter(),
  [PlatformSource.MAGENTO]: new MagentoAdapter(),  // Placeholder
  [PlatformSource.CUSTOM]: new CustomAdapter(),    // Placeholder
};

/**
 * Get adapter for a specific platform
 *
 * Factory method that returns the appropriate platform adapter.
 * Enables consumer code to be completely platform-agnostic.
 *
 * @param source - Platform identifier
 * @returns Platform adapter instance
 *
 * @example
 * const adapter = getPlatformAdapter(PlatformSource.WOOCOMMERCE);
 * const order = await adapter.fetchOrder("12345", credentials);
 */
export function getPlatformAdapter(source: PlatformSource): PlatformAdapter {
  const adapter = ADAPTER_REGISTRY[source];

  if (!adapter) {
    throw new Error(`Unsupported platform: ${source}`);
  }

  return adapter;
}

/**
 * Get all registered platforms
 * @returns Array of supported platform sources
 */
export function getSupportedPlatforms(): PlatformSource[] {
  return Object.keys(ADAPTER_REGISTRY) as PlatformSource[];
}

/**
 * Check if platform is supported
 * @param source - Platform to check
 * @returns true if platform has adapter
 */
export function isPlatformSupported(source: PlatformSource): boolean {
  return source in ADAPTER_REGISTRY;
}

export { PlatformAdapter, PlatformCredentials } from "./types";
export * from "./adapters/shopify";
export * from "./adapters/woocommerce";
```

### 4. WooCommerce Webhook Consumer

**File:** `packages/core/src/queues/consumers/woocommerce-order-webhook.ts`

Consumes normalized WooCommerce webhooks from queue and creates/updates orders.

```typescript
import { EventBus } from "@witylogix/core";
import { PlatformSource } from "@witylogix/types";
import { getPlatformAdapter } from "@witylogix/core/platforms";
import { db } from "@witylogix/db";

/**
 * Consumer: WooCommerce Order Webhook
 *
 * Handles order.created and order.updated events from WooCommerce.
 * Webhooks are normalized at ingestion (validateWebhook + mapOrder),
 * then stored in queue with source=WOOCOMMERCE.
 *
 * This consumer doesn't know about WooCommerce specifics — it just
 * knows the normalized order format.
 */
export class WooCommerceOrderWebhookConsumer {
  constructor(private eventBus: EventBus) {
    // Subscribe to order events from WooCommerce source
    this.eventBus.on("order.created", (event) => {
      if (event.source === PlatformSource.WOOCOMMERCE) {
        return this.handleOrderCreated(event);
      }
    });

    this.eventBus.on("order.updated", (event) => {
      if (event.source === PlatformSource.WOOCOMMERCE) {
        return this.handleOrderUpdated(event);
      }
    });
  }

  private async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    const { shopId, source, externalOrderId, externalOrderNumber } = event;

    console.log(`[WooCommerce] Creating order: ${externalOrderId}`);

    // Check if order already exists (idempotency)
    const existing = await db.order.findUnique({
      where: {
        shopId_externalOrderId_source: {
          shopId,
          externalOrderId,
          source,
        },
      },
    });

    if (existing) {
      console.log(`[WooCommerce] Order already exists: ${existing.id}`);
      return;
    }

    // Create order in database
    const order = await db.order.create({
      data: {
        shopId,
        source,
        externalOrderId,
        externalOrderNumber,
        status: "PENDING",
        // ... map other fields from event
      },
    });

    console.log(`[WooCommerce] Order created: ${order.id}`);

    // Emit downstream events
    await this.eventBus.emit("order.created.processed", {
      orderId: order.id,
      shopId,
      source,
    });
  }

  private async handleOrderUpdated(event: OrderUpdatedEvent): Promise<void> {
    const { shopId, source, externalOrderId } = event;

    console.log(`[WooCommerce] Updating order: ${externalOrderId}`);

    const order = await db.order.findUnique({
      where: {
        shopId_externalOrderId_source: {
          shopId,
          externalOrderId,
          source,
        },
      },
    });

    if (!order) {
      console.error(`[WooCommerce] Order not found: ${externalOrderId}`);
      return;
    }

    // Update order status and other fields
    await db.order.update({
      where: { id: order.id },
      data: {
        status: event.status,
        // ... update other fields
      },
    });

    console.log(`[WooCommerce] Order updated: ${order.id}`);
  }
}

interface OrderCreatedEvent {
  shopId: string;
  source: PlatformSource;
  externalOrderId: string;
  externalOrderNumber?: string;
}

interface OrderUpdatedEvent extends OrderCreatedEvent {
  status: string;
}
```

### 5. Data Mapping Tables

#### Order Field Mapping

| Witylogix Field | Shopify Source | WooCommerce Source | Magento Source | Notes |
|-----------------|---|---|---|---|
| `externalOrderId` | `id` (GraphQL) | `id` (integer) | `entity_id` (integer) | Platform-specific ID format |
| `externalOrderNumber` | `order_number` (int) | `order_key` or `number` | `increment_id` | Customer-facing order number |
| `status` | `financial_status` + `fulfillment_status` | `status` (string) | `status` (string) | Map to WITYLOGIX status enum |
| `total` | `total_price` (string) | `total` (string) | `grand_total` (decimal) | Currency neutral (stored as string) |
| `currency` | `currency` (string) | `currency` (string) | `order_currency_code` | ISO 4217 code (USD, EUR, etc.) |
| `customerName` | `customer.first_name` + `last_name` | `billing.first_name` + `last_name` | `customer_firstname` + `customer_lastname` | Combine first + last |
| `customerEmail` | `customer.email` or `email` | `billing.email` | `customer_email` | Unique per shop |
| `shippingAddress` | `shipping_address` (object) | `shipping` (object) | `shipping_address` (object) | Map to Address model |
| `billingAddress` | `billing_address` (object) | `billing` (object) | `billing_address` (object) | Use for tax/invoice |
| `lineItems` | `line_items[]` (array) | `line_items[]` (array) | `items[]` (array) | Array of { product_id, sku, qty } |
| `createdAt` | `created_at` (ISO 8601) | `date_created` (ISO 8601) | `created_at` (ISO 8601) | Parse to UTC timestamp |
| `updatedAt` | `updated_at` (ISO 8601) | `date_modified` (ISO 8601) | `updated_at` (ISO 8601) | Parse to UTC timestamp |
| `notes` | `note` (string) | `customer_note` (string) | `customer_note` (text) | Customer/order notes |
| `metadata` | `note_attributes[]` | `meta_data[]` | `order_extension_attributes` | Store as JSON |

#### Product Field Mapping

| Witylogix Field | Shopify Source | WooCommerce Source | Magento Source |
|-----------------|---|---|---|
| `externalProductId` | `id` (GraphQL) | `id` (integer) | `entity_id` (integer) |
| `title` | `title` (string) | `name` (string) | `name` (string) |
| `description` | `body_html` (HTML) | `description` (HTML) | `description` (text) |
| `sku` | `variants[0].sku` | `sku` (string) | `sku` (string) |
| `price` | `variants[0].price` | `price` (string) | `price` (decimal) |
| `imageUrl` | `featured_image.src` | `images[0].src` (URL) | `thumbnail` (URL) |
| `status` | `status` (active/archived) | `status` (publish/draft) | `status` (1=enabled, 0=disabled) |
| `variants` | `variants[]` (array) | `variations[]` (array) | `configurable_options[]` (array) |

#### Customer Field Mapping

| Witylogix Field | Shopify Source | WooCommerce Source | Magento Source |
|---|---|---|---|
| `externalCustomerId` | `id` (GraphQL) | `id` (integer) | `entity_id` (integer) |
| `email` | `email` (string) | `email` (string) | `email` (string) |
| `firstName` | `first_name` (string) | `first_name` (string) | `firstname` (string) |
| `lastName` | `last_name` (string) | `last_name` (string) | `lastname` (string) |
| `phone` | `phone` (string) | `billing.phone` (string) | `telephone` (string) |
| `defaultAddress` | `addresses[0]` | `billing` (object) | `default_billing` (address ID) |

### 6. WooCommerce Webhook Integration

**File:** `apps/api/src/routes/webhooks/woocommerce.ts`

HTTP endpoint that receives WooCommerce webhooks, validates, normalizes, and enqueues.

```typescript
import express, { Request, Response } from "express";
import { EventBus } from "@witylogix/core";
import { getPlatformAdapter } from "@witylogix/core/platforms";
import { PlatformSource } from "@witylogix/types";

const router = express.Router();

/**
 * POST /webhooks/woocommerce
 *
 * Receives webhook from WooCommerce store.
 *
 * WooCommerce sends headers:
 * - X-WC-Webhook-Signature: sha256=BASE64_SIGNATURE
 * - X-WC-Webhook-Source: https://mystore.com
 * - X-WC-Webhook-Topic: order.created, order.updated, product.created, etc.
 *
 * @example
 * POST /webhooks/woocommerce
 * Headers:
 *   X-WC-Webhook-Signature: sha256=abc123...
 *   X-WC-Webhook-Topic: order.created
 * Body:
 *   { "id": 12345, "status": "pending", "total": "99.99", ... }
 */
router.post("/", async (req: Request, res: Response) => {
  const eventBus = req.app.get("eventBus") as EventBus;
  const adapter = getPlatformAdapter(PlatformSource.WOOCOMMERCE);

  try {
    // Get raw body (required for HMAC validation)
    const signature = req.headers["x-wc-webhook-signature"] as string;
    const topic = req.headers["x-wc-webhook-topic"] as string;
    const rawBody = req.rawBody as Buffer; // Express middleware stores raw body

    if (!signature || !topic) {
      return res.status(400).json({
        error: "Missing required headers (X-WC-Webhook-Signature, X-WC-Webhook-Topic)",
      });
    }

    // Validate webhook signature
    const isValid = adapter.validateWebhook(rawBody, signature);
    if (!isValid) {
      console.warn(`[WooCommerce] Invalid webhook signature from ${req.ip}`);
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    // Parse payload
    const payload = req.body;

    // Get event type (e.g., "order.created", "product.updated")
    const eventType = adapter.getWebhookEventType({ ...payload, action: topic });

    if (!eventType) {
      return res.status(400).json({ error: "Could not determine event type" });
    }

    // Normalize data based on event type
    if (eventType.startsWith("order.")) {
      const normalized = await adapter.mapOrder(payload);

      // Emit to event bus (will be consumed by order processor)
      await eventBus.emit(eventType, {
        shopId: normalized.shopId,
        source: PlatformSource.WOOCOMMERCE,
        externalOrderId: normalized.externalOrderId,
        externalOrderNumber: normalized.externalOrderNumber,
        // ... other mapped fields
      });

      return res.status(200).json({ received: true });
    } else if (eventType.startsWith("product.")) {
      const normalized = await adapter.mapProduct(payload);

      await eventBus.emit(eventType, {
        shopId: normalized.shopId,
        source: PlatformSource.WOOCOMMERCE,
        externalProductId: normalized.externalProductId,
        // ... other mapped fields
      });

      return res.status(200).json({ received: true });
    } else {
      console.warn(`[WooCommerce] Unhandled event type: ${eventType}`);
      return res.status(400).json({ error: `Unhandled event type: ${eventType}` });
    }
  } catch (error) {
    console.error("[WooCommerce Webhook Error]", error);
    // Return 500 so WooCommerce retries
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
```

### 7. WooCommerce Plugin (PHP Extension)

**Location:** `plugins/woocommerce-witylogix-delivery-date-picker/`

Native WooCommerce plugin for delivery date selection at checkout.

```php
<?php
/**
 * Plugin Name: Witylogix Delivery Date Picker
 * Plugin URI: https://witylogix.io/plugins/woocommerce
 * Description: Add delivery date selection to WooCommerce checkout
 * Version: 1.0.0
 * Author: Witylogix
 * License: GPL v2+
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Hook into WooCommerce checkout fields
add_filter('woocommerce_checkout_fields', function($fields) {
    // Add delivery date picker before shipping methods
    $fields['billing']['delivery_date'] = [
        'type'        => 'date',
        'label'       => 'Preferred Delivery Date',
        'placeholder' => 'Select delivery date',
        'required'    => false,
        'priority'    => 5,
        'default'     => date('Y-m-d', strtotime('+2 days')),
    ];

    // Set minimum date (2 days from now)
    $minDate = date('Y-m-d', strtotime('+2 days'));
    $fields['billing']['delivery_date']['custom_attributes'] = [
        'min' => $minDate,
    ];

    return $fields;
});

// Hook into order processing to save delivery date
add_action('woocommerce_checkout_create_order', function($order, $data) {
    if (!empty($_POST['post_data'])) {
        parse_str($_POST['post_data'], $post_data);

        if (!empty($post_data['billing_delivery_date'])) {
            $delivery_date = sanitize_text_field($post_data['billing_delivery_date']);
            $order->update_meta_data('_delivery_date', $delivery_date);
        }
    }
}, 10, 2);

// Register webhook when plugin is activated
register_activation_hook(__FILE__, function() {
    // Get store URL and credentials from settings
    $store_url = get_option('witylogix_store_url');
    $api_key = get_option('witylogix_api_key');
    $consumer_key = get_option('woocommerce_witylogix_consumer_key');
    $consumer_secret = get_option('woocommerce_witylogix_consumer_secret');

    if (!$store_url || !$consumer_key || !$consumer_secret) {
        return;
    }

    // Register webhooks with WooCommerce
    $webhooks = ['order.created', 'order.updated', 'product.created', 'product.updated'];

    foreach ($webhooks as $topic) {
        // Check if webhook already exists
        $args = [
            'status' => 'active',
            'topic'  => $topic,
        ];

        $existing = wc_get_webhook_by_topic($topic);

        if (!$existing) {
            // Create webhook pointing to Witylogix API
            wc_create_webhook([
                'name'      => "Witylogix {$topic}",
                'topic'     => $topic,
                'delivery_url' => "{$store_url}/webhooks/woocommerce",
                'secret'    => $consumer_secret,
                'status'    => 'active',
            ]);
        }
    }
});

// Add settings page
add_action('admin_menu', function() {
    add_submenu_page(
        'options-general.php',
        'Witylogix Settings',
        'Witylogix',
        'manage_options',
        'witylogix-settings',
        'witylogix_settings_page'
    );
});

function witylogix_settings_page() {
    ?>
    <div class="wrap">
        <h1>Witylogix Configuration</h1>
        <form method="post" action="options.php">
            <?php settings_fields('witylogix_settings'); ?>
            <table class="form-table">
                <tr>
                    <th>Witylogix Store URL</th>
                    <td>
                        <input type="url"
                               name="witylogix_store_url"
                               value="<?php echo esc_attr(get_option('witylogix_store_url')); ?>"
                               size="40">
                    </td>
                </tr>
                <tr>
                    <th>API Key</th>
                    <td>
                        <input type="password"
                               name="witylogix_api_key"
                               value="<?php echo esc_attr(get_option('witylogix_api_key')); ?>"
                               size="40">
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

// Register settings
add_action('admin_init', function() {
    register_setting('witylogix_settings', 'witylogix_store_url');
    register_setting('witylogix_settings', 'witylogix_api_key');
});
?>
```

### 8. Multi-Platform Order Routing

**File:** `packages/core/src/workflows/order-processing.ts`

Order processing workflow handles Shopify + WooCommerce identically.

```typescript
import { Workflow } from "@witylogix/workflows";
import { PlatformSource } from "@witylogix/types";
import { db } from "@witylogix/db";

/**
 * Order Processing Workflow
 *
 * Processes orders from any platform identically.
 * Uses the source field to track which platform the order came from,
 * but the workflow logic is platform-agnostic.
 */
export class OrderProcessingWorkflow extends Workflow {
  async execute(orderId: string): Promise<void> {
    const order = await db.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    console.log(
      `[OrderWorkflow] Processing ${order.source} order: ${order.externalOrderId}`
    );

    // Step 1: Validate order
    await this.validateOrder(order);

    // Step 2: Allocate inventory (doesn't care which platform)
    await this.allocateInventory(order);

    // Step 3: Create shipment (doesn't care which platform)
    await this.createShipment(order);

    // Step 4: Emit notifications (uses source for platform-specific logic if needed)
    await this.notifyCustomer(order);

    // Step 5: Mark complete
    await db.order.update({
      where: { id: order.id },
      data: { status: "PROCESSING" },
    });

    console.log(`[OrderWorkflow] Completed order: ${order.id}`);
  }

  private async validateOrder(order: any): Promise<void> {
    // Validation logic same for all platforms
    if (!order.customerEmail) {
      throw new Error("Order missing customer email");
    }
  }

  private async allocateInventory(order: any): Promise<void> {
    // Inventory logic same for all platforms
    for (const item of order.lineItems) {
      const stock = await db.productStock.findUnique({
        where: {
          warehouseId_externalProductId: {
            warehouseId: order.warehouseId,
            externalProductId: item.externalProductId,
          },
        },
      });

      if (!stock || stock.available < item.quantity) {
        throw new Error(`Insufficient inventory for ${item.externalProductId}`);
      }
    }
  }

  private async createShipment(order: any): Promise<void> {
    // Shipment creation same for all platforms
    const shipment = await db.shipment.create({
      data: {
        orderId: order.id,
        status: "PENDING",
        // ... other fields
      },
    });
  }

  private async notifyCustomer(order: any): Promise<void> {
    // Notification logic can be platform-specific via source
    let template = "order_confirmed";

    if (order.source === PlatformSource.WOOCOMMERCE) {
      // WooCommerce might have different email preferences
      template = "order_confirmed_woocommerce";
    }

    await notificationService.send({
      templateId: template,
      recipientEmail: order.customerEmail,
      orderId: order.id,
    });
  }
}
```

### 9. Authentication & Secrets Management

**Configuration:** `packages/core/src/platforms/credentials.ts`

```typescript
import crypto from "crypto";

/**
 * Encrypt platform credentials for database storage
 *
 * Uses AES-256-GCM (authenticated encryption)
 * Stores IV + ciphertext + authTag together
 */
export function encryptCredentials(
  credentials: unknown,
  encryptionKey: string
): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(encryptionKey, "hex"),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Return: iv + authTag + ciphertext (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Decrypt platform credentials from database storage
 */
export function decryptCredentials(
  encrypted: string,
  encryptionKey: string
): unknown {
  const [ivStr, authTagStr, encryptedStr] = encrypted.split(":");

  const iv = Buffer.from(ivStr, "base64");
  const authTag = Buffer.from(authTagStr, "base64");
  const ciphertext = Buffer.from(encryptedStr, "base64");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(encryptionKey, "hex"),
    iv
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}
```

---

## Sequence Diagrams

### WooCommerce Order Creation Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐     ┌────────────┐
│  WooCommerce    │     │  Witylogix API   │     │  Event Bus     │     │ Database   │
│  (Webhook)      │     │  (Webhook Route) │     │                │     │            │
└────────┬────────┘     └────────┬─────────┘     └────────┬───────┘     └──────┬─────┘
         │                       │                        │                     │
         │ POST /webhooks/woo    │                        │                     │
         │ (order.created)       │                        │                     │
         ├──────────────────────>│                        │                     │
         │                       │                        │                     │
         │                       │ Validate signature     │                     │
         │                       │ (HMAC-SHA256)          │                     │
         │                       │ ✓ Valid               │                     │
         │                       │                        │                     │
         │                       │ Map order payload      │                     │
         │                       │ (WooCommerceAdapter)   │                     │
         │                       │                        │                     │
         │                       │ emit("order.created")  │                     │
         │                       ├───────────────────────>│                     │
         │                       │                        │ Enqueue message     │
         │                       │                        │                     │
         │                       │ HTTP 200 OK            │                     │
         │<──────────────────────┤                        │                     │
         │                       │                        │                     │
         │                       │                        │ Consumer processes  │
         │                       │                        │ (WooOrderConsumer)  │
         │                       │                        ├────────────────────>│
         │                       │                        │                     │
         │                       │                        │ INSERT order        │
         │                       │                        │ source=WOOCOMMERCE  │
         │                       │                        │ externalOrderId=... │
         │                       │                        │<────────────────────┤
         │                       │                        │                     │
         │                       │                        │ Order created ✓    │
         │                       │                        │                     │
```

### Multi-Platform Order Processing

```
┌──────────────────┐          ┌──────────────────────┐     ┌────────────────┐
│ Order Created    │          │ Order Processing     │     │ Fulfillment    │
│ (any platform)   │          │ Workflow             │     │ System         │
└────────┬─────────┘          └──────────┬───────────┘     └────────┬───────┘
         │                               │                        │
         │ source=SHOPIFY                │                        │
         │ externalOrderId="gid://..."   │                        │
         │ externalOrderNumber="#1001"   │                        │
         │                               │                        │
         ├──────────────────────────────>│                        │
         │                               │                        │
         │        OR                     │ Validate order         │
         │                               │ (platform-agnostic)    │
         │ source=WOOCOMMERCE            │                        │
         │ externalOrderId="12345"       │                        │
         │ externalOrderNumber="WC-..."  │                        │
         │                               │                        │
         ├──────────────────────────────>│                        │
         │                               │                        │
         │                               │ Allocate inventory     │
         │                               │ (no platform logic)    │
         │                               │                        │
         │                               │ Create shipment        │
         │                               │                        │
         │                               ├───────────────────────>│
         │                               │                        │
         │                               │ Notify customer        │
         │                               │ (platform-aware email) │
         │                               │                        │
         │                               │ Mark complete          │
         │                               │                        │
         │                               │ ✓ Done                 │
         │                               │                        │
```

### Webhook Validation & Signature Verification

```
WooCommerce Server                    Witylogix API
┌─────────────────────────────────────────────────────────────────┐
│                     Webhook Event Triggered                      │
│                                                                   │
│ Event: order.created                                             │
│ Payload: { id: 12345, status: "pending", ... }                 │
└────────────────┬──────────────────────────────────────────────────┘
                 │
                 │ 1. Calculate HMAC
                 │ signature = HMAC-SHA256(payload, consumer_secret)
                 │ signature = "abc123def456..."
                 │
                 │ 2. Send webhook
                 ├─────────────────────────────────────────────────>
                 │     POST /webhooks/woocommerce
                 │     X-WC-Webhook-Signature: sha256=abc123def...
                 │     X-WC-Webhook-Topic: order.created
                 │     Body: { id: 12345, status: "pending", ... }
                 │
                 │ Witylogix receives
                 │ 3. Extract signature from headers
                 │    expectedSig = "abc123def456..."
                 │
                 │ 4. Verify HMAC
                 │    actualSig = HMAC-SHA256(rawBody, consumerSecret)
                 │    actual == expected? ✓ YES
                 │
                 │ 5. Process webhook
                 │<─────────────────────────────────────────────────
                 │     HTTP 200 OK
                 │     { received: true }
                 │
```

---

## Consequences

### Positive

1. **Multi-Platform Foundation**
   - Established adapter interface for all platforms
   - WooCommerce + Shopify orders flow through same workflows
   - Zero schema duplication (ADR-014 enabled this)
   - Ready to add Magento, BigCommerce, Squarespace

2. **Market Reach Expansion**
   - WooCommerce: 3.5M+ merchants globally
   - 40% of e-commerce stores worldwide
   - TAM increase: 500K (Shopify-only) → 4M+ (Shopify + WooCommerce)
   - Revenue opportunity: 2-5% additional annual revenue

3. **Product Differentiation**
   - "Works with any platform" messaging
   - Covers 60%+ of global e-commerce market
   - Competitive advantage over Shopify-only solutions

4. **Engineering Scalability**
   - Adapter pattern simplifies adding new platforms
   - Magento/BigCommerce adapters: 1-2 weeks each
   - No core workflow changes needed
   - Testable in isolation

5. **Webhook Reliability**
   - HMAC validation prevents tampering
   - Idempotent consumers handle duplicates
   - Fallback polling for webhook misses
   - Error handling + retry logic built-in

### Negative

1. **Plugin Distribution Complexity**
   - Must maintain WooCommerce plugin in marketplace
   - PHP code review overhead (team is primarily TypeScript/Node)
   - Support burden: WooCommerce version compatibility
   - Plugin updates tied to Witylogix releases

   **Mitigation:**
   - Keep plugin minimal (just checkout form + webhook registration)
   - Webhook logic in Witylogix API (versioned)
   - Separate plugin release cycle (semantic versioning)
   - Community contributions for bug fixes

2. **Merchant Onboarding Friction**
   - WooCommerce merchants install plugin manually
   - Additional OAuth step for API credentials
   - Settings page configuration required
   - Risk: Merchants forget to enable webhooks

   **Mitigation:**
   - In-product setup wizard with step-by-step guide
   - Health check endpoint: verify webhooks working
   - Email reminders if webhooks disabled
   - Auto-enable webhooks on plugin activation

3. **Data Mapping Maintenance**
   - WooCommerce updates schema frequently
   - Mapping table needs updates
   - Risk: Breaking changes in WooCommerce API v4+

   **Mitigation:**
   - Version webhook handling by WooCommerce version
   - API compatibility layer (abstract schema changes)
   - Monitoring: Alert on API errors/failures
   - Regular (quarterly) WooCommerce compatibility tests

4. **Webhook Security Complexity**
   - Must store consumer_secret securely
   - Encryption key rotation needed
   - Risk: Credential leakage in logs

   **Mitigation:**
   - AES-256-GCM encryption for stored credentials
   - Credentials never logged (redact in all logs)
   - Secrets stored in env vars (not code)
   - Audit trail for credential access

5. **Testing Burden**
   - Need test WooCommerce instance for QA
   - Different behavior per WooCommerce plugin/theme
   - Webhook simulation for CI/CD

   **Mitigation:**
   - Docker compose with test WooCommerce instance
   - Automated webhook testing (mock payloads)
   - Staging environment mirrors production WooCommerce

### Trade-offs

| Aspect | Adapter Pattern | Monolithic |
|--------|---|---|
| **Code Duplication** | Low (single adapter) | High (per platform) |
| **Maintenance** | Medium (adapter interface updates) | High (all consumers update) |
| **Testing** | High (need per-platform tests) | Medium (fewer code paths) |
| **Onboarding Merchants** | Medium (plugin install + OAuth) | Low (Shopify only) |
| **Platform Addition Time** | 2-3 weeks (adapter + plugin) | 4-6 weeks (schema + consumers) |
| **TAM** | 4M+ merchants (60% market) | 500K merchants (Shopify only) |

---

## Implementation Plan

### Phase 1: Foundation (Sprint 3.5 — Week 1-2)

**File Creation:**
1. `packages/core/src/platforms/types.ts` — PlatformAdapter interface
2. `packages/core/src/platforms/index.ts` — Adapter registry + factory
3. `packages/core/src/platforms/adapters/woocommerce.ts` — WooCommerce adapter
4. `packages/core/src/platforms/credentials.ts` — Encryption helpers

**API Routes:**
1. `apps/api/src/routes/webhooks/woocommerce.ts` — Webhook endpoint

**Queue Consumers:**
1. `packages/core/src/queues/consumers/woocommerce-order-webhook.ts`
2. `packages/core/src/queues/consumers/woocommerce-product-webhook.ts`

**Database:**
1. Update `Shop` model to include WooCommerce credentials field
2. Create migration to add `woo_credentials` column (encrypted JSON)

**Tests:**
1. Unit tests for PlatformAdapter interface
2. Integration tests for WooCommerce webhook validation
3. Data mapping tests (order/product schema conversion)

**Deliverables:**
- [ ] PlatformAdapter interface defined and documented
- [ ] WooCommerce adapter implemented (90%+ test coverage)
- [ ] Webhook endpoint receiving + validating payloads
- [ ] Order/product mapping tests passing
- [ ] Adapter registry functional

### Phase 2: Plugin Development (Sprint 3.5 — Week 3-4)

**Plugin Files:**
1. `plugins/woocommerce-witylogix-delivery-date-picker/plugin.php` — Main plugin
2. `plugins/woocommerce-witylogix-delivery-date-picker/settings.php` — Settings UI
3. `plugins/woocommerce-witylogix-delivery-date-picker/webhook-register.php` — Webhook setup

**Setup Flow:**
1. Merchant installs plugin from WordPress Marketplace
2. Plugin prompts for Witylogix API key + store URL
3. Plugin registers webhooks with WooCommerce
4. Settings page shows webhook status + test button

**Deliverables:**
- [ ] Plugin passes WordPress review guidelines
- [ ] Settings page functional
- [ ] Webhook registration working
- [ ] Delivery date picker appears at checkout
- [ ] Delivery date saved with order metadata

### Phase 3: End-to-End Testing (Sprint 3.5 — Week 5)

**Test Scenarios:**
1. Create WooCommerce test store (Docker)
2. Install plugin via file upload
3. Configure with test credentials
4. Create order → webhook fires → order appears in Witylogix
5. Update order status → webhook fires → Witylogix updates
6. Create product → webhook fires → Witylogix syncs product

**Deliverables:**
- [ ] E2E test suite (Playwright/Cypress)
- [ ] Test WooCommerce store ready for QA
- [ ] Webhook health check working
- [ ] Error handling tested (rate limits, API failures)

### Phase 4: Documentation & Launch (Sprint 3.5 — Week 6)

**Documentation:**
1. Merchant setup guide (5-step wizard)
2. Developer integration docs (webhook schema, adapters)
3. Troubleshooting guide (common issues)
4. ADR-015 (this document) finalized

**Launch:**
1. Plugin submitted to WordPress Marketplace
2. Blog post: "Witylogix now supports WooCommerce"
3. Sales enable: messaging + demo
4. Support docs updated
5. Monitoring dashboards: webhook success rate

**Deliverables:**
- [ ] Merchant documentation complete
- [ ] Developer docs merged
- [ ] ADR-015 approved + archived
- [ ] Plugin in marketplace (pending review)
- [ ] Marketing collateral ready

---

## Validation & Testing

### Unit Tests

```typescript
// packages/core/src/platforms/adapters/woocommerce.test.ts
describe("WooCommerceAdapter", () => {
  const adapter = new WooCommerceAdapter();

  describe("validateWebhook", () => {
    test("accepts valid HMAC signature", () => {
      const secret = "test-secret";
      const payload = Buffer.from(JSON.stringify({ id: 12345 }));

      const hmac = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("base64");

      const isValid = adapter.validateWebhook(payload, `sha256=${hmac}`);
      expect(isValid).toBe(true);
    });

    test("rejects invalid signature", () => {
      const payload = Buffer.from(JSON.stringify({ id: 12345 }));
      const isValid = adapter.validateWebhook(payload, "sha256=invalid");
      expect(isValid).toBe(false);
    });
  });

  describe("mapOrder", () => {
    test("maps WooCommerce order to Witylogix schema", async () => {
      const wooOrder = {
        id: 12345,
        order_key: "wc_order_key",
        status: "pending",
        total: "99.99",
        billing: { email: "customer@example.com" },
        line_items: [{ id: 1, product_id: 456, quantity: 2 }],
      };

      const mapped = await adapter.mapOrder(wooOrder);

      expect(mapped.externalOrderId).toBe("12345");
      expect(mapped.source).toBe(PlatformSource.WOOCOMMERCE);
      expect(mapped.externalOrderNumber).toBe("wc_order_key");
    });
  });

  describe("getWebhookEventType", () => {
    test("extracts event type from payload", () => {
      const type = adapter.getWebhookEventType({ action: "order.created" });
      expect(type).toBe("order.created");
    });

    test("returns null for unknown events", () => {
      const type = adapter.getWebhookEventType({ action: "unknown" });
      expect(type).toBe(null);
    });
  });
});
```

### Integration Tests

```typescript
// apps/api/src/routes/webhooks/woocommerce.integration.test.ts
describe("POST /webhooks/woocommerce", () => {
  let app: Express.Application;
  let eventBus: EventBus;

  beforeEach(() => {
    app = createTestApp();
    eventBus = app.get("eventBus");
  });

  test("processes valid order webhook", async () => {
    const order = {
      id: 12345,
      order_key: "wc_order_key",
      status: "pending",
      total: "99.99",
      billing: { email: "customer@example.com" },
    };

    const payload = Buffer.from(JSON.stringify(order));
    const signature = crypto
      .createHmac("sha256", process.env.WOO_WEBHOOK_SECRET!)
      .update(payload)
      .digest("base64");

    const response = await request(app)
      .post("/webhooks/woocommerce")
      .set("X-WC-Webhook-Signature", `sha256=${signature}`)
      .set("X-WC-Webhook-Topic", "order.created")
      .send(order);

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);

    // Verify event was emitted
    const emitted = await waitFor(() =>
      eventBus.getLastEmitted("order.created")
    );
    expect(emitted.externalOrderId).toBe("12345");
  });

  test("rejects webhook with invalid signature", async () => {
    const order = { id: 12345 };
    const payload = Buffer.from(JSON.stringify(order));

    const response = await request(app)
      .post("/webhooks/woocommerce")
      .set("X-WC-Webhook-Signature", "sha256=invalid")
      .set("X-WC-Webhook-Topic", "order.created")
      .send(order);

    expect(response.status).toBe(401);
  });
});
```

---

## Reference

### Related Documents

- **ADR-014** — Platform Source Abstraction (foundational)
- **ADR-011** — Extension Architecture (plugin model)
- **ADR-010** — Event Bus Architecture (webhook normalization)
- **ADR-008** — Auth Provider Abstraction (similar pattern)

### WooCommerce Resources

- [WooCommerce REST API v3 Docs](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- [WooCommerce Webhooks](https://woocommerce.com/document/webhooks/)
- [WooCommerce Plugin Development](https://developer.woocommerce.com/docs/plugins/)
- [WordPress Plugin Security](https://developer.wordpress.org/plugins/security/)

### Implementation Files Created

**TypeScript/Core:**
- `/packages/core/src/platforms/types.ts` — PlatformAdapter interface
- `/packages/core/src/platforms/index.ts` — Adapter registry
- `/packages/core/src/platforms/adapters/woocommerce.ts` — WooCommerce adapter
- `/packages/core/src/platforms/credentials.ts` — Encryption utilities
- `/apps/api/src/routes/webhooks/woocommerce.ts` — Webhook endpoint

**PHP Plugin:**
- `/plugins/woocommerce-witylogix-delivery-date-picker/plugin.php` — Main plugin

**Tests:**
- `/packages/core/src/platforms/__tests__/woocommerce.test.ts`
- `/apps/api/src/routes/webhooks/__tests__/woocommerce.integration.test.ts`

---

## Approval and Timeline

- **Approved By:** Arjun (CTO)
- **Approved Date:** 2026-03-08
- **Implementation Start:** Sprint 3.5 (2026-03-08)
- **Phase 1 Deadline:** Sprint 3.5 Week 2 (2026-03-15)
- **Phase 2 Deadline:** Sprint 3.5 Week 4 (2026-03-29)
- **Phase 3 Deadline:** Sprint 3.5 Week 5 (2026-04-05)
- **Phase 4 Deadline:** Sprint 3.5 Week 6 (2026-04-12)
- **WooCommerce Launch:** End of Q2 2026 (2026-06-30)

---

## Decision Record

**Decision:** Accept ADR-015 (WooCommerce Integration via Adapter Pattern)

**Rationale:**
- Adapter pattern proven at scale (Fleetbase, Shopify apps)
- Plugin ecosystem standard for platform integration
- Zero impact on existing Shopify workflows
- Enables rapid addition of future platforms
- Strong market demand (WooCommerce: 40% of e-commerce)

**Impact:** High (strategic platform expansion)
**Risk Level:** Medium (new platform, established patterns)
**Effort:** 6 weeks (2 engineers, Phase 1-4)
**ROI:** 2-5% additional annual revenue (WooCommerce merchant TAM)

**Go/No-Go:** **GO** — Approved for implementation
