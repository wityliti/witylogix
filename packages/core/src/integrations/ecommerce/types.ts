/**
 * E-Commerce Integration Types
 * Shared types for Magento, BigCommerce, Shopify, and WooCommerce adapters
 */

/**
 * Order Status mapping across platforms
 */
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "dispatched"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "failed";

/**
 * Fulfillment Status
 */
export type FulfillmentStatus =
  | "pending"
  | "partial"
  | "complete"
  | "cancelled";

/**
 * Payment Status
 */
export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "refunded"
  | "failed";

/**
 * E-Commerce Order Line Item
 */
export interface ECommerceLineItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  variantId?: string;
  customAttributes?: Record<string, unknown>;
}

/**
 * E-Commerce Order Address
 */
export interface ECommerceAddress {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province?: string;
  state?: string;
  postalCode: string;
  country: string;
  email?: string;
  phone?: string;
}

/**
 * E-Commerce Order
 */
export interface ECommerceOrder {
  id: string; // Platform-specific order ID
  externalId: string; // External/order number visible to customers
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  currency: string;
  totalAmount: number;
  subtotalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  customer: ECommerceCustomer;
  billingAddress: ECommerceAddress;
  shippingAddress: ECommerceAddress;
  lineItems: ECommerceLineItem[];
  shippingMethod?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  customAttributes?: Record<string, unknown>;
}

/**
 * E-Commerce Product Variant
 */
export interface ECommerceVariant {
  id: string;
  sku: string;
  title?: string;
  price: number;
  compareAtPrice?: number;
  costAmount?: number;
  inventory: ECommerceInventory;
  weight?: number;
  weightUnit?: "lb" | "kg" | "g" | "oz";
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: "in" | "cm" | "m";
  };
  attributes?: Record<string, string>;
  image?: {
    url: string;
    altText?: string;
  };
  customAttributes?: Record<string, unknown>;
}

/**
 * E-Commerce Product
 */
export interface ECommerceProduct {
  id: string;
  title: string;
  description?: string;
  status: "active" | "draft" | "archived";
  productType?: string;
  vendor?: string;
  tags?: string[];
  variants: ECommerceVariant[];
  images?: Array<{
    url: string;
    altText?: string;
  }>;
  category?: {
    id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
  customAttributes?: Record<string, unknown>;
}

/**
 * E-Commerce Inventory
 */
export interface ECommerceInventory {
  variantId: string;
  quantity: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  warehouseId?: string;
  trackQuantity: boolean;
  allowNegativeStock: boolean;
  updatedAt: Date;
}

/**
 * E-Commerce Customer
 */
export interface ECommerceCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  acceptsMarketing: boolean;
  taxExempt?: boolean;
  defaultAddress?: ECommerceAddress;
  addresses?: ECommerceAddress[];
  createdAt: Date;
  updatedAt: Date;
  customAttributes?: Record<string, unknown>;
}

/**
 * E-Commerce Webhook Event
 */
export interface ECommerceWebhookEvent {
  id: string;
  platform: "magento" | "bigcommerce" | "shopify" | "woocommerce";
  topic: string;
  event: string;
  createdAt: Date;
  data: ECommerceOrder | ECommerceProduct | ECommerceCustomer;
  signature?: string;
}

/**
 * Fulfillment Item
 */
export interface FulfillmentItem {
  lineItemId: string;
  quantity: number;
}

/**
 * Fulfillment Request
 */
export interface FulfillmentRequest {
  items: FulfillmentItem[];
  trackingCompany?: string;
  trackingNumber?: string;
  notifyCustomer?: boolean;
}

/**
 * Fulfillment Response
 */
export interface FulfillmentResponse {
  id: string;
  orderId: string;
  status: FulfillmentStatus;
  items: FulfillmentItem[];
  trackingInfo?: {
    company: string;
    number: string;
    url?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Inventory Update Request
 */
export interface InventoryUpdateRequest {
  variantId: string;
  quantity: number;
  warehouseId?: string;
  reason?: "sale" | "return" | "adjustment" | "recount";
}

/**
 * Sync Status
 */
export interface SyncStatus {
  platform: string;
  lastSyncAt: Date | null;
  nextSyncAt?: Date;
  status: "idle" | "syncing" | "error";
  lastError?: string;
}

/**
 * Sync Options
 */
export interface SyncOptions {
  since?: Date;
  limit?: number;
  chunkSize?: number;
  conflictResolution?: "last-write-wins" | "external-wins" | "internal-wins";
  includeArchived?: boolean;
}

/**
 * Sync Result
 */
export interface SyncResult {
  platform: string;
  entityType: "order" | "product" | "customer";
  created: number;
  updated: number;
  deleted: number;
  failed: number;
  duration: number; // milliseconds
  startedAt: Date;
  completedAt: Date;
  errors: Array<{
    id: string;
    error: string;
  }>;
}

/**
 * E-Commerce Adapter Interface
 */
export interface IECommerceAdapter {
  // Order operations
  getOrders(options?: SyncOptions): Promise<ECommerceOrder[]>;
  getOrderById(orderId: string): Promise<ECommerceOrder>;
  updateOrder(orderId: string, data: Partial<ECommerceOrder>): Promise<ECommerceOrder>;

  // Product operations
  getProducts(options?: SyncOptions): Promise<ECommerceProduct[]>;
  getProductById(productId: string): Promise<ECommerceProduct>;
  createProduct(product: ECommerceProduct): Promise<ECommerceProduct>;
  updateProduct(productId: string, data: Partial<ECommerceProduct>): Promise<ECommerceProduct>;

  // Customer operations
  getCustomers(options?: SyncOptions): Promise<ECommerceCustomer[]>;
  getCustomerById(customerId: string): Promise<ECommerceCustomer>;
  updateCustomer(customerId: string, data: Partial<ECommerceCustomer>): Promise<ECommerceCustomer>;

  // Fulfillment operations
  createFulfillment(orderId: string, request: FulfillmentRequest): Promise<FulfillmentResponse>;
  updateFulfillment(orderId: string, fulfillmentId: string, data: Partial<FulfillmentResponse>): Promise<FulfillmentResponse>;

  // Inventory operations
  updateInventory(request: InventoryUpdateRequest): Promise<ECommerceInventory>;
  getInventory(variantId: string): Promise<ECommerceInventory>;

  // Webhook handling
  verifyWebhookSignature(payload: unknown, signature: string): boolean;
  parseWebhookEvent(payload: unknown): ECommerceWebhookEvent;

  // Health check
  healthCheck(): Promise<boolean>;

  // Connection validation
  validateConnection(): Promise<boolean>;
}

/**
 * E-Commerce Adapter Configuration
 */
export interface ECommerceAdapterConfig {
  platform: "magento" | "bigcommerce" | "shopify" | "woocommerce";
  storeUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  webhookSecret?: string;
  timeout?: number;
  rateLimit?: number;
  retries?: number;
  customAttributes?: Record<string, unknown>;
}

/**
 * Rate Limiter Config
 */
export interface RateLimiterConfig {
  requestsPerSecond: number;
  windowMs?: number;
  maxBurst?: number;
}

/**
 * Circuit Breaker Config
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitoringIntervalMs?: number;
}

/**
 * Retry Config
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
}

/**
 * Request/Response Log
 */
export interface RequestLog {
  timestamp: Date;
  method: string;
  endpoint: string;
  statusCode: number;
  duration: number;
  cached: boolean;
  error?: string;
}

/**
 * Audit Log Entry
 */
export interface AuditLogEntry {
  timestamp: Date;
  platform: string;
  entityType: string;
  entityId: string;
  action: "create" | "update" | "delete" | "sync";
  changes?: Record<string, {
    from: unknown;
    to: unknown;
  }>;
  userId?: string;
  source: "api" | "webhook" | "sync";
}
