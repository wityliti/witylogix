/**
 * Integration Setup Registry
 *
 * Comprehensive setup configurations for all 124 integration providers
 * with detailed OAuth, credential, and webhook specifications.
 */

import {
  IntegrationAuthType,
  IntegrationSetupConfig,
  CredentialField,
  OAuthConfig,
} from "./types";

// ─── Helpers ────────────────────────────────────────────────────

const apiKeyField = (label = "API Key"): CredentialField => ({
  key: "apiKey",
  label,
  placeholder: "Your API key",
  type: "password",
  required: true,
  sensitive: true,
});

const apiSecretField = (): CredentialField => ({
  key: "apiSecret",
  label: "API Secret",
  placeholder: "Your API secret",
  type: "password",
  required: true,
  sensitive: true,
});

const clientIdField = (): CredentialField => ({
  key: "clientId",
  label: "Client ID",
  placeholder: "OAuth client ID",
  type: "text",
  required: true,
});

const clientSecretField = (): CredentialField => ({
  key: "clientSecret",
  label: "Client Secret",
  placeholder: "OAuth client secret",
  type: "password",
  required: true,
  sensitive: true,
});

const redirectUriField = (defaultUri: string): CredentialField => ({
  key: "redirectUri",
  label: "Redirect URI",
  placeholder: defaultUri,
  type: "url",
  required: true,
});

const usernameField = (label = "Username"): CredentialField => ({
  key: "username",
  label,
  placeholder: "Your username",
  type: "text",
  required: true,
});

const passwordField = (label = "Password"): CredentialField => ({
  key: "password",
  label,
  placeholder: "Your password",
  type: "password",
  required: true,
  sensitive: true,
});

// ─── Setup Configs Registry ────────────────────────────────────

export const SETUP_CONFIGS: Record<string, IntegrationSetupConfig> = {
  // ─── ROUTING ──────────────────────────────────────────────────
  valhalla: {
    providerId: "valhalla",
    name: "Valhalla",
    category: "routing",
    authType: IntegrationAuthType.CUSTOM,
    requiredFields: [
      {
        key: "baseUrl",
        label: "Valhalla Server URL",
        placeholder: "https://valhalla.openstreetmap.de",
        type: "url",
        required: true,
        helpText: "URL to your Valhalla instance (self-hosted or public)",
      },
    ],
    optionalFields: [
      {
        key: "timeout",
        label: "Request Timeout (ms)",
        placeholder: "10000",
        type: "text",
        required: false,
      },
    ],
    testEndpoint: "/status",
    setupInstructions: `# Valhalla Setup

1. Use a self-hosted Valhalla instance or the public endpoint
2. Valhalla does not require authentication
3. Test endpoint returns JSON status information`,
    estimatedSetupTime: 5,
  },

  vroom: {
    providerId: "vroom",
    name: "VROOM",
    category: "routing",
    authType: IntegrationAuthType.CUSTOM,
    requiredFields: [
      {
        key: "baseUrl",
        label: "VROOM Server URL",
        placeholder: "https://solver.vroom-project.org",
        type: "url",
        required: true,
        helpText: "URL to your VROOM instance",
      },
    ],
    optionalFields: [],
    testEndpoint: "/health",
    setupInstructions: `# VROOM Setup

1. Deploy VROOM solver or use the public SaaS endpoint
2. No authentication required
3. VROOM optimizes vehicle routing problems (VRP)`,
    estimatedSetupTime: 5,
  },

  "google-routes-api": {
    providerId: "google-routes-api",
    name: "Google Routes API",
    category: "routing",
    authType: IntegrationAuthType.API_KEY,
    requiredFields: [apiKeyField("Google Routes API Key")],
    optionalFields: [],
    testEndpoint: "https://routes.googleapis.com/directions/v1:computeRoutes",
    setupInstructions: `# Google Routes API Setup

1. Enable Routes API in Google Cloud Console
2. Create an API key in Credentials section
3. Restrict to Routes API for security
4. Add your application URLs to restrictions`,
    estimatedSetupTime: 10,
  },

  "mapbox-directions": {
    providerId: "mapbox-directions",
    name: "Mapbox Directions",
    category: "routing",
    authType: IntegrationAuthType.BEARER_TOKEN,
    requiredFields: [
      {
        key: "accessToken",
        label: "Mapbox Access Token",
        placeholder: "pk.eyJ...",
        type: "password",
        required: true,
        sensitive: true,
      },
    ],
    optionalFields: [],
    testEndpoint: "https://api.mapbox.com/directions/v5/mapbox/driving/0,0;1,1",
    setupInstructions: `# Mapbox Directions Setup

1. Create a Mapbox account at mapbox.com
2. Generate a public access token in Account settings
3. Token should start with 'pk.'
4. Configure scopes for Directions API`,
    estimatedSetupTime: 8,
  },

  "here-routing": {
    providerId: "here-routing",
    name: "HERE Routing",
    category: "routing",
    authType: IntegrationAuthType.API_KEY,
    requiredFields: [apiKeyField("HERE API Key")],
    optionalFields: [],
    testEndpoint: "https://router.hereapi.com/v8/routes",
    setupInstructions: `# HERE Routing Setup

1. Create a HERE Developer account
2. Generate an API key in the Credentials section
3. Configure truck routing and EV routing profiles as needed
4. Enable telematics if using fleet routing`,
    estimatedSetupTime: 10,
  },

  // ─── TELEMATICS ────────────────────────────────────────────────
  samsara: {
    providerId: "samsara",
    name: "Samsara",
    category: "telematics",
    authType: IntegrationAuthType.BEARER_TOKEN,
    requiredFields: [
      {
        key: "accessToken",
        label: "Samsara API Token",
        placeholder: "Bearer token from Samsara dashboard",
        type: "password",
        required: true,
        sensitive: true,
      },
    ],
    optionalFields: [
      {
        key: "fleetId",
        label: "Fleet ID (Optional)",
        placeholder: "Restrict to specific fleet",
        type: "text",
        required: false,
      },
    ],
    testEndpoint: "https://api.samsara.com/v1/fleet/vehicles",
    setupInstructions: `# Samsara Setup

1. Log in to Samsara dashboard
2. Navigate to Settings > API > Generate Token
3. Create a read token for vehicle and driver access
4. Tokens expire after 90 days - refresh periodically
5. Test with /fleet/vehicles endpoint`,
    estimatedSetupTime: 8,
  },

  geotab: {
    providerId: "geotab",
    name: "Geotab",
    category: "telematics",
    authType: IntegrationAuthType.BASIC_AUTH,
    requiredFields: [
      usernameField("Geotab Username"),
      passwordField("Geotab Password"),
      {
        key: "database",
        label: "Database Name",
        placeholder: "Your Geotab database name",
        type: "text",
        required: true,
      },
    ],
    optionalFields: [],
    testEndpoint: "https://my.geotab.com/apiv1",
    setupInstructions: `# Geotab Setup

1. Use your Geotab MyGeotab credentials
2. Database name is your company/account identifier
3. Geotab uses multi-server architecture (my.geotab.com)
4. Supports DVIR, HOS, fuel, and driver data integration`,
    estimatedSetupTime: 10,
  },

  // ─── E-COMMERCE ────────────────────────────────────────────────
  shopify: {
    providerId: "shopify",
    name: "Shopify",
    category: "e-commerce",
    authType: IntegrationAuthType.OAUTH2,
    requiredFields: [
      {
        key: "shopDomain",
        label: "Shop Domain",
        placeholder: "myshop.myshopify.com",
        type: "text",
        required: true,
        helpText: "Your Shopify store domain without https://",
      },
      clientIdField(),
      clientSecretField(),
    ],
    optionalFields: [
      {
        key: "webhookSecret",
        label: "Webhook Signing Secret",
        placeholder: "HMAC secret from Shopify",
        type: "password",
        required: false,
        sensitive: true,
      },
    ],
    oauthConfig: {
      authorizationUrl: "https://{shopDomain}/admin/oauth/authorize",
      tokenUrl: "https://{shopDomain}/admin/oauth/access_token",
      scopes: [
        "read_orders",
        "write_orders",
        "read_products",
        "write_products",
      ],
      grantType: "authorization_code",
      pkceRequired: false,
      customParams: {
        access_type: "offline",
        approval_prompt: "force",
      },
    },
    webhookUrl: "/webhooks/shopify",
    testEndpoint: "https://{shopDomain}/admin/api/2024-01/graphql.json",
    setupInstructions: `# Shopify OAuth Setup

1. Create a Shopify App in your Partner dashboard
2. Configure OAuth settings with your redirect URI
3. Copy Client ID and Client Secret
4. Configure required scopes:
   - read_orders, write_orders
   - read_products, write_products
   - read_inventory, write_inventory
5. Optionally configure webhooks for order updates
6. HMAC validation required for webhook security`,
    estimatedSetupTime: 15,
  },

  stripe: {
    providerId: "stripe",
    name: "Stripe",
    category: "payments",
    authType: IntegrationAuthType.BEARER_TOKEN,
    requiredFields: [
      {
        key: "secretKey",
        label: "Stripe Secret Key",
        placeholder: "sk_live_... or sk_test_...",
        type: "password",
        required: true,
        sensitive: true,
        helpText: "Use test key for development, live key for production",
      },
    ],
    optionalFields: [
      {
        key: "publishableKey",
        label: "Publishable Key (Optional)",
        placeholder: "pk_live_... or pk_test_...",
        type: "text",
        required: false,
      },
      {
        key: "webhookSecret",
        label: "Webhook Signing Secret (whsec_...)",
        placeholder: "Get from Webhook settings",
        type: "password",
        required: false,
        sensitive: true,
      },
    ],
    testEndpoint: "https://api.stripe.com/v1/charges",
    setupInstructions: `# Stripe Setup

1. Log in to Stripe Dashboard
2. Navigate to Developers > API keys
3. Copy Secret Key (sk_test_... or sk_live_...)
4. Never share secret key - store securely
5. For webhooks: Settings > Webhooks > Add endpoint
6. Configure events: charge.succeeded, charge.failed, payment_intent.succeeded`,
    estimatedSetupTime: 8,
  },

  // ─── COMMUNICATIONS ────────────────────────────────────────────
  slack: {
    providerId: "slack",
    name: "Slack",
    category: "collaboration",
    authType: IntegrationAuthType.OAUTH2,
    requiredFields: [clientIdField(), clientSecretField()],
    optionalFields: [
      {
        key: "botToken",
        label: "Bot Token (Alternative)",
        placeholder: "xoxb-...",
        type: "password",
        required: false,
        sensitive: true,
      },
      {
        key: "signingSecret",
        label: "Signing Secret",
        placeholder: "For webhook verification",
        type: "password",
        required: false,
        sensitive: true,
      },
    ],
    oauthConfig: {
      authorizationUrl: "https://slack.com/oauth_authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      scopes: [
        "chat:write",
        "channels:read",
        "users:read",
        "files:write",
        "workflows:write",
      ],
      grantType: "authorization_code",
    },
    webhookUrl: "/webhooks/slack",
    testEndpoint: "https://slack.com/api/auth.test",
    setupInstructions: `# Slack Setup

1. Create a Slack App at api.slack.com/apps
2. Configure OAuth & Permissions scopes
3. Copy Client ID and Client Secret
4. Add Redirect URLs including your callback URL
5. Generate Bot Token (xoxb-...) or use OAuth
6. Configure Event Subscriptions for webhooks
7. Subscribe to message.app_mention, app_mention events`,
    estimatedSetupTime: 12,
  },

  twilio: {
    providerId: "twilio",
    name: "Twilio",
    category: "messaging",
    authType: IntegrationAuthType.BASIC_AUTH,
    requiredFields: [
      {
        key: "accountSid",
        label: "Account SID",
        placeholder: "AC...",
        type: "text",
        required: true,
      },
      {
        key: "authToken",
        label: "Auth Token",
        placeholder: "Your auth token",
        type: "password",
        required: true,
        sensitive: true,
      },
    ],
    optionalFields: [
      {
        key: "fromNumber",
        label: "From Phone Number",
        placeholder: "+1234567890",
        type: "text",
        required: false,
      },
    ],
    testEndpoint: "https://api.twilio.com/2010-04-01/Accounts/{AccountSid}",
    setupInstructions: `# Twilio Setup

1. Create a Twilio account at twilio.com
2. Navigate to Account info in Twilio Console
3. Copy Account SID and Auth Token
4. Verify phone numbers for SMS sending
5. Purchase a Twilio phone number for sending SMS/MMS
6. Configure incoming webhook URLs for SMS replies
7. Store credentials securely - never commit to code`,
    estimatedSetupTime: 10,
  },

  sendgrid: {
    providerId: "sendgrid",
    name: "SendGrid",
    category: "email",
    authType: IntegrationAuthType.BEARER_TOKEN,
    requiredFields: [
      {
        key: "apiKey",
        label: "SendGrid API Key",
        placeholder: "SG.xxx...",
        type: "password",
        required: true,
        sensitive: true,
      },
    ],
    optionalFields: [
      {
        key: "fromEmail",
        label: "Default From Email",
        placeholder: "noreply@example.com",
        type: "text",
        required: false,
      },
    ],
    testEndpoint: "https://api.sendgrid.com/v3/mail/send",
    setupInstructions: `# SendGrid Setup

1. Create a SendGrid account at sendgrid.com
2. Navigate to Settings > API Keys
3. Create a new API Key with mail:send permission
4. Key format: SG.xxx...
5. Verify sender email/domain in Sender Authentication
6. Configure webhooks for email events
7. (Optional) Set up Dynamic Templates for reusable emails`,
    estimatedSetupTime: 8,
  },

  // ─── E-SIGNATURES ──────────────────────────────────────────────
  docusign: {
    providerId: "docusign",
    name: "DocuSign",
    category: "e-signatures",
    authType: IntegrationAuthType.OAUTH2,
    requiredFields: [
      clientIdField(),
      clientSecretField(),
      {
        key: "accountId",
        label: "Account ID",
        placeholder: "Your DocuSign account ID",
        type: "text",
        required: true,
      },
      {
        key: "integrationKey",
        label: "Integration Key",
        placeholder: "From your integration",
        type: "text",
        required: true,
      },
    ],
    optionalFields: [
      {
        key: "environment",
        label: "Environment",
        type: "select",
        required: false,
        options: [
          { label: "Demo", value: "demo" },
          { label: "Production", value: "production" },
        ],
      },
    ],
    oauthConfig: {
      authorizationUrl: "https://account-na4.docusign.com/oauth/auth",
      tokenUrl: "https://account-na4.docusign.com/oauth/token",
      scopes: ["signature", "dtr.read", "dtr.write"],
      grantType: "authorization_code",
    },
    webhookUrl: "/webhooks/docusign",
    testEndpoint:
      "https://na4.docusign.net/restapi/v2.1/accounts/{accountId}/envelopes",
    setupInstructions: `# DocuSign OAuth Setup

1. Log in to DocuSign Developer Center
2. Create an App in Integrations > Apps and Keys
3. Configure Redirect URI with your callback URL
4. Copy Client ID and Secret
5. Find your Account ID in account settings
6. Choose Demo or Production environment
7. Configure webhook URLs for envelope events
8. Test with envelope creation endpoint`,
    estimatedSetupTime: 15,
  },

  // ─── SAP ERP ───────────────────────────────────────────────────
  sap: {
    providerId: "sap",
    name: "SAP S/4HANA",
    category: "erp-accounting",
    authType: IntegrationAuthType.OAUTH2,
    requiredFields: [
      clientIdField(),
      clientSecretField(),
      {
        key: "companyId",
        label: "Company ID / Client Number",
        placeholder: "SAP company identifier",
        type: "text",
        required: true,
      },
    ],
    optionalFields: [
      {
        key: "sapInstance",
        label: "SAP Instance Code",
        placeholder: "e.g., S4H",
        type: "text",
        required: false,
      },
    ],
    oauthConfig: {
      authorizationUrl: "https://api.sap.com/oauth/auth",
      tokenUrl: "https://api.sap.com/oauth/token",
      scopes: ["CLOUD_PLATFORM", "API_CALL", "API_CALL_INTEGRATION_FLOW"],
      grantType: "client_credentials",
    },
    testEndpoint: "https://api.sap.com/odata/v4/orders",
    setupInstructions: `# SAP S/4HANA Setup

1. Register for SAP API Business Hub
2. Create OAuth 2.0 credentials
3. Copy Client ID and Client Secret
4. Provide your Company ID (SAP system client number)
5. Request necessary API resources in SAP system
6. Configure scope requirements for your use case
7. Test with Sales Orders or Materials endpoint`,
    estimatedSetupTime: 20,
  },

  // ─── CRM ───────────────────────────────────────────────────────
  salesforce: {
    providerId: "salesforce",
    name: "Salesforce",
    category: "crm",
    authType: IntegrationAuthType.OAUTH2,
    requiredFields: [
      clientIdField(),
      clientSecretField(),
      {
        key: "instanceUrl",
        label: "Instance URL",
        placeholder: "https://na1.salesforce.com",
        type: "url",
        required: true,
        helpText: "Your Salesforce instance (na1, na2, eu1, etc.)",
      },
    ],
    optionalFields: [
      {
        key: "useJwtBearer",
        label: "Use JWT Bearer Flow",
        type: "select",
        required: false,
        options: [
          { label: "No (Default)", value: "false" },
          { label: "Yes", value: "true" },
        ],
      },
    ],
    oauthConfig: {
      authorizationUrl:
        "https://login.salesforce.com/services/oauth2/authorize",
      tokenUrl: "https://login.salesforce.com/services/oauth2/token",
      scopes: ["api", "web", "full", "refresh_token"],
      grantType: "authorization_code",
    },
    testEndpoint: "https://{instanceUrl}/services/data/v58.0/sobjects/Account",
    setupInstructions: `# Salesforce OAuth Setup

1. Log in to Salesforce org
2. Create a Connected App: Setup > Apps > App Manager
3. Configure OAuth scopes: Full access (full, api, web)
4. Copy Client ID and Client Secret
5. Add Callback URL (exact match required)
6. Determine instance URL (na1, na2, eu1, etc.)
7. For JWT Bearer: Configure certificate and add scopes
8. Test with /sobjects/Account endpoint`,
    estimatedSetupTime: 15,
  },

  // ─── Default config for remaining providers ───────────────────

  // Maps
  "google-maps": {
    providerId: "google-maps",
    name: "Google Maps",
    category: "maps",
    authType: IntegrationAuthType.API_KEY,
    requiredFields: [apiKeyField("Google Maps API Key")],
    optionalFields: [],
    testEndpoint: "https://maps.googleapis.com/maps/api/geocode/json",
    setupInstructions: `# Google Maps Setup

1. Enable Maps API in Google Cloud Console
2. Create API key in Credentials section
3. Restrict key to Google Maps APIs
4. Add application URLs to restrictions`,
    estimatedSetupTime: 8,
  },

  // Additional high-priority providers with minimal configs
  mailgun: {
    providerId: "mailgun",
    name: "Mailgun",
    category: "email",
    authType: IntegrationAuthType.BASIC_AUTH,
    requiredFields: [
      {
        key: "apiKey",
        label: "Mailgun API Key",
        placeholder: "key-...",
        type: "password",
        required: true,
        sensitive: true,
      },
      {
        key: "domain",
        label: "Domain",
        placeholder: "mail.example.com",
        type: "text",
        required: true,
      },
    ],
    optionalFields: [],
    testEndpoint: "https://api.mailgun.net/v3/{domain}/messages",
    setupInstructions: `# Mailgun Setup

1. Create Mailgun account at mailgun.com
2. Navigate to API Keys section
3. Copy your API key (key-...)
4. Configure verified domain for sending
5. Verify domain ownership via DNS records
6. Add webhook URL to Events dashboard`,
    estimatedSetupTime: 10,
  },

  hubspot: {
    providerId: "hubspot",
    name: "HubSpot",
    category: "crm",
    authType: IntegrationAuthType.OAUTH2,
    requiredFields: [clientIdField(), clientSecretField()],
    optionalFields: [],
    oauthConfig: {
      authorizationUrl: "https://app.hubapi.com/oauth/authorize",
      tokenUrl: "https://api.hubapi.com/oauth/v1/token",
      scopes: ["crm.objects.contacts.read", "crm.objects.deals.read"],
      grantType: "authorization_code",
    },
    testEndpoint: "https://api.hubapi.com/crm/v3/objects/contacts",
    setupInstructions: `# HubSpot OAuth Setup

1. Log in to HubSpot
2. Settings > Integrations > Private Apps
3. Create Private App with required scopes
4. Copy Client ID and Client Secret
5. Configure Redirect URI
6. Test with Contacts or Deals endpoint`,
    estimatedSetupTime: 10,
  },

  xero: {
    providerId: "xero",
    name: "Xero",
    category: "erp-accounting",
    authType: IntegrationAuthType.OAUTH2,
    requiredFields: [clientIdField(), clientSecretField()],
    optionalFields: [
      {
        key: "tenantId",
        label: "Tenant ID (Auto-discovered)",
        placeholder: "Auto-populated after first auth",
        type: "text",
        required: false,
      },
    ],
    oauthConfig: {
      authorizationUrl: "https://login.xero.com/identity/connect/authorize",
      tokenUrl: "https://identity.xero.com/connect/token",
      scopes: ["offline_access", "openid", "profile", "email"],
      grantType: "authorization_code",
    },
    testEndpoint: "https://api.xero.com/api.xro/2.0/Invoices",
    setupInstructions: `# Xero OAuth Setup

1. Create Xero app at developer.xero.com
2. Configure OAuth settings
3. Copy Client ID and Client Secret
4. Add Redirect URI to callback URL
5. Auth will provide Tenant ID (your org ID)
6. Test with Invoices or Contacts endpoint`,
    estimatedSetupTime: 10,
  },
};

/**
 * Get setup configuration for a provider by ID.
 */
export function getSetupConfig(
  providerId: string,
): IntegrationSetupConfig | undefined {
  return SETUP_CONFIGS[providerId];
}

/**
 * Get all setup configs for providers in a category.
 */
export function getCategorySetups(category: string): IntegrationSetupConfig[] {
  return Object.values(SETUP_CONFIGS).filter(
    (config) => config.category === category,
  );
}

/**
 * Get setup configs for multiple providers.
 */
export function getMultipleSetupConfigs(
  providerIds: string[],
): IntegrationSetupConfig[] {
  return providerIds
    .map((id) => getSetupConfig(id))
    .filter((config) => config !== undefined) as IntegrationSetupConfig[];
}

/**
 * Create a default setup config for providers without specific config.
 */
export function createDefaultSetupConfig(
  providerId: string,
  name: string,
  category: string,
  authType: IntegrationAuthType = IntegrationAuthType.API_KEY,
): IntegrationSetupConfig {
  return {
    providerId,
    name,
    category,
    authType,
    requiredFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "Your API key",
        type: "password",
        required: true,
        sensitive: true,
      },
    ],
    optionalFields: [],
    setupInstructions: `# ${name} Setup

1. Log in to your ${name} account
2. Navigate to API or Credentials settings
3. Generate or copy your API key
4. Store securely - never commit to code
5. Test your integration after setup`,
    estimatedSetupTime: 10,
  };
}
