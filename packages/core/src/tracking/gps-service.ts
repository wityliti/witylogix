/**
 * GPS Tracking Service for real-time driver location processing.
 *
 * Provides:
 * - Real-time GPS update processing from driver mobile apps
 * - Driver location tracking with in-memory TTL-based storage
 * - Active driver queries per shop
 * - ETA calculation based on speed and distance
 * - Geofence detection (entry/exit events)
 * - Location history retrieval
 * - Haversine distance and bearing calculations
 */

/** Represents a GPS update from a driver's device. */
export interface GPSUpdate {
  /** Unique driver identifier */
  driverId: string;
  /** Shop/organization identifier */
  shopId: string;
  /** Optional shipment/delivery being tracked */
  shipmentId?: string;
  /** Latitude in decimal degrees */
  latitude: number;
  /** Longitude in decimal degrees */
  longitude: number;
  /** Heading/bearing in degrees (0-360, 0=North) */
  heading?: number;
  /** Speed in km/h */
  speed?: number;
  /** Location accuracy in meters */
  accuracy?: number;
  /** Altitude in meters */
  altitude?: number;
  /** Battery level percentage (0-100) */
  batteryLevel?: number;
  /** Timestamp when location was captured */
  timestamp: Date;
}

/** Represents the current location state of a driver. */
export interface DriverLocation {
  /** Unique driver identifier */
  driverId: string;
  /** Shop/organization identifier */
  shopId: string;
  /** Current GPS coordinates */
  currentPosition: { lat: number; lng: number };
  /** Heading in degrees (0-360) */
  heading: number;
  /** Current speed in km/h */
  speed: number;
  /** Timestamp of last update */
  lastUpdate: Date;
  /** Optional active shipment being delivered */
  activeShipmentId?: string;
  /** Distance to next stop in meters */
  distanceToNextStop?: number;
  /** Estimated minutes to next stop */
  etaToNextStop?: number;
}

/** Geofence event triggered when driver enters/exits a zone. */
export interface GeofenceEvent {
  /** Geofence identifier */
  geofenceId: string;
  /** Type of event */
  eventType: "enter" | "exit";
  /** Driver who triggered the event */
  driverId: string;
  /** Shop identifier */
  shopId: string;
  /** When the event occurred */
  timestamp: Date;
  /** GPS position when event triggered */
  position: { lat: number; lng: number };
}

/** Geofence definition. */
export interface Geofence {
  /** Unique geofence identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Circle or polygon geofence */
  type: "circle" | "polygon";
  /** Center point for circle geofence */
  center?: { lat: number; lng: number };
  /** Radius in meters for circle geofence */
  radius?: number;
  /** Polygon vertices for polygon geofence */
  polygon?: { lat: number; lng: number }[];
  /** Trigger on enter, exit, or both */
  triggerOn: "enter" | "exit" | "both";
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Result of ETA calculation. */
export interface ETAResult {
  /** Estimated arrival time */
  estimatedArrival: Date;
  /** Estimated minutes to arrival */
  estimatedMinutes: number;
  /** Confidence level of estimate */
  confidence: "high" | "medium" | "low";
  /** Remaining distance in meters */
  distanceRemaining: number;
  /** Factors that affected the estimate */
  factors: string[];
}

const EARTH_RADIUS_M = 6371000; // Earth's radius in meters
const LOCATION_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL for location data
const SPEED_WINDOW_SIZE = 5; // Number of updates to average speed over
const SPEED_OUTLIER_THRESHOLD = 3; // Standard deviations for outlier detection

/**
 * In-memory storage for driver locations with TTL expiration.
 * @internal
 */
interface StoredLocation {
  location: DriverLocation;
  expiresAt: number;
  speedHistory: number[]; // For averaging and outlier detection
}

/**
 * GPS Tracking Service - manages real-time driver location updates and queries.
 * Uses in-memory storage with TTL for high-performance real-time tracking.
 *
 * @example
 * ```typescript
 * const gpsService = new GPSTrackingService();
 *
 * // Process incoming GPS update from driver app
 * await gpsService.processUpdate({
 *   driverId: "driver-123",
 *   shopId: "shop-456",
 *   latitude: 40.7128,
 *   longitude: -74.0060,
 *   speed: 45,
 *   timestamp: new Date(),
 * });
 *
 * // Get current driver location
 * const location = gpsService.getDriverLocation("driver-123");
 * console.log(location.currentPosition); // { lat: 40.7128, lng: -74.0060 }
 * ```
 */
export class GPSTrackingService {
  private locations: Map<string, StoredLocation> = new Map();
  private history: Map<string, GPSUpdate[]> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup timer to remove expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Process an incoming GPS update from a driver device.
   * Updates location state, maintains history, and applies speed outlier rejection.
   *
   * @param update - GPS update from driver
   * @returns Promise that resolves when update is processed
   */
  async processUpdate(update: GPSUpdate): Promise<void> {
    const key = update.driverId;

    // Get existing location or create new one
    const stored = this.locations.get(key);
    const speedHistory = stored?.speedHistory ?? [];

    // Update speed history with outlier rejection
    if (update.speed !== undefined) {
      const filteredSpeed = this.applySpeedOutlierRejection(
        update.speed,
        speedHistory,
      );
      speedHistory.push(filteredSpeed);
      if (speedHistory.length > SPEED_WINDOW_SIZE) {
        speedHistory.shift();
      }
    }

    const averageSpeed =
      speedHistory.length > 0
        ? speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length
        : (update.speed ?? 0);

    const location: DriverLocation = {
      driverId: update.driverId,
      shopId: update.shopId,
      currentPosition: {
        lat: update.latitude,
        lng: update.longitude,
      },
      heading: update.heading ?? 0,
      speed: averageSpeed,
      lastUpdate: update.timestamp,
      activeShipmentId: update.shipmentId,
    };

    // Store with TTL
    this.locations.set(key, {
      location,
      expiresAt: Date.now() + LOCATION_TTL_MS,
      speedHistory,
    });

    // Maintain history (keep last 1000 updates per driver)
    if (!this.history.has(key)) {
      this.history.set(key, []);
    }
    const driverHistory = this.history.get(key)!;
    driverHistory.push(update);
    if (driverHistory.length > 1000) {
      driverHistory.shift();
    }
  }

  /**
   * Get current location for a driver.
   *
   * @param driverId - Driver identifier
   * @returns Current driver location or null if not found/expired
   */
  getDriverLocation(driverId: string): DriverLocation | null {
    const stored = this.locations.get(driverId);

    // Check if expired
    if (stored && stored.expiresAt <= Date.now()) {
      this.locations.delete(driverId);
      return null;
    }

    return stored?.location ?? null;
  }

  /**
   * Get all active drivers for a shop.
   *
   * @param shopId - Shop identifier
   * @returns Array of active driver locations
   */
  getActiveDrivers(shopId: string): DriverLocation[] {
    const drivers: DriverLocation[] = [];
    const now = Date.now();

    for (const [_, stored] of this.locations) {
      // Remove expired entries
      if (stored.expiresAt <= now) {
        continue;
      }

      if (stored.location.shopId === shopId) {
        drivers.push(stored.location);
      }
    }

    return drivers;
  }

  /**
   * Calculate ETA from current position to destination.
   * Uses Haversine distance and average speed.
   *
   * @param current - Current position
   * @param destination - Target position
   * @param speed - Current average speed in km/h
   * @returns ETA calculation result
   */
  calculateETA(
    current: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    speed: number,
  ): ETAResult {
    const distanceM = this.haversineDistance(current, destination);
    const distanceKm = distanceM / 1000;
    const speedKmh = speed > 0 ? speed : 30; // Default to 30 km/h if stationary

    const estimatedMinutes = (distanceKm / speedKmh) * 60;
    const estimatedArrival = new Date(
      Date.now() + estimatedMinutes * 60 * 1000,
    );

    // Determine confidence based on speed variation and distance
    let confidence: "high" | "medium" | "low" = "medium";
    if (speedKmh > 40 && distanceKm < 20) {
      confidence = "high"; // Highway speed, short distance
    } else if (speedKmh < 15 || distanceKm > 50) {
      confidence = "low"; // Low speed or very long distance
    }

    return {
      estimatedArrival,
      estimatedMinutes: Math.round(estimatedMinutes),
      confidence,
      distanceRemaining: Math.round(distanceM),
      factors: [
        `Speed: ${speedKmh.toFixed(1)} km/h`,
        `Distance: ${distanceKm.toFixed(2)} km`,
      ],
    };
  }

  /**
   * Check if a position intersects with any geofences and return triggered events.
   *
   * @param position - Current position to check
   * @param geofences - Array of geofences to test against
   * @param previousPosition - Previous position (for enter/exit detection)
   * @param driverId - Driver identifier for event
   * @param shopId - Shop identifier for event
   * @returns Array of triggered geofence events
   */
  checkGeofence(
    position: { lat: number; lng: number },
    geofences: Geofence[],
    previousPosition?: { lat: number; lng: number },
    driverId: string = "",
    shopId: string = "",
  ): GeofenceEvent[] {
    const events: GeofenceEvent[] = [];

    for (const geofence of geofences) {
      const currentInside = this.isPointInGeofence(position, geofence);
      const previousInside = previousPosition
        ? this.isPointInGeofence(previousPosition, geofence)
        : currentInside;

      let eventType: "enter" | "exit" | null = null;

      if (currentInside && !previousInside) {
        eventType = "enter";
      } else if (!currentInside && previousInside) {
        eventType = "exit";
      }

      // Check if we should trigger this event
      if (eventType) {
        const shouldTrigger =
          geofence.triggerOn === "both" || geofence.triggerOn === eventType;

        if (shouldTrigger) {
          events.push({
            geofenceId: geofence.id,
            eventType,
            driverId,
            shopId,
            timestamp: new Date(),
            position,
          });
        }
      }
    }

    return events;
  }

  /**
   * Get location history for a driver within a time range.
   *
   * @param driverId - Driver identifier
   * @param from - Start of time range
   * @param to - End of time range
   * @returns Array of GPS updates in time range
   */
  getLocationHistory(driverId: string, from: Date, to: Date): GPSUpdate[] {
    const history = this.history.get(driverId);
    if (!history) return [];

    const fromMs = from.getTime();
    const toMs = to.getTime();

    return history.filter(
      (update) =>
        update.timestamp.getTime() >= fromMs &&
        update.timestamp.getTime() <= toMs,
    );
  }

  /**
   * Shutdown the service and stop cleanup timers.
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Calculate great-circle distance between two points using Haversine formula.
   * @internal
   *
   * @param a - First point
   * @param b - Second point
   * @returns Distance in meters
   */
  private haversineDistance(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const deltaLat = toRad(b.lat - a.lat);
    const deltaLng = toRad(b.lng - a.lng);

    const sinHalfDeltaLat = Math.sin(deltaLat / 2);
    const sinHalfDeltaLng = Math.sin(deltaLng / 2);

    const h =
      sinHalfDeltaLat * sinHalfDeltaLat +
      Math.cos(lat1) * Math.cos(lat2) * sinHalfDeltaLng * sinHalfDeltaLng;

    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

    return EARTH_RADIUS_M * c;
  }

  /**
   * Calculate bearing (heading) between two points.
   * @internal
   *
   * @param from - Starting point
   * @param to - Ending point
   * @returns Bearing in degrees (0-360)
   */
  private calculateBearing(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;

    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const deltaLng = toRad(to.lng - from.lng);

    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

    const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
    return bearing;
  }

  /**
   * Apply outlier rejection to speed values using standard deviation.
   * @internal
   *
   * @param newSpeed - New speed value to validate
   * @param history - Historical speed values
   * @returns Validated speed (original or previous average)
   */
  private applySpeedOutlierRejection(
    newSpeed: number,
    history: number[],
  ): number {
    if (history.length < 1) {
      return newSpeed;
    }

    const mean = history.reduce((a, b) => a + b, 0) / history.length;

    // For small sample sizes, use a stricter threshold
    let threshold = SPEED_OUTLIER_THRESHOLD;
    if (history.length < 3) {
      threshold = 2; // More strict for small sample sizes
    }

    const variance =
      history.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      history.length;
    const stdDev = Math.sqrt(variance);

    // Reject if more than N standard deviations from mean
    if (Math.abs(newSpeed - mean) > threshold * stdDev) {
      return mean;
    }

    return newSpeed;
  }

  /**
   * Check if a point is inside a geofence (circle or polygon).
   * @internal
   *
   * @param point - Point to test
   * @param geofence - Geofence to test against
   * @returns True if point is inside geofence
   */
  private isPointInGeofence(
    point: { lat: number; lng: number },
    geofence: Geofence,
  ): boolean {
    if (geofence.type === "circle") {
      if (!geofence.center || geofence.radius === undefined) {
        return false;
      }

      const distanceM = this.haversineDistance(point, geofence.center);
      return distanceM <= geofence.radius;
    } else if (geofence.type === "polygon") {
      if (!geofence.polygon || geofence.polygon.length < 3) {
        return false;
      }

      return this.isPointInPolygon(point, geofence.polygon);
    }

    return false;
  }

  /**
   * Ray casting algorithm to determine if point is inside polygon.
   * @internal
   *
   * @param point - Point to test
   * @param polygon - Polygon vertices
   * @returns True if point is inside polygon
   */
  private isPointInPolygon(
    point: { lat: number; lng: number },
    polygon: { lat: number; lng: number }[],
  ): boolean {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng;
      const yi = polygon[i].lat;
      const xj = polygon[j].lng;
      const yj = polygon[j].lat;

      const intersect =
        yi > point.lat !== yj > point.lat &&
        point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Clean up expired location entries.
   * @internal
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [key, stored] of this.locations) {
      if (stored.expiresAt <= now) {
        this.locations.delete(key);
      }
    }
  }
}
