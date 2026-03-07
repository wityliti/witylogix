/**
 * Routing module — multi-provider registry, factory, and metering.
 *
 * Architecture:
 *
 *   ┌─────────────┐    ┌──────────────────┐    ┌──────────────┐
 *   │  Deployer    │    │  Tenant (Shop)   │    │  Provider    │
 *   │  .env config │──▶│  shop.settings   │──▶│  Registry    │
 *   └─────────────┘    └──────────────────┘    └──────┬───────┘
 *         │                                           │
 *         ▼                                           ▼
 *   ROUTING_PROVIDER=mapbox              createRoutingProvider()
 *   ROUTING_BYOK=true                    resolves tenant → deployer
 *   MAPBOX_ACCESS_TOKEN=pk...            fallback + metering
 *
 * Resolution order:
 *   1. Tenant has chosen a provider & provided credentials → use it
 *   2. Tenant has NOT configured → fall back to deployer's default
 *      provider + credentials → emit metering event
 *   3. No credentials anywhere → throw with helpful error
 *
 * Providers are added one-by-one. Each implements RoutingProvider.
 * The registry holds static metadata for all (including "coming_soon").
 *
 * Supported providers:
 *   ✅ mapbox       — Mapbox Directions, Matrix, Geocoding
 *   ✅ osrm         — Self-hosted OSRM (routing + matrix, no geocoding)
 *   🔜 google_maps  — Google Routes API + Geocoding
 *   🔜 here         — HERE Routing + Geocoding
 *   🔜 graphhopper  — GraphHopper Routing + Geocoding
 *   🔜 tomtom       — TomTom Routing + Geocoding
 */

export type {
  RoutingProvider,
  Coordinates,
  RouteResult,
  DistanceMatrixResult,
  GeocodingResult,
  ETAResult,
  RoutingProviderSlug,
  ProviderMeta,
  MeteringEvent,
  AuthType,
} from "./provider.js";

export { MapboxProvider } from "./mapbox-provider.js";
export { OSRMProvider } from "./osrm-provider.js";

import type {
  RoutingProvider,
  RoutingProviderSlug,
  ProviderMeta,
  MeteringEvent,
} from "./provider.js";
import { MapboxProvider } from "./mapbox-provider.js";
import { OSRMProvider } from "./osrm-provider.js";

// ─── Provider Registry ────────────────────────────────────

/**
 * Static registry of all routing providers.
 * UI reads this to show available options; factory reads it to instantiate.
 */
export const PROVIDER_REGISTRY: ReadonlyMap<RoutingProviderSlug, ProviderMeta> =
  new Map<RoutingProviderSlug, ProviderMeta>([
    [
      "mapbox",
      {
        slug: "mapbox",
        displayName: "Mapbox",
        description:
          "Production-ready routing, geocoding, and distance matrices. " +
          "25-point matrix limit per request. Pay-per-use.",
        authType: "api_key",
        credentialLabel: "Access Token",
        credentialPlaceholder: "pk.eyJ1IjoibXl1c2VyIiwiYSI6...",
        credentialPattern: /^[ps]k\.\w+/,
        credentialHelpUrl: "https://account.mapbox.com/access-tokens/",
        requiresBaseUrl: false,
        capabilities: { routing: true, matrix: true, geocoding: true, eta: true },
        status: "available",
      },
    ],
    [
      "osrm",
      {
        slug: "osrm",
        displayName: "OSRM (Self-Hosted)",
        description:
          "Open-source routing engine. Zero per-request cost, unlimited " +
          "matrix size (~3s for 1,000×1,000). Requires self-hosting. " +
          "No geocoding — pair with Nominatim or another geocoder.",
        authType: "none",
        credentialLabel: "Server URL",
        credentialPlaceholder: "http://osrm.example.com:5000",
        requiresBaseUrl: true,
        capabilities: { routing: true, matrix: true, geocoding: false, eta: true },
        status: "available",
      },
    ],
    [
      "google_maps",
      {
        slug: "google_maps",
        displayName: "Google Maps",
        description:
          "Google Routes API with real-time traffic, geocoding, and " +
          "distance matrices. Broad global coverage. Pay-per-use.",
        authType: "api_key",
        credentialLabel: "API Key",
        credentialPlaceholder: "AIzaSy...",
        credentialPattern: /^AIza[0-9A-Za-z_-]{35}$/,
        credentialHelpUrl: "https://console.cloud.google.com/apis/credentials",
        requiresBaseUrl: false,
        capabilities: { routing: true, matrix: true, geocoding: true, eta: true },
        status: "coming_soon",
      },
    ],
    [
      "here",
      {
        slug: "here",
        displayName: "HERE",
        description:
          "HERE Routing and Geocoding APIs with fleet management features, " +
          "truck routing, and isoline calculations.",
        authType: "api_key",
        credentialLabel: "API Key",
        credentialPlaceholder: "your-here-api-key",
        credentialHelpUrl: "https://platform.here.com/admin/apps",
        requiresBaseUrl: false,
        capabilities: { routing: true, matrix: true, geocoding: true, eta: true },
        status: "coming_soon",
      },
    ],
    [
      "graphhopper",
      {
        slug: "graphhopper",
        displayName: "GraphHopper",
        description:
          "Open-source routing engine with hosted and self-hosted options. " +
          "Built-in vehicle routing problem (VRP) solver.",
        authType: "api_key",
        credentialLabel: "API Key",
        credentialPlaceholder: "your-graphhopper-key",
        credentialHelpUrl: "https://www.graphhopper.com/dashboard/#/api-keys",
        requiresBaseUrl: false,
        capabilities: { routing: true, matrix: true, geocoding: true, eta: true },
        status: "coming_soon",
      },
    ],
    [
      "tomtom",
      {
        slug: "tomtom",
        displayName: "TomTom",
        description:
          "TomTom Routing and Geocoding APIs with real-time traffic and " +
          "commercial vehicle routing profiles.",
        authType: "api_key",
        credentialLabel: "API Key",
        credentialPlaceholder: "your-tomtom-key",
        credentialHelpUrl: "https://developer.tomtom.com/user/me/apps",
        requiresBaseUrl: false,
        capabilities: { routing: true, matrix: true, geocoding: true, eta: true },
        status: "coming_soon",
      },
    ],
  ]);

/**
 * Get list of all provider metadata (for Settings UI).
 * Optionally filter by status.
 */
export function getProviderRegistry(
  filter?: { status?: "available" | "coming_soon" },
): ProviderMeta[] {
  const all = Array.from(PROVIDER_REGISTRY.values());
  if (filter?.status) {
    return all.filter((p) => p.status === filter.status);
  }
  return all;
}

/**
 * Get metadata for a specific provider.
 */
export function getProviderMeta(
  slug: RoutingProviderSlug,
): ProviderMeta | undefined {
  return PROVIDER_REGISTRY.get(slug);
}

// ─── Types ─────────────────────────────────────────────────

/**
 * Credentials the tenant or deployer provides for a specific provider.
 * Stored in shop.settings.routing or read from env vars.
 */
export interface RoutingCredentials {
  /** The provider the tenant wants to use (overrides deployer default). */
  provider?: RoutingProviderSlug;
  /** API key / access token for key-based providers. */
  apiKey?: string;
  /** Base URL for self-hosted providers (OSRM, self-hosted GraphHopper). */
  baseUrl?: string;
}

/**
 * Result from resolving which provider + credentials to use.
 * Includes metering context so callers can log fallback usage.
 */
export interface ResolvedProvider {
  instance: RoutingProvider;
  /** The provider slug that was actually used. */
  provider: RoutingProviderSlug;
  /** Whether the deployer's fallback credentials were used. */
  usedFallback: boolean;
  /** The tenant's shop ID (for metering). */
  shopId?: string;
}

// ─── Metering ──────────────────────────────────────────────

/**
 * Metering callback type. The deployer can plug in their own
 * implementation (e.g., write to DB, emit to Redis, send to analytics).
 */
export type MeteringCallback = (event: MeteringEvent) => void | Promise<void>;

let _meteringCallback: MeteringCallback | null = null;

/**
 * Register a global metering callback. Called each time a routing
 * operation uses the deployer's fallback credentials.
 *
 * Example:
 *   onRoutingMeter(async (event) => {
 *     await db.routingMeterEvent.create({ data: event });
 *   });
 */
export function onRoutingMeter(callback: MeteringCallback): void {
  _meteringCallback = callback;
}

/**
 * Emit a metering event (called internally by the metered proxy).
 */
export function emitMeterEvent(event: MeteringEvent): void {
  if (_meteringCallback) {
    // Fire-and-forget — never block the routing call
    Promise.resolve(_meteringCallback(event)).catch((err) => {
      console.error("[routing:metering] Callback error:", err);
    });
  }
}

// ─── Metered Provider Proxy ────────────────────────────────

/**
 * Wraps a RoutingProvider to emit metering events on each call
 * when the deployer's fallback credentials are being used.
 */
function createMeteredProxy(
  inner: RoutingProvider,
  resolved: ResolvedProvider,
): RoutingProvider {
  if (!resolved.usedFallback || !resolved.shopId) {
    // No metering needed — tenant is using their own credentials
    return inner;
  }

  const base: MeteringEvent = {
    shopId: resolved.shopId,
    provider: resolved.provider,
    operation: "route", // overridden per method
    usedFallback: true,
    timestamp: new Date(),
  };

  const emit = (operation: MeteringEvent["operation"]) => {
    emitMeterEvent({ ...base, operation, timestamp: new Date() });
  };

  return {
    get name() {
      return inner.name;
    },
    async getRoute(origin, destination) {
      emit("route");
      return inner.getRoute(origin, destination);
    },
    async getRouteWithWaypoints(waypoints) {
      emit("route");
      return inner.getRouteWithWaypoints(waypoints);
    },
    async getDistanceMatrix(points) {
      emit("matrix");
      return inner.getDistanceMatrix(points);
    },
    async geocode(address) {
      emit("geocode");
      return inner.geocode(address);
    },
    async reverseGeocode(coords) {
      emit("reverse_geocode");
      return inner.reverseGeocode(coords);
    },
    async getETA(origin, destination) {
      emit("eta");
      return inner.getETA(origin, destination);
    },
  };
}

// ─── Factory ───────────────────────────────────────────────

/**
 * Create a routing provider instance.
 *
 * Resolution:
 *   1. If tenantCredentials.provider is set & credentials valid → use tenant's choice
 *   2. Otherwise → fall back to deployer env vars (ROUTING_PROVIDER + token/url)
 *      and emit metering events to track fallback usage
 *   3. If nothing is configured → throw with a helpful message
 *
 * @param tenantCredentials  Per-tenant routing config from shop.settings.routing
 * @param shopId             Tenant shop ID (used for metering)
 * @returns  A ResolvedProvider with the instance and metering context
 */
export function createRoutingProvider(
  tenantCredentials?: RoutingCredentials,
  shopId?: string,
): ResolvedProvider {
  const deployerProvider = (process.env.ROUTING_PROVIDER || "mapbox") as RoutingProviderSlug;
  const byok = process.env.ROUTING_BYOK === "true";

  // ── Attempt 1: Tenant's own provider + credentials ──────────
  if (byok && tenantCredentials?.provider) {
    const meta = PROVIDER_REGISTRY.get(tenantCredentials.provider);

    if (meta && meta.status === "available") {
      try {
        const instance = instantiateProvider(
          tenantCredentials.provider,
          tenantCredentials.apiKey,
          tenantCredentials.baseUrl,
        );
        return { instance, provider: tenantCredentials.provider, usedFallback: false, shopId };
      } catch {
        // Tenant credentials are invalid — fall through to deployer fallback
        console.warn(
          `[routing] Tenant ${shopId} credentials for ${tenantCredentials.provider} failed, falling back to deployer default`,
        );
      }
    }
  }

  // ── Legacy BYOK: tenant provided just an API key without choosing provider ──
  // (backwards-compat with the old mapboxAccessToken-only flow)
  if (byok && tenantCredentials?.apiKey && !tenantCredentials.provider) {
    try {
      const instance = instantiateProvider(
        deployerProvider,
        tenantCredentials.apiKey,
        tenantCredentials.baseUrl,
      );
      return { instance, provider: deployerProvider, usedFallback: false, shopId };
    } catch {
      // Fall through
    }
  }

  // ── Attempt 2: Deployer fallback ────────────────────────────
  const fallbackKey = resolveDeployerCredential(deployerProvider);
  const fallbackUrl = resolveDeployerBaseUrl(deployerProvider);

  try {
    const instance = instantiateProvider(deployerProvider, fallbackKey, fallbackUrl);
    const resolved: ResolvedProvider = {
      instance,
      provider: deployerProvider,
      usedFallback: true,
      shopId,
    };
    // Wrap in metering proxy so every call is tracked
    return {
      ...resolved,
      instance: createMeteredProxy(instance, resolved),
    };
  } catch (err) {
    throw new Error(
      `Cannot create routing provider. Deployer default is "${deployerProvider}" ` +
      `but credentials are missing. ${byok
        ? "BYOK is enabled — configure your credentials in Settings → Routing, " +
          "or ask your platform administrator to set fallback credentials in .env."
        : `Set ${getEnvVarHint(deployerProvider)} in your .env file.`
      }`,
    );
  }
}

/**
 * Simplified factory for non-tenant contexts (e.g., CLI tools, scripts).
 * Always uses deployer credentials, no metering.
 */
export function createDeployerRoutingProvider(): RoutingProvider {
  const provider = (process.env.ROUTING_PROVIDER || "mapbox") as RoutingProviderSlug;
  const key = resolveDeployerCredential(provider);
  const url = resolveDeployerBaseUrl(provider);
  return instantiateProvider(provider, key, url);
}

// ─── Instantiation ─────────────────────────────────────────

function instantiateProvider(
  slug: RoutingProviderSlug,
  apiKey?: string,
  baseUrl?: string,
): RoutingProvider {
  switch (slug) {
    case "mapbox": {
      if (!apiKey) throw new Error("Mapbox requires an access token");
      return new MapboxProvider(apiKey);
    }

    case "osrm": {
      if (!baseUrl) throw new Error("OSRM requires a base URL");
      return new OSRMProvider(baseUrl);
    }

    case "google_maps":
      throw new Error(
        "Google Maps provider is coming soon. " +
        "Please use Mapbox or OSRM in the meantime.",
      );

    case "here":
      throw new Error(
        "HERE provider is coming soon. " +
        "Please use Mapbox or OSRM in the meantime.",
      );

    case "graphhopper":
      throw new Error(
        "GraphHopper provider is coming soon. " +
        "Please use Mapbox or OSRM in the meantime.",
      );

    case "tomtom":
      throw new Error(
        "TomTom provider is coming soon. " +
        "Please use Mapbox or OSRM in the meantime.",
      );

    default:
      throw new Error(
        `Unknown routing provider: "${slug}". ` +
        `Supported: ${Array.from(PROVIDER_REGISTRY.keys()).join(", ")}`,
      );
  }
}

// ─── Deployer Credential Resolution ────────────────────────

function resolveDeployerCredential(slug: RoutingProviderSlug): string | undefined {
  switch (slug) {
    case "mapbox":
      return process.env.MAPBOX_ACCESS_TOKEN;
    case "google_maps":
      return process.env.GOOGLE_MAPS_API_KEY;
    case "here":
      return process.env.HERE_API_KEY;
    case "graphhopper":
      return process.env.GRAPHHOPPER_API_KEY;
    case "tomtom":
      return process.env.TOMTOM_API_KEY;
    case "osrm":
      return undefined; // OSRM uses baseUrl, not an API key
    default:
      return undefined;
  }
}

function resolveDeployerBaseUrl(slug: RoutingProviderSlug): string | undefined {
  switch (slug) {
    case "osrm":
      return process.env.OSRM_BASE_URL;
    default:
      return undefined;
  }
}

function getEnvVarHint(slug: RoutingProviderSlug): string {
  switch (slug) {
    case "mapbox":
      return "MAPBOX_ACCESS_TOKEN";
    case "google_maps":
      return "GOOGLE_MAPS_API_KEY";
    case "here":
      return "HERE_API_KEY";
    case "graphhopper":
      return "GRAPHHOPPER_API_KEY";
    case "tomtom":
      return "TOMTOM_API_KEY";
    case "osrm":
      return "OSRM_BASE_URL";
    default:
      return `<credentials for ${slug}>`;
  }
}
