/**
 * Delivery Zone Analyzer
 *
 * Analyzes delivery patterns and clustering:
 * - Cluster delivery addresses into zones using k-means
 * - Identify hot zones: areas with highest delivery density
 * - Peak hour analysis: delivery volume by hour of day
 * - Zone heat map data: { zones: { center, radius, deliveryCount, avgDuration }[] }
 * - Suggest optimal number of drivers per zone based on demand
 * - Weekly pattern detection: Mon-Fri patterns vs weekend
 * - Export as GeoJSON for map overlay
 */

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Delivery {
  id: string;
  coordinate: Coordinate;
  timestamp: Date;
  durationMinutes: number;
  weight?: number;
  volume?: number;
}

export interface Zone {
  id: string;
  center: Coordinate;
  radius: number; // km
  deliveryCount: number;
  avgDuration: number; // minutes
  peakHours: number[]; // 0-23
  weeklyPattern: WeeklyPattern;
  deliveryIds: string[];
}

export interface WeeklyPattern {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

export interface HourlyDistribution {
  hour: number; // 0-23
  deliveryCount: number;
  avgDuration: number;
}

export interface HeatMapData {
  zones: Zone[];
  totalDeliveries: number;
  avgDeliveryDuration: number;
  hourlyDistribution: HourlyDistribution[];
  suggestedDriversPerZone: Map<string, number>;
  hotZones: Zone[]; // top zones by density
}

export interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: "Point" | "Circle";
    coordinates: [number, number]; // [lng, lat]
    radius?: number;
  };
  properties: Record<string, unknown>;
}

export interface GeoJSONCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

// ─── K-MEANS CLUSTERING ────────────────────────────────────────────────────

/**
 * K-means clustering algorithm for zone identification
 */
class KMeansClustering {
  private k: number;
  private maxIterations: number;
  private tolerance: number;

  constructor(
    k: number = 5,
    maxIterations: number = 100,
    tolerance: number = 0.001,
  ) {
    this.k = k;
    this.maxIterations = maxIterations;
    this.tolerance = tolerance;
  }

  /**
   * Calculate distance between two coordinates
   */
  private distance(a: Coordinate, b: Coordinate): number {
    const R = 6371; // Earth radius in km
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;

    const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((a.latitude * Math.PI) / 180) *
        Math.cos((b.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c;
  }

  /**
   * Initialize centroids randomly from data points
   */
  private initializeCentroids(points: Coordinate[]): Coordinate[] {
    const centroids: Coordinate[] = [];
    const indices = new Set<number>();

    while (indices.size < Math.min(this.k, points.length)) {
      const idx = Math.floor(Math.random() * points.length);
      indices.add(idx);
    }

    return Array.from(indices).map((i) => ({
      latitude: points[i].latitude,
      longitude: points[i].longitude,
    }));
  }

  /**
   * Assign points to nearest centroid
   */
  private assignClusters(
    points: Coordinate[],
    centroids: Coordinate[],
  ): number[] {
    return points.map((point) => {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < centroids.length; i++) {
        const dist = this.distance(point, centroids[i]);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      return nearestIdx;
    });
  }

  /**
   * Calculate new centroids from clusters
   */
  private updateCentroids(
    points: Coordinate[],
    assignments: number[],
  ): Coordinate[] {
    const newCentroids: Coordinate[] = [];

    for (let i = 0; i < this.k; i++) {
      const clusterPoints = points.filter((_, idx) => assignments[idx] === i);

      if (clusterPoints.length === 0) {
        // Empty cluster, keep old centroid
        newCentroids.push(points[Math.floor(Math.random() * points.length)]);
      } else {
        const avgLat =
          clusterPoints.reduce((s, p) => s + p.latitude, 0) /
          clusterPoints.length;
        const avgLon =
          clusterPoints.reduce((s, p) => s + p.longitude, 0) /
          clusterPoints.length;

        newCentroids.push({
          latitude: avgLat,
          longitude: avgLon,
        });
      }
    }

    return newCentroids;
  }

  /**
   * Check convergence
   */
  private hasConverged(
    oldCentroids: Coordinate[],
    newCentroids: Coordinate[],
  ): boolean {
    let totalMovement = 0;

    for (let i = 0; i < oldCentroids.length; i++) {
      totalMovement += this.distance(oldCentroids[i], newCentroids[i]);
    }

    return totalMovement / oldCentroids.length < this.tolerance;
  }

  /**
   * Run k-means clustering
   */
  public cluster(points: Coordinate[]): {
    clusters: number[];
    centroids: Coordinate[];
  } {
    if (points.length === 0) {
      return { clusters: [], centroids: [] };
    }

    let centroids = this.initializeCentroids(points);
    let clusters = this.assignClusters(points, centroids);

    for (let iter = 0; iter < this.maxIterations; iter++) {
      const newCentroids = this.updateCentroids(points, clusters);

      if (this.hasConverged(centroids, newCentroids)) {
        break;
      }

      centroids = newCentroids;
      clusters = this.assignClusters(points, centroids);
    }

    return { clusters, centroids };
  }
}

// ─── DELIVERY ZONE ANALYZER ────────────────────────────────────────────────

export class DeliveryZoneAnalyzer {
  private deliveries: Delivery[] = [];
  private zones: Zone[] = [];
  private kmeans: KMeansClustering;

  constructor(numZones: number = 5) {
    this.kmeans = new KMeansClustering(numZones);
  }

  /**
   * Add deliveries for analysis
   */
  public addDeliveries(deliveries: Delivery[]): void {
    this.deliveries.push(...deliveries);
  }

  /**
   * Calculate distance between two coordinates
   */
  private distance(a: Coordinate, b: Coordinate): number {
    const R = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - b.longitude) * Math.PI) / 180;

    const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((a.latitude * Math.PI) / 180) *
        Math.cos((b.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c;
  }

  /**
   * Analyze deliveries and create zones
   */
  public analyzeZones(): HeatMapData {
    if (this.deliveries.length === 0) {
      return {
        zones: [],
        totalDeliveries: 0,
        avgDeliveryDuration: 0,
        hourlyDistribution: [],
        suggestedDriversPerZone: new Map(),
        hotZones: [],
      };
    }

    // Cluster deliveries into zones
    const coordinates = this.deliveries.map((d) => d.coordinate);
    const { clusters, centroids } = this.kmeans.cluster(coordinates);

    // Build zones
    this.zones = [];

    for (let i = 0; i < centroids.length; i++) {
      const zoneDeliveries = this.deliveries.filter(
        (_, idx) => clusters[idx] === i,
      );

      if (zoneDeliveries.length === 0) continue;

      // Find bounding radius
      let maxDistance = 0;
      for (const delivery of zoneDeliveries) {
        const dist = this.distance(centroids[i], delivery.coordinate);
        maxDistance = Math.max(maxDistance, dist);
      }

      const avgDuration =
        zoneDeliveries.reduce((s, d) => s + d.durationMinutes, 0) /
        zoneDeliveries.length;

      // Calculate peak hours
      const hourlyMap = new Map<number, number>();
      for (const delivery of zoneDeliveries) {
        const hour = delivery.timestamp.getHours();
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
      }

      const peakHours = Array.from(hourlyMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour]) => hour);

      // Calculate weekly pattern
      const weeklyCount: Record<string, number> = {
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0,
      };

      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];

      for (const delivery of zoneDeliveries) {
        const dayName = dayNames[delivery.timestamp.getDay()];
        weeklyCount[dayName]++;
      }

      const zone: Zone = {
        id: `zone_${i}`,
        center: centroids[i],
        radius: maxDistance,
        deliveryCount: zoneDeliveries.length,
        avgDuration: Math.round(avgDuration),
        peakHours,
        weeklyPattern: {
          monday: weeklyCount.monday,
          tuesday: weeklyCount.tuesday,
          wednesday: weeklyCount.wednesday,
          thursday: weeklyCount.thursday,
          friday: weeklyCount.friday,
          saturday: weeklyCount.saturday,
          sunday: weeklyCount.sunday,
        },
        deliveryIds: zoneDeliveries.map((d) => d.id),
      };

      this.zones.push(zone);
    }

    // Calculate hourly distribution
    const hourlyMap = new Map<number, { count: number; durations: number[] }>();

    for (const delivery of this.deliveries) {
      const hour = delivery.timestamp.getHours();
      const existing = hourlyMap.get(hour);

      if (!existing) {
        hourlyMap.set(hour, {
          count: 1,
          durations: [delivery.durationMinutes],
        });
      } else {
        existing.count++;
        existing.durations.push(delivery.durationMinutes);
      }
    }

    const hourlyDistribution: HourlyDistribution[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const data = hourlyMap.get(hour);
      hourlyDistribution.push({
        hour,
        deliveryCount: data?.count || 0,
        avgDuration: data
          ? Math.round(
              data.durations.reduce((s, d) => s + d, 0) / data.durations.length,
            )
          : 0,
      });
    }

    // Suggest drivers per zone
    const suggestedDrivers = new Map<string, number>();
    for (const zone of this.zones) {
      // Heuristic: 1 driver per 20 deliveries, minimum 1
      const suggested = Math.max(1, Math.ceil(zone.deliveryCount / 20));
      suggestedDrivers.set(zone.id, suggested);
    }

    // Identify hot zones (top 3 by density)
    const hotZones = [...this.zones]
      .sort((a, b) => b.deliveryCount - a.deliveryCount)
      .slice(0, 3);

    const avgDuration =
      this.deliveries.reduce((s, d) => s + d.durationMinutes, 0) /
      this.deliveries.length;

    return {
      zones: this.zones,
      totalDeliveries: this.deliveries.length,
      avgDeliveryDuration: Math.round(avgDuration),
      hourlyDistribution,
      suggestedDriversPerZone: suggestedDrivers,
      hotZones,
    };
  }

  /**
   * Export zones as GeoJSON
   */
  public exportGeoJSON(): GeoJSONCollection {
    const features: GeoJSONFeature[] = [];

    for (const zone of this.zones) {
      features.push({
        type: "Feature",
        geometry: {
          type: "Circle",
          coordinates: [zone.center.longitude, zone.center.latitude],
          radius: zone.radius,
        },
        properties: {
          zoneId: zone.id,
          deliveryCount: zone.deliveryCount,
          avgDuration: zone.avgDuration,
          peakHours: zone.peakHours,
          radius: zone.radius,
          weeklyPattern: zone.weeklyPattern,
        },
      });
    }

    return {
      type: "FeatureCollection",
      features,
    };
  }

  /**
   * Get peak hours summary
   */
  public getPeakHours(): { hour: number; totalDeliveries: number }[] {
    const hourlyMap = new Map<number, number>();

    for (const delivery of this.deliveries) {
      const hour = delivery.timestamp.getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    }

    return Array.from(hourlyMap.entries())
      .map(([hour, count]) => ({
        hour,
        totalDeliveries: count,
      }))
      .sort((a, b) => b.totalDeliveries - a.totalDeliveries);
  }

  /**
   * Get weekly pattern summary
   */
  public getWeeklyPattern(): Record<string, number> {
    const pattern: Record<string, number> = {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0,
    };

    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    for (const delivery of this.deliveries) {
      const dayName = dayNames[delivery.timestamp.getDay()];
      pattern[dayName]++;
    }

    return pattern;
  }

  /**
   * Get zone statistics
   */
  public getZoneStatistics(zoneId: string): Zone | undefined {
    return this.zones.find((z) => z.id === zoneId);
  }

  /**
   * Get all zones
   */
  public getZones(): Zone[] {
    return [...this.zones];
  }

  /**
   * Clear all data
   */
  public clear(): void {
    this.deliveries = [];
    this.zones = [];
  }
}

/**
 * Create zone analyzer instance
 */
export function createDeliveryZoneAnalyzer(
  numZones?: number,
): DeliveryZoneAnalyzer {
  return new DeliveryZoneAnalyzer(numZones);
}
