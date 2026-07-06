/**
 * Zone Visualizer Service
 * Handles zone polygon generation, GeoJSON conversion, and visualization utilities
 */

import type {
  Zone,
  GeoJSONFeature,
  GeoJSONFeatureCollection,
  CoverageStats,
} from "./types.js";

/**
 * Zone Visualizer Service
 */
export class ZoneVisualizerService {
  /**
   * Convert zones to GeoJSON FeatureCollection
   */
  getZonePolygons(zones: Zone[]): GeoJSONFeatureCollection {
    const features: GeoJSONFeature[] = zones.map((zone) => {
      // Convert boundaries to polygon coordinates [lng, lat]
      const coordinates = zone.boundaries.map((b) => [b.longitude, b.latitude]);

      // Close the polygon by adding the first point at the end
      if (
        coordinates.length > 0 &&
        (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
          coordinates[0][1] !== coordinates[coordinates.length - 1][1])
      ) {
        coordinates.push(coordinates[0]);
      }

      return {
        type: "Feature",
        properties: {
          id: zone.id,
          name: zone.name,
          baseFee: zone.baseDeliveryFee || 0,
          perMileFee: zone.perMileFee || 0,
          maxDistance: zone.maxDistance || 0,
          estimatedTime: zone.estimatedDeliveryTime || 0,
        },
        geometry: {
          type: "Polygon",
          coordinates: [coordinates],
        },
      };
    });

    return {
      type: "FeatureCollection",
      features,
    };
  }

  /**
   * Check if a point is inside any zone
   */
  isPointInZone(lat: number, lng: number, zone: Zone): boolean {
    const boundaries = zone.boundaries;

    if (boundaries.length < 3) {
      return false;
    }

    // Ray casting algorithm
    let inside = false;
    let p1x = boundaries[0].longitude;
    let p1y = boundaries[0].latitude;

    for (let i = 1; i <= boundaries.length; i++) {
      const p2x = boundaries[i % boundaries.length].longitude;
      const p2y = boundaries[i % boundaries.length].latitude;

      if (lat > Math.min(p1y, p2y)) {
        if (lat <= Math.max(p1y, p2y)) {
          if (lng <= Math.max(p1x, p2x)) {
            if (p1y !== p2y) {
              const xinters = ((lat - p1y) * (p2x - p1x)) / (p2y - p1y) + p1x;
              if (p1x === p2x || lng <= xinters) {
                inside = !inside;
              }
            }
          }
        }
      }

      p1x = p2x;
      p1y = p2y;
    }

    return inside;
  }

  /**
   * Calculate zone coverage statistics
   */
  calculateZoneCoverage(zones: Zone[]): CoverageStats {
    const zoneDetails = zones.map((zone) => {
      const area = this.calculatePolygonArea(zone.boundaries);
      const center =
        zone.center || this.calculatePolygonCenter(zone.boundaries);

      return {
        zoneId: zone.id,
        zoneName: zone.name,
        area,
        center: {
          latitude: center.latitude,
          longitude: center.longitude,
        },
      };
    });

    const totalArea = zoneDetails.reduce((sum, z) => sum + z.area, 0);

    return {
      totalZones: zones.length,
      totalArea,
      populationCovered: 0, // This would require external data
      averageDensity:
        zoneDetails.length > 0 ? totalArea / zoneDetails.length : 0,
      zoneDetails,
    };
  }

  /**
   * Calculate polygon area using Shoelace formula (in km²)
   */
  private calculatePolygonArea(
    boundaries: Array<{ latitude: number; longitude: number }>,
  ): number {
    if (boundaries.length < 3) {
      return 0;
    }

    // Convert to radians for accurate area calculation
    const points = boundaries.map((b) => ({
      lat: (b.latitude * Math.PI) / 180,
      lng: (b.longitude * Math.PI) / 180,
    }));

    let area = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      area += (p2.lng - p1.lng) * (2 + Math.sin(p1.lat) + Math.sin(p2.lat));
    }

    area = (area * 6371009) / 2; // Earth radius in meters
    return Math.abs(area) / 1e6; // Convert to km²
  }

  /**
   * Calculate polygon center (centroid)
   */
  private calculatePolygonCenter(
    boundaries: Array<{ latitude: number; longitude: number }>,
  ): {
    latitude: number;
    longitude: number;
  } {
    let lat = 0;
    let lng = 0;

    for (const boundary of boundaries) {
      lat += boundary.latitude;
      lng += boundary.longitude;
    }

    return {
      latitude: lat / boundaries.length,
      longitude: lng / boundaries.length,
    };
  }

  /**
   * Generate a static Google Maps URL for zone visualization
   */
  generateZoneMapUrl(
    zones: Zone[],
    center?: { latitude: number; longitude: number },
    apiKey?: string,
    options?: {
      width?: number;
      height?: number;
      zoom?: number;
      maptype?: "roadmap" | "satellite" | "terrain" | "hybrid";
    },
  ): string {
    const width = options?.width || 600;
    const height = options?.height || 400;
    const zoom = options?.zoom || 12;
    const maptype = options?.maptype || "roadmap";

    // Calculate center if not provided
    let centerPoint = center;
    if (!centerPoint && zones.length > 0) {
      const stats = this.calculateZoneCoverage(zones);
      if (stats.zoneDetails.length > 0) {
        centerPoint = stats.zoneDetails[0].center;
      }
    }

    if (!centerPoint) {
      throw new Error("No center point provided or calculable");
    }

    const baseUrl = "https://maps.googleapis.com/maps/api/staticmap";
    const params = new URLSearchParams();

    params.append("center", `${centerPoint.latitude},${centerPoint.longitude}`);
    params.append("zoom", zoom.toString());
    params.append("size", `${width}x${height}`);
    params.append("maptype", maptype);
    params.append("scale", "2");

    // Add zone boundaries as polylines
    for (const zone of zones) {
      if (zone.boundaries.length > 0) {
        const polyline = zone.boundaries
          .map((b) => `${b.latitude},${b.longitude}`)
          .join("|");
        params.append("path", `color:0x0000ff|weight:2|${polyline}`);

        // Add zone center marker
        if (zone.center) {
          params.append(
            "markers",
            `color:0xff0000|label:${zone.id[0]}|${zone.center.latitude},${zone.center.longitude}`,
          );
        }
      }
    }

    if (apiKey) {
      params.append("key", apiKey);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Get zone boundary as a KML string
   */
  getZoneKML(zone: Zone): string {
    const coordinates = zone.boundaries
      .map((b) => `${b.longitude},${b.latitude},0`)
      .join(" ");

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>${zone.name}</name>
      <description>Delivery Zone: ${zone.id}</description>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordinates} ${zone.boundaries[0].longitude},${zone.boundaries[0].latitude},0</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number },
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(point2.latitude - point1.latitude);
    const dLng = this.toRad(point2.longitude - point1.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(point1.latitude)) *
        Math.cos(this.toRad(point2.latitude)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  /**
   * Create heat map data from zones
   */
  createHeatmapData(zones: Zone[]): Array<{
    latitude: number;
    longitude: number;
    weight: number;
  }> {
    return zones.map((zone) => {
      const center =
        zone.center || this.calculatePolygonCenter(zone.boundaries);
      const weight = zone.boundaries.length; // Weight by number of points

      return {
        latitude: center.latitude,
        longitude: center.longitude,
        weight,
      };
    });
  }

  /**
   * Simplify zone boundaries using Douglas-Peucker algorithm
   */
  simplifyBoundaries(
    boundaries: Array<{ latitude: number; longitude: number }>,
    tolerance: number = 0.0001,
  ): Array<{ latitude: number; longitude: number }> {
    if (boundaries.length <= 2) {
      return boundaries;
    }

    const dmax = { index: 0, distance: 0 };

    // Find the point with the maximum distance from line segment
    for (let i = 1; i < boundaries.length - 1; i++) {
      const d = this.perpendicularDistance(
        boundaries[i],
        boundaries[0],
        boundaries[boundaries.length - 1],
      );
      if (d > dmax.distance) {
        dmax.index = i;
        dmax.distance = d;
      }
    }

    if (dmax.distance > tolerance) {
      const left = this.simplifyBoundaries(
        boundaries.slice(0, dmax.index + 1),
        tolerance,
      );
      const right = this.simplifyBoundaries(
        boundaries.slice(dmax.index),
        tolerance,
      );
      return [...left.slice(0, -1), ...right];
    } else {
      return [boundaries[0], boundaries[boundaries.length - 1]];
    }
  }

  private perpendicularDistance(
    point: { latitude: number; longitude: number },
    lineStart: { latitude: number; longitude: number },
    lineEnd: { latitude: number; longitude: number },
  ): number {
    const { latitude: x, longitude: y } = point;
    const { latitude: x1, longitude: y1 } = lineStart;
    const { latitude: x2, longitude: y2 } = lineEnd;

    const numerator = Math.abs(
      (y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1,
    );
    const denominator = Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));

    return denominator === 0 ? 0 : numerator / denominator;
  }
}

/**
 * Create zone visualizer service instance
 */
export function createZoneVisualizerService(): ZoneVisualizerService {
  return new ZoneVisualizerService();
}
