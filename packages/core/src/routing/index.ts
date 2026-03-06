/**
 * Routing module — factory for creating the active routing provider
 *
 * Usage:
 *   import { createRoutingProvider } from "@witylogix/core/routing";
 *   const routing = createRoutingProvider();
 *   const route = await routing.getRoute(origin, destination);
 *
 * Provider selection via ROUTING_PROVIDER env var:
 *   - "mapbox" (default, Phase 1)
 *   - "osrm" (Phase 2)
 */

export type { RoutingProvider, Coordinates, RouteResult, DistanceMatrixResult, GeocodingResult, ETAResult } from "./provider.js";
export { MapboxProvider } from "./mapbox-provider.js";
export { OSRMProvider } from "./osrm-provider.js";

import type { RoutingProvider } from "./provider.js";
import { MapboxProvider } from "./mapbox-provider.js";
import { OSRMProvider } from "./osrm-provider.js";

export function createRoutingProvider(): RoutingProvider {
  const provider = process.env.ROUTING_PROVIDER || "mapbox";

  switch (provider) {
    case "mapbox": {
      const token = process.env.MAPBOX_ACCESS_TOKEN;
      if (!token) {
        throw new Error("MAPBOX_ACCESS_TOKEN is required when ROUTING_PROVIDER=mapbox");
      }
      return new MapboxProvider(token);
    }

    case "osrm": {
      const baseUrl = process.env.OSRM_BASE_URL;
      if (!baseUrl) {
        throw new Error("OSRM_BASE_URL is required when ROUTING_PROVIDER=osrm");
      }
      return new OSRMProvider(baseUrl);
    }

    default:
      throw new Error(`Unknown ROUTING_PROVIDER: "${provider}". Supported: mapbox, osrm`);
  }
}
