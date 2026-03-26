/**
 * Integration Marketplace — public API.
 *
 * Unified integration system consolidating routing, notifications,
 * order management, inventory, payment, and analytics providers
 * into a single marketplace with category-aware catalog, per-tenant
 * installation, and BYOK + metered fallback credential resolution.
 *
 * Usage:
 *
 *   import {
 *     INTEGRATION_REGISTRY,
 *     getIntegrationsByCategory,
 *     resolveIntegration,
 *     onIntegrationMeter,
 *   } from "@witylogix/core/integrations";
 */

// ─── Types ───────────────────────────────────────────────────

export type {
  IntegrationCategory,
  IntegrationStatus,
  IntegrationAuthType,
  IntegrationHealthStatus,
  CredentialField,
  IntegrationAppMeta,
  IntegrationProvider,
  ResolvedIntegration,
  IntegrationEventType,
  IntegrationEvent,
} from "./types.js";

export { CATEGORY_LABELS } from "./types.js";

// ─── Registry ────────────────────────────────────────────────

export {
  INTEGRATION_REGISTRY,
  getIntegrationsByCategory,
  getIntegrationBySlug,
  getAvailableIntegrations,
  searchIntegrations,
  getIntegrationCounts,
  getAllIntegrationSlugs,
} from "./registry.js";

// ─── Categories ──────────────────────────────────────────────

export {
  COMMUNICATION_INTEGRATIONS,
  ROUTING_INTEGRATIONS,
  ORDER_MANAGEMENT_INTEGRATIONS,
  INVENTORY_INTEGRATIONS,
  PAYMENT_INTEGRATIONS,
  ANALYTICS_INTEGRATIONS,
} from "./categories/index.js";

// ─── Resolver ────────────────────────────────────────────────

export {
  resolveIntegration,
  resolveByCategory,
  maskCredentials,
} from "./resolver.js";

export type { TenantIntegrationConfig } from "./resolver.js";

// ─── Metering ────────────────────────────────────────────────

export {
  onIntegrationMeter,
  emitIntegrationEvent,
} from "./metering.js";

export type { IntegrationMeteringCallback } from "./metering.js";

// ─── Backward Compatibility ──────────────────────────────────

export {
  resolveNotificationProviderCompat,
  resolveRoutingCredentialsCompat,
} from "./compat.js";
