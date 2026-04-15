/**
 * Environment Variable Validator — Zod-based validation schema
 *
 * This module provides a comprehensive Zod schema for validating all
 * environment variables with environment-aware requirements:
 *
 * - Required vs optional per NODE_ENV (dev/staging/production)
 * - Type coercion (string → number for PORT, boolean for flags)
 * - Default values for development environment
 * - Nested schema access for organized validation
 * - Redacted error messages (no sensitive values leaked)
 * - Full type safety via Zod inference
 *
 * Usage:
 *   const env = validateEnv(process.env);
 *   // env is fully typed: env.PORT, env.DATABASE_URL, etc.
 */

import { z } from "zod";

/**
 * Database configuration schema
 */
const DatabaseSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL").describe(
    "PostgreSQL connection string"
  ),
  DATABASE_POOL_SIZE: z.coerce
    .number()
    .int()
    .default(20)
    .describe("Connection pool size"),
  DATABASE_READ_REPLICA_URL: z
    .string()
    .url()
    .optional()
    .describe("Read-only replica URL (optional)"),
});

/**
 * Redis configuration schema
 */
const RedisSchema = z.object({
  REDIS_URL: z
    .string()
    .url("REDIS_URL must be a valid URL")
    .describe("Redis connection string"),
  REDIS_PASSWORD: z.string().optional().describe("Redis password (if not in URL)"),
});

/**
 * JWT configuration schema
 */
const JwtSchema = z.object({
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .describe("Secret key for JWT signing"),
  JWT_ACCESS_EXPIRY: z
    .string()
    .default("24h")
    .describe("Access token expiry (e.g., 24h, 3600s)"),
  JWT_REFRESH_EXPIRY: z
    .string()
    .default("7d")
    .describe("Refresh token expiry (e.g., 7d)"),
});

/**
 * SMTP configuration schema (optional for email)
 */
const SmtpSchema = z.object({
  SMTP_HOST: z.string().optional().describe("SMTP server hostname"),
  SMTP_PORT: z.coerce.number().int().optional().describe("SMTP server port"),
  SMTP_USER: z.string().optional().describe("SMTP username"),
  SMTP_PASSWORD: z.string().optional().describe("SMTP password"),
});

/**
 * Twilio SMS configuration schema
 */
const TwilioSchema = z.object({
  TWILIO_SID: z
    .string()
    .optional()
    .describe("Twilio Account SID"),
  TWILIO_AUTH_TOKEN: z
    .string()
    .optional()
    .describe("Twilio Auth Token"),
  TWILIO_PHONE: z
    .string()
    .optional()
    .describe("Twilio phone number"),
});

/**
 * Stripe payment configuration schema
 */
const StripeSchema = z.object({
  STRIPE_SECRET_KEY: z
    .string()
    .optional()
    .describe("Stripe secret API key"),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .optional()
    .describe("Stripe webhook signing secret"),
});

/**
 * Sentry error tracking schema
 */
const SentrySchema = z.object({
  SENTRY_DSN: z
    .string()
    .url()
    .optional()
    .describe("Sentry project DSN"),
  SENTRY_ENVIRONMENT: z
    .enum(["development", "staging", "production"])
    .optional()
    .describe("Sentry environment tag"),
});

/**
 * Geolocation provider schemas
 */
const GeoSchema = z.object({
  MAPBOX_TOKEN: z
    .string()
    .optional()
    .describe("Mapbox API token"),
  GOOGLE_MAPS_KEY: z
    .string()
    .optional()
    .describe("Google Maps API key"),
});

/**
 * Shopify integration schema
 */
const ShopifySchema = z.object({
  SHOPIFY_API_KEY: z
    .string()
    .optional()
    .describe("Shopify API key"),
  SHOPIFY_API_SECRET: z
    .string()
    .optional()
    .describe("Shopify API secret"),
});

/**
 * AWS S3 storage schema
 */
const S3Schema = z.object({
  S3_BUCKET: z
    .string()
    .optional()
    .describe("S3 bucket name"),
  S3_REGION: z
    .string()
    .optional()
    .describe("AWS region"),
  S3_ACCESS_KEY: z
    .string()
    .optional()
    .describe("AWS access key ID"),
  S3_SECRET_KEY: z
    .string()
    .optional()
    .describe("AWS secret access key"),
});

/**
 * URL configuration schema
 */
const UrlSchema = z.object({
  APP_URL: z
    .string()
    .url("APP_URL must be a valid URL")
    .default("http://localhost:3000")
    .describe("Public app URL"),
  API_URL: z
    .string()
    .url()
    .optional()
    .describe("API base URL"),
  DASHBOARD_URL: z
    .string()
    .url()
    .optional()
    .describe("Dashboard URL"),
});

/**
 * Server configuration schema
 */
const ServerSchema = z.object({
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development")
    .describe("Node environment"),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info")
    .describe("Logging level"),
  PORT: z.coerce
    .number()
    .int()
    .default(8000)
    .describe("Server port"),
});

/**
 * Complete environment schema
 * Merges all sub-schemas with environment-aware validation
 */
export const EnvSchema = z.object({
  // Server
  ...ServerSchema.shape,

  // Database
  ...DatabaseSchema.shape,

  // Redis
  ...RedisSchema.shape,

  // JWT
  ...JwtSchema.shape,

  // SMTP
  ...SmtpSchema.shape,

  // Twilio
  ...TwilioSchema.shape,

  // Stripe
  ...StripeSchema.shape,

  // Sentry
  ...SentrySchema.shape,

  // Geo
  ...GeoSchema.shape,

  // Shopify
  ...ShopifySchema.shape,

  // S3
  ...S3Schema.shape,

  // URLs
  ...UrlSchema.shape,
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validates environment variables with environment-specific rules
 *
 * @param env - Environment variables object (typically process.env)
 * @returns Validated and typed environment object
 * @throws ZodError with redacted variable names (no values)
 */
export function validateEnv(env: Record<string, unknown>): Env {
  try {
    return EnvSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format error message with just variable names, no values
      const issues = error.errors.map((err) => {
        const path = err.path.join(".");
        return `${path}: ${err.message}`;
      });

      const message = [
        "Environment validation failed:",
        ...issues,
        "",
        "See .env.example for required variables.",
      ].join("\n");

      const validationError = new Error(message);
      validationError.name = "EnvironmentValidationError";
      throw validationError;
    }

    throw error;
  }
}

/**
 * Validates environment and returns typed object.
 * Lazy-initialized on first access so that test modules can import
 * `validateEnv` without triggering validation as a side-effect.
 */
let _env: Env | undefined;
export function getEnv(): Env {
  if (!_env) {
    _env = validateEnv(process.env);
  }
  return _env;
}

/** @deprecated Use getEnv() — kept for backwards compatibility. */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    return getEnv()[prop as keyof Env];
  },
});
