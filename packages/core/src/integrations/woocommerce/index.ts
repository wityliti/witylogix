/**
 * WooCommerce Integration Exports
 * Main entry point for WooCommerce REST API integration
 */

export {
  WooCommerceClient as WCRestApiClient,
  createWooCommerceClient as createWCRestApiClient,
} from "./wc-client.js";

export {
  OrderSyncService,
  createOrderSyncService,
} from "./order-sync.js";

export {
  ProductSyncService,
  createProductSyncService,
} from "./product-sync.js";

export {
  CustomerSyncService,
  createCustomerSyncService,
} from "./customer-sync.js";

export {
  WebhookConsumer,
  createWebhookConsumer,
} from "./webhook-consumer.js";

export type {
  WCOrder,
  WCAddress,
  WCLineItem,
  WCTaxLine,
  WCShippingLine,
  WCFeeLine,
  WCCouponLine,
  WCProduct,
  WCProductImage,
  WCProductVariation,
  WCCustomer,
  WCWebhook,
  WCWebhookPayload,
  WCClientConfig,
  WCSyncOptions,
  WCSyncResult,
  WCToWLOrderMapping,
  WCSyncRecord,
  OAuth1aSignature,
  WCPaginationOptions,
  WCAPIError,
  WCListResponse,
  WCOrderStatus,
  WLOrderStatus,
  WCProductType,
} from "./types.js";

export type {
  WebhookVerificationResult,
  WebhookEventHandler,
} from "./webhook-consumer.js";
