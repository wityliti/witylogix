/**
 * E-Commerce SDK Types
 * Shared types for Shopify and WooCommerce SDKs
 * Includes order, product, customer, inventory types and sync configuration
 */

import type {
  ECommerceOrder,
  ECommerceProduct,
  ECommerceCustomer,
  ECommerceInventory,
  OrderStatus,
  FulfillmentStatus,
  PaymentStatus,
} from "./types.js";

/**
 * E-Commerce Platform Type
 */
export type EcommercePlatform = "shopify" | "woocommerce";

/**
 * Shopify-specific configuration
 */
export interface ShopifyConfig {
  platform: "shopify";
  shopName: string;
  accessToken: string;
  apiVersion?: string;
  webhookSecret?: string;
  scopes?: string[];
}

/**
 * WooCommerce-specific configuration
 */
export interface WooCommerceConfig {
  platform: "woocommerce";
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  webhookSecret?: string;
}

/**
 * Union type for all platform configurations
 */
export type EcommerceSdkConfig = ShopifyConfig | WooCommerceConfig;

/**
 * Sync state enum
 */
export enum SyncStateStatus {
  SYNCED = "synced",
  PENDING = "pending",
  FAILED = "failed",
  DEAD_LETTER = "dead-letter",
}

/**
 * Sync direction enum
 */
export enum SyncDirection {
  INBOUND = "inbound",
  OUTBOUND = "outbound",
  BIDIRECTIONAL = "bidirectional",
}

/**
 * Conflict resolution strategy
 */
export enum ConflictResolution {
  LAST_WRITE_WINS = "last-write-wins",
  EXTERNAL_WINS = "external-wins",
  INTERNAL_WINS = "internal-wins",
  MANUAL_OVERRIDE = "manual-override",
}

/**
 * Sync state tracking
 */
export interface SyncStateRecord {
  id: string;
  orderId: string;
  platform: EcommercePlatform;
  direction: SyncDirection;
  status: SyncStateStatus;
  lastSyncAt: Date;
  lastSyncedHash: string;
  conflictResolution: ConflictResolution;
  retryCount: number;
  maxRetries?: number;
  lastError?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Field mapping for order sync
 */
export interface FieldMapConfig {
  witylogixField: string;
  platformField: string;
  direction: SyncDirection;
  transform?: (value: unknown) => unknown;
  reverseTransform?: (value: unknown) => unknown;
  required?: boolean;
}

/**
 * Status mapping for orders
 */
export interface StatusMapConfig {
  platform: EcommercePlatform;
  orderStatusMap: Record<string, OrderStatus>;
  reverseOrderStatusMap: Record<OrderStatus, string>;
  paymentStatusMap: Record<string, PaymentStatus>;
  fulfillmentStatusMap: Record<string, FulfillmentStatus>;
}

/**
 * Event types for order sync
 */
export interface OrderSyncEvent {
  id: string;
  type:
    | "order.synced"
    | "order.conflict"
    | "order.failed"
    | "order.retried"
    | "sync.started"
    | "sync.completed"
    | "sync.failed";
  platform: EcommercePlatform;
  orderId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Event types for inventory sync
 */
export interface InventorySyncEvent {
  id: string;
  type:
    | "inventory.synced"
    | "inventory.adjustment"
    | "inventory.failed"
    | "low_stock.alert";
  platform: EcommercePlatform;
  productId: string;
  variantId: string;
  timestamp: Date;
  previousQuantity?: number;
  currentQuantity?: number;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  platform: EcommercePlatform;
  direction: SyncDirection;
  conflictResolution: ConflictResolution;
  batchSize?: number;
  maxConcurrency?: number;
  retryPolicy?: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  fieldMappings?: FieldMapConfig[];
  statusMappings?: StatusMapConfig;
  webhookConfig?: {
    enabled: boolean;
    topics?: string[];
    verifySignature?: boolean;
  };
}

/**
 * Sync result for individual item
 */
export interface ItemSyncResult {
  id: string;
  success: boolean;
  created: boolean;
  updated: boolean;
  deleted: boolean;
  changeCount: number;
  duration: number;
  error?: string;
  warnings?: string[];
}

/**
 * Batch sync result
 */
export interface BatchSyncResult {
  id: string;
  platform: EcommercePlatform;
  startedAt: Date;
  completedAt: Date;
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  totalSkipped: number;
  results: ItemSyncResult[];
  metrics: {
    avgLatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    throughputPerSec: number;
  };
}

/**
 * Sync metrics for platform
 */
export interface SyncMetrics {
  platform: EcommercePlatform;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  ordersInSync: number;
  productsInSync: number;
  customersInSync: number;
  failedOrders: number;
  failedProducts: number;
  failedCustomers: number;
  lastSyncAt: Date;
  nextSyncAt?: Date;
  successRate: number;
  avgLatencyMs: number;
  deadLetterQueueSize: number;
}

/**
 * Webhook event payload
 */
export interface WebhookEventPayload {
  id: string;
  platform: EcommercePlatform;
  topic: string;
  resource: "order" | "product" | "customer" | "inventory";
  action: "created" | "updated" | "deleted";
  timestamp: Date;
  data: Record<string, unknown>;
  signature?: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  platform: EcommercePlatform;
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  checks: {
    apiConnectivity: boolean;
    authenticationValid: boolean;
    rateLimitStatus: {
      remaining: number;
      limit: number;
      resetAt: Date;
    };
    lastSuccessfulSync: Date | null;
    errorRate: number;
  };
  message?: string;
}

/**
 * Configuration for OAuth2 flow (Shopify)
 */
export interface OAuth2Config {
  platform: "shopify";
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * OAuth2 token response
 */
export interface OAuth2TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  refreshToken?: string;
  scope: string[];
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  platform: EcommercePlatform;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfter?: number;
}

/**
 * API error response
 */
export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
  retryable: boolean;
  retryAfter?: number;
}

/**
 * Logger interface for SDK
 */
export interface SdkLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

/**
 * SDK options
 */
export interface SdkOptions {
  logger?: SdkLogger;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  rateLimitWaitMs?: number;
  enableMetrics?: boolean;
}

/**
 * Inventory level info
 */
export interface InventoryLevelInfo {
  variantId: string;
  sku: string;
  location?: string;
  quantity: number;
  reserved?: number;
  available?: number;
  lastUpdated: Date;
}

/**
 * Low stock alert
 */
export interface LowStockAlert {
  productId: string;
  variantId: string;
  sku: string;
  currentQuantity: number;
  threshold: number;
  timestamp: Date;
}

/**
 * Batch operation request
 */
export interface BatchOperationRequest {
  id: string;
  type: "order" | "product" | "customer" | "inventory";
  operation: "create" | "update" | "delete";
  resource: Record<string, unknown>;
  dryRun?: boolean;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  requestId: string;
  success: boolean;
  resourceId?: string;
  error?: ApiError;
  duration: number;
}
