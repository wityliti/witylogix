/**
 * Unified Integration Registry — single catalog of all integrations
 * across all categories.
 *
 * Consolidates the existing separate registries:
 *   - PROVIDER_REGISTRY (routing — 6 providers)
 *   - EMAIL_REGISTRY, SMS_REGISTRY, WHATSAPP_REGISTRY, PUSH_REGISTRY (17 providers)
 *   - + New categories: Order Management (4), Inventory (4), Payment (3), Analytics (4)
 *
 * Total: 38 integrations in the marketplace catalog.
 *
 * UI reads this registry to render provider cards + credential forms.
 * Adding a new integration = adding an entry to the appropriate category file.
 */

import type { IntegrationAppMeta, IntegrationCategory, IntegrationStatus } from "./types.js";
import { COMMUNICATION_INTEGRATIONS } from "./categories/communication.js";
import { ROUTING_INTEGRATIONS } from "./categories/routing.js";
import { ORDER_MANAGEMENT_INTEGRATIONS } from "./categories/order-management.js";
import { INVENTORY_INTEGRATIONS } from "./categories/inventory.js";
import { PAYMENT_INTEGRATIONS } from "./categories/payment.js";
import { ANALYTICS_INTEGRATIONS } from "./categories/analytics.js";

// ─── Build Unified Registry ─────────────────────────────────

const ALL_INTEGRATIONS: IntegrationAppMeta[] = [
  ...COMMUNICATION_INTEGRATIONS,
  ...ROUTING_INTEGRATIONS,
  ...ORDER_MANAGEMENT_INTEGRATIONS,
  ...INVENTORY_INTEGRATIONS,
  ...PAYMENT_INTEGRATIONS,
  ...ANALYTICS_INTEGRATIONS,
];

/**
 * The unified integration registry — a ReadonlyMap keyed by slug.
 * Source of truth for all marketplace catalog data.
 */
export const INTEGRATION_REGISTRY: ReadonlyMap<string, IntegrationAppMeta> = new Map(
  ALL_INTEGRATIONS.map((app) => [app.slug, app]),
);

// ─── Accessor Functions ─────────────────────────────────────

/**
 * Get all integrations for a specific category.
 * Optionally filter by subcategory (e.g., "email" within COMMUNICATION).
 */
export function getIntegrationsByCategory(
  category: IntegrationCategory,
  subcategory?: string,
): IntegrationAppMeta[] {
  const result = ALL_INTEGRATIONS.filter((app) => app.category === category);
  if (subcategory) {
    return result.filter((app) => app.subcategory === subcategory);
  }
  return result;
}

/**
 * Get a single integration by its slug.
 */
export function getIntegrationBySlug(slug: string): IntegrationAppMeta | undefined {
  return INTEGRATION_REGISTRY.get(slug);
}

/**
 * Get all available integrations (non-deprecated).
 * Optionally filter by status.
 */
export function getAvailableIntegrations(
  filter?: { status?: IntegrationStatus; category?: IntegrationCategory },
): IntegrationAppMeta[] {
  let result = ALL_INTEGRATIONS.filter((app) => app.status !== "DEPRECATED");

  if (filter?.status) {
    result = result.filter((app) => app.status === filter.status);
  }
  if (filter?.category) {
    result = result.filter((app) => app.category === filter.category);
  }

  return result;
}

/**
 * Search integrations by text query (name, description, slug, capabilities).
 */
export function searchIntegrations(query: string): IntegrationAppMeta[] {
  const q = query.toLowerCase().trim();
  if (!q) return ALL_INTEGRATIONS;

  return ALL_INTEGRATIONS.filter(
    (app) =>
      app.slug.toLowerCase().includes(q) ||
      app.name.toLowerCase().includes(q) ||
      app.description.toLowerCase().includes(q) ||
      app.capabilities.some((c) => c.toLowerCase().includes(q)) ||
      (app.subcategory && app.subcategory.toLowerCase().includes(q)),
  );
}

/**
 * Get count of integrations per category.
 */
export function getIntegrationCounts(): Record<IntegrationCategory, { total: number; available: number }> {
  const categories: IntegrationCategory[] = [
    "COMMUNICATION",
    "ROUTING",
    "ORDER_MANAGEMENT",
    "INVENTORY",
    "PAYMENT",
    "ANALYTICS",
  ];

  const counts = {} as Record<IntegrationCategory, { total: number; available: number }>;

  for (const category of categories) {
    const apps = getIntegrationsByCategory(category);
    counts[category] = {
      total: apps.length,
      available: apps.filter((a) => a.status === "AVAILABLE").length,
    };
  }

  return counts;
}

/**
 * Get all integration slugs (useful for validation).
 */
export function getAllIntegrationSlugs(): string[] {
  return ALL_INTEGRATIONS.map((app) => app.slug);
}
