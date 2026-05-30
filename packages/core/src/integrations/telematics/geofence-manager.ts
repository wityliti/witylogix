/**
 * Geofence Manager
 * CRUD operations, geometric calculations, event detection
 * Supports circles, polygons, GeoJSON import/export
 */

import type { WitylogixVehiclePosition } from "./telematics-types.js";

/**
 * Circle geofence
 */
export interface CircleGeofence {
  id: string;
  name: string;
  type: "circle";
  center: { lat: number; lng: number };
  radius: number; // meters
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

/**
 * Polygon geofence
 */
export interface PolygonGeofence {
  id: string;
  name: string;
  type: "polygon";
  points: Array<{ lat: number; lng: number }>;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

/**
 * Geofence union type
 */
export type Geofence = CircleGeofence | PolygonGeofence;

/**
 * Geofence event
 */
export type GeofenceEventType = "enter" | "exit" | "dwell";

export interface GeofenceEvent {
  vehicleId: string;
  geofenceId: string;
  geofenceName: string;
  eventType: GeofenceEventType;
  timestamp: Date;
  location: { lat: number; lng: number };
  dwellDurationMinutes?: number; // for dwell events
}

/**
 * Geofence violation
 */
export interface GeofenceViolation {
  vehicleId: string;
  geofenceId: string;
  geofenceName: string;
  violationType: "unauthorized_entry" | "unauthorized_exit";
  timestamp: Date;
  location: { lat: number; lng: number };
}

/**
 * GeoJSON types
 */
export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: Array<Array<[number, number]>>;
}

export interface GeoJSONCircle {
  type: "Circle";
  center: [number, number]; // [lng, lat]
  radius: number;
}

export interface GeoJSONFeature {
  type: "Feature";
  id: string;
  geometry: GeoJSONPoint | GeoJSONPolygon | GeoJSONCircle;
  properties: Record<string, unknown>;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

/**
 * Vehicle position state for dwell detection
 */
interface VehicleGeofenceState {
  [vehicleId: string]: {
    geofenceId: string;
    enteredAt: Date;
    lastPosition: { lat: number; lng: number };
  };
}

/**
 * Geofence Manager
 */
export class GeofenceManager {
  private geofences = new Map<string, Geofence>();
  private vehicleStates: VehicleGeofenceState = {};

  /**
   * Add a circle geofence
   */
  addCircleGeofence(
    id: string,
    name: string,
    center: { lat: number; lng: number },
    radius: number,
    tags?: string[],
  ): CircleGeofence {
    const geofence: CircleGeofence = {
      id,
      name,
      type: "circle",
      center,
      radius,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags,
    };

    this.geofences.set(id, geofence);
    return geofence;
  }

  /**
   * Add a polygon geofence
   */
  addPolygonGeofence(
    id: string,
    name: string,
    points: Array<{ lat: number; lng: number }>,
    tags?: string[],
  ): PolygonGeofence {
    if (points.length < 3) {
      throw new Error("Polygon must have at least 3 points");
    }

    const geofence: PolygonGeofence = {
      id,
      name,
      type: "polygon",
      points,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags,
    };

    this.geofences.set(id, geofence);
    return geofence;
  }

  /**
   * Get a geofence by ID
   */
  getGeofence(id: string): Geofence | undefined {
    return this.geofences.get(id);
  }

  /**
   * Get all geofences
   */
  getAllGeofences(): Geofence[] {
    return Array.from(this.geofences.values());
  }

  /**
   * Get geofences by tag
   */
  getGeofencesByTag(tag: string): Geofence[] {
    return Array.from(this.geofences.values()).filter((gf) => gf.tags?.includes(tag));
  }

  /**
   * Update a geofence
   */
  updateGeofence(id: string, updates: Partial<Geofence>): Geofence {
    const geofence = this.geofences.get(id);
    if (!geofence) {
      throw new Error(`Geofence ${id} not found`);
    }

    const updated = { ...geofence, ...updates, id: geofence.id, updatedAt: new Date() } as Geofence;
    this.geofences.set(id, updated);
    return updated;
  }

  /**
   * Remove a geofence
   */
  removeGeofence(id: string): boolean {
    return this.geofences.delete(id);
  }

  /**
   * Check if a point is inside a circle geofence
   */
  private isPointInCircle(
    lat: number,
    lng: number,
    circle: CircleGeofence,
  ): boolean {
    const distance = this.haversineDistance(lat, lng, circle.center.lat, circle.center.lng);
    return distance <= circle.radius;
  }

  /**
   * Check if a point is inside a polygon geofence
   */
  private isPointInPolygon(lat: number, lng: number, polygon: PolygonGeofence): boolean {
    let inside = false;

    for (let i = 0, j = polygon.points.length - 1; i < polygon.points.length; j = i++) {
      const xi = polygon.points[i].lng;
      const yi = polygon.points[i].lat;
      const xj = polygon.points[j].lng;
      const yj = polygon.points[j].lat;

      const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Check if a point is inside any geofence
   */
  isPointInGeofence(lat: number, lng: number, geofenceId?: string): Geofence | null {
    if (geofenceId) {
      const gf = this.geofences.get(geofenceId);
      if (!gf) return null;

      if (gf.type === "circle") {
        return this.isPointInCircle(lat, lng, gf) ? gf : null;
      } else {
        return this.isPointInPolygon(lat, lng, gf) ? gf : null;
      }
    }

    for (const gf of this.geofences.values()) {
      if (gf.type === "circle") {
        if (this.isPointInCircle(lat, lng, gf)) return gf;
      } else {
        if (this.isPointInPolygon(lat, lng, gf)) return gf;
      }
    }

    return null;
  }

  /**
   * Get all geofences containing a point
   */
  getGeofencesContainingPoint(lat: number, lng: number): Geofence[] {
    const result: Geofence[] = [];

    for (const gf of this.geofences.values()) {
      if (gf.type === "circle") {
        if (this.isPointInCircle(lat, lng, gf)) result.push(gf);
      } else {
        if (this.isPointInPolygon(lat, lng, gf)) result.push(gf);
      }
    }

    return result;
  }

  /**
   * Detect geofence events for a vehicle position
   */
  detectGeofenceEvents(position: WitylogixVehiclePosition): GeofenceEvent[] {
    const events: GeofenceEvent[] = [];
    const currentGeofences = this.getGeofencesContainingPoint(position.lat, position.lng);
    const state = this.vehicleStates[position.vehicleId];

    if (state) {
      // Check for exit
      const stillInside = currentGeofences.some((gf) => gf.id === state.geofenceId);
      if (!stillInside) {
        const exitedGeofence = this.geofences.get(state.geofenceId);
        if (exitedGeofence) {
          events.push({
            vehicleId: position.vehicleId,
            geofenceId: exitedGeofence.id,
            geofenceName: exitedGeofence.name,
            eventType: "exit",
            timestamp: position.timestamp,
            location: { lat: position.lat, lng: position.lng },
          });
        }

        delete this.vehicleStates[position.vehicleId];
      } else {
        // Check for dwell
        const dwellMinutes = (position.timestamp.getTime() - state.enteredAt.getTime()) / (1000 * 60);
        if (dwellMinutes > 5) {
          // Report dwell every 5 minutes
          events.push({
            vehicleId: position.vehicleId,
            geofenceId: state.geofenceId,
            geofenceName: this.geofences.get(state.geofenceId)?.name || "",
            eventType: "dwell",
            timestamp: position.timestamp,
            location: { lat: position.lat, lng: position.lng },
            dwellDurationMinutes: dwellMinutes,
          });
        }
      }
    }

    // Check for entry
    for (const gf of currentGeofences) {
      if (!state || state.geofenceId !== gf.id) {
        events.push({
          vehicleId: position.vehicleId,
          geofenceId: gf.id,
          geofenceName: gf.name,
          eventType: "enter",
          timestamp: position.timestamp,
          location: { lat: position.lat, lng: position.lng },
        });

        this.vehicleStates[position.vehicleId] = {
          geofenceId: gf.id,
          enteredAt: position.timestamp,
          lastPosition: { lat: position.lat, lng: position.lng },
        };
      }
    }

    return events;
  }

  /**
   * Batch check positions against geofences
   */
  batchCheckPositions(positions: WitylogixVehiclePosition[]): Map<string, GeofenceEvent[]> {
    const results = new Map<string, GeofenceEvent[]>();

    for (const position of positions) {
      const events = this.detectGeofenceEvents(position);
      if (events.length > 0) {
        results.set(position.vehicleId, events);
      }
    }

    return results;
  }

  /**
   * Haversine distance in meters
   */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Export geofences as GeoJSON
   */
  exportAsGeoJSON(): GeoJSONFeatureCollection {
    const features: GeoJSONFeature[] = Array.from(this.geofences.values()).map((gf) => {
      if (gf.type === "circle") {
        return {
          type: "Feature",
          id: gf.id,
          geometry: {
            type: "Circle",
            center: [gf.center.lng, gf.center.lat],
            radius: gf.radius,
          },
          properties: {
            name: gf.name,
            radius: gf.radius,
            tags: gf.tags,
          },
        };
      } else {
        return {
          type: "Feature",
          id: gf.id,
          geometry: {
            type: "Polygon",
            coordinates: [gf.points.map((p) => [p.lng, p.lat])],
          },
          properties: {
            name: gf.name,
            tags: gf.tags,
          },
        };
      }
    });

    return {
      type: "FeatureCollection",
      features,
    };
  }

  /**
   * Import geofences from GeoJSON
   */
  importFromGeoJSON(collection: GeoJSONFeatureCollection): void {
    for (const feature of collection.features) {
      const id = String(feature.id);
      const name = String(feature.properties?.name || "");
      const tags = (feature.properties?.tags as string[]) || [];

      if (feature.geometry.type === "Circle") {
        const circle = feature.geometry as GeoJSONCircle;
        this.addCircleGeofence(id, name, { lat: circle.center[1], lng: circle.center[0] }, circle.radius, tags);
      } else if (feature.geometry.type === "Polygon") {
        const polygon = feature.geometry as GeoJSONPolygon;
        const points = polygon.coordinates[0].map((coord) => ({ lat: coord[1], lng: coord[0] }));
        this.addPolygonGeofence(id, name, points, tags);
      }
    }
  }

  /**
   * Clear all geofences
   */
  clearAllGeofences(): void {
    this.geofences.clear();
    this.vehicleStates = {};
  }

  /**
   * Reset vehicle state (for testing or when vehicle disconnects)
   */
  resetVehicleState(vehicleId: string): void {
    delete this.vehicleStates[vehicleId];
  }

  /**
   * Get count of geofences
   */
  getGeofenceCount(): number {
    return this.geofences.size;
  }
}
