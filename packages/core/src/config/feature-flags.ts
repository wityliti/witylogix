/**
 * Feature Flags System — Environment, tenant, and percentage-based feature control
 *
 * This module provides a comprehensive feature flagging system with:
 * - Environment-aware defaults (dev: all on, prod: selective)
 * - Tenant-based flag overrides
 * - Percentage rollout support (deterministic per tenant)
 * - Flag definitions with descriptions
 *
 * Usage:
 *   const isEnabled = isFeatureEnabled('ONBOARDING_AI_DEFAULTS');
 *   const isEnabledForTenant = isFeatureEnabled('REAL_TIME_TRACKING', {
 *     tenantId: 'org-123',
 *     percentageRollout: 50  // 50% of tenants
 *   });
 */

import { ConfigService } from "./config-service.ts";

/**
 * All available feature flags
 */
export enum FeatureFlag {
  /** AI-assisted onboarding with smart defaults */
  ONBOARDING_AI_DEFAULTS = "ONBOARDING_AI_DEFAULTS",

  /** Require MFA for all user accounts */
  MFA_REQUIRED = "MFA_REQUIRED",

  /** Webhook API v2 with improved payload structure */
  WEBHOOK_V2 = "WEBHOOK_V2",

  /** API versioning support (v1, v2, etc.) */
  API_VERSIONING = "API_VERSIONING",

  /** Real-time tracking updates (WebSocket) */
  REAL_TIME_TRACKING = "REAL_TIME_TRACKING",

  /** Advanced analytics dashboard */
  ADVANCED_ANALYTICS = "ADVANCED_ANALYTICS",

  /** Multi-currency support */
  MULTI_CURRENCY = "MULTI_CURRENCY",

  /** SSO provider integrations (SAML, OAuth) */
  SSO_PROVIDERS = "SSO_PROVIDERS",
}

/**
 * Feature flag definitions with metadata
 */
export const FEATURE_FLAG_DEFINITIONS: Record<
  FeatureFlag,
  {
    name: string;
    description: string;
    defaultInDev: boolean;
    defaultInStaging: boolean;
    defaultInProd: boolean;
    rolloutPercentage?: number;
  }
> = {
  [FeatureFlag.ONBOARDING_AI_DEFAULTS]: {
    name: "AI-Assisted Onboarding",
    description: "Use AI to suggest smart defaults during onboarding",
    defaultInDev: true,
    defaultInStaging: false,
    defaultInProd: false,
  },

  [FeatureFlag.MFA_REQUIRED]: {
    name: "Require MFA",
    description: "Enforce multi-factor authentication for all users",
    defaultInDev: false,
    defaultInStaging: true,
    defaultInProd: true,
  },

  [FeatureFlag.WEBHOOK_V2]: {
    name: "Webhook API v2",
    description: "New webhook payload structure with additional fields",
    defaultInDev: true,
    defaultInStaging: false,
    defaultInProd: false,
    rolloutPercentage: 10, // 10% rollout in prod
  },

  [FeatureFlag.API_VERSIONING]: {
    name: "API Versioning",
    description: "Support multiple API versions (v1, v2)",
    defaultInDev: true,
    defaultInStaging: true,
    defaultInProd: true,
  },

  [FeatureFlag.REAL_TIME_TRACKING]: {
    name: "Real-Time Tracking",
    description: "WebSocket-based real-time delivery tracking updates",
    defaultInDev: true,
    defaultInStaging: true,
    defaultInProd: true,
  },

  [FeatureFlag.ADVANCED_ANALYTICS]: {
    name: "Advanced Analytics",
    description: "Advanced reporting and analytics features",
    defaultInDev: false,
    defaultInStaging: false,
    defaultInProd: true,
  },

  [FeatureFlag.MULTI_CURRENCY]: {
    name: "Multi-Currency Support",
    description: "Support for multiple currencies in orders and billing",
    defaultInDev: true,
    defaultInStaging: true,
    defaultInProd: true,
  },

  [FeatureFlag.SSO_PROVIDERS]: {
    name: "SSO Providers",
    description: "Single sign-on via SAML and OAuth providers",
    defaultInDev: false,
    defaultInStaging: false,
    defaultInProd: true,
  },
};

/**
 * Context for evaluating feature flags
 */
export interface FeatureFlagContext {
  /** Organization/tenant ID for tenant-based overrides */
  tenantId?: string;

  /** User ID for user-based decisions */
  userId?: string;

  /** Percentage of users/tenants to enable for (0-100) */
  percentageRollout?: number;

  /** Custom data for complex flag evaluation */
  metadata?: Record<string, unknown>;
}

/**
 * Tenant-level feature flag overrides
 */
const tenantOverrides: Map<string, Set<FeatureFlag>> = new Map();

/**
 * Check if a feature flag is enabled
 *
 * @param flag - Feature flag to check
 * @param context - Optional context for evaluation
 * @returns Whether the feature is enabled
 *
 * @example
 * // Simple check
 * if (isFeatureEnabled(FeatureFlag.MFA_REQUIRED)) {
 *   enfororeMfa();
 * }
 *
 * @example
 * // With tenant-based rollout
 * if (isFeatureEnabled(FeatureFlag.WEBHOOK_V2, {
 *   tenantId: 'org-123',
 *   percentageRollout: 10  // 10% of tenants
 * })) {
 *   useWebhookV2();
 * }
 */
export function isFeatureEnabled(
  flag: FeatureFlag | string,
  context?: FeatureFlagContext,
): boolean {
  const config = ConfigService.getInstance();
  const env = config.get<string>("server.env", "development");

  // Check tenant override first
  if (context?.tenantId) {
    const overrides = tenantOverrides.get(context.tenantId);
    if (overrides?.has(flag as FeatureFlag)) {
      return true;
    }
  }

  // Get default for environment
  const definition = FEATURE_FLAG_DEFINITIONS[flag as FeatureFlag];
  if (!definition) {
    return false;
  }

  let enabled: boolean;
  switch (env) {
    case "development":
      enabled = definition.defaultInDev;
      break;
    case "staging":
      enabled = definition.defaultInStaging;
      break;
    case "production":
      enabled = definition.defaultInProd;
      break;
    default:
      enabled = false;
  }

  // Apply percentage rollout if needed
  if (enabled && context?.percentageRollout !== undefined) {
    const rolloutEnabled = evaluateRollout(
      context.percentageRollout,
      context.tenantId || context.userId || "",
    );
    return rolloutEnabled;
  }

  return enabled;
}

/**
 * Enable a feature flag for a specific tenant
 *
 * @param flag - Feature flag to enable
 * @param tenantId - Tenant ID to enable for
 */
export function enableFeatureForTenant(
  flag: FeatureFlag,
  tenantId: string,
): void {
  if (!tenantOverrides.has(tenantId)) {
    tenantOverrides.set(tenantId, new Set());
  }
  tenantOverrides.get(tenantId)!.add(flag);
}

/**
 * Disable a feature flag for a specific tenant
 *
 * @param flag - Feature flag to disable
 * @param tenantId - Tenant ID to disable for
 */
export function disableFeatureForTenant(
  flag: FeatureFlag,
  tenantId: string,
): void {
  const overrides = tenantOverrides.get(tenantId);
  if (overrides) {
    overrides.delete(flag);
    if (overrides.size === 0) {
      tenantOverrides.delete(tenantId);
    }
  }
}

/**
 * Get all enabled flags for a tenant
 *
 * @param tenantId - Tenant ID
 * @returns List of enabled flags
 */
export function getEnabledFlagsForTenant(tenantId: string): FeatureFlag[] {
  const enabled: FeatureFlag[] = [];

  for (const flag of Object.values(FeatureFlag)) {
    if (isFeatureEnabled(flag, { tenantId })) {
      enabled.push(flag as FeatureFlag);
    }
  }

  return enabled;
}

/**
 * Evaluate percentage rollout deterministically
 * Same input always produces same output
 *
 * @param percentage - Percentage to rollout (0-100)
 * @param seed - Seed for consistent hashing
 * @returns Whether this seed falls in the rollout percentage
 */
function evaluateRollout(percentage: number, seed: string): boolean {
  if (percentage <= 0) return false;
  if (percentage >= 100) return true;

  const hash = hashString(seed);
  const rolloutValue = hash % 100;
  return rolloutValue < percentage;
}

/**
 * Simple deterministic hash function
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get all flag definitions
 * Useful for admin panels and documentation
 *
 * @returns All feature flag definitions
 */
export function getAllFlagDefinitions() {
  return FEATURE_FLAG_DEFINITIONS;
}

/**
 * Reset tenant overrides (for testing)
 */
export function resetTenantOverrides(): void {
  tenantOverrides.clear();
}
