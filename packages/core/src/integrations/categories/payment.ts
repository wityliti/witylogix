/**
 * Payment category — payment processing integrations for
 * COD collection, tips, and POS delivery payments.
 */

import type { IntegrationAppMeta } from "../types.js";

export const PAYMENT_INTEGRATIONS: readonly IntegrationAppMeta[] = [
  {
    slug: "shopify_payments",
    name: "Shopify Payments",
    description:
      "Native Shopify payment processing — built-in payment handling through your Shopify store.",
    category: "PAYMENT",
    websiteUrl: "https://www.shopify.com/payments",
    docsUrl:
      "https://shopify.dev/docs/api/admin-rest/current/resources/payment",
    authType: "NONE",
    credentialFields: [],
    capabilities: ["payment_processing", "refunds", "payment_status"],
    status: "AVAILABLE",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "stripe",
    name: "Stripe",
    description:
      "Stripe Connect — handle COD collection, driver tips, and delivery surcharges with Stripe's payment infrastructure.",
    category: "PAYMENT",
    websiteUrl: "https://stripe.com",
    docsUrl: "https://stripe.com/docs/api",
    authType: "MULTI_CREDENTIAL",
    credentialFields: [
      {
        key: "publishableKey",
        label: "Publishable Key",
        placeholder: "pk_live_xxxxxxxxxxxxxxxx",
        type: "password",
        required: true,
        helpUrl: "https://dashboard.stripe.com/apikeys",
        pattern: "^pk_(live|test)_",
      },
      {
        key: "secretKey",
        label: "Secret Key",
        placeholder: "sk_live_xxxxxxxxxxxxxxxx",
        type: "password",
        required: true,
        pattern: "^sk_(live|test)_",
      },
      {
        key: "webhookSecret",
        label: "Webhook Secret",
        placeholder: "whsec_xxxxxxxxxxxxxxxx",
        type: "password",
        required: false,
      },
    ],
    capabilities: [
      "payment_processing",
      "refunds",
      "connect",
      "webhooks",
      "cod_collection",
    ],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "square",
    name: "Square",
    description:
      "Square for POS delivery — accept payments at the door with Square Terminal or contactless reader.",
    category: "PAYMENT",
    websiteUrl: "https://squareup.com",
    docsUrl: "https://developer.squareup.com/docs",
    authType: "API_KEY",
    credentialFields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "EAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        type: "password",
        required: true,
        helpUrl: "https://developer.squareup.com/apps",
      },
      {
        key: "locationId",
        label: "Location ID",
        placeholder: "your-location-id",
        type: "text",
        required: true,
      },
    ],
    capabilities: ["pos_payment", "contactless", "terminal", "refunds"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
];
