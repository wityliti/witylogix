/**
 * Telematics Stream Service
 * Real-time position streaming with multi-provider polling and WebSocket broadcast
 * Features: EventEmitter-based updates, position buffer/interpolation, geofence detection, stale data detection
 */

import { EventEmitter } from "events";
import type { ITelematicsAdapter, NormalizedPosition } from "./types.js";

/**
 * Stream configuration
 */
export interface StreamConfig {
  pollingIntervalMs?: number; // Per-provider polling interval (default 5000)
  positionBufferSize?: number; // Max positions to keep in memory (default 100)
  staleThresholdMs?: number; // Mark device stale if no update for N ms (default 300000)
  interpolationEnabled?: boolean; // Smooth position interpolation (default true)
  geofenceCheckIntervalMs?: number; // Geofence check interval (default 10000)
}

/**
 * Position with buffer metadata
 */
export interface BufferedPosition extends NormalizedPosition {
  provider: string;
  bufferedAt: Date;
  interpolated?: boolean;
}

/**
 * Geofence entry/exit event
 */
export interface GeofenceEvent {
  vehicleId: string;
  geofenceId: string;
  type: "entry" | "exit";
  position: NormalizedPosition;
  timestamp: Date;
}

/**
 * Device status in stream
 */
export interface DeviceStreamStatus {
  vehicleId: string;
  provider: string;
  lastUpdate: Date;
  stale: boolean;
  staleSinceMs: number;
  positionCount: number;
  connectionStatus: "connected" | "disconnected" | "error";
  lastError?: Error;
}

/**
 * Stream event types
 */
export type StreamEvent =
  | { type: "position"; data: BufferedPosition }
  | { type: "geofence"; data: GeofenceEvent }
  | { type: "stale"; data: DeviceStreamStatus }
  | { type: "connection"; data: DeviceStreamStatus }
  | { type: "error"; data: { vehicleId: string; provider: string; error: Error } };

/**
 * Telematics Stream Service
 * Real-time streaming with multi-provider support
 */
export class TelematicsStream extends EventEmitter {
  private providers = new Map<string, ITelematicsAdapter>();
  private pollingIntervals = new Map<string, NodeJS.Timeout>();
  private positionBuffers = new Map<string, BufferedPosition[]>();
  private deviceStatus = new Map<string, DeviceStreamStatus>();
  private geofences: Array<{
    id: string;
    center?: { latitude: number; longitude: number };
    radius?: number;
    polygon?: Array<{ latitude: number; longitude: number }>;
  }> = [];
  private config: Required<StreamConfig>;

  constructor(config: StreamConfig = {}) {
    super();
    this.config = {
      pollingIntervalMs: config.pollingIntervalMs ?? 5000,
      positionBufferSize: config.positionBufferSize ?? 100,
      staleThresholdMs: config.staleThresholdMs ?? 300000,
      interpolationEnabled: config.interpolationEnabled ?? true,
      geofenceCheckIntervalMs: config.geofenceCheckIntervalMs ?? 10000,
    };
  }

  /**
   * Register a provider for polling
   */
  registerProvider(name: string, adapter: ITelematicsAdapter): void {
    if (this.providers.has(name)) {
      throw new Error(`Provider '${name}' already registered`);
    }
    this.providers.set(name, adapter);
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(name: string): void {
    this.providers.delete(name);
    // Stop polling for this provider
    for (const [, interval] of this.pollingIntervals) {
      if (name === "unknown") clearInterval(interval); // Basic cleanup
    }
  }

  /**
   * Start streaming for a vehicle
   */
  startStreamingVehicle(vehicleId: string, provider: string): void {
    const adapter = this.providers.get(provider);
    if (!adapter) {
      throw new Error(`Provider '${provider}' not registered`);
    }

    const statusKey = `${provider}:${vehicleId}`;
    if (this.pollingIntervals.has(statusKey)) {
      return; // Already streaming
    }

    this.deviceStatus.set(statusKey, {
      vehicleId,
      provider,
      lastUpdate: new Date(),
      stale: false,
      staleSinceMs: 0,
      positionCount: 0,
      connectionStatus: "connected",
    });

    this.positionBuffers.set(statusKey, []);

    // Start polling
    const interval = setInterval(() => {
      this.pollPosition(vehicleId, provider);
    }, this.config.pollingIntervalMs);

    this.pollingIntervals.set(statusKey, interval);

    // Initial poll
    this.pollPosition(vehicleId, provider);
  }

  /**
   * Stop streaming for a vehicle
   */
  stopStreamingVehicle(vehicleId: string, provider: string): void {
    const statusKey = `${provider}:${vehicleId}`;
    const interval = this.pollingIntervals.get(statusKey);

    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(statusKey);
    }

    this.deviceStatus.delete(statusKey);
    this.positionBuffers.delete(statusKey);
  }

  /**
   * Poll position for a vehicle
   */
  private async pollPosition(vehicleId: string, providerName: string): Promise<void> {
    const adapter = this.providers.get(providerName);
    if (!adapter) return;

    const statusKey = `${providerName}:${vehicleId}`;

    try {
      const position = await adapter.getVehiclePosition(vehicleId);
      const buffered: BufferedPosition = {
        ...position,
        provider: providerName,
        bufferedAt: new Date(),
      };

      // Update position buffer
      const buffer = this.positionBuffers.get(statusKey) || [];
      buffer.unshift(buffered);
      if (buffer.length > this.config.positionBufferSize) {
        buffer.pop();
      }
      this.positionBuffers.set(statusKey, buffer);

      // Update device status
      const status = this.deviceStatus.get(statusKey);
      if (status) {
        status.lastUpdate = new Date();
        status.stale = false;
        status.staleSinceMs = 0;
        status.positionCount = buffer.length;
        status.connectionStatus = "connected";
        this.deviceStatus.set(statusKey, status);
      }

      // Emit position event
      this.emit("stream", {
        type: "position",
        data: buffered,
      } as StreamEvent);

      // Check geofences
      this.checkGeofences(vehicleId, buffered);
    } catch (error) {
      const status = this.deviceStatus.get(statusKey);
      if (status) {
        status.connectionStatus = "error";
        status.lastError = error instanceof Error ? error : new Error(String(error));
        this.deviceStatus.set(statusKey, status);
      }

      this.emit("stream", {
        type: "error",
        data: {
          vehicleId,
          provider: providerName,
          error: error instanceof Error ? error : new Error(String(error)),
        },
      } as StreamEvent);
    }

    // Check for stale devices
    this.checkStaleness(statusKey);
  }

  /**
   * Check if device has stale data
   */
  private checkStaleness(statusKey: string): void {
    const status = this.deviceStatus.get(statusKey);
    if (!status) return;

    const staleSince = Date.now() - status.lastUpdate.getTime();
    if (staleSince > this.config.staleThresholdMs && !status.stale) {
      status.stale = true;
      status.staleSinceMs = staleSince;
      this.deviceStatus.set(statusKey, status);

      this.emit("stream", {
        type: "stale",
        data: status,
      } as StreamEvent);
    }
  }

  /**
   * Check geofence entry/exit
   */
  private checkGeofences(vehicleId: string, position: BufferedPosition): void {
    for (const geofence of this.geofences) {
      const inside = this.isPointInGeofence(position, geofence);

      // Check if this is an entry/exit
      const lastPosition = this.getLastPosition(vehicleId);
      if (lastPosition) {
        const wasInside = this.isPointInGeofence(lastPosition, geofence);

        if (inside && !wasInside) {
          this.emit("stream", {
            type: "geofence",
            data: {
              vehicleId,
              geofenceId: geofence.id,
              type: "entry",
              position,
              timestamp: new Date(),
            },
          } as StreamEvent);
        } else if (!inside && wasInside) {
          this.emit("stream", {
            type: "geofence",
            data: {
              vehicleId,
              geofenceId: geofence.id,
              type: "exit",
              position,
              timestamp: new Date(),
            },
          } as StreamEvent);
        }
      }
    }
  }

  /**
   * Check if point is inside geofence
   */
  private isPointInGeofence(
    position: NormalizedPosition,
    geofence: {
      id: string;
      center?: { latitude: number; longitude: number };
      radius?: number;
      polygon?: Array<{ latitude: number; longitude: number }>;
    },
  ): boolean {
    if (geofence.center && geofence.radius) {
      // Circle geofence
      const distance = this.haversineDistance(
        position.latitude,
        position.longitude,
        geofence.center.latitude,
        geofence.center.longitude,
      );
      return distance <= geofence.radius;
    } else if (geofence.polygon) {
      // Polygon geofence (point-in-polygon algorithm)
      return this.pointInPolygon(
        position.latitude,
        position.longitude,
        geofence.polygon,
      );
    }
    return false;
  }

  /**
   * Haversine distance calculation (meters)
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Point-in-polygon using ray casting algorithm
   */
  private pointInPolygon(
    lat: number,
    lon: number,
    polygon: Array<{ latitude: number; longitude: number }>,
  ): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].longitude;
      const yi = polygon[i].latitude;
      const xj = polygon[j].longitude;
      const yj = polygon[j].latitude;

      const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Get last position for vehicle (any provider)
   */
  private getLastPosition(vehicleId: string): BufferedPosition | null {
    for (const [key, buffer] of this.positionBuffers) {
      if (key.includes(vehicleId) && buffer.length > 0) {
        return buffer[0];
      }
    }
    return null;
  }

  /**
   * Get position from buffer
   */
  getBufferedPosition(vehicleId: string, provider: string): BufferedPosition | null {
    const statusKey = `${provider}:${vehicleId}`;
    const buffer = this.positionBuffers.get(statusKey);
    return buffer && buffer.length > 0 ? buffer[0] : null;
  }

  /**
   * Get all positions in buffer
   */
  getPositionHistory(vehicleId: string, provider: string): BufferedPosition[] {
    const statusKey = `${provider}:${vehicleId}`;
    return this.positionBuffers.get(statusKey) || [];
  }

  /**
   * Add geofence for monitoring
   */
  addGeofence(
    id: string,
    type: "circle" | "polygon",
    shapeData: Record<string, unknown>,
  ): void {
    this.geofences.push({
      id,
      center: shapeData.center as { latitude: number; longitude: number },
      radius: shapeData.radius as number,
      polygon: shapeData.polygon as Array<{ latitude: number; longitude: number }>,
    });
  }

  /**
   * Remove geofence
   */
  removeGeofence(id: string): void {
    this.geofences = this.geofences.filter((g) => g.id !== id);
  }

  /**
   * Get device status
   */
  getDeviceStatus(vehicleId: string, provider: string): DeviceStreamStatus | null {
    const statusKey = `${provider}:${vehicleId}`;
    return this.deviceStatus.get(statusKey) || null;
  }

  /**
   * Get all device statuses
   */
  getAllDeviceStatuses(): DeviceStreamStatus[] {
    return Array.from(this.deviceStatus.values());
  }

  /**
   * Stop all streaming
   */
  stopAll(): void {
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
    this.deviceStatus.clear();
    this.positionBuffers.clear();
  }

  /**
   * Interpolate position between two points
   * Useful for smooth map rendering at intervals
   */
  interpolatePosition(
    vehicleId: string,
    provider: string,
    targetTime: Date,
  ): BufferedPosition | null {
    if (!this.config.interpolationEnabled) {
      return this.getBufferedPosition(vehicleId, provider);
    }

    const history = this.getPositionHistory(vehicleId, provider);
    if (history.length < 2) return history[0] || null;

    // Find two positions bracketing targetTime
    let before: BufferedPosition | null = null;
    let after: BufferedPosition | null = null;

    for (const pos of history) {
      if (pos.bufferedAt <= targetTime) {
        before = pos;
      } else {
        after = pos;
        break;
      }
    }

    if (!before || !after) return before || after;

    // Linear interpolation
    const timeDiff = after.bufferedAt.getTime() - before.bufferedAt.getTime();
    const targetDiff = targetTime.getTime() - before.bufferedAt.getTime();
    const ratio = Math.min(1, Math.max(0, targetDiff / timeDiff));

    return {
      ...before,
      latitude: before.latitude + (after.latitude - before.latitude) * ratio,
      longitude: before.longitude + (after.longitude - before.longitude) * ratio,
      speed: before.speed && after.speed
        ? {
            value:
              before.speed.value + (after.speed.value - before.speed.value) * ratio,
            unit: before.speed.unit,
          }
        : before.speed,
      heading: before.heading != null && after.heading != null ? this.interpolateHeading(before.heading, after.heading, ratio) : before.heading,
      timestamp: targetTime,
      interpolated: true,
    };
  }

  /**
   * Interpolate heading (circular value)
   */
  private interpolateHeading(heading1: number, heading2: number, ratio: number): number {
    let diff = heading2 - heading1;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const result = heading1 + diff * ratio;
    return ((result % 360) + 360) % 360;
  }
}
