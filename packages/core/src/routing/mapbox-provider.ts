/**
 * MapboxProvider — Phase 1 routing implementation
 *
 * Uses Mapbox Directions API, Matrix API, and Geocoding API.
 * Drop-in replacement available via OSRMProvider in Phase 2.
 */

import type {
  RoutingProvider,
  Coordinates,
  RouteResult,
  DistanceMatrixResult,
  GeocodingResult,
  ETAResult,
} from "./provider.js";

const MAPBOX_BASE = "https://api.mapbox.com";

export class MapboxProvider implements RoutingProvider {
  readonly name = "mapbox";
  private readonly accessToken: string;

  constructor(accessToken: string) {
    if (!accessToken) {
      throw new Error("MapboxProvider requires MAPBOX_ACCESS_TOKEN");
    }
    this.accessToken = accessToken;
  }

  async getRoute(origin: Coordinates, destination: Coordinates): Promise<RouteResult> {
    return this.getRouteWithWaypoints([origin, destination]);
  }

  async getRouteWithWaypoints(waypoints: Coordinates[]): Promise<RouteResult> {
    if (waypoints.length < 2) {
      throw new Error("At least 2 waypoints required");
    }

    const coords = waypoints
      .map((w) => `${w.longitude},${w.latitude}`)
      .join(";");

    const url = `${MAPBOX_BASE}/directions/v5/mapbox/driving/${coords}?` +
      `geometries=geojson&overview=full&access_token=${this.accessToken}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Mapbox Directions API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const route = data.routes?.[0];

    if (!route) {
      throw new Error("No route found");
    }

    return {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry.coordinates as [number, number][],
    };
  }

  async getDistanceMatrix(points: Coordinates[]): Promise<DistanceMatrixResult> {
    if (points.length > 25) {
      // Mapbox Matrix API limit is 25 coordinates
      // For larger sets, chunk and merge (or upgrade to Phase 2 OSRM)
      throw new Error(
        `Mapbox Matrix API supports max 25 points (got ${points.length}). ` +
        `Consider upgrading to OSRM provider for larger matrices.`
      );
    }

    const coords = points
      .map((p) => `${p.longitude},${p.latitude}`)
      .join(";");

    const url = `${MAPBOX_BASE}/directions-matrix/v1/mapbox/driving/${coords}?` +
      `annotations=duration,distance&access_token=${this.accessToken}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Mapbox Matrix API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    return {
      durations: data.durations,
      distances: data.distances,
    };
  }

  async geocode(address: string): Promise<GeocodingResult[]> {
    const encoded = encodeURIComponent(address);
    const url = `${MAPBOX_BASE}/search/geocode/v6/forward?` +
      `q=${encoded}&access_token=${this.accessToken}&limit=5`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Mapbox Geocoding API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    return (data.features || []).map((f: any) => ({
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
      formattedAddress: f.properties.full_address || f.properties.name || "",
      confidence: f.properties.match_code?.confidence === "exact" ? 1.0
        : f.properties.match_code?.confidence === "high" ? 0.8
        : f.properties.match_code?.confidence === "medium" ? 0.6
        : 0.4,
    }));
  }

  async reverseGeocode(coords: Coordinates): Promise<GeocodingResult> {
    const url = `${MAPBOX_BASE}/search/geocode/v6/reverse?` +
      `longitude=${coords.longitude}&latitude=${coords.latitude}` +
      `&access_token=${this.accessToken}&limit=1`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Mapbox Reverse Geocoding error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const feature = data.features?.[0];

    if (!feature) {
      throw new Error("No results for reverse geocoding");
    }

    return {
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
      formattedAddress: feature.properties.full_address || feature.properties.name || "",
      confidence: 1.0,
    };
  }

  async getETA(origin: Coordinates, destination: Coordinates): Promise<ETAResult> {
    const route = await this.getRoute(origin, destination);
    return {
      durationSeconds: route.durationSeconds,
      distanceMeters: route.distanceMeters,
      arrivalTime: new Date(Date.now() + route.durationSeconds * 1000),
    };
  }
}
