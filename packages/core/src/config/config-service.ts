/**
 * Configuration Service — Centralized, environment-aware configuration
 *
 * This module provides a singleton ConfigService that:
 * - Manages typed, nested configuration access
 * - Supports environment-aware defaults
 * - Enables hot reload via file watcher (config.local.json)
 * - Provides feature flag support
 * - Returns sanitized configs for debugging (secrets redacted)
 *
 * Usage:
 *   const config = ConfigService.getInstance();
 *   const dbUrl = config.get('database.url');
 *   const featureEnabled = config.isFeatureEnabled('ONBOARDING_AI_DEFAULTS');
 */

import { readFileSync, watchFile } from "fs";
import { resolve } from "path";
import type { Env } from "./env-validator.ts";
import { env as validatedEnv } from "./env-validator.ts";

type ConfigValue = string | number | boolean | object | undefined;

/**
 * Configuration object structure
 */
interface ConfigStructure {
  server: {
    port: number;
    env: string;
    logLevel: string;
  };
  database: {
    url: string;
    poolSize: number;
    readReplicaUrl?: string;
  };
  redis: {
    url: string;
    password?: string;
  };
  jwt: {
    secret: string;
    accessExpiry: string;
    refreshExpiry: string;
  };
  smtp: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
  };
  twilio: {
    sid?: string;
    authToken?: string;
    phone?: string;
  };
  stripe: {
    secretKey?: string;
    webhookSecret?: string;
  };
  sentry: {
    dsn?: string;
    environment?: string;
  };
  geo: {
    mapboxToken?: string;
    googleMapsKey?: string;
  };
  shopify: {
    apiKey?: string;
    apiSecret?: string;
  };
  s3: {
    bucket?: string;
    region?: string;
    accessKey?: string;
    secretKey?: string;
  };
  urls: {
    appUrl: string;
    apiUrl?: string;
    dashboardUrl?: string;
  };
  features: Record<string, boolean>;
  [key: string]: ConfigValue;
}

/**
 * Sensitive keys that should be redacted in debug output
 */
const SENSITIVE_KEYS = [
  "secret",
  "password",
  "token",
  "key",
  "sid",
  "dsn",
];

/**
 * Singleton configuration service
 */
export class ConfigService {
  private static instance: ConfigService;
  private config: ConfigStructure;
  private localConfigPath: string;

  private constructor(env: Env) {
    this.localConfigPath = resolve(process.cwd(), "config.local.json");
    this.config = this.buildConfig(env);
    this.setupWatcher();
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService(validatedEnv);
    }
    return ConfigService.instance;
  }

  /**
   * Build typed configuration from environment variables
   */
  private buildConfig(env: Env): ConfigStructure {
    return {
      server: {
        port: env.PORT,
        env: env.NODE_ENV,
        logLevel: env.LOG_LEVEL,
      },
      database: {
        url: env.DATABASE_URL,
        poolSize: env.DATABASE_POOL_SIZE,
        readReplicaUrl: env.DATABASE_READ_REPLICA_URL,
      },
      redis: {
        url: env.REDIS_URL,
        password: env.REDIS_PASSWORD,
      },
      jwt: {
        secret: env.JWT_SECRET,
        accessExpiry: env.JWT_ACCESS_EXPIRY,
        refreshExpiry: env.JWT_REFRESH_EXPIRY,
      },
      smtp: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        password: env.SMTP_PASSWORD,
      },
      twilio: {
        sid: env.TWILIO_SID,
        authToken: env.TWILIO_AUTH_TOKEN,
        phone: env.TWILIO_PHONE,
      },
      stripe: {
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      },
      sentry: {
        dsn: env.SENTRY_DSN,
        environment: env.SENTRY_ENVIRONMENT,
      },
      geo: {
        mapboxToken: env.MAPBOX_TOKEN,
        googleMapsKey: env.GOOGLE_MAPS_KEY,
      },
      shopify: {
        apiKey: env.SHOPIFY_API_KEY,
        apiSecret: env.SHOPIFY_API_SECRET,
      },
      s3: {
        bucket: env.S3_BUCKET,
        region: env.S3_REGION,
        accessKey: env.S3_ACCESS_KEY,
        secretKey: env.S3_SECRET_KEY,
      },
      urls: {
        appUrl: env.APP_URL,
        apiUrl: env.API_URL,
        dashboardUrl: env.DASHBOARD_URL,
      },
      features: this.getDefaultFeatureFlags(env.NODE_ENV),
    };
  }

  /**
   * Get default feature flags per environment
   */
  private getDefaultFeatureFlags(nodeEnv: string): Record<string, boolean> {
    const isDev = nodeEnv === "development";

    return {
      ONBOARDING_AI_DEFAULTS: isDev,
      MFA_REQUIRED: nodeEnv === "production",
      WEBHOOK_V2: isDev,
      API_VERSIONING: true,
      REAL_TIME_TRACKING: true,
      ADVANCED_ANALYTICS: nodeEnv !== "development",
      MULTI_CURRENCY: true,
      SSO_PROVIDERS: nodeEnv !== "development",
    };
  }

  /**
   * Set up file watcher for hot reload of local config
   */
  private setupWatcher(): void {
    try {
      watchFile(this.localConfigPath, { interval: 1000 }, () => {
        try {
          const localConfig = JSON.parse(
            readFileSync(this.localConfigPath, "utf-8")
          );
          this.config = { ...this.config, ...localConfig };
        } catch (error) {
          console.warn(`Failed to reload local config: ${error}`);
        }
      });
    } catch (error) {
      // File watcher is optional, don't fail if it's not available
    }
  }

  /**
   * Get configuration value with nested path support
   * Example: get('database.poolSize') returns config.database.poolSize
   *
   * @param path - Dot-separated path (e.g., 'database.url')
   * @param defaultValue - Optional default value
   * @returns Configuration value
   */
  get<T = ConfigValue>(path: string, defaultValue?: T): T {
    const keys = path.split(".");
    let value: ConfigValue = this.config;

    for (const key of keys) {
      if (typeof value === "object" && value !== null && key in value) {
        value = (value as Record<string, ConfigValue>)[key];
      } else {
        return defaultValue as T;
      }
    }

    return (value as T) || (defaultValue as T);
  }

  /**
   * Check if feature flag is enabled
   *
   * @param flag - Feature flag name
   * @param context - Optional context for tenant/user-based overrides
   * @returns Whether feature is enabled
   */
  isFeatureEnabled(
    flag: string,
    context?: {
      tenantId?: string;
      userId?: string;
      percentageRollout?: number;
    }
  ): boolean {
    const enabled = this.config.features[flag] ?? false;

    // Percentage rollout support
    if (context?.percentageRollout !== undefined && enabled) {
      const seed = context.tenantId || context.userId || "";
      const hash = this.simpleHash(seed);
      return hash % 100 < context.percentageRollout;
    }

    return enabled;
  }

  /**
   * Enable/disable a feature flag at runtime
   * @param flag - Feature flag name
   * @param enabled - Whether to enable
   */
  setFeatureFlag(flag: string, enabled: boolean): void {
    this.config.features[flag] = enabled;
  }

  /**
   * Get configuration snapshot for debugging (with secrets redacted)
   *
   * @returns Sanitized configuration object
   */
  getSnapshot(): Record<string, unknown> {
    return this.redactSensitiveData(
      JSON.parse(JSON.stringify(this.config))
    );
  }

  /**
   * Recursively redact sensitive configuration values
   */
  private redactSensitiveData(
    obj: Record<string, unknown>
  ): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      const isSensitive = SENSITIVE_KEYS.some((sensitive) =>
        keyLower.includes(sensitive)
      );

      if (isSensitive && typeof value === "string") {
        redacted[key] = "***REDACTED***";
      } else if (typeof value === "object" && value !== null) {
        redacted[key] = this.redactSensitiveData(
          value as Record<string, unknown>
        );
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Simple hash function for percentage rollout
   * Ensures consistent results for same input
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Export singleton instance getter for convenience
 */
export const getConfig = (): ConfigService => ConfigService.getInstance();
