/**
 * Telematics Polling Service
 * Manages periodic polling of telematics data with configurable intervals
 * Handles stale data detection, error handling, and event emission
 */

import { EventEmitter } from "node:events";
import type {
  TelematicsAdapter,
  PollingConfig,
  PollingState,
  TelematicsEvent,
  NormalizedPosition,
  NormalizedDiagnostic,
  NormalizedFuelReading,
} from "./types.js";

/**
 * Telematics Polling Service
 */
export class TelematicsPoller extends EventEmitter {
  private adapter: TelematicsAdapter;
  private config: Required<PollingConfig>;
  private states = new Map<string, PollingState>();
  private timers = new Map<string, NodeJS.Timeout>();
  private isRunning = false;
  private lastDataCache = new Map<string, Record<string, unknown>>();

  constructor(adapter: TelematicsAdapter, config: PollingConfig = {}) {
    super();
    this.adapter = adapter;
    this.config = {
      positionIntervalMs: config.positionIntervalMs || 30000, // 30s
      diagnosticIntervalMs: config.diagnosticIntervalMs || 300000, // 5min
      fuelIntervalMs: config.fuelIntervalMs || 120000, // 2min
      behaviorIntervalMs: config.behaviorIntervalMs || 600000, // 10min
    };
  }

  /**
   * Start polling for a vehicle
   */
  startPolling(vehicleId: string): void {
    if (this.states.has(vehicleId)) {
      return; // Already polling
    }

    const state: PollingState = {
      vehicleId,
      errorCount: 0,
    };

    this.states.set(vehicleId, state);

    // Start all polling intervals
    this.pollPosition(vehicleId);
    this.pollDiagnostics(vehicleId);
    this.pollFuel(vehicleId);
  }

  /**
   * Stop polling for a vehicle
   */
  stopPolling(vehicleId: string): void {
    this.clearTimers(vehicleId);
    this.states.delete(vehicleId);
  }

  /**
   * Start polling for multiple vehicles
   */
  startPollingMultiple(vehicleIds: string[]): void {
    vehicleIds.forEach((id) => this.startPolling(id));
  }

  /**
   * Stop all polling
   */
  stopAllPolling(): void {
    for (const vehicleId of this.states.keys()) {
      this.stopPolling(vehicleId);
    }
    this.states.clear();
  }

  /**
   * Get polling state for a vehicle
   */
  getState(vehicleId: string): PollingState | undefined {
    return this.states.get(vehicleId);
  }

  /**
   * Get all polling states
   */
  getAllStates(): PollingState[] {
    return Array.from(this.states.values());
  }

  /**
   * Check if currently polling a vehicle
   */
  isPolling(vehicleId: string): boolean {
    return this.states.has(vehicleId);
  }

  /**
   * Poll position data
   */
  private pollPosition(vehicleId: string): void {
    const timer = setInterval(async () => {
      try {
        const state = this.states.get(vehicleId);
        if (!state) return;

        const position = await this.adapter.getVehiclePosition(vehicleId);

        // Check if data has changed
        const cacheKey = `position:${vehicleId}`;
        const lastData = this.lastDataCache.get(cacheKey);

        if (
          !lastData ||
          !this.dataEquals(lastData, position, ["timestamp"])
        ) {
          this.emitEvent({
            id: `${vehicleId}-pos-${Date.now()}`,
            provider: "samsara", // This will be set by adapter
            type: "position",
            vehicleId,
            data: position,
            timestamp: new Date(),
          });

          this.lastDataCache.set(cacheKey, position);
        }

        state.lastPositionPoll = new Date();
        state.errorCount = 0;
      } catch (error) {
        this.handlePollingError(vehicleId, error, "position");
      }
    }, this.config.positionIntervalMs);

    this.timers.set(`${vehicleId}:position`, timer);
  }

  /**
   * Poll diagnostics data
   */
  private pollDiagnostics(vehicleId: string): void {
    const timer = setInterval(async () => {
      try {
        const state = this.states.get(vehicleId);
        if (!state) return;

        const diagnostics = await this.adapter.getVehicleDiagnostics(vehicleId);

        // Check if data has changed
        const cacheKey = `diagnostics:${vehicleId}`;
        const lastData = this.lastDataCache.get(cacheKey);

        if (
          !lastData ||
          !this.dataEquals(lastData, diagnostics, [
            "timestamp",
            "faultCodes",
          ])
        ) {
          this.emitEvent({
            id: `${vehicleId}-diag-${Date.now()}`,
            provider: "samsara",
            type: "diagnostic",
            vehicleId,
            data: diagnostics,
            timestamp: new Date(),
          });

          this.lastDataCache.set(cacheKey, diagnostics);
        }

        state.lastDiagnosticPoll = new Date();
        state.errorCount = 0;
      } catch (error) {
        this.handlePollingError(vehicleId, error, "diagnostics");
      }
    }, this.config.diagnosticIntervalMs);

    this.timers.set(`${vehicleId}:diagnostics`, timer);
  }

  /**
   * Poll fuel data
   */
  private pollFuel(vehicleId: string): void {
    const timer = setInterval(async () => {
      try {
        const state = this.states.get(vehicleId);
        if (!state) return;

        const fuel = await this.adapter.getFuelLevel(vehicleId);

        // Check if data has changed
        const cacheKey = `fuel:${vehicleId}`;
        const lastData = this.lastDataCache.get(cacheKey);

        if (!lastData || !this.dataEquals(lastData, fuel, ["timestamp"])) {
          this.emitEvent({
            id: `${vehicleId}-fuel-${Date.now()}`,
            provider: "samsara",
            type: "fuel",
            vehicleId,
            data: fuel,
            timestamp: new Date(),
          });

          this.lastDataCache.set(cacheKey, fuel);
        }

        state.lastFuelPoll = new Date();
        state.errorCount = 0;
      } catch (error) {
        this.handlePollingError(vehicleId, error, "fuel");
      }
    }, this.config.fuelIntervalMs);

    this.timers.set(`${vehicleId}:fuel`, timer);
  }

  /**
   * Handle polling errors
   */
  private handlePollingError(
    vehicleId: string,
    error: unknown,
    type: string,
  ): void {
    const state = this.states.get(vehicleId);
    if (!state) return;

    state.errorCount++;
    state.lastError =
      error instanceof Error ? error : new Error(String(error));

    // Emit error event
    this.emit("error", {
      vehicleId,
      type,
      error: state.lastError,
      errorCount: state.errorCount,
    });

    // Stop polling after too many errors (circuit breaker pattern)
    if (state.errorCount > 10) {
      this.stopPolling(vehicleId);
      this.emit("stopped", { vehicleId, reason: "excessive_errors" });
    }
  }

  /**
   * Emit telematics event
   */
  private emitEvent(event: TelematicsEvent): void {
    this.emit("data", event);
  }

  /**
   * Compare two objects for equality (ignoring specified keys)
   */
  private dataEquals(
    obj1: Record<string, unknown>,
    obj2: Record<string, unknown>,
    ignoreKeys: string[] = [],
  ): boolean {
    const keys1 = Object.keys(obj1).filter((k) => !ignoreKeys.includes(k));
    const keys2 = Object.keys(obj2).filter((k) => !ignoreKeys.includes(k));

    if (keys1.length !== keys2.length) return false;

    return keys1.every((key) => {
      const v1 = obj1[key];
      const v2 = obj2[key];

      if (Array.isArray(v1) && Array.isArray(v2)) {
        return JSON.stringify(v1) === JSON.stringify(v2);
      }

      if (typeof v1 === "object" && typeof v2 === "object" && v1 && v2) {
        return JSON.stringify(v1) === JSON.stringify(v2);
      }

      return v1 === v2;
    });
  }

  /**
   * Clear timers for a vehicle
   */
  private clearTimers(vehicleId: string): void {
    for (const key of Array.from(this.timers.keys())) {
      if (key.startsWith(vehicleId)) {
        const timer = this.timers.get(key);
        if (timer) clearInterval(timer);
        this.timers.delete(key);
      }
    }
  }

  /**
   * Get current polling interval configuration
   */
  getConfig(): PollingConfig {
    return { ...this.config };
  }

  /**
   * Update polling interval configuration
   */
  updateConfig(config: Partial<PollingConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}
