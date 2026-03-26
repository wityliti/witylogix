/**
 * Inventory Management category — warehouse and stock management integrations.
 */

import type { IntegrationAppMeta } from "../types.js";

export const INVENTORY_INTEGRATIONS: readonly IntegrationAppMeta[] = [
  {
    slug: "shopify_inventory",
    name: "Shopify Inventory",
    description:
      "Native Shopify inventory sync — real-time stock levels from your Shopify locations. Built into the platform.",
    category: "INVENTORY",
    websiteUrl: "https://www.shopify.com",
    docsUrl: "https://shopify.dev/docs/api/admin-rest/current/resources/inventorylevel",
    authType: "NONE",
    credentialFields: [],
    capabilities: ["stock_levels", "location_sync", "real_time_updates"],
    status: "AVAILABLE",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "skubana",
    name: "Extensiv (Skubana)",
    description:
      "Extensiv (formerly Skubana) — enterprise inventory and order management across multiple warehouses and channels.",
    category: "INVENTORY",
    websiteUrl: "https://www.extensiv.com",
    docsUrl: "https://developer.extensiv.com",
    authType: "MULTI_CREDENTIAL",
    credentialFields: [
      { key: "apiKey", label: "API Key", placeholder: "your-extensiv-api-key", type: "password", required: true },
      { key: "apiSecret", label: "API Secret", placeholder: "your-extensiv-api-secret", type: "password", required: true },
    ],
    capabilities: ["stock_levels", "multi_warehouse", "order_management", "forecasting"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "cin7",
    name: "Cin7 Core",
    description:
      "Cin7 Core — inventory management with built-in B2B e-commerce, POS, and warehouse management.",
    category: "INVENTORY",
    websiteUrl: "https://www.cin7.com",
    docsUrl: "https://api.cin7.com/docs",
    authType: "API_KEY",
    credentialFields: [
      { key: "apiKey", label: "API Key", placeholder: "your-cin7-api-key", type: "password", required: true, helpUrl: "https://go.cin7.com/Account/APIKey" },
    ],
    capabilities: ["stock_levels", "multi_warehouse", "b2b", "pos"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "stocky",
    name: "Shopify Stocky",
    description:
      "Stocky by Shopify — demand forecasting, purchase orders, and stock transfers for Shopify Plus merchants.",
    category: "INVENTORY",
    websiteUrl: "https://www.shopify.com/stocky",
    authType: "NONE",
    credentialFields: [],
    capabilities: ["demand_forecasting", "purchase_orders", "stock_transfers"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
];
