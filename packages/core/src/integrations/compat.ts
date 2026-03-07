/**
 * Backward Compatibility Layer — delegates existing routing and
 * notification resolution functions to the unified integration resolver.
 *
 * Existing code that calls:
 *   - resolveNotificationProvider() from @witylogix/core/notifications
 *   - createRoutingProvider() from @witylogix/core/routing
 *
 * continues to work without changes. These functions internally
 * still call the original implementations (not redirected yet) —
 * this file provides the mapping layer for gradual migration.
 *
 * Migration plan:
 *   Phase 1 (now): Compat layer exists, original functions still work
 *   Phase 2 (future): Routes/workers import from integrations instead
 *   Phase 3 (future): Remove compat layer, delete old modules
 */

import type { IntegrationCategory } from "./types.js";
import { resolveIntegration, resolveByCategory } from "./resolver.js";
import type { TenantIntegrationConfig } from "./resolver.js";

// ─── Notification Compat ─────────────────────────────────────

/** Channel slug → integration slug mapping for existing notification providers. */
const NOTIFICATION_CHANNEL_DEFAULTS: Record<string, string> = {
  email: "sendgrid",
  sms: "twilio",
  whatsapp: "meta_cloud",
  push: "firebase",
};

/**
 * Resolve a notification provider using the unified resolver.
 * Drop-in replacement for the original resolveNotificationProvider().
 */
export function resolveNotificationProviderCompat(
  channel: string,
  tenantConfig?: { provider?: string; [key: string]: unknown } | null,
  shopId?: string,
) {
  // If tenant has chosen a specific provider, resolve that slug
  const slug = tenantConfig?.provider || NOTIFICATION_CHANNEL_DEFAULTS[channel];

  if (!slug) {
    return {
      channel,
      provider: channel,
      credentials: {},
      usedFallback: true,
      available: false,
    };
  }

  // Build tenant config for the resolver
  let tenantInstallation: TenantIntegrationConfig | null = null;
  if (tenantConfig) {
    const creds = { ...tenantConfig };
    delete creds.provider;
    tenantInstallation = {
      credentials: creds,
      config: {},
      isEnabled: true,
    };
  }

  const resolved = resolveIntegration(slug, tenantInstallation, shopId);

  return {
    channel,
    provider: resolved.slug,
    credentials: resolved.credentials,
    usedFallback: resolved.usedFallback,
    available: resolved.available,
  };
}

// ─── Routing Compat ──────────────────────────────────────────

/**
 * Resolve a routing provider using the unified resolver.
 * This provides the credential resolution part — the actual
 * RoutingProvider instantiation still happens in the routing module.
 */
export function resolveRoutingCredentialsCompat(
  tenantCredentials?: { provider?: string; apiKey?: string; baseUrl?: string } | null,
  shopId?: string,
) {
  const slug = tenantCredentials?.provider || process.env.ROUTING_PROVIDER || "mapbox";

  let tenantInstallation: TenantIntegrationConfig | null = null;
  if (tenantCredentials?.apiKey || tenantCredentials?.baseUrl) {
    tenantInstallation = {
      credentials: {
        apiKey: tenantCredentials.apiKey,
        baseUrl: tenantCredentials.baseUrl,
      },
      config: {},
      isEnabled: true,
    };
  }

  return resolveIntegration(slug, tenantInstallation, shopId);
}
