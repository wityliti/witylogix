/**
 * Integration Marketplace — Core type definitions.
 *
 * Generalizes the existing CredentialField, ProviderMeta, and MeteringEvent
 * patterns from routing + notifications into a category-aware unified model.
 */

// ─── Category Taxonomy ───────────────────────────────────────

/** Top-level integration categories. Matches Prisma IntegrationCategory enum. */
export type IntegrationCategory =
  | "COMMUNICATION"
  | "ROUTING"
  | "ORDER_MANAGEMENT"
  | "INVENTORY"
  | "PAYMENT"
  | "ANALYTICS";

/** Human-readable labels for each category. */
export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  COMMUNICATION: "Communication",
  ROUTING: "Routing",
  ORDER_MANAGEMENT: "Order Management",
  INVENTORY: "Inventory Management",
  PAYMENT: "Payment",
  ANALYTICS: "Analytics",
};

/** Subcategories for COMMUNICATION (notification channels). */
export type CommunicationSubcategory = "email" | "sms" | "whatsapp" | "push";

// ─── Integration App Metadata ────────────────────────────────

/** Status of an integration in the marketplace. Matches Prisma IntegrationStatus enum. */
export type IntegrationStatus = "AVAILABLE" | "COMING_SOON" | "BETA" | "DEPRECATED";

/** How authentication works. Matches Prisma IntegrationAuthType enum. */
export type IntegrationAuthType = "API_KEY" | "OAUTH" | "NONE" | "MULTI_CREDENTIAL";

/** Health status for installed integrations. Matches Prisma IntegrationHealthStatus enum. */
export type IntegrationHealthStatus = "HEALTHY" | "DEGRADED" | "ERROR" | "UNKNOWN";

/**
 * Describes a single credential field for dynamic form generation.
 * Generalized from the existing CredentialField in notifications.
 */
export interface CredentialField {
  /** Unique key (stored in credentials JSONB). */
  key: string;
  /** Human label for the form field. */
  label: string;
  /** Placeholder text. */
  placeholder: string;
  /** Input type: text, password, url, textarea. */
  type: "text" | "password" | "url" | "textarea";
  /** Whether this field is required. */
  required: boolean;
  /** URL where the user can find this credential. */
  helpUrl?: string;
  /** Regex string for client-side validation. */
  pattern?: string;
}

/**
 * Static metadata for a single integration app in the marketplace catalog.
 * This is the source-of-truth that drives UI generation, credential forms,
 * and installation flows.
 */
export interface IntegrationAppMeta {
  /** Unique slug (e.g., "sendgrid", "mapbox", "stripe"). */
  slug: string;
  /** Display name (e.g., "SendGrid"). */
  name: string;
  /** Short description for card view. */
  description: string;
  /** Detailed description (markdown) for detail view. */
  longDescription?: string;
  /** Top-level category. */
  category: IntegrationCategory;
  /** Optional subcategory (e.g., "email" for COMMUNICATION). */
  subcategory?: string;
  /** Logo URL (relative or CDN). */
  logoUrl?: string;
  /** Provider website URL. */
  websiteUrl?: string;
  /** Documentation URL. */
  docsUrl?: string;
  /** Authentication method. */
  authType: IntegrationAuthType;
  /** Credential fields for the install form (generated from this). */
  credentialFields: CredentialField[];
  /** What the integration can do (category-specific). */
  capabilities: string[];
  /** Marketplace status. */
  status: IntegrationStatus;
  /** Platform-managed (true) vs future third-party (false). */
  isBuiltIn: boolean;
  /** Semver version. */
  version: string;
}

// ─── Integration Provider Interface ──────────────────────────

/**
 * Plugin-ready provider interface with lifecycle hooks.
 * Each concrete integration provider can implement this interface.
 * Currently used internally; can be exposed as SDK later.
 */
export interface IntegrationProvider {
  /** The integration slug this provider handles. */
  readonly slug: string;

  /**
   * Called when a tenant installs this integration.
   * Validates credentials and performs initial setup.
   */
  onInstall?(credentials: Record<string, unknown>, config: Record<string, unknown>): Promise<void>;

  /**
   * Called when a tenant uninstalls this integration.
   * Cleanup any external resources.
   */
  onUninstall?(): Promise<void>;

  /**
   * Called periodically or on-demand to sync data.
   * (e.g., inventory sync, order import)
   */
  onSync?(config: Record<string, unknown>): Promise<{ synced: number; errors: number }>;

  /**
   * Called when a webhook is received from the external service.
   */
  onWebhook?(payload: unknown, headers: Record<string, string>): Promise<void>;

  /**
   * Called to check the health of the integration.
   * Returns true if the integration is healthy, false otherwise.
   */
  onHealthCheck?(credentials: Record<string, unknown>): Promise<boolean>;
}

// ─── Resolved Integration ────────────────────────────────────

/**
 * Result of resolving which provider + credentials to use.
 * Returned by the resolver for each integration category.
 */
export interface ResolvedIntegration {
  /** The integration slug that was resolved. */
  slug: string;
  /** The credentials to use (tenant's own or deployer fallback). */
  credentials: Record<string, unknown>;
  /** Whether deployer fallback credentials were used. */
  usedFallback: boolean;
  /** Whether any credentials are available at all. */
  available: boolean;
  /** Non-secret configuration. */
  config: Record<string, unknown>;
}

// ─── Integration Events ──────────────────────────────────────

/** Event types for audit trail and metering. Matches Prisma IntegrationEventType enum. */
export type IntegrationEventType =
  | "INSTALL"
  | "UNINSTALL"
  | "SYNC"
  | "WEBHOOK"
  | "HEALTH_CHECK"
  | "METER"
  | "CONFIG_UPDATE";

/**
 * Unified integration event for audit trail and metering.
 * Replaces separate RoutingMeterEvent and NotificationMeterEvent.
 */
export interface IntegrationEvent {
  shopId: string;
  appSlug: string;
  integrationId?: string;
  eventType: IntegrationEventType;
  operation?: string;
  usedFallback: boolean;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}
