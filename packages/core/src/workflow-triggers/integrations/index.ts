/**
 * Integration Bridges for Workflow Triggers
 *
 * Provides bridges between external platforms (Shopify, etc.) and the workflow trigger system.
 */

export {
  ShopifyWorkflowBridge,
  type ShopifyOrderPayload,
  type ShopifyFulfillmentPayload,
  type WebhookProcessResult,
  type ShopifyBridgeOptions,
} from "./shopify-bridge.js";
