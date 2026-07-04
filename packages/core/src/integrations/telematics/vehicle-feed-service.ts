/**
 * Vehicle Feed Service
 * Real-time vehicle tracking feed with polling/SSE support
 * Provides position updates, status changes, and alerts via EventEmitter
 */

import { EventEmitter } from "events";
import type {
  WitylogixVehiclePosition,
  WitylogixDriverStatus,
  WitylogixSafetyEvent,
  VehicleFeedConfig,
  VehicleFeedEvent,
  TelematicsProvider,
} from "./telematics-types.js";

/**
 * Vehicle position with metadata
 */
interface StoredPosition extends WitylogixVehiclePosition {
  stale: boolean;
  interpolated: boolean;
}

/**
 * Vehicle Feed Service
 */
export class VehicleFeedService extends EventEmitter {
  private provider: TelematicsProvider;
  private config: Required<VehicleFeedConfig>;
  private vehicles = new Map<string, StoredPosition[]>();
  private driverStatus = new Map<string, WitylogixDriverStatus>();
  private isRunning = false;
  private pollIntervalId?: NodeJS.Timeout;
  private vehicleIds: string[] = [];

  constructor(provider: TelematicsProvider, config?: VehicleFeedConfig) {
    super();
    this.provider = provider;
    this.config = {
      updateInterval: config?.updateInterval || 10000,
      transport: config?.transport || "polling",
      maxPositions: config?.maxPositions || 100,
      staleThreshold: config?.staleThreshold || 300000,
      smoothing: config?.smoothing ?? false,
    };
  }

  /**
   * Start the vehicle feed
   */
  async start(vehicleIds: string[]): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.vehicleIds = vehicleIds;
    this.isRunning = true;

    try {
      // Initial fetch
      await this.poll();

      // Set up polling
      this.pollIntervalId = setInterval(() => {
        this.poll().catch((error) => {
          this.emit("error", {
            type: "error" as const,
            data: error,
            timestamp: new Date(),
            error,
          });
        });
      }, this.config.updateInterval);
    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the vehicle feed
   */
  stop(): void {
    this.isRunning = false;
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = undefined;
    }
  }

  /**
   * Single polling cycle
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Fetch batch positions
      const positions = await this.provider.getBatchVehiclePositions(
        this.vehicleIds,
      );

      for (const position of positions) {
        await this.updateVehiclePosition(position);
      }

      // Check for stale vehicles
      this.checkForStaleVehicles();
    } catch (error) {
      this.emit("error", {
        type: "error" as const,
        data: error,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Update vehicle position with smoothing
   */
  private async updateVehiclePosition(
    position: WitylogixVehiclePosition,
  ): Promise<void> {
    let stored = this.getStoredPositions(position.vehicleId);

    if (!stored) {
      stored = [];
      this.vehicles.set(position.vehicleId, stored);
    }

    // Apply position smoothing if enabled
    let positionToStore: StoredPosition = {
      ...position,
      stale: false,
      interpolated: false,
    };

    if (this.config.smoothing && stored.length > 0) {
      const lastPosition = stored[stored.length - 1];
      positionToStore = this.interpolatePosition(lastPosition, position);
    }

    // Maintain max positions
    stored.push(positionToStore);
    if (stored.length > this.config.maxPositions) {
      stored.shift();
    }

    // Emit update event
    this.emit("position-update", {
      type: "position-update" as const,
      vehicleId: position.vehicleId,
      data: positionToStore,
      timestamp: new Date(),
    } satisfies VehicleFeedEvent);
  }

  /**
   * Interpolate position between GPS fixes
   */
  private interpolatePosition(
    lastPos: StoredPosition,
    newPos: WitylogixVehiclePosition,
  ): StoredPosition {
    const timeIntervalSecs =
      (newPos.timestamp.getTime() - lastPos.timestamp.getTime()) / 1000;

    if (timeIntervalSecs <= 0) {
      return {
        ...newPos,
        stale: false,
        interpolated: false,
      };
    }

    // Linear interpolation for smooth movement
    const latDiff = newPos.lat - lastPos.lat;
    const lngDiff = newPos.lng - lastPos.lng;
    const headingDiff = this.normalizeHeading(newPos.heading - lastPos.heading);

    const interpolated: StoredPosition = {
      ...newPos,
      lat: (lastPos.lat + newPos.lat) / 2,
      lng: (lastPos.lng + newPos.lng) / 2,
      heading: (lastPos.heading + newPos.heading) / 2,
      speed: (lastPos.speed + newPos.speed) / 2,
      stale: false,
      interpolated: true,
    };

    return interpolated;
  }

  /**
   * Normalize heading difference
   */
  private normalizeHeading(diff: number): number {
    if (diff > 180) return diff - 360;
    if (diff < -180) return diff + 360;
    return diff;
  }

  /**
   * Check for stale vehicles
   */
  private checkForStaleVehicles(): void {
    const now = Date.now();

    for (const [vehicleId, positions] of this.vehicles.entries()) {
      if (positions.length === 0) continue;

      const lastPosition = positions[positions.length - 1];
      const ageMs = now - lastPosition.timestamp.getTime();

      const isStale = ageMs > this.config.staleThreshold;

      if (isStale && !lastPosition.stale) {
        // Mark as stale
        lastPosition.stale = true;
        this.emit("status-change", {
          type: "status-change" as const,
          vehicleId,
          data: { stale: true, lastUpdate: lastPosition.timestamp },
          timestamp: new Date(),
        } satisfies VehicleFeedEvent);
      }
    }
  }

  /**
   * Get all current vehicle positions
   */
  getCurrentPositions(): Map<string, WitylogixVehiclePosition> {
    const positions = new Map<string, WitylogixVehiclePosition>();

    for (const [vehicleId, stored] of this.vehicles.entries()) {
      if (stored.length > 0) {
        const lastPos = stored[stored.length - 1];
        const { stale, interpolated, ...pos } = lastPos;
        positions.set(vehicleId, pos);
      }
    }

    return positions;
  }

  /**
   * Get a specific vehicle's current position
   */
  getVehiclePosition(vehicleId: string): WitylogixVehiclePosition | undefined {
    const stored = this.getStoredPositions(vehicleId);
    if (!stored || stored.length === 0) return undefined;

    const lastPos = stored[stored.length - 1];
    const { stale, interpolated, ...pos } = lastPos;
    return pos;
  }

  /**
   * Get position history for a vehicle
   */
  getPositionHistory(
    vehicleId: string,
    limit?: number,
  ): WitylogixVehiclePosition[] {
    const stored = this.getStoredPositions(vehicleId);
    if (!stored) return [];

    const history = stored.map(({ stale, interpolated, ...pos }) => pos);

    if (limit && history.length > limit) {
      return history.slice(-limit);
    }

    return history;
  }

  /**
   * Get stored positions array
   */
  private getStoredPositions(vehicleId: string): StoredPosition[] | undefined {
    return this.vehicles.get(vehicleId);
  }

  /**
   * Filter vehicles by status
   */
  filterByStatus(status: string): string[] {
    const filtered: string[] = [];

    for (const [vehicleId, positions] of this.vehicles.entries()) {
      if (positions.length === 0) continue;

      const lastPos = positions[positions.length - 1];
      if (!lastPos.stale) {
        filtered.push(vehicleId);
      }
    }

    return filtered;
  }

  /**
   * Filter vehicles in a geofence
   */
  filterByGeofence(bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }): string[] {
    const inGeofence: string[] = [];

    for (const [vehicleId, positions] of this.vehicles.entries()) {
      if (positions.length === 0) continue;

      const lastPos = positions[positions.length - 1];
      if (
        lastPos.lat >= bounds.minLat &&
        lastPos.lat <= bounds.maxLat &&
        lastPos.lng >= bounds.minLng &&
        lastPos.lng <= bounds.maxLng
      ) {
        inGeofence.push(vehicleId);
      }
    }

    return inGeofence;
  }

  /**
   * Update driver status
   */
  async updateDriverStatus(driverId: string): Promise<WitylogixDriverStatus> {
    try {
      const status = await this.provider.getDriverStatus(driverId);
      this.driverStatus.set(driverId, status);

      this.emit("status-change", {
        type: "status-change" as const,
        driverId,
        data: status,
        timestamp: new Date(),
      } satisfies VehicleFeedEvent);

      return status;
    } catch (error) {
      this.emit("error", {
        type: "error" as const,
        driverId,
        data: error,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Get cached driver status
   */
  getDriverStatus(driverId: string): WitylogixDriverStatus | undefined {
    return this.driverStatus.get(driverId);
  }

  /**
   * Get all cached driver statuses
   */
  getAllDriverStatuses(): Map<string, WitylogixDriverStatus> {
    return new Map(this.driverStatus);
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.vehicles.clear();
    this.driverStatus.clear();
  }

  /**
   * Get feed statistics
   */
  getStats(): {
    isRunning: boolean;
    vehicleCount: number;
    driverCount: number;
    staleCount: number;
    lastUpdate: Date | null;
  } {
    let staleCount = 0;
    let lastUpdate: Date | null = null;

    for (const positions of this.vehicles.values()) {
      if (positions.length > 0) {
        const lastPos = positions[positions.length - 1];
        if (lastPos.stale) staleCount++;
        if (!lastUpdate || lastPos.timestamp > lastUpdate) {
          lastUpdate = lastPos.timestamp;
        }
      }
    }

    return {
      isRunning: this.isRunning,
      vehicleCount: this.vehicles.size,
      driverCount: this.driverStatus.size,
      staleCount,
      lastUpdate,
    };
  }

  /**
   * Check if feed is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

/**
 * Export named exports
 */
export type { VehicleFeedConfig, VehicleFeedEvent, TelematicsProvider };
