/**
 * Telematics Aggregator
 * Unified multi-provider telematics data aggregation and deduplication
 * Supports: provider registry, vehicle merging, position aggregation, alert consolidation, diagnostics merging
 */

import type {
  ITelematicsAdapter,
  NormalizedVehicle,
  NormalizedPosition,
  NormalizedDiagnostic,
  NormalizedBehaviorEvent,
  NormalizedFuelReading,
} from "./types.js";

/**
 * Aggregated Vehicle (merged across providers)
 */
export interface AggregatedVehicle {
  id: string; // Internal unique ID
  internalId?: string; // Custom fleet ID
  externalVehicleIds: Record<string, string>; // Map of provider -> externalVehicleId
  name: string;
  vin?: string;
  licensePlate?: string;
  make?: string;
  model?: string;
  year?: number;
  status: "ACTIVE" | "INACTIVE" | "DELETED";
  providers: string[]; // Which providers have this vehicle
  lastUpdated: Date;
}

/**
 * Vehicle deduplication matcher
 */
export interface VehicleDeduplicationRule {
  matchBy: ("vin" | "licensePlate" | "customId" | "name")[];
  customIdField?: string;
  tolerance?: number; // For fuzzy matching on name
}

/**
 * Health score for fleet
 */
export interface FleetHealthScore {
  overall: number; // 0-100
  connectivity: number; // Device connectivity %
  faultCodeRate: number; // % vehicles with faults
  avgDiagnosticFreshness: number; // minutes since last update
  alertCount: number;
}

/**
 * Provider-agnostic alert
 */
export interface AggregatedAlert {
  id: string;
  vehicleId: string; // Internal aggregated vehicle ID
  provider: string;
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: Date;
  deduped: boolean; // Whether this alert was merged with others
}

/**
 * Telematics Aggregator
 * Consolidates data from multiple telematics providers
 */
export class TelematicsAggregator {
  private providers = new Map<string, ITelematicsAdapter>();
  private vehicleRegistry = new Map<string, AggregatedVehicle>();
  private deduplicationRules: VehicleDeduplicationRule = {
    matchBy: ["vin", "licensePlate"],
  };

  constructor() {
    // Initialize
  }

  /**
   * Register a telematics provider
   */
  registerProvider(name: string, adapter: ITelematicsAdapter): void {
    if (this.providers.has(name)) {
      throw new Error(`Provider '${name}' already registered`);
    }
    this.providers.set(name, adapter);
  }

  /**
   * Unregister a telematics provider
   */
  unregisterProvider(name: string): void {
    this.providers.delete(name);
  }

  /**
   * Set vehicle deduplication rules
   */
  setDeduplicationRules(rules: VehicleDeduplicationRule): void {
    this.deduplicationRules = rules;
  }

  /**
   * Get unified fleet view (deduplicated vehicles)
   */
  async getUnifiedFleet(): Promise<AggregatedVehicle[]> {
    const allVehicles = new Map<string, FleetioVehicleMap>();

    // Fetch vehicles from all providers
    for (const [providerName, adapter] of this.providers) {
      try {
        const vehicles = await adapter.getVehicles();
        for (const vehicle of vehicles) {
          const key = this.getVehicleDeduplicationKey(vehicle);
          if (!allVehicles.has(key)) {
            allVehicles.set(key, {
              vehicles: [],
              providers: [],
              baseInfo: vehicle,
            });
          }
          const entry = allVehicles.get(key)!;
          entry.vehicles.push(vehicle);
          entry.providers.push(providerName);
        }
      } catch (error) {
        console.error(`Failed to fetch vehicles from ${providerName}:`, error);
      }
    }

    // Merge deduplicated vehicles
    const aggregated: AggregatedVehicle[] = [];
    for (const [key, entry] of allVehicles) {
      const vehicle: AggregatedVehicle = {
        id: this.generateAggregateId(key),
        name: entry.baseInfo.name,
        vin: entry.baseInfo.vin,
        licensePlate: entry.baseInfo.licensePlate,
        make: entry.baseInfo.make,
        model: entry.baseInfo.model,
        year: entry.baseInfo.year,
        status: entry.baseInfo.status,
        externalVehicleIds: {},
        providers: entry.providers,
        lastUpdated: new Date(),
      };

      for (const provider of entry.providers) {
        const vehicleFromProvider = entry.vehicles.find(
          (v) => this.getVehicleDeduplicationKey(v) === key,
        );
        if (vehicleFromProvider) {
          vehicle.externalVehicleIds[provider] =
            vehicleFromProvider.externalVehicleId;
        }
      }

      aggregated.push(vehicle);
      this.vehicleRegistry.set(vehicle.id, vehicle);
    }

    return aggregated;
  }

  /**
   * Get best-available position from multiple providers
   */
  async getBestPosition(
    aggregatedVehicleId: string,
  ): Promise<NormalizedPosition | null> {
    const vehicle = this.vehicleRegistry.get(aggregatedVehicleId);
    if (!vehicle) throw new Error(`Vehicle ${aggregatedVehicleId} not found`);

    const positions: Array<
      NormalizedPosition & { provider: string; freshness: number }
    > = [];

    // Fetch position from each provider
    for (const provider of vehicle.providers) {
      const adapter = this.providers.get(provider);
      if (!adapter) continue;

      const externalVehicleId = vehicle.externalVehicleIds[provider];
      try {
        const position = await adapter.getVehiclePosition(externalVehicleId);
        const freshness = Date.now() - position.timestamp.getTime();
        positions.push({ ...position, provider, freshness });
      } catch (error) {
        console.error(
          `Failed to fetch position from ${provider} for vehicle ${externalVehicleId}:`,
          error,
        );
      }
    }

    if (positions.length === 0) return null;

    // Return freshest position (lowest freshness time)
    return positions.reduce((best, current) =>
      current.freshness < best.freshness ? current : best,
    );
  }

  /**
   * Consolidate alerts from multiple providers with deduplication
   */
  async getConsolidatedAlerts(
    aggregatedVehicleId: string,
  ): Promise<AggregatedAlert[]> {
    const vehicle = this.vehicleRegistry.get(aggregatedVehicleId);
    if (!vehicle) throw new Error(`Vehicle ${aggregatedVehicleId} not found`);

    const alerts: AggregatedAlert[] = [];
    const seenAlerts = new Set<string>();

    // Fetch behavior events (converted to alerts) from each provider
    for (const provider of vehicle.providers) {
      const adapter = this.providers.get(provider);
      if (!adapter) continue;

      const externalVehicleId = vehicle.externalVehicleIds[provider];
      try {
        const now = new Date();
        const oneDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const events = await adapter.getDriverBehaviorEvents("unknown", {
          startDate: oneDay,
          endDate: now,
        });

        for (const event of events) {
          const alertKey = this.getAlertDeduplicationKey(event);
          const deduped = seenAlerts.has(alertKey);
          if (!deduped) {
            seenAlerts.add(alertKey);
          }

          alerts.push({
            id: `${provider}:${event.externalEventId}`,
            vehicleId: aggregatedVehicleId,
            provider,
            type: event.eventType,
            severity: event.severity,
            message: event.description || `${event.eventType} detected`,
            timestamp: event.timestamp,
            deduped,
          });
        }
      } catch (error) {
        console.error(
          `Failed to fetch behavior events from ${provider} for vehicle ${externalVehicleId}:`,
          error,
        );
      }
    }

    return alerts;
  }

  /**
   * Merge diagnostics from multiple providers
   */
  async getMergedDiagnostics(
    aggregatedVehicleId: string,
  ): Promise<NormalizedDiagnostic | null> {
    const vehicle = this.vehicleRegistry.get(aggregatedVehicleId);
    if (!vehicle) throw new Error(`Vehicle ${aggregatedVehicleId} not found`);

    const diagnostics: NormalizedDiagnostic[] = [];

    for (const provider of vehicle.providers) {
      const adapter = this.providers.get(provider);
      if (!adapter) continue;

      const externalVehicleId = vehicle.externalVehicleIds[provider];
      try {
        const diag = await adapter.getVehicleDiagnostics(externalVehicleId);
        diagnostics.push(diag);
      } catch (error) {
        console.error(
          `Failed to fetch diagnostics from ${provider} for vehicle ${externalVehicleId}:`,
          error,
        );
      }
    }

    if (diagnostics.length === 0) return null;

    // Merge diagnostics: combine fault codes, use most recent timestamp
    const merged: NormalizedDiagnostic = {
      externalVehicleId: aggregatedVehicleId,
      engineRunning: diagnostics.some((d) => d.engineRunning),
      faultCodes: Array.from(
        new Map(
          diagnostics
            .flatMap((d) => d.faultCodes)
            .map((code) => [code.code, code]),
        ).values(),
      ),
      odometer: diagnostics
        .filter((d) => d.odometer)
        .sort((a, b) => (b.odometer?.value ?? 0) - (a.odometer?.value ?? 0))[0]
        ?.odometer,
      timestamp: new Date(
        Math.max(...diagnostics.map((d) => d.timestamp.getTime())),
      ),
    };

    return merged;
  }

  /**
   * Calculate fleet health score
   */
  async getFleetHealthScore(): Promise<FleetHealthScore> {
    const fleet = await this.getUnifiedFleet();

    let totalFreshness = 0;
    let healthyDevices = 0;
    let devicesWithFaults = 0;
    let totalAlerts = 0;

    for (const vehicle of fleet) {
      try {
        const position = await this.getBestPosition(vehicle.id);
        if (position) {
          healthyDevices++;
          const freshness = Date.now() - position.timestamp.getTime();
          totalFreshness += freshness;
        }

        const diagnostics = await this.getMergedDiagnostics(vehicle.id);
        if (diagnostics && diagnostics.faultCodes.length > 0) {
          devicesWithFaults++;
        }

        const alerts = await this.getConsolidatedAlerts(vehicle.id);
        totalAlerts += alerts.length;
      } catch (error) {
        console.error(
          `Error calculating health for vehicle ${vehicle.id}:`,
          error,
        );
      }
    }

    const fleetSize = fleet.length || 1;
    return {
      overall: Math.round(
        (healthyDevices / fleetSize) * 100 -
          (devicesWithFaults / fleetSize) * 10,
      ),
      connectivity: Math.round((healthyDevices / fleetSize) * 100),
      faultCodeRate: Math.round((devicesWithFaults / fleetSize) * 100),
      avgDiagnosticFreshness: Math.round(totalFreshness / fleetSize / 60000), // Convert to minutes
      alertCount: totalAlerts,
    };
  }

  /**
   * Get provider status and health
   */
  async getProviderStatus(): Promise<
    Record<string, { healthy: boolean; lastError?: string }>
  > {
    const status: Record<string, { healthy: boolean; lastError?: string }> = {};

    for (const [name, adapter] of this.providers) {
      try {
        const healthy = await adapter.healthCheck();
        status[name] = { healthy };
      } catch (error) {
        status[name] = {
          healthy: false,
          lastError: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return status;
  }

  /**
   * Get deduplication key for vehicle
   */
  private getVehicleDeduplicationKey(vehicle: NormalizedVehicle): string {
    // First-match (OR) logic: a vehicle sharing any key field with another is a duplicate
    for (const field of this.deduplicationRules.matchBy) {
      if (field === "vin" && vehicle.vin) {
        return `vin:${vehicle.vin}`;
      } else if (field === "licensePlate" && vehicle.licensePlate) {
        return `plate:${vehicle.licensePlate}`;
      } else if (field === "name") {
        return `name:${vehicle.name}`;
      }
    }

    return `id:${vehicle.externalVehicleId}`;
  }

  /**
   * Get deduplication key for alert (approximate)
   */
  private getAlertDeduplicationKey(event: NormalizedBehaviorEvent): string {
    return `${event.externalVehicleId}:${event.eventType}:${Math.floor(event.timestamp.getTime() / 60000)}`;
  }

  /**
   * Generate aggregate ID from dedup key
   */
  private generateAggregateId(key: string): string {
    // Use hash of key to generate stable ID
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const chr = key.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `agg_${Math.abs(hash).toString(16).padStart(8, "0")}`;
  }
}

/**
 * Internal type for vehicle mapping during aggregation
 */
interface FleetioVehicleMap {
  vehicles: NormalizedVehicle[];
  providers: string[];
  baseInfo: NormalizedVehicle;
}
