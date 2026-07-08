/**
 * Quick Setup Templates
 *
 * Pre-configured integration bundles for common industries and use cases.
 * Provides pre-filled configurations and setup instructions for faster onboarding.
 */

import { IntegrationQuickSetup, IndustryTemplate } from "./types";

// ─── Industry-Specific Integration Templates ──────────────────

export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  ecommerce: {
    industry: "E-Commerce",
    description:
      "Complete e-commerce solution with order management, payments, shipping",
    integrations: ["shopify", "stripe", "shipstation", "mailgun"],
    suggestedWebhooks: {
      shopify: "https://yourapp.com/webhooks/shopify",
      stripe: "https://yourapp.com/webhooks/stripe",
      shipstation: "https://yourapp.com/webhooks/shipstation",
    },
    defaultConfig: {
      shopify: {
        syncOrders: true,
        syncProducts: true,
        syncInventory: true,
      },
      stripe: {
        environment: "live",
        webhookEvents: [
          "charge.succeeded",
          "charge.failed",
          "payment_intent.succeeded",
        ],
      },
      shipstation: {
        autoDownloadOrders: true,
        markAsShipped: true,
      },
      mailgun: {
        template: "order-confirmation",
        automationEnabled: true,
      },
    },
  },

  "food-beverage": {
    industry: "Food & Beverage",
    description:
      "Restaurant and food service integrations for delivery, orders, and payments",
    integrations: [
      "doordash-drive",
      "uber-eats",
      "toast-pos",
      "square-payments",
    ],
    suggestedWebhooks: {
      "toast-pos": "https://yourapp.com/webhooks/toast",
      "doordash-drive": "https://yourapp.com/webhooks/doordash",
    },
    defaultConfig: {
      "toast-pos": {
        syncMenus: true,
        trackOrders: true,
        laborTracking: true,
      },
      "doordash-drive": {
        automateDelivery: true,
        estimatedTime: "accurate",
      },
      "uber-eats": {
        menuSync: true,
        orderNotifications: true,
      },
      "square-payments": {
        receiptEmail: true,
        itemization: true,
      },
    },
  },

  "logistics-3pl": {
    industry: "Logistics & 3PL",
    description:
      "Fleet management, vehicle tracking, fuel cards, and load boards",
    integrations: ["samsara", "dat-load-board", "wex", "motive-eld"],
    suggestedWebhooks: {
      samsara: "https://yourapp.com/webhooks/samsara",
      "motive-eld": "https://yourapp.com/webhooks/motive",
    },
    defaultConfig: {
      samsara: {
        trackFleet: true,
        monitorSafety: true,
        fuelTracking: true,
      },
      "dat-load-board": {
        postTrucks: true,
        searchLoads: true,
        rateAnalytics: true,
      },
      wex: {
        cardTracking: true,
        spendManagement: true,
        driverLimits: true,
      },
      "motive-eld": {
        hosCompliance: true,
        dvirAutomation: true,
      },
    },
  },

  healthcare: {
    industry: "Healthcare",
    description: "Healthcare integration with EHR systems and FHIR standard",
    integrations: ["epic", "cerner", "hl7-fhir"],
    suggestedWebhooks: {
      epic: "https://yourapp.com/webhooks/epic",
    },
    defaultConfig: {
      epic: {
        patientSync: true,
        appointmentManagement: true,
        ehr: true,
      },
      cerner: {
        fhir: true,
        patientData: true,
      },
      "hl7-fhir": {
        standardCompliance: true,
      },
    },
  },

  "field-service": {
    industry: "Field Service",
    description:
      "Field service management with dispatch, scheduling, and payments",
    integrations: ["servicetitan", "jobber", "motive-eld", "square-payments"],
    suggestedWebhooks: {
      servicetitan: "https://yourapp.com/webhooks/servicetitan",
      jobber: "https://yourapp.com/webhooks/jobber",
    },
    defaultConfig: {
      servicetitan: {
        jobManagement: true,
        dispatchOptimization: true,
        invoicing: true,
      },
      jobber: {
        scheduleSync: true,
        quoteManagement: true,
      },
      "motive-eld": {
        vehicleTracking: true,
        driverCompliance: true,
      },
      "square-payments": {
        onSitePayments: true,
        receipts: true,
      },
    },
  },

  saas: {
    industry: "SaaS",
    description:
      "SaaS infrastructure with analytics, communication, and billing",
    integrations: ["stripe", "sendgrid", "slack", "google-analytics"],
    suggestedWebhooks: {
      stripe: "https://yourapp.com/webhooks/stripe",
    },
    defaultConfig: {
      stripe: {
        subscriptions: true,
        webhooks: true,
        invoicing: true,
      },
      sendgrid: {
        transactionalEmail: true,
        templates: true,
      },
      slack: {
        notifications: true,
        botIntegration: true,
      },
      "google-analytics": {
        eventTracking: true,
        userAnalytics: true,
      },
    },
  },

  marketplaces: {
    industry: "Marketplaces",
    description:
      "Multi-channel integration for Amazon, eBay, Etsy, and Shopify",
    integrations: [
      "amazon-seller-central",
      "ebay",
      "etsy",
      "shopify",
      "square-online",
    ],
    suggestedWebhooks: {
      shopify: "https://yourapp.com/webhooks/shopify",
      "amazon-seller-central": "https://yourapp.com/webhooks/amazon",
    },
    defaultConfig: {
      "amazon-seller-central": {
        orderSync: true,
        inventorySync: true,
        fulfillmentTracking: true,
      },
      ebay: {
        listingManagement: true,
        orderImport: true,
        inventorySync: true,
      },
      etsy: {
        listingSync: true,
        orderManagement: true,
        reviewTracking: true,
      },
      shopify: {
        multiChannel: true,
        orderManagement: true,
      },
      "square-online": {
        catalogSync: true,
        orderTracking: true,
      },
    },
  },
};

// ─── Individual Quick Setup Templates ──────────────────────────

export const QUICK_SETUP_TEMPLATES: Record<string, IntegrationQuickSetup> = {
  // Routing & Logistics
  samsara: {
    providerId: "samsara",
    prefilledConfig: {
      syncInterval: 5 * 60 * 1000, // Every 5 minutes
      dataTypes: ["locations", "vehicles", "drivers", "safety"],
      dashboardEnabled: true,
      webhookEvents: ["vehicle_data", "driver_safety", "geofence"],
    },
    setupInstructions: `## Quick Setup: Samsara

### 1. Generate API Token
- Log in to Samsara dashboard
- Go to Settings > API > Create Token
- Select "Read" permissions for vehicle and driver data
- Copy the token (valid for 90 days)

### 2. Configure Integrations
- Use the token in the API token field
- Optionally specify Fleet ID to limit scope
- Enable the integrations you need

### 3. Test the Connection
- Click "Test Connection"
- Should return 200 OK with fleet data
- Check vehicle locations appear in 5 minutes

### 4. Set Up Webhooks (Optional)
- Webhook URL: \`https://yourapp.com/webhooks/samsara\`
- Subscribe to: vehicle_data, driver_safety, geofence events
- Test webhook delivery in dashboard

**Estimated Time:** 5 minutes`,
    estimatedTime: 5,
    commonMistakes: [
      'Token format should not include "Bearer" prefix',
      "Tokens expire after 90 days - set reminder to refresh",
      "Fleet ID is optional - leave blank to get all fleets",
      "Webhook endpoint must be publicly accessible",
    ],
  },

  shopify: {
    providerId: "shopify",
    prefilledConfig: {
      scopes: [
        "read_orders",
        "write_orders",
        "read_products",
        "write_products",
        "read_inventory",
      ],
      webhookTopics: [
        "orders/created",
        "orders/updated",
        "orders/fulfilled",
        "products/create",
      ],
      syncInterval: 15 * 60 * 1000, // Every 15 minutes
      autoFulfillment: true,
      inventoryTracking: true,
    },
    setupInstructions: `## Quick Setup: Shopify

### 1. Create Private App (Legacy) or Custom App
- Log in to Shopify Admin
- Go to Settings > Apps and Integrations > App and sales channel settings
- Create a "Custom app" or "Private app"

### 2. Configure OAuth
- Set Redirect URI: \`https://yourapp.com/oauth/callback/shopify\`
- Request scopes:
  - read_orders, write_orders
  - read_products, write_products
  - read_inventory

### 3. Complete OAuth Flow
- Click "Authorize" in the setup form
- You'll be redirected to Shopify login
- Approve access on the consent screen

### 4. Set Up Webhooks
- Webhook URL: \`https://yourapp.com/webhooks/shopify\`
- Topics: orders/created, orders/updated, fulfillment/create
- HMAC validation required - copy signing secret

**Estimated Time:** 10 minutes`,
    estimatedTime: 10,
    commonMistakes: [
      "Shop domain must not include https://",
      "OAuth scope mismatch - ensure all required scopes are requested",
      "HMAC validation required for webhook security",
      "API version must match (2024-01 or later)",
    ],
  },

  stripe: {
    providerId: "stripe",
    prefilledConfig: {
      mode: "live",
      webhookEvents: [
        "charge.succeeded",
        "charge.failed",
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
        "invoice.paid",
        "invoice.payment_failed",
      ],
      automaticRetry: true,
      idempotency: true,
    },
    setupInstructions: `## Quick Setup: Stripe

### 1. Get API Keys
- Log in to Stripe Dashboard
- Go to Developers > API Keys
- Copy Secret Key (sk_live_... or sk_test_...)
- For development, use test key (sk_test_...)

### 2. Configure Publishable Key (Optional)
- Copy Publishable Key (pk_live_... or pk_test_...)
- Use for client-side integrations

### 3. Set Up Webhooks
- Webhook URL: \`https://yourapp.com/webhooks/stripe\`
- Signing Secret: Copy from Webhook endpoint settings
- Subscribe to: charge.succeeded, payment_intent.succeeded, invoice.paid

### 4. Security Best Practices
- Never commit secret keys to repository
- Rotate keys regularly (every 90 days)
- Test with test keys before going live
- Enable webhook signature verification

**Estimated Time:** 8 minutes`,
    estimatedTime: 8,
    commonMistakes: [
      "Using test key in production or vice versa",
      "Missing webhook signing secret verification",
      "Idempotency key not implemented for retries",
      "API version mismatch",
    ],
  },

  slack: {
    providerId: "slack",
    prefilledConfig: {
      scopes: ["chat:write", "channels:read", "users:read"],
      slashCommands: true,
      botMentions: true,
      eventSubscriptions: ["app_mention", "message.app_mention"],
    },
    setupInstructions: `## Quick Setup: Slack

### 1. Create Slack App
- Go to api.slack.com/apps
- Click "Create New App"
- Choose "From scratch"
- App name: Your integration name
- Select workspace

### 2. Configure OAuth
- Go to OAuth & Permissions
- Add Redirect URLs: \`https://yourapp.com/oauth/callback/slack\`
- Add scopes:
  - chat:write (send messages)
  - channels:read (list channels)
  - users:read (list users)

### 3. Get Credentials
- Copy Client ID and Client Secret
- Store securely in environment variables

### 4. Set Up Event Subscriptions
- Enable events
- Request URL: \`https://yourapp.com/webhooks/slack\`
- Subscribe to: app_mention, message.app_mention
- Copy Signing Secret from Basic Information

### 5. Install App to Workspace
- Go to Install App section
- Click "Install to Workspace"
- Approve permissions

**Estimated Time:** 12 minutes`,
    estimatedTime: 12,
    commonMistakes: [
      "Missing Request URL verification step",
      "Signing secret must be saved for webhook validation",
      "Scopes too broad - request only what you need",
      "Token format: xoxb-... (bot) vs xoxp-... (user)",
    ],
  },

  sendgrid: {
    providerId: "sendgrid",
    prefilledConfig: {
      fromEmail: "noreply@example.com",
      trackingSettings: {
        opens: true,
        clicks: true,
        unsubscribe: true,
      },
      dynamicTemplates: true,
      webhookEvents: ["bounce", "click", "open", "spamreport", "unsubscribe"],
    },
    setupInstructions: `## Quick Setup: SendGrid

### 1. Create SendGrid Account
- Sign up at sendgrid.com
- Verify email address

### 2. Generate API Key
- Go to Settings > API Keys
- Click "Create API Key"
- Select "Restricted Access"
- Grant Mail Send permission only
- Copy key (SG.xxx...)

### 3. Verify Sender Email
- Go to Sender Authentication
- Single Sender Verification (recommended for testing)
- Or Domain Verification (for production)
- Follow email/DNS verification steps

### 4. Set Up Webhooks (Optional)
- Webhook URL: \`https://yourapp.com/webhooks/sendgrid\`
- Go to Settings > Mail Send > Event Webhook
- Subscribe to events: open, click, bounce, spamreport

### 5. Create Dynamic Templates (Optional)
- Go to Dynamic Templates
- Create template for transactional emails
- Use template ID in API calls

**Estimated Time:** 8 minutes`,
    estimatedTime: 8,
    commonMistakes: [
      "API key format: Should start with SG.",
      "Sender email must be verified before sending",
      "Rate limiting: 100 requests/second per API key",
      "Test emails go to sandbox subdomain",
    ],
  },

  salesforce: {
    providerId: "salesforce",
    prefilledConfig: {
      instanceType: "production",
      objects: ["Account", "Contact", "Opportunity", "Lead"],
      syncDirection: "bidirectional",
      batchSize: 50,
    },
    setupInstructions: `## Quick Setup: Salesforce

### 1. Create Connected App
- Log in to Salesforce org
- Go to Setup > Apps > App Manager
- Click "New Connected App"

### 2. Configure OAuth Settings
- Callback URL: \`https://yourapp.com/oauth/callback/salesforce\`
- OAuth scopes:
  - full (Full access)
  - api (Access API)
  - refresh_token
  - web (Access via web browser)

### 3. Get Credentials
- Copy Client ID and Client Secret
- Note your instance URL (e.g., na1.salesforce.com, eu1.salesforce.com)

### 4. Determine Instance Type
- Production: Use login.salesforce.com
- Sandbox: Use test.salesforce.com
- Custom: Use your org's URL

### 5. Test Connection
- API endpoint: \`/services/data/v58.0/sobjects/Account\`
- Should list Account records in your org

### 6. Set Up API Integration
- Enable for OAuth flows
- Configure refresh token handling
- Enable for service-to-service integration

**Estimated Time:** 15 minutes`,
    estimatedTime: 15,
    commonMistakes: [
      "Instance URL must match org type (production vs sandbox)",
      "Scope requirements vary by org - may need admin approval",
      "API version may need to match installed packages",
      "Refresh tokens expire if not used for 6 months",
    ],
  },
};

/**
 * Get quick setup template for a provider.
 */
export function getQuickSetupTemplate(
  providerId: string,
): IntegrationQuickSetup | undefined {
  return QUICK_SETUP_TEMPLATES[providerId];
}

/**
 * Get industry template for a given industry.
 */
export function getIndustryTemplate(
  industry: string,
): IndustryTemplate | undefined {
  return INDUSTRY_TEMPLATES[industry.toLowerCase()];
}

/**
 * Get all available industries.
 */
export function getAvailableIndustries(): string[] {
  return Object.keys(INDUSTRY_TEMPLATES).map(
    (key) => INDUSTRY_TEMPLATES[key].industry,
  );
}

/**
 * Get providers for an industry.
 */
export function getIndustryProviders(industry: string): string[] {
  const template = getIndustryTemplate(industry);
  return template?.integrations || [];
}

/**
 * Get default configuration for a provider within an industry context.
 */
export function getDefaultConfig(
  providerId: string,
  industry?: string,
): Record<string, unknown> {
  if (industry) {
    const industryTemplate = getIndustryTemplate(industry);
    if (industryTemplate) {
      return industryTemplate.defaultConfig?.[providerId] || {};
    }
  }

  const quickSetup = getQuickSetupTemplate(providerId);
  return quickSetup?.prefilledConfig || {};
}
