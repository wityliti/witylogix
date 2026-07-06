/**
 * Traffic Zone Classifier
 *
 * Classifies delivery areas into traffic zones based on:
 * - Historical delivery time variance
 * - Geographic characteristics
 * - PostGIS polygon boundaries
 *
 * Zone types:
 * - urban-core: High traffic variability, congestion
 * - suburban: Moderate variability
 * - rural: Low variability, sparse traffic
 * - highway-corridor: Highway segments, predictable traffic
 * - industrial: Industrial areas, specific traffic patterns
 *
 * Used as feature input for ML models.
 */

import type { Coordinates } from "../ai-eta/types.js";

/**
 * Traffic zone type
 */
export type TrafficZoneType =
  | "urban-core"
  | "suburban"
  | "rural"
  | "highway-corridor"
  | "industrial";

/**
 * Zone definition
 */
export interface TrafficZone {
  id: string;
  name: string;
  type: TrafficZoneType;
  center: Coordinates;
  polygon?: Array<[number, number]>; // GeoJSON-style coordinates
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  metrics: ZoneMetrics;
}

/**
 * Zone metrics based on historical data
 */
export interface ZoneMetrics {
  averageSpeed: number; // km/h
  speedVariance: number; // standard deviation
  peakHours: number[]; // 0-23 hours when traffic is highest
  averageDeliveryTime: number; // minutes
  deliveryTimeVariance: number; // standard deviation
  congestionLevel: "low" | "medium" | "high" | "very_high";
  sampleSize: number; // number of historical deliveries
  lastUpdated: Date;
}

/**
 * Classification result
 */
export interface ClassificationResult {
  zoneId: string;
  zoneType: TrafficZoneType;
  confidence: number; // 0-1
  reasoning: string;
}

/**
 * Historical route for training zones
 */
export interface HistoricalZoneData {
  location: Coordinates;
  deliveryTimeMin: number;
  departureTime: Date;
  distance?: number;
  dayOfWeek: number;
  hourOfDay: number;
}

/**
 * Traffic Zone Classifier
 */
export class TrafficZoneClassifier {
  private zones: Map<string, TrafficZone>;
  private historicalData: HistoricalZoneData[];
  private confidenceThreshold: number;

  constructor(zones?: TrafficZone[], confidenceThreshold: number = 0.7) {
    this.zones = new Map();
    this.historicalData = [];
    this.confidenceThreshold = confidenceThreshold;

    if (zones) {
      for (const zone of zones) {
        this.zones.set(zone.id, zone);
      }
    }

    // Initialize default zones
    this.initializeDefaultZones();
  }

  /**
   * Initialize default zone definitions
   */
  private initializeDefaultZones(): void {
    // If no zones provided, create empty map for user to populate
    if (this.zones.size === 0) {
      // Users can add zones via addZone() method
    }
  }

  /**
   * Add a zone definition
   */
  addZone(zone: TrafficZone): void {
    this.zones.set(zone.id, zone);
  }

  /**
   * Add historical delivery data for training
   */
  addHistoricalData(data: HistoricalZoneData[]): void {
    this.historicalData.push(...data);
  }

  /**
   * Calculate point-in-polygon test using ray casting algorithm
   */
  private isPointInPolygon(
    point: Coordinates,
    polygon: Array<[number, number]>,
  ): boolean {
    let inside = false;
    const x = point.lng;
    const y = point.lat;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][1];
      const yi = polygon[i][0];
      const xj = polygon[j][1];
      const yj = polygon[j][0];

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Check if point is in bounding box
   */
  private isPointInBounds(
    point: Coordinates,
    bounds: TrafficZone["bounds"],
  ): boolean {
    return (
      point.lat >= bounds.minLat &&
      point.lat <= bounds.maxLat &&
      point.lng >= bounds.minLng &&
      point.lng <= bounds.maxLng
    );
  }

  /**
   * Classify a location to a traffic zone
   *
   * Returns the best matching zone based on:
   * 1. Polygon containment (if polygon defined)
   * 2. Bounding box proximity
   * 3. Historical data patterns
   */
  classifyLocation(location: Coordinates): ClassificationResult {
    let bestZone: TrafficZone | null = null;
    let bestConfidence = 0;

    // Check exact polygon matches first
    for (const zone of this.zones.values()) {
      if (zone.polygon && this.isPointInPolygon(location, zone.polygon)) {
        return {
          zoneId: zone.id,
          zoneType: zone.type,
          confidence: 0.95,
          reasoning: "Point is within zone polygon boundary",
        };
      }
    }

    // Check bounding box proximity
    for (const zone of this.zones.values()) {
      if (this.isPointInBounds(location, zone.bounds)) {
        const distance = this.haversineDistance(location, zone.center);
        // Closer to zone center = higher confidence
        const maxDistance = this.boundingBoxDiagonal(zone.bounds);
        const confidence = Math.max(0.5, 1.0 - distance / maxDistance);

        if (confidence > bestConfidence) {
          bestZone = zone;
          bestConfidence = confidence;
        }
      }
    }

    // If no bounding box match, find nearest zone
    if (!bestZone) {
      let minDistance = Infinity;
      for (const zone of this.zones.values()) {
        const distance = this.haversineDistance(location, zone.center);
        if (distance < minDistance) {
          minDistance = distance;
          bestZone = zone;
        }
      }

      // Confidence based on distance (decreases with distance)
      bestConfidence = Math.max(0.3, Math.exp(-minDistance / 10));
    }

    if (!bestZone) {
      throw new Error("No zones configured for classification");
    }

    return {
      zoneId: bestZone.id,
      zoneType: bestZone.type,
      confidence: bestConfidence,
      reasoning: `Closest match to zone: ${bestZone.name} (distance confidence: ${(bestConfidence * 100).toFixed(1)}%)`,
    };
  }

  /**
   * Calculate bounding box diagonal distance in km
   */
  private boundingBoxDiagonal(bounds: TrafficZone["bounds"]): number {
    const ne: Coordinates = { lat: bounds.maxLat, lng: bounds.maxLng };
    const sw: Coordinates = { lat: bounds.minLat, lng: bounds.minLng };
    return this.haversineDistance(ne, sw);
  }

  /**
   * Calculate haversine distance between two points in km
   */
  private haversineDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.lat * Math.PI) / 180) *
        Math.cos((point2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Train zones using historical data
   *
   * Automatically updates zone metrics based on delivery history
   */
  trainZones(): void {
    const zoneGroups = new Map<string, HistoricalZoneData[]>();

    // Group data by zone
    for (const data of this.historicalData) {
      // Find which zone this data belongs to
      const classification = this.classifyLocation(data.location);
      const key = classification.zoneId;

      if (!zoneGroups.has(key)) {
        zoneGroups.set(key, []);
      }
      zoneGroups.get(key)!.push(data);
    }

    // Update zone metrics
    for (const [zoneId, data] of zoneGroups.entries()) {
      const zone = this.zones.get(zoneId);
      if (!zone) continue;

      const metrics = this.calculateMetrics(data);
      zone.metrics = metrics;
    }
  }

  /**
   * Calculate metrics from historical data
   */
  private calculateMetrics(data: HistoricalZoneData[]): ZoneMetrics {
    if (data.length === 0) {
      return {
        averageSpeed: 40,
        speedVariance: 10,
        peakHours: [],
        averageDeliveryTime: 30,
        deliveryTimeVariance: 10,
        congestionLevel: "medium",
        sampleSize: 0,
        lastUpdated: new Date(),
      };
    }

    // Calculate average delivery time
    const deliveryTimes = data.map((d) => d.deliveryTimeMin);
    const avgDeliveryTime =
      deliveryTimes.reduce((a, b) => a + b) / deliveryTimes.length;
    const deliveryTimeVariance = Math.sqrt(
      deliveryTimes.reduce(
        (sum, val) => sum + Math.pow(val - avgDeliveryTime, 2),
        0,
      ) / deliveryTimes.length,
    );

    // Find peak hours
    const hourlyData = new Map<number, number[]>();
    for (const datum of data) {
      const hour = datum.hourOfDay;
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      hourlyData.get(hour)!.push(datum.deliveryTimeMin);
    }

    const hourlyAverages = Array.from(hourlyData.entries()).map(
      ([hour, times]) => ({
        hour,
        avg: times.reduce((a, b) => a + b) / times.length,
      }),
    );

    // Peak hours are those with delivery time > mean + 1 std dev
    const peakThreshold = avgDeliveryTime + deliveryTimeVariance;
    const peakHours = hourlyAverages
      .filter((h) => h.avg > peakThreshold)
      .map((h) => h.hour);

    // Calculate congestion level based on variance
    let congestionLevel: "low" | "medium" | "high" | "very_high";
    const varianceRatio = deliveryTimeVariance / avgDeliveryTime;
    if (varianceRatio < 0.15) {
      congestionLevel = "low";
    } else if (varianceRatio < 0.3) {
      congestionLevel = "medium";
    } else if (varianceRatio < 0.5) {
      congestionLevel = "high";
    } else {
      congestionLevel = "very_high";
    }

    // Calculate average speed (assuming some distance data)
    const avgSpeed =
      data.length > 0
        ? data
            .filter((d) => d.distance)
            .reduce(
              (sum, d) => sum + d.distance! / (d.deliveryTimeMin / 60),
              0,
            ) / Math.max(1, data.filter((d) => d.distance).length)
        : 40;

    return {
      averageSpeed: avgSpeed,
      speedVariance: deliveryTimeVariance * (avgSpeed / avgDeliveryTime),
      peakHours,
      averageDeliveryTime: avgDeliveryTime,
      deliveryTimeVariance,
      congestionLevel,
      sampleSize: data.length,
      lastUpdated: new Date(),
    };
  }

  /**
   * Detect zone type based on characteristics
   */
  detectZoneType(metrics: ZoneMetrics): TrafficZoneType {
    const varianceRatio =
      metrics.deliveryTimeVariance / metrics.averageDeliveryTime;

    // Urban-core: high variance, slow average speed
    if (varianceRatio > 0.35 && metrics.averageSpeed < 30) {
      return "urban-core";
    }

    // Highway: low variance, high speed
    if (varianceRatio < 0.2 && metrics.averageSpeed > 70) {
      return "highway-corridor";
    }

    // Industrial: medium variance, medium speed
    if (metrics.averageSpeed < 50 && metrics.peakHours.length > 0) {
      return "industrial";
    }

    // Suburban: medium variance, medium speed
    if (varianceRatio < 0.35 && metrics.averageSpeed > 40) {
      return "suburban";
    }

    // Rural: low variance, medium-high speed
    return "rural";
  }

  /**
   * Get zone by ID
   */
  getZone(zoneId: string): TrafficZone | undefined {
    return this.zones.get(zoneId);
  }

  /**
   * Get all zones
   */
  getAllZones(): TrafficZone[] {
    return Array.from(this.zones.values());
  }

  /**
   * Get zones of specific type
   */
  getZonesByType(type: TrafficZoneType): TrafficZone[] {
    return Array.from(this.zones.values()).filter((z) => z.type === type);
  }

  /**
   * Update zone metrics
   */
  updateZoneMetrics(zoneId: string, metrics: ZoneMetrics): void {
    const zone = this.zones.get(zoneId);
    if (zone) {
      zone.metrics = metrics;
    }
  }
}
