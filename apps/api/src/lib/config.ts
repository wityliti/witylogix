/**
 * Application configuration — validated at startup.
 * Fails fast if required environment variables are missing.
 */

import { z } from "zod";

const configSchema = z.object({
  // App
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Database
  DATABASE_URL: z.string().url().startsWith("postgresql://"),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // Shopify (optional in local dev — required for Shopify integration)
  SHOPIFY_API_KEY: z.string().default(""),
  SHOPIFY_API_SECRET: z.string().default(""),
  SHOPIFY_APP_URL: z.string().url().optional(),
  SHOPIFY_SCOPES: z.string().default(
    "read_products,write_products,read_orders,write_orders,read_fulfillments,write_fulfillments,read_shipping,write_shipping,read_locations,read_inventory,write_inventory,read_customers",
  ),

  // Routing — provider + BYOK mode
  // Deployer sets the default provider. Tenants can override when BYOK=true.
  ROUTING_PROVIDER: z
    .enum(["mapbox", "osrm", "google_maps", "here", "graphhopper", "tomtom"])
    .default("mapbox"),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
  OSRM_BASE_URL: z.string().url().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  HERE_API_KEY: z.string().optional(),
  GRAPHHOPPER_API_KEY: z.string().optional(),
  TOMTOM_API_KEY: z.string().optional(),

  // BYOK (Bring Your Own Key) mode
  // When "true", tenants can choose their own provider + credentials
  //   via Settings → Routing. Fallback to deployer credentials is metered.
  // When "false" (default), all tenants share the deployer's provider.
  ROUTING_BYOK: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // Notifications — multi-provider per channel, BYOK pattern
  NOTIFICATIONS_BYOK: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // Email provider (default: sendgrid)
  EMAIL_PROVIDER: z
    .enum(["sendgrid", "mailgun", "aws_ses", "postmark", "resend", "smtp"])
    .default("sendgrid"),
  SENDGRID_API_KEY: z.string().optional(),
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  POSTMARK_SERVER_TOKEN: z.string().optional(),
  // AWS SES (coming soon)
  AWS_SES_ACCESS_KEY_ID: z.string().optional(),
  AWS_SES_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SES_REGION: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USERNAME: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_FROM_NAME: z.string().optional(),

  // SMS provider (default: twilio)
  SMS_PROVIDER: z
    .enum(["twilio", "vonage", "aws_sns", "messagebird", "plivo"])
    .default("twilio"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  VONAGE_API_KEY: z.string().optional(),
  VONAGE_API_SECRET: z.string().optional(),
  // AWS SNS (coming soon)
  AWS_SNS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SNS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SNS_REGION: z.string().optional(),
  // MessageBird (coming soon)
  MESSAGEBIRD_API_KEY: z.string().optional(),
  // Plivo (coming soon)
  PLIVO_AUTH_ID: z.string().optional(),
  PLIVO_AUTH_TOKEN: z.string().optional(),

  // WhatsApp provider (default: meta_cloud)
  WHATSAPP_PROVIDER: z
    .enum(["meta_cloud", "twilio_whatsapp", "360dialog"])
    .default("meta_cloud"),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  // 360dialog (coming soon)
  DIALOG360_API_KEY: z.string().optional(),

  // Push provider (default: firebase)
  PUSH_PROVIDER: z
    .enum(["firebase", "onesignal", "expo_push"])
    .default("firebase"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  ONESIGNAL_APP_ID: z.string().optional(),
  ONESIGNAL_REST_API_KEY: z.string().optional(),

  // ─── Integrations Marketplace ─────────────────────────────
  //
  // Unified BYOK flag for non-routing/non-notification integrations.
  // When "true", tenants can install + configure their own integrations
  // across Order Management, Inventory, Payment, and Analytics categories.
  // Routing and Notifications still respect their own BYOK flags above.
  INTEGRATIONS_BYOK: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // URLs
  TRACKING_PAGE_URL: z.string().url().default("http://localhost:3002"),
  DASHBOARD_URL: z.string().url().default("http://localhost:3000"),

  // ─── Security Configuration ──────────────────────────────────
  // CORS: comma-separated list of allowed origins (required in production)
  CORS_ORIGINS: z.string().optional(),

  // Rate limiting: per-IP (unauthenticated) and per-shopId (authenticated)
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(200), // per IP
  RATE_LIMIT_AUTHENTICATED_MAX: z.coerce.number().int().min(1).default(1000), // per shopId
  RATE_LIMIT_STRICT_MAX: z.coerce.number().int().min(1).default(10), // for auth endpoints

  // Security headers
  ENABLE_HSTS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  HSTS_MAX_AGE: z.coerce.number().int().min(0).default(31536000), // 1 year in seconds
  ENABLE_CSP: z
    .enum(["true", "false"])
    .default("false") // Relaxed for embedded iframe
    .transform((v) => v === "true"),
  ENABLE_FRAMEGUARD: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  // Graceful shutdown timeout (milliseconds)
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000), // 30s

  // Sentry error tracking (optional — set to enable)
  SENTRY_DSN: z.string().url().optional(),
});

export type Config = z.infer<typeof configSchema>;

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    const result = configSchema.safeParse(process.env);
    if (!result.success) {
      const errors = result.error.issues.map(
        (i) => `  ${i.path.join(".")}: ${i.message}`,
      );
      console.error("Configuration validation failed:\n" + errors.join("\n"));
      process.exit(1);
    }
    _config = result.data;
  }
  return _config;
}

export function isDev(): boolean {
  return getConfig().NODE_ENV === "development";
}

export function isProd(): boolean {
  return getConfig().NODE_ENV === "production";
}
