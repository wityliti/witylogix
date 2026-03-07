/**
 * Integration Resolver — unified multi-level credential resolution.
 *
 * Extends the existing tenant → deployer → unavailable pattern
 * from routing and notifications to all integration categories.
 *
 * Resolution per integration:
 *   1. Tenant has installed the integration with credentials → use tenant's
 *   2. Deployer has env-based fallback credentials → use deployer's (metered)
 *   3. No credentials anywhere → mark as unavailable
 */

import type {
  IntegrationCategory,
  ResolvedIntegration,
} from "./types.js";
import { INTEGRATION_REGISTRY, getIntegrationsByCategory } from "./registry.js";
import { emitIntegrationEvent } from "./metering.js";

// ─── Types ───────────────────────────────────────────────────

/**
 * Tenant integration config from the Integration DB model.
 * Maps slug → { credentials, config, isEnabled }.
 */
export interface TenantIntegrationConfig {
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
  isEnabled: boolean;
}

// ─── Deployer Env Map ────────────────────────────────────────

/**
 * Maps integration slug → env var names for deployer fallback credentials.
 * Extended from the existing routing and notification DEPLOYER_ENV_MAPs.
 */
const DEPLOYER_ENV_MAP: Record<string, string[]> = {
  // ── Communication: Email ──
  sendgrid: ["SENDGRID_API_KEY", "EMAIL_FROM", "EMAIL_FROM_NAME"],
  mailgun: ["MAILGUN_API_KEY", "MAILGUN_DOMAIN", "EMAIL_FROM"],
  aws_ses: ["AWS_SES_ACCESS_KEY_ID", "AWS_SES_SECRET_ACCESS_KEY", "AWS_SES_REGION", "EMAIL_FROM"],
  postmark: ["POSTMARK_SERVER_TOKEN", "EMAIL_FROM"],
  resend: ["RESEND_API_KEY", "EMAIL_FROM"],
  smtp: ["SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "EMAIL_FROM"],

  // ── Communication: SMS ──
  twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
  vonage: ["VONAGE_API_KEY", "VONAGE_API_SECRET"],
  aws_sns: ["AWS_SNS_ACCESS_KEY_ID", "AWS_SNS_SECRET_ACCESS_KEY", "AWS_SNS_REGION"],
  messagebird: ["MESSAGEBIRD_API_KEY"],
  plivo: ["PLIVO_AUTH_ID", "PLIVO_AUTH_TOKEN"],

  // ── Communication: WhatsApp ──
  meta_cloud: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
  twilio_whatsapp: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
  "360dialog": ["DIALOG360_API_KEY"],

  // ── Communication: Push ──
  firebase: ["FIREBASE_PROJECT_ID", "FIREBASE_PRIVATE_KEY", "FIREBASE_CLIENT_EMAIL"],
  onesignal: ["ONESIGNAL_APP_ID", "ONESIGNAL_REST_API_KEY"],
  expo_push: [],

  // ── Routing ──
  mapbox: ["MAPBOX_ACCESS_TOKEN"],
  osrm: ["OSRM_BASE_URL"],
  google_maps: ["GOOGLE_MAPS_API_KEY"],
  here: ["HERE_API_KEY"],
  graphhopper: ["GRAPHHOPPER_API_KEY"],
  tomtom: ["TOMTOM_API_KEY"],

  // ── Order Management ──
  shopify_orders: [], // Native, no external credentials needed
  woocommerce: ["WOOCOMMERCE_STORE_URL", "WOOCOMMERCE_CONSUMER_KEY", "WOOCOMMERCE_CONSUMER_SECRET"],
  magento: ["MAGENTO_BASE_URL", "MAGENTO_ACCESS_TOKEN"],
  custom_orders_api: ["CUSTOM_ORDERS_WEBHOOK_SECRET"],

  // ── Inventory ──
  shopify_inventory: [], // Native
  skubana: ["SKUBANA_API_KEY", "SKUBANA_API_SECRET"],
  cin7: ["CIN7_API_KEY"],
  stocky: [], // Shopify native

  // ── Payment ──
  shopify_payments: [], // Native
  stripe: ["STRIPE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  square: ["SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID"],

  // ── Analytics ──
  built_in_analytics: [], // Native
  segment: ["SEGMENT_WRITE_KEY"],
  google_analytics: ["GA4_MEASUREMENT_ID", "GA4_API_SECRET"],
  mixpanel: ["MIXPANEL_PROJECT_TOKEN"],
};

// ─── Resolution Functions ────────────────────────────────────

/**
 * Resolve a specific integration by slug.
 *
 * @param slug                The integration slug
 * @param tenantInstallation  Tenant's installed integration data (from DB)
 * @param shopId              Shop ID for metering
 * @returns ResolvedIntegration with credentials and availability
 */
export function resolveIntegration(
  slug: string,
  tenantInstallation?: TenantIntegrationConfig | null,
  shopId?: string,
): ResolvedIntegration {
  const appMeta = INTEGRATION_REGISTRY.get(slug);

  if (!appMeta || appMeta.status === "DEPRECATED") {
    return {
      slug,
      credentials: {},
      usedFallback: false,
      available: false,
      config: {},
    };
  }

  // Native integrations (no external credentials) are always available
  if (appMeta.credentialFields.length === 0) {
    return {
      slug,
      credentials: {},
      usedFallback: false,
      available: true,
      config: tenantInstallation?.config ?? {},
    };
  }

  const byokEnvKey = getCategoryByokEnv(appMeta.category);
  const byok = byokEnvKey ? process.env[byokEnvKey] === "true" : false;

  // ── Attempt 1: Tenant's own credentials ──────────────────
  if (tenantInstallation?.isEnabled && tenantInstallation.credentials) {
    const creds = tenantInstallation.credentials as Record<string, unknown>;
    const hasAnyCred = Object.values(creds).some((v) => Boolean(v));

    if (hasAnyCred) {
      return {
        slug,
        credentials: creds,
        usedFallback: false,
        available: true,
        config: tenantInstallation.config ?? {},
      };
    }
  }

  // ── Attempt 2: Deployer fallback ─────────────────────────
  const envKeys = DEPLOYER_ENV_MAP[slug] ?? [];
  const deployerCreds: Record<string, unknown> = {};

  for (const envKey of envKeys) {
    const value = process.env[envKey];
    if (value) {
      deployerCreds[envKey] = value;
    }
  }

  const hasDeployerCreds = Object.keys(deployerCreds).length > 0;

  if (hasDeployerCreds) {
    // Emit metering event when using deployer fallback in BYOK mode
    if (byok && shopId) {
      emitIntegrationEvent({
        shopId,
        appSlug: slug,
        eventType: "METER",
        operation: "fallback_usage",
        usedFallback: true,
        timestamp: new Date(),
      });
    }

    return {
      slug,
      credentials: deployerCreds,
      usedFallback: true,
      available: true,
      config: tenantInstallation?.config ?? {},
    };
  }

  // ── Nothing configured ───────────────────────────────────
  return {
    slug,
    credentials: {},
    usedFallback: true,
    available: false,
    config: {},
  };
}

/**
 * Resolve the active integration for a category + optional subcategory.
 * Returns the first available integration in the category.
 *
 * @param category     The integration category
 * @param subcategory  Optional subcategory (e.g., "email" for COMMUNICATION)
 * @param tenantIntegrations  Map of slug → tenant config (from DB)
 * @param shopId       Shop ID for metering
 */
export function resolveByCategory(
  category: IntegrationCategory,
  subcategory?: string,
  tenantIntegrations?: Map<string, TenantIntegrationConfig>,
  shopId?: string,
): ResolvedIntegration | null {
  const apps = getIntegrationsByCategory(category, subcategory)
    .filter((a) => a.status === "AVAILABLE" || a.status === "BETA");

  for (const app of apps) {
    const tenantConfig = tenantIntegrations?.get(app.slug);
    const resolved = resolveIntegration(app.slug, tenantConfig, shopId);

    if (resolved.available) {
      return resolved;
    }
  }

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Get the BYOK env var key for a category.
 * Maintains backward compat with existing ROUTING_BYOK and NOTIFICATIONS_BYOK.
 */
function getCategoryByokEnv(category: IntegrationCategory): string | null {
  switch (category) {
    case "ROUTING":
      return "ROUTING_BYOK";
    case "COMMUNICATION":
      return "NOTIFICATIONS_BYOK";
    case "ORDER_MANAGEMENT":
    case "INVENTORY":
    case "PAYMENT":
    case "ANALYTICS":
      return "INTEGRATIONS_BYOK";
    default:
      return null;
  }
}

/**
 * Mask credentials for safe display (e.g., "SG.xxx...abc").
 */
export function maskCredentials(
  credentials: Record<string, unknown>,
): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(credentials)) {
    if (typeof value === "string" && value.length > 8) {
      masked[key] = `${value.slice(0, 4)}${"•".repeat(8)}${value.slice(-4)}`;
    } else if (typeof value === "string") {
      masked[key] = "••••••••";
    } else {
      masked[key] = "••••••••";
    }
  }
  return masked;
}
