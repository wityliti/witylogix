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
