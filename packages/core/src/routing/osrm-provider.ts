/**
 * OSRMProvider — Phase 2 routing implementation (stub)
 *
 * Self-hosted OSRM instance for zero marginal cost routing.
 * Implements the same RoutingProvider interface as MapboxProvider.
 *
 * Key advantages over Mapbox:
 * - No per-request charges
 * - No element caps on distance matrices (Mapbox: 25, OSRM: unlimited)
 * - ~3s for 1,000×1,000 matrix vs Mapbox's 25×25 limit
 *
 * TODO: Implement when migrating from Phase 1 → Phase 2
 */

import type {
  RoutingProvider,
  Coordinates,
  RouteResult,
  DistanceMatrixResult,
  GeocodingResult,
  ETAResult,
} from "./provider.js";

export class OSRMProvider implements RoutingProvider {
  readonly name = "osrm";
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getRoute(_origin: Coordinates, _destination: Coordinates): Promise<RouteResult> {
    // TODO: GET /route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson
    throw new Error("OSRMProvider.getRoute not yet implemented (Phase 2)");
  }

  async getRouteWithWaypoints(_waypoints: Coordinates[]): Promise<RouteResult> {
    // TODO: GET /route/v1/driving/{coords}?overview=full&geometries=geojson
    throw new Error("OSRMProvider.getRouteWithWaypoints not yet implemented (Phase 2)");
  }

  async getDistanceMatrix(_points: Coordinates[]): Promise<DistanceMatrixResult> {
    // TODO: GET /table/v1/driving/{coords}?annotations=duration,distance
    // This is OSRM's killer feature: unlimited matrix size, ~3s for 1000 points
    throw new Error("OSRMProvider.getDistanceMatrix not yet implemented (Phase 2)");
  }

  async geocode(_address: string): Promise<GeocodingResult[]> {
    // OSRM does not do geocoding — pair with Nominatim or keep Mapbox geocoding
    throw new Error(
      "OSRM does not support geocoding. Use Nominatim or retain Mapbox geocoding."
    );
  }

  async reverseGeocode(_coords: Coordinates): Promise<GeocodingResult> {
    // OSRM's /nearest/v1/driving/{lng},{lat} returns the nearest road, not an address
    throw new Error(
      "OSRM does not support reverse geocoding. Use Nominatim or retain Mapbox geocoding."
    );
  }

  async getETA(_origin: Coordinates, _destination: Coordinates): Promise<ETAResult> {
    // TODO: Use /route/v1/driving endpoint
    throw new Error("OSRMProvider.getETA not yet implemented (Phase 2)");
  }
}
