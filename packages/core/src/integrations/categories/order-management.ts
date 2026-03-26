/**
 * Order Management category — e-commerce platform integrations
 * for importing orders into Witylogix.
 */

import type { IntegrationAppMeta } from "../types.js";

export const ORDER_MANAGEMENT_INTEGRATIONS: readonly IntegrationAppMeta[] = [
  {
    slug: "shopify_orders",
    name: "Shopify Orders",
    description:
      "Native Shopify order sync — automatically imports orders from your Shopify store. Built into the platform.",
    longDescription:
      "Automatically syncs orders from your connected Shopify store. Orders are imported in real-time via webhooks " +
      "and can also be bulk-imported on demand. Supports order status updates, fulfillment creation, and tracking " +
      "number sync back to Shopify.",
    category: "ORDER_MANAGEMENT",
    websiteUrl: "https://www.shopify.com",
    docsUrl: "https://shopify.dev/docs/api/admin-rest",
    authType: "NONE",
    credentialFields: [],
    capabilities: ["order_import", "real_time_sync", "fulfillment_sync", "tracking_sync"],
    status: "AVAILABLE",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "woocommerce",
    name: "WooCommerce",
    description:
      "WooCommerce REST API integration — import orders from WordPress/WooCommerce stores.",
    category: "ORDER_MANAGEMENT",
    websiteUrl: "https://woocommerce.com",
    docsUrl: "https://woocommerce.github.io/woocommerce-rest-api-docs/",
    authType: "MULTI_CREDENTIAL",
    credentialFields: [
      { key: "storeUrl", label: "Store URL", placeholder: "https://yourstore.com", type: "url", required: true },
      { key: "consumerKey", label: "Consumer Key", placeholder: "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password", required: true, helpUrl: "https://woocommerce.github.io/woocommerce-rest-api-docs/#authentication" },
      { key: "consumerSecret", label: "Consumer Secret", placeholder: "cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password", required: true },
    ],
    capabilities: ["order_import", "webhook_sync", "fulfillment_sync"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "magento",
    name: "Adobe Commerce (Magento)",
    description:
      "Magento 2 / Adobe Commerce integration — import orders via REST API.",
    category: "ORDER_MANAGEMENT",
    websiteUrl: "https://business.adobe.com/products/magento/magento-commerce.html",
    docsUrl: "https://developer.adobe.com/commerce/webapi/rest/",
    authType: "MULTI_CREDENTIAL",
    credentialFields: [
      { key: "baseUrl", label: "Store URL", placeholder: "https://yourstore.com", type: "url", required: true },
      { key: "accessToken", label: "Integration Access Token", placeholder: "your-integration-token", type: "password", required: true },
    ],
    capabilities: ["order_import", "fulfillment_sync"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "custom_orders_api",
    name: "Custom API",
    description:
      "Generic webhook-based order ingestion — push orders from any system via a webhook endpoint.",
    category: "ORDER_MANAGEMENT",
    docsUrl: "https://docs.witylogix.com/integrations/custom-orders",
    authType: "API_KEY",
    credentialFields: [
      { key: "webhookSecret", label: "Webhook Secret", placeholder: "whsec_xxxxxxxxxxxxxxxx", type: "password", required: true },
    ],
    capabilities: ["order_import", "webhook_ingestion"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
];
