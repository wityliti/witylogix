/**
 * @witylogix/core/platforms/types
 * Platform adapter interface and types
 *
 * Defines the core interface that all e-commerce platform integrations
 * must implement. This enables Witylogix to support multiple platforms
 * (Shopify, WooCommerce, Magento, custom) with a unified adapter pattern.
 *
 * See ADR-015: WooCommerce Integration
 */

import { PlatformSource } from "@witylogix/types";

/**
 * Platform adapter interface
 *
 * All e-commerce platforms are integrated through adapters that implement
 * this interface. This ensures consistent behavior across platforms while
 * allowing platform-specific implementations.
 *
 * @example
 * ```typescript
 * const adapter = getPlatformAdapter(PlatformSource.WOOCOMMERCE);
 * const order = await adapter.mapOrder(woocommerceOrderPayload);
 * const isValid = adapter.validateWebhook(payload, signature);
 * ```
 */
export interface PlatformAdapter {
  /**
   * The platform source this adapter handles
   *
   * Used to identify which adapter to use for a given order/product/customer.
   */
  source: PlatformSource;

  /**
   * Validate incoming webhook using platform-specific authentication
   *
   * Each platform uses its own authentication method:
   * - Shopify: HMAC-SHA256 (X-Shopify-Hmac-SHA256 header)
   * - WooCommerce: HMAC-SHA256 (X-WC-Webhook-Signature header)
   * - Magento: HMAC-SHA256 (X-Magento-Signature header)
   *
   * This method prevents webhook spoofing by verifying the signature matches
   * the platform's secret key.
   *
   * @param payload - Raw webhook body (Buffer, required for signature verification)
   * @param signature - Platform-provided signature (from webhook headers)
   * @returns true if signature is valid and webhook is authentic, false otherwise
   *
   * @throws Error if signature validation fails (security issue)
   *
   * @example
   * ```typescript
   * // In webhook handler
   * const rawBody = req.rawBody; // Must be Buffer, not parsed JSON
   * const signature = req.headers['x-wc-webhook-signature'];
   * const isValid = adapter.validateWebhook(rawBody, signature);
   *
   * if (!isValid) {
   *   return res.status(401).json({ error: 'Invalid signature' });
   * }
   * ```
   */
  validateWebhook(payload: Buffer, signature: string): boolean;

  /**
   * Map platform-specific order schema to Witylogix Order model
   *
   * Transforms the platform's order format (which varies by platform)
   * into Witylogix's normalized order format. This is the key function
   * that enables platform-agnostic order processing.
   *
   * Responsible for:
   * - Extracting external order ID (format varies by platform)
   * - Mapping order status to Witylogix status enum
   * - Normalizing customer information
   * - Converting line items to Witylogix format
   * - Handling platform-specific data (stored in metadata)
   *
   * @param externalOrder - Raw order from platform API (JSON parsed)
   * @returns Normalized order input compatible with Prisma create/update
   *
   * @throws Error if order is missing required fields
   *
   * @example
   * ```typescript
   * // Shopify order
   * const shopifyOrder = {
   *   id: "gid://shopify/Order/123456789",
   *   order_number: 1001,
   *   status: "pending",
   *   // ... other Shopify fields
   * };
   * const witylogixOrder = await shopifyAdapter.mapOrder(shopifyOrder);
   * // Returns: { externalOrderId: "gid://shopify/Order/123456789", ... }
   *
   * // WooCommerce order
   * const wooOrder = {
   *   id: 12345,
   *   order_key: "wc_order_123",
   *   status: "pending",
   *   // ... other WooCommerce fields
   * };
   * const witylogixOrder = await wooAdapter.mapOrder(wooOrder);
   * // Returns: { externalOrderId: "12345", externalOrderNumber: "wc_order_123", ... }
   * ```
   */
  mapOrder(externalOrder: unknown): Promise<CreateOrderInput>;

  /**
   * Map platform-specific product schema to Witylogix Product model
   *
   * Transforms platform product data to Witylogix format.
   *
   * Responsible for:
   * - Extracting product ID and SKU
   * - Normalizing product status
   * - Converting pricing information
   * - Handling variations/options
   * - Storing platform-specific metadata
   *
   * @param externalProduct - Raw product from platform API
   * @returns Normalized product input compatible with Prisma
   *
   * @throws Error if product is missing required fields
   *
   * @example
   * ```typescript
   * const wooProduct = { id: 456, sku: "ABC123", name: "Widget", ... };
   * const mapped = await adapter.mapProduct(wooProduct);
   * // Returns: { externalProductId: "456", sku: "ABC123", ... }
   * ```
   */
  mapProduct(externalProduct: unknown): Promise<CreateProductInput>;

  /**
   * Map platform-specific customer schema to Witylogix Customer model
   *
   * Transforms platform customer data to Witylogix format.
   *
   * Responsible for:
   * - Extracting customer ID
   * - Normalizing name, email, phone
   * - Converting address information
   * - Storing platform-specific metadata
   *
   * @param externalCustomer - Raw customer from platform API
   * @returns Normalized customer input compatible with Prisma
   *
   * @throws Error if customer is missing required fields
   *
   * @example
   * ```typescript
   * const wooCustomer = { id: 789, email: "customer@example.com", ... };
   * const mapped = await adapter.mapCustomer(wooCustomer);
   * // Returns: { externalCustomerId: "789", email: "customer@example.com", ... }
   * ```
   */
  mapCustomer(externalCustomer: unknown): Promise<CreateCustomerInput>;

  /**
   * Fetch a single order by external ID (REST API call)
   *
   * Used for several scenarios:
   * - Webhook reliability check (verify order exists before processing)
   * - Retry logic (refetch stale data after transient error)
   * - Manual order sync (merchant-triggered full sync)
   * - Order detail enrichment (get full order after webhook summary)
   *
   * This method makes an actual API call to the platform, so it should
   * include proper error handling and retry logic for network failures.
   *
   * @param externalOrderId - Platform-specific order ID
   * @param credentials - Authentication credentials for platform API
   * @returns Raw order from platform API (unparsed/unmapped)
   *
   * @throws PlatformAuthError if credentials invalid or expired
   * @throws PlatformNotFoundError if order not found
   * @throws PlatformRateLimitError if API rate limit exceeded
   * @throws NetworkError if API is unreachable
   *
   * @example
   * ```typescript
   * const credentials = {
   *   source: PlatformSource.WOOCOMMERCE,
   *   data: { siteUrl: "https://mystore.com", consumerKey: "...", ... }
   * };
   * try {
   *   const order = await adapter.fetchOrder("12345", credentials);
   *   // order is raw WooCommerce API response
   * } catch (error) {
   *   if (error instanceof PlatformAuthError) {
   *     // Handle auth failure (refresh token?)
   *   } else if (error instanceof PlatformRateLimitError) {
   *     // Backoff and retry
   *   }
   * }
   * ```
   */
  fetchOrder(
    externalOrderId: string,
    credentials: PlatformCredentials,
  ): Promise<unknown>;

  /**
   * Fetch products with pagination (REST API call)
   *
   * Used for:
   * - Initial product sync (when merchant first connects)
   * - Periodic full sync (catch any webhook misses)
   * - Product catalog refresh (after bulk updates)
   *
   * Returns paginated results with cursor for fetching next batch.
   * The cursor is opaque (platform-specific) and only meaningful within
   * a single fetch session.
   *
   * @param credentials - Authentication credentials for platform API
   * @param cursor - Pagination cursor (undefined = first page)
   * @returns Products array + cursor for next page (if more results)
   *
   * @throws PlatformAuthError if credentials invalid
   * @throws PlatformRateLimitError if API rate limit exceeded
   * @throws NetworkError if API is unreachable
   *
   * @example
   * ```typescript
   * let cursor: string | undefined;
   * const allProducts = [];
   *
   * do {
   *   const { products, nextCursor } = await adapter.fetchProducts(credentials, cursor);
   *   allProducts.push(...products);
   *   cursor = nextCursor;
   * } while (cursor);
   *
   * console.log(`Fetched ${allProducts.length} products`);
   * ```
   */
  fetchProducts(
    credentials: PlatformCredentials,
    cursor?: string,
  ): Promise<{ products: unknown[]; nextCursor?: string }>;

  /**
   * Optional: Fetch orders with pagination
   *
   * Some platforms (like WooCommerce) don't have reliable webhooks,
   * so polling orders is necessary. Other platforms (Shopify) have
   * very reliable webhooks, so this is less critical.
   *
   * Only implement if platform webhooks are unreliable.
   *
   * @param credentials - Authentication credentials
   * @param cursor - Pagination cursor (undefined = first page)
   * @returns Orders array + cursor for next page
   *
   * @example
   * ```typescript
   * if (adapter.fetchOrders) {
   *   const { orders } = await adapter.fetchOrders(credentials);
   *   // Process orders
   * }
   * ```
   */
  fetchOrders?(
    credentials: PlatformCredentials,
    cursor?: string,
  ): Promise<{ orders: unknown[]; nextCursor?: string }>;

  /**
   * Optional: Fetch customers with pagination
   *
   * Only implement if platform supports customer sync.
   *
   * @param credentials - Authentication credentials
   * @param cursor - Pagination cursor
   * @returns Customers array + cursor
   */
  fetchCustomers?(
    credentials: PlatformCredentials,
    cursor?: string,
  ): Promise<{ customers: unknown[]; nextCursor?: string }>;

  /**
   * Get webhook event type from platform-specific payload
   *
   * Extracts the event type (e.g., "order.created", "product.updated")
   * from the raw webhook payload. Used to route webhooks to the correct
   * handler function.
   *
   * Different platforms use different formats:
   * - Shopify: topic from X-Shopify-Topic header
   * - WooCommerce: action field from topic query parameter
   * - Magento: eventType field from payload
   *
   * @param payload - Raw webhook body (JSON parsed)
   * @returns Event type string (e.g., "order.created") or null if unknown
   *
   * @example
   * ```typescript
   * // WooCommerce webhook payload
   * const payload = { id: 12345, status: "pending", action: "order.created" };
   * const eventType = adapter.getWebhookEventType(payload); // "order.created"
   *
   * // Route to appropriate handler
   * switch (eventType) {
   *   case 'order.created':
   *     await handleOrderCreated(payload);
   *     break;
   *   case 'order.updated':
   *     await handleOrderUpdated(payload);
   *     break;
   *   default:
   *     console.warn(`Unknown event: ${eventType}`);
   * }
   * ```
   */
  getWebhookEventType(payload: unknown): string | null;
}

/**
 * Platform authentication credentials
 *
 * Base interface for platform credentials. The `data` field is polymorphic
 * and contains platform-specific credential format.
 *
 * Used to:
 * - Authenticate API calls to the platform
 * - Validate webhook signatures
 * - Refresh access tokens
 *
 * Credentials should be:
 * - Stored encrypted in the database
 * - Never logged or exposed in errors
 * - Rotated periodically
 * - Revoked when integration is disabled
 *
 * @example
 * ```typescript
 * // Create and store credentials
 * const creds: PlatformCredentials = {
 *   source: PlatformSource.WOOCOMMERCE,
 *   data: {
 *     siteUrl: "https://mystore.com",
 *     consumerKey: "ck_abc123",
 *     consumerSecret: "cs_def456", // Should be encrypted before storing
 *   }
 * };
 *
 * const encrypted = encryptCredentials(creds, encryptionKey);
 * await db.shop.update({ credentials: encrypted });
 *
 * // Later: decrypt and use
 * const decrypted = decryptCredentials(encrypted, encryptionKey);
 * const adapter = getPlatformAdapter(decrypted.source);
 * const order = await adapter.fetchOrder("12345", decrypted);
 * ```
 */
export interface PlatformCredentials {
  /** Platform identifier (SHOPIFY, WOOCOMMERCE, MAGENTO, CUSTOM) */
  source: PlatformSource;

  /** Raw credential object (format varies by platform) */
  data: unknown;
}

/**
 * Shopify-specific credentials
 *
 * Uses OAuth 2.0 access token for API authentication.
 * Tokens expire after ~24 hours and must be refreshed.
 *
 * @example
 * ```typescript
 * const creds: ShopifyCredentials = {
 *   source: PlatformSource.SHOPIFY,
 *   data: {
 *     accessToken: "shpat_abc123def456",
 *     shop: "mystore.myshopify.com"
 *   }
 * };
 * ```
 */
export interface ShopifyCredentials extends PlatformCredentials {
  source: PlatformSource.SHOPIFY;
  data: {
    /** OAuth 2.0 access token from Shopify */
    accessToken: string;

    /** Shop domain (e.g., "mystore.myshopify.com") */
    shop: string;

    /** Optional: refresh token for token renewal */
    refreshToken?: string;

    /** Optional: token expiration timestamp */
    expiresAt?: number;
  };
}

/**
 * WooCommerce-specific credentials
 *
 * Uses HTTP Basic Auth with consumer key/secret for API authentication.
 * Credentials don't expire, but should be rotated periodically.
 *
 * @example
 * ```typescript
 * const creds: WooCommerceCredentials = {
 *   source: PlatformSource.WOOCOMMERCE,
 *   data: {
 *     siteUrl: "https://mystore.com",
 *     consumerKey: "ck_abc123",
 *     consumerSecret: "cs_def456"
 *   }
 * };
 * ```
 */
export interface WooCommerceCredentials extends PlatformCredentials {
  source: PlatformSource.WOOCOMMERCE;
  data: {
    /** Store URL (e.g., "https://mystore.com") */
    siteUrl: string;

    /** WooCommerce API consumer key */
    consumerKey: string;

    /** WooCommerce API consumer secret (use HMAC-SHA256 for webhooks) */
    consumerSecret: string;
  };
}

/**
 * Magento-specific credentials
 *
 * Uses Bearer token for API authentication.
 * Tokens expire and must be refreshed.
 */
export interface MagentoCredentials extends PlatformCredentials {
  source: PlatformSource.MAGENTO;
  data: {
    /** Store base URL (e.g., "https://mystore.magento.com") */
    storeUrl: string;

    /** OAuth 2.0 access token */
    accessToken: string;

    /** Token refresh token */
    refreshToken?: string;

    /** Token expiration timestamp */
    expiresAt?: number;
  };
}

/**
 * Custom/self-hosted platform credentials
 *
 * For custom integrations, the credential format is flexible.
 */
export interface CustomCredentials extends PlatformCredentials {
  source: PlatformSource.CUSTOM;
  data: Record<string, unknown>;
}

/**
 * Order creation input
 *
 * Normalized order format that all adapters produce.
 * Compatible with Prisma schema Order model.
 *
 * This is the "currency" that flows through Witylogix after platform mapping.
 */
export interface CreateOrderInput {
  /** Shop this order belongs to */
  shopId: string;

  /** Platform source (SHOPIFY, WOOCOMMERCE, etc.) */
  source: PlatformSource;

  /** External order ID (unique per shop + platform) */
  externalOrderId: string;

  /** External order number (customer-facing, like "#1001") */
  externalOrderNumber?: string;

  /** Order status (PENDING, CONFIRMED, PAID, etc.) */
  status?: string;

  /** Total order amount (as string to preserve precision) */
  total?: string;

  /** Currency code (ISO 4217, e.g., "USD") */
  currency?: string;

  /** Customer email address */
  customerEmail?: string;

  /** Customer name */
  customerName?: string;

  /** Shipping address */
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };

  /** Billing address */
  billingAddress?: {
    firstName?: string;
    lastName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };

  /** Line items in order */
  lineItems?: Array<{
    externalProductId: string;
    sku?: string;
    quantity: number;
    price?: string;
  }>;

  /** Customer notes (optional) */
  notes?: string;

  /** Order timestamp (ISO 8601) */
  createdAt?: Date;

  /** Last update timestamp */
  updatedAt?: Date;

  /** Platform-specific metadata (stored as JSON) */
  metadata?: Record<string, unknown>;
}

/**
 * Product creation input
 *
 * Normalized product format that all adapters produce.
 * Compatible with Prisma schema Product model.
 */
export interface CreateProductInput {
  /** Shop this product belongs to */
  shopId: string;

  /** Platform source */
  source: PlatformSource;

  /** External product ID (unique per shop + platform) */
  externalProductId: string;

  /** Product title/name */
  title?: string;

  /** Product description (may contain HTML) */
  description?: string;

  /** SKU (stock keeping unit) */
  sku?: string;

  /** Product price (as string) */
  price?: string;

  /** Currency code */
  currency?: string;

  /** Product status (ACTIVE, INACTIVE, DRAFT) */
  status?: string;

  /** Featured image URL */
  imageUrl?: string;

  /** Product variants (if any) */
  variants?: Array<{
    externalId: string;
    sku: string;
    price?: string;
  }>;

  /** Product timestamp */
  createdAt?: Date;

  /** Last update timestamp */
  updatedAt?: Date;

  /** Platform-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Customer creation input
 *
 * Normalized customer format that all adapters produce.
 * Compatible with Prisma schema Customer model.
 */
export interface CreateCustomerInput {
  /** Shop this customer belongs to */
  shopId: string;

  /** Platform source */
  source: PlatformSource;

  /** External customer ID (unique per shop + platform) */
  externalCustomerId: string;

  /** Customer email (unique per shop) */
  email?: string;

  /** First name */
  firstName?: string;

  /** Last name */
  lastName?: string;

  /** Phone number */
  phone?: string;

  /** Default address */
  defaultAddress?: {
    firstName?: string;
    lastName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };

  /** Customer timestamp */
  createdAt?: Date;

  /** Last update timestamp */
  updatedAt?: Date;

  /** Platform-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Webhook validation error
 */
export class WebhookValidationError extends Error {
  constructor(
    public readonly reason:
      | "invalid_signature"
      | "missing_signature"
      | "invalid_payload",
  ) {
    super(`Webhook validation failed: ${reason}`);
    this.name = "WebhookValidationError";
  }
}

/**
 * Platform API error (base class)
 */
export class PlatformError extends Error {
  constructor(
    public readonly platform: PlatformSource,
    message: string,
  ) {
    super(`[${platform}] ${message}`);
    this.name = "PlatformError";
  }
}

/**
 * Platform authentication error
 */
export class PlatformAuthError extends PlatformError {
  constructor(
    platform: PlatformSource,
    message: string = "Authentication failed",
  ) {
    super(platform, message);
    this.name = "PlatformAuthError";
  }
}

/**
 * Platform API rate limit error
 */
export class PlatformRateLimitError extends PlatformError {
  constructor(
    platform: PlatformSource,
    public readonly retryAfter?: number,
  ) {
    super(platform, `Rate limit exceeded`);
    this.name = "PlatformRateLimitError";
  }
}

/**
 * Platform resource not found error
 */
export class PlatformNotFoundError extends PlatformError {
  constructor(
    platform: PlatformSource,
    public readonly resourceId: string,
  ) {
    super(platform, `Resource not found: ${resourceId}`);
    this.name = "PlatformNotFoundError";
  }
}

export default PlatformAdapter;
