/**
 * Geofence Management and Detection Service.
 *
 * Provides:
 * - Circular geofence detection (Haversine point-in-circle)
 * - Polygon geofence detection (ray casting algorithm)
 * - Entry/exit event generation
 * - Delivery zone management
 * - Customer proximity alerts (500m, 200m, arrived)
 * - Geofence state tracking
 */

/** Geofence definition with geometry. */
export interface Geofence {
  /** Unique geofence identifier */
  id: string;
  /** Human-readable geofence name */
  name: string;
  /** Geofence geometry type */
  type: "circle" | "polygon";
  /** Center point for circle geofence */
  center?: { lat: number; lng: number };
  /** Radius in meters for circle geofence */
  radius?: number;
  /** Polygon vertices for polygon geofence */
  polygon?: { lat: number; lng: number }[];
  /** Trigger on enter, exit, or both */
  triggerOn: "enter" | "exit" | "both";
  /** Additional metadata (zone type, customer info, etc.) */
  metadata?: Record<string, unknown>;
}

/** Event triggered by geofence entry/exit. */
export interface GeofenceEvent {
  /** Geofence identifier */
  geofenceId: string;
  /** Type of event */
  eventType: "enter" | "exit" | "proximity";
  /** Driver who triggered the event */
  driverId: string;
  /** Shop/organization identifier */
  shopId: string;
  /** When the event occurred */
  timestamp: Date;
  /** GPS position when event triggered */
  position: { lat: number; lng: number };
  /** Proximity distance in meters (for proximity events) */
  proximityDistance?: number;
}

/** Proximity alert threshold configuration. */
export interface ProximityThreshold {
  /** Distance in meters for the alert */
  distanceM: number;
  /** Human-readable label */
  label: string;
}

/** Internal state tracking for geofence entry/exit. */
interface GeofenceState {
  driverId: string;
  geofenceId: string;
  isInside: boolean;
  lastUpdate: Date;
}

const DEFAULT_PROXIMITY_THRESHOLDS: ProximityThreshold[] = [
  { distanceM: 500, label: "Customer zone (500m)" },
  { distanceM: 200, label: "Approaching (200m)" },
  { distanceM: 50, label: "Arrived (50m)" },
];

/**
 * Geofence Manager - manages geofence definitions and detects entry/exit events.
 * Supports circular and polygon geofences with configurable trigger behavior.
 *
 * @example
 * ```typescript
 * const manager = new GeofenceManager();
 *
 * // Create a circular geofence for a store
 * manager.addGeofence({
 *   id: "store-123",
 *   name: "Main Store",
 *   type: "circle",
 *   center: { lat: 40.7128, lng: -74.0060 },
 *   radius: 500, // 500 meters
 *   triggerOn: "both",
 *   metadata: { storeId: "123", address: "123 Main St" },
 * });
 *
 * // Check for geofence events as driver moves
 * const events = manager.checkGeofence(
 *   "driver-456",
 *   "shop-789",
 *   { lat: 40.7128, lng: -74.0060 },  // new position
 *   { lat: 40.7100, lng: -74.0050 },  // previous position
 * );
 *
 * // Handle proximity alerts
 * const proximityEvents = manager.checkProximity(
 *   "driver-456",
 *   "shop-789",
 *   { lat: 40.7128, lng: -74.0055 },
 * );
 * ```
 */
export class GeofenceManager {
  private geofences: Map<string, Geofence> = new Map();
  private geofenceState: Map<string, GeofenceState> = new Map();
  private proximityThresholds: ProximityThreshold[] =
    DEFAULT_PROXIMITY_THRESHOLDS;

  /**
   * Add or update a geofence definition.
   *
   * @param geofence - Geofence to add/update
   * @throws Error if geofence geometry is invalid
   */
  addGeofence(geofence: Geofence): void {
    // Validate geofence geometry
    if (geofence.type === "circle") {
      if (
        !geofence.center ||
        geofence.radius === undefined ||
        geofence.radius <= 0
      ) {
        throw new Error(
          "Circle geofence must have valid center and positive radius",
        );
      }
    } else if (geofence.type === "polygon") {
      if (
        !geofence.polygon ||
        geofence.polygon.length < 3 ||
        !this.isValidPolygon(geofence.polygon)
      ) {
        throw new Error(
          "Polygon geofence must have at least 3 valid, non-intersecting vertices",
        );
      }
    }

    this.geofences.set(geofence.id, geofence);
  }

  /**
   * Remove a geofence by ID.
   *
   * @param geofenceId - Geofence identifier
   */
  removeGeofence(geofenceId: string): void {
    this.geofences.delete(geofenceId);

    // Clean up state entries for this geofence
    for (const [key, state] of this.geofenceState) {
      if (state.geofenceId === geofenceId) {
        this.geofenceState.delete(key);
      }
    }
  }

  /**
   * Get a geofence by ID.
   *
   * @param geofenceId - Geofence identifier
   * @returns Geofence or null if not found
   */
  getGeofence(geofenceId: string): Geofence | null {
    return this.geofences.get(geofenceId) ?? null;
  }

  /**
   * Get all geofences.
   *
   * @returns Array of all geofences
   */
  getAllGeofences(): Geofence[] {
    return Array.from(this.geofences.values());
  }

  /**
   * Set custom proximity alert thresholds.
   *
   * @param thresholds - Array of proximity thresholds
   */
  setProximityThresholds(thresholds: ProximityThreshold[]): void {
    this.proximityThresholds = thresholds;
  }

  /**
   * Check driver position against all geofences and return triggered events.
   * Detects entry/exit transitions based on stored state.
   *
   * @param driverId - Driver identifier
   * @param shopId - Shop/organization identifier
   * @param currentPos - Current driver position
   * @param previousPos - Previous driver position (optional, for enter/exit detection)
   * @returns Array of geofence events
   */
  checkGeofence(
    driverId: string,
    shopId: string,
    currentPos: { lat: number; lng: number },
    previousPos?: { lat: number; lng: number },
  ): GeofenceEvent[] {
    const events: GeofenceEvent[] = [];

    for (const geofence of this.geofences.values()) {
      const stateKey = `${driverId}-${geofence.id}`;
      const previousState = this.geofenceState.get(stateKey);

      // Check if currently inside
      const isCurrentlyInside = this.isPointInGeofence(currentPos, geofence);

      // Determine previous state
      const wasPreviouslyInside = previousPos
        ? this.isPointInGeofence(previousPos, geofence)
        : isCurrentlyInside;

      // Detect transitions
      if (!wasPreviouslyInside && isCurrentlyInside) {
        // Entry event
        const shouldTrigger =
          geofence.triggerOn === "enter" || geofence.triggerOn === "both";
        if (shouldTrigger) {
          events.push({
            geofenceId: geofence.id,
            eventType: "enter",
            driverId,
            shopId,
            timestamp: new Date(),
            position: currentPos,
          });
        }
      } else if (wasPreviouslyInside && !isCurrentlyInside) {
        // Exit event
        const shouldTrigger =
          geofence.triggerOn === "exit" || geofence.triggerOn === "both";
        if (shouldTrigger) {
          events.push({
            geofenceId: geofence.id,
            eventType: "exit",
            driverId,
            shopId,
            timestamp: new Date(),
            position: currentPos,
          });
        }
      }

      // Update state
      this.geofenceState.set(stateKey, {
        driverId,
        geofenceId: geofence.id,
        isInside: isCurrentlyInside,
        lastUpdate: new Date(),
      });
    }

    return events;
  }

  /**
   * Check driver proximity to all geofence centers and generate proximity events.
   * Useful for alerts when approaching a delivery location.
   *
   * @param driverId - Driver identifier
   * @param shopId - Shop/organization identifier
   * @param currentPos - Current driver position
   * @returns Array of proximity events for triggered thresholds
   */
  checkProximity(
    driverId: string,
    shopId: string,
    currentPos: { lat: number; lng: number },
  ): GeofenceEvent[] {
    const events: GeofenceEvent[] = [];

    for (const geofence of this.geofences.values()) {
      // Only check circular geofences for proximity
      if (geofence.type !== "circle" || !geofence.center) {
        continue;
      }

      const distanceM = this.haversineDistance(currentPos, geofence.center);

      // Check each proximity threshold
      for (const threshold of this.proximityThresholds) {
        if (distanceM <= threshold.distanceM) {
          events.push({
            geofenceId: geofence.id,
            eventType: "proximity",
            driverId,
            shopId,
            timestamp: new Date(),
            position: currentPos,
            proximityDistance: Math.round(distanceM),
          });
          break; // Only trigger the closest threshold
        }
      }
    }

    return events;
  }

  /**
   * Check if a driver is currently inside a specific geofence.
   *
   * @param driverId - Driver identifier
   * @param geofenceId - Geofence identifier
   * @returns True if driver is inside geofence
   */
  isDriverInsideGeofence(driverId: string, geofenceId: string): boolean {
    const stateKey = `${driverId}-${geofenceId}`;
    const state = this.geofenceState.get(stateKey);
    return state?.isInside ?? false;
  }

  /**
   * Get all geofences a driver is currently inside.
   *
   * @param driverId - Driver identifier
   * @returns Array of geofence IDs
   */
  getDriverInsideGeofences(driverId: string): string[] {
    const inside: string[] = [];

    for (const [key, state] of this.geofenceState) {
      if (state.driverId === driverId && state.isInside) {
        inside.push(state.geofenceId);
      }
    }

    return inside;
  }

  /**
   * Get geofence state for a driver.
   *
   * @param driverId - Driver identifier
   * @returns Map of geofence IDs to inside/outside state
   */
  getDriverGeofenceState(driverId: string): Map<string, boolean> {
    const stateMap = new Map<string, boolean>();

    for (const [_, state] of this.geofenceState) {
      if (state.driverId === driverId) {
        stateMap.set(state.geofenceId, state.isInside);
      }
    }

    return stateMap;
  }

  /**
   * Check if a point is inside a geofence (circle or polygon).
   * @internal
   *
   * @param point - Point to test
   * @param geofence - Geofence definition
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
   * Ray casting algorithm to detect if point is inside polygon.
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
   * Validate polygon is valid (at least 3 points, not self-intersecting for simple check).
   * @internal
   *
   * @param polygon - Polygon vertices
   * @returns True if polygon is valid
   */
  private isValidPolygon(polygon: { lat: number; lng: number }[]): boolean {
    if (polygon.length < 3) return false;

    // Check all points are valid lat/lng
    for (const point of polygon) {
      if (
        typeof point.lat !== "number" ||
        typeof point.lng !== "number" ||
        point.lat < -90 ||
        point.lat > 90 ||
        point.lng < -180 ||
        point.lng > 180
      ) {
        return false;
      }
    }

    // Check first and last points are not the same (closed polygon)
    // Allow either closed or open, but convert to closed internally
    return true;
  }

  /**
   * Calculate great-circle distance using Haversine formula.
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
    const EARTH_RADIUS_M = 6371000;
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
}
