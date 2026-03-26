/**
 * E-Commerce Integration Module
 * Exports all e-commerce adapters, types, and utilities
 */

// Types
export type {
  OrderStatus,
  FulfillmentStatus,
  PaymentStatus,
  ECommerceLineItem,
  ECommerceAddress,
  ECommerceOrder,
  ECommerceVariant,
  ECommerceProduct,
  ECommerceInventory,
  ECommerceCustomer,
  ECommerceWebhookEvent,
  FulfillmentItem,
  FulfillmentRequest,
  FulfillmentResponse,
  InventoryUpdateRequest,
  SyncStatus,
  SyncOptions,
  SyncResult,
  IECommerceAdapter,
  ECommerceAdapterConfig,
  RateLimiterConfig,
  CircuitBreakerConfig,
  RetryConfig,
  RequestLog,
  AuditLogEntry,
} from "./types.js";

// Base adapter
export {
  RateLimiter,
  CircuitBreaker,
  RetryHandler,
  ECommerceAdapterBase,
} from "./ecommerce-adapter.js";

// Magento adapter
export {
  MagentoClient,
  createMagentoClient,
} from "./magento-client.js";

// BigCommerce adapter
export {
  BigCommerceClient,
  createBigCommerceClient,
} from "./bigcommerce-client.js";

// Sync engine
export {
  SyncEngine,
  createSyncEngine,
} from "./ecommerce-sync.js";

// Shopify SDK client
export {
  ShopifyClient,
  createShopifyClient,
} from "./shopify-sdk-client.js";
export type {
  ShopifyConfig,
  ShopifyOAuthConfig,
} from "./shopify-sdk-client.js";

// WooCommerce SDK client
export {
  WooCommerceClient,
  createWooCommerceClient,
} from "./woocommerce-sdk-client.js";
export type {
  WooCommerceConfig,
} from "./woocommerce-sdk-client.js";

// Magento SDK client
export {
  MagentoSDKClient,
  SearchCriteriaBuilder,
  createMagentoSDKClient,
  MagentoAPIError,
} from "./magento-sdk-client.js";
export type {
  MagentoConfig,
  MagentoOrderResponse,
  MagentoProductResponse,
  MagentoCustomerResponse,
  MagentoInvoiceResponse,
  MagentoShipmentResponse,
  MagentoCreditMemoResponse,
  MagentoSearchCriteria,
  MagentoSearchResults,
  MagentoCategoryResponse,
  MagentoQuoteResponse,
  MagentoMSISourceResponse,
  MagentoMSIStockResponse,
  MagentoMSISourceItemResponse,
  MagentoAsyncBulkRequest,
  MagentoAsyncBulkResponse,
  MagentoErrorResponse,
} from "./magento-types.js";

// Order sync engine
export {
  OrderSyncEngine,
  createOrderSyncEngine,
} from "./order-sync-engine.js";
export type {
  SyncState,
  SyncDirection,
  ConflictResolutionStrategy,
  FieldMapping,
  StatusMapping,
  SyncMetrics,
  SyncResult as OrderSyncResult,
  BatchSyncResult as OrderBatchSyncResult,
  WitylogixOrder,
} from "./order-sync-engine.js";

// SDK Types
export type {
  EcommercePlatform,
  ShopifyConfig as ShopifySdkConfig,
  WooCommerceConfig as WooCommerceSdkConfig,
  EcommerceSdkConfig,
  SyncStateStatus,
  SyncStateRecord,
  FieldMapConfig,
  StatusMapConfig,
  OrderSyncEvent,
  InventorySyncEvent,
  SyncConfig,
  ItemSyncResult,
  BatchSyncResult,
  SyncMetrics as SyncMetricsType,
  WebhookEventPayload,
  HealthCheckResult,
  OAuth2Config,
  OAuth2TokenResponse,
  RateLimitInfo,
  ApiError,
  SdkLogger,
  SdkOptions,
  InventoryLevelInfo,
  LowStockAlert,
  BatchOperationRequest,
  BatchOperationResult,
} from "./ecommerce-sdk-types.js";
