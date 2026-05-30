/**
 * Powerfleet API Client Adapter
 * Handles asset tracking, yard management, utilization reporting,
 * temperature monitoring, and geofence management
 */

import type {
  ITelematicsAdapter,
  TelematicsConfig,
  NormalizedVehicle,
  NormalizedPosition,
  NormalizedDiagnostic,
  NormalizedBehaviorEvent,
  NormalizedFuelReading,
  WebhookSubscription,
  SyncOptions,
} from "./types.js";
import { RateLimiter, CircuitBreaker } from "./telematics-adapter.js";

/**
 * Powerfleet Asset Response
 */
interface PowerfleetAsset {
  assetId: string;
  assetName: string;
  assetType: "VEHICLE" | "TRAILER" | "CONTAINER";
  licensePlate?: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  status: "ACTIVE" | "INACTIVE" | "DELETED";
  lastUpdateTime: number;
}

/**
 * Powerfleet Location Response
 */
interface PowerfleetLocation {
  assetId: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

/**
 * Powerfleet Yard Dwell Event
 */
interface PowerfleetDwellEvent {
  eventId: string;
  assetId: string;
  eventType: "DOCK_ARRIVAL" | "DOCK_DEPARTURE" | "YARD_ENTRY" | "YARD_EXIT";
  timestamp: number;
  latitude: number;
  longitude: number;
  durationMinutes?: number;
  location?: string;
}

/**
 * Powerfleet Temperature Reading
 */
interface PowerfleetTemperatureReading {
  readingId: string;
  assetId: string;
  timestamp: number;
  temperatureFahrenheit: number;
  temperatureCelsius: number;
  humidity?: number;
  status: "NORMAL" | "WARNING" | "CRITICAL";
}

/**
 * Powerfleet Geofence
 */
interface PowerfleetGeofence {
  geofenceId: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  type: "DOCK" | "FACILITY" | "HOTSPOT" | "CUSTOM";
  alertOnEntry: boolean;
  alertOnExit: boolean;
}

/**
 * Powerfleet Geofence Alert
 */
interface PowerfleetGeofenceAlert {
  alertId: string;
  assetId: string;
  geofenceId: string;
  eventType: "ENTRY" | "EXIT";
  timestamp: number;
  latitude: number;
  longitude: number;
}

/**
 * Powerfleet API Client
 */
export class PowerfleetClient implements ITelematicsAdapter {
  private baseUrl = "https://api.powerfleet.com/v1";
  private apiKey: string;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private logger: any;

  /**
   * Initialize Powerfleet API Client
   * @param config - Telematics configuration with API key
   */
  constructor(config: TelematicsConfig) {
    if (!config.credentials || typeof config.credentials !== "object") {
      throw new Error("Invalid Powerfleet configuration");
    }

    // Extract API key from credentials or use default
    this.apiKey = (config.credentials as any)?.apiKey || "";

    this.rateLimiter = new RateLimiter(config.rateLimit ?? 10);
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
    });

    this.logger = console;
  }

  /**
   * Make authenticated request to Powerfleet API
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitIfNeeded();

      const url = `${this.baseUrl}${path}`;

      const response = await fetch(url, {
        method,
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`Powerfleet API error: ${response.status} ${response.statusText}`);
      }

      if (response.status === 204 || typeof response.json !== "function") {
        return undefined as T;
      }

      return (await response.json()) as T;
    });
  }

  /**
   * Get all assets (vehicles, trailers, containers)
   */
  async getVehicles(options?: SyncOptions): Promise<NormalizedVehicle[]> {
    try {
      const response = await this.request<{
        assets: PowerfleetAsset[];
      }>("GET", "/assets");

      return response.assets.map((asset) => this.normalizeAsset(asset));
    } catch (error) {
      this.logger.error("Failed to get vehicles from Powerfleet", error);
      return [];
    }
  }

  /**
   * Get vehicle by ID
   */
  async getVehicleById(vehicleId: string): Promise<NormalizedVehicle> {
    const response = await this.request<PowerfleetAsset>(
      "GET",
      `/assets/${vehicleId}`,
    );

    return this.normalizeAsset(response);
  }

  /**
   * Get current positions for all vehicles
   */
  async getPositions(options?: SyncOptions): Promise<NormalizedPosition[]> {
    try {
      const response = await this.request<{
        locations: PowerfleetLocation[];
      }>("GET", "/locations/current");

      return response.locations.map((loc) => this.normalizeLocation(loc));
    } catch (error) {
      this.logger.error("Failed to get positions from Powerfleet", error);
      return [];
    }
  }

  /**
   * Get position by vehicle ID
   */
  async getPositionByVehicleId(vehicleId: string): Promise<NormalizedPosition> {
    const response = await this.request<PowerfleetLocation>(
      "GET",
      `/locations/${vehicleId}/current`,
    );

    return this.normalizeLocation(response);
  }

  /**
   * Get diagnostics
   */
  async getDiagnostics(options?: SyncOptions): Promise<NormalizedDiagnostic[]> {
    // Powerfleet doesn't have direct diagnostics endpoint; could aggregate from other sources
    return [];
  }

  /**
   * Get diagnostics by vehicle ID
   */
  async getDiagnosticsByVehicleId(vehicleId: string): Promise<NormalizedDiagnostic> {
    return {
      externalVehicleId: vehicleId,
      engineRunning: false,
      faultCodes: [],
      timestamp: new Date(),
    };
  }

  /**
   * Get behavior events
   */
  async getBehaviorEvents(options?: SyncOptions): Promise<NormalizedBehaviorEvent[]> {
    // Powerfleet focuses on tracking; behavior events may come from yard management
    return [];
  }

  /**
   * Get fuel readings
   */
  async getFuelReadings(options?: SyncOptions): Promise<NormalizedFuelReading[]> {
    // Powerfleet doesn't provide fuel data
    return [];
  }

  /**
   * Get fuel reading by vehicle ID
   */
  async getFuelReadingByVehicleId(vehicleId: string): Promise<NormalizedFuelReading> {
    return {
      externalVehicleId: vehicleId,
      fuelLevel: 0,
      fuelUnit: "gallons",
      timestamp: new Date(),
    };
  }

  /**
   * Get yard dwell events
   */
  async getYardDwellEvents(options?: SyncOptions): Promise<PowerfleetDwellEvent[]> {
    try {
      const response = await this.request<{
        events: PowerfleetDwellEvent[];
      }>("GET", "/yards/dwell-events");

      return response.events;
    } catch (error) {
      this.logger.error("Failed to get yard dwell events", error);
      return [];
    }
  }

  /**
   * Get utilization report
   */
  async getUtilizationReport(vehicleId?: string): Promise<Record<string, unknown>> {
    try {
      const path = vehicleId ? `/utilization/${vehicleId}` : "/utilization";
      const response = await this.request<Record<string, unknown>>(
        "GET",
        path,
      );

      return response;
    } catch (error) {
      this.logger.error("Failed to get utilization report", error);
      return {};
    }
  }

  /**
   * Get temperature readings for reefer units
   */
  async getTemperatureReadings(): Promise<PowerfleetTemperatureReading[]> {
    try {
      const response = await this.request<{
        readings: PowerfleetTemperatureReading[];
      }>("GET", "/temperature/readings");

      return response.readings;
    } catch (error) {
      this.logger.error("Failed to get temperature readings", error);
      return [];
    }
  }

  /**
   * Get geofences
   */
  async getGeofences(): Promise<PowerfleetGeofence[]> {
    try {
      const response = await this.request<{
        geofences: PowerfleetGeofence[];
      }>("GET", "/geofences");

      return response.geofences;
    } catch (error) {
      this.logger.error("Failed to get geofences", error);
      return [];
    }
  }

  /**
   * Create geofence
   */
  async createGeofence(geofence: Omit<PowerfleetGeofence, "geofenceId">): Promise<PowerfleetGeofence> {
    const response = await this.request<PowerfleetGeofence>(
      "POST",
      "/geofences",
      geofence,
    );

    return response;
  }

  /**
   * Update geofence
   */
  async updateGeofence(
    geofenceId: string,
    updates: Partial<PowerfleetGeofence>,
  ): Promise<PowerfleetGeofence> {
    const response = await this.request<PowerfleetGeofence>(
      "PUT",
      `/geofences/${geofenceId}`,
      updates,
    );

    return response;
  }

  /**
   * Delete geofence
   */
  async deleteGeofence(geofenceId: string): Promise<void> {
    await this.request<void>("DELETE", `/geofences/${geofenceId}`);
  }

  /**
   * Get geofence alerts
   */
  async getGeofenceAlerts(): Promise<PowerfleetGeofenceAlert[]> {
    try {
      const response = await this.request<{
        alerts: PowerfleetGeofenceAlert[];
      }>("GET", "/geofences/alerts");

      return response.alerts;
    } catch (error) {
      this.logger.error("Failed to get geofence alerts", error);
      return [];
    }
  }

  /**
   * Subscribe to webhook events
   */
  async subscribeWebhook(subscription: WebhookSubscription): Promise<string> {
    const response = await this.request<{
      subscriptionId: string;
    }>("POST", "/webhooks/subscribe", subscription);

    return response.subscriptionId;
  }

  /**
   * Unsubscribe from webhook
   */
  async unsubscribeWebhook(subscriptionId: string): Promise<void> {
    await this.request<void>("DELETE", `/webhooks/${subscriptionId}`);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request<{
        status: string;
      }>("GET", "/health");

      return response.status === "ok";
    } catch {
      return false;
    }
  }

  // ITelematicsAdapter interface implementation

  async authenticate(): Promise<void> {
    await this.healthCheck();
  }

  async getVehiclePosition(vehicleId: string): Promise<NormalizedPosition> {
    return this.getPositionByVehicleId(vehicleId);
  }

  async getVehicleDiagnostics(vehicleId: string): Promise<NormalizedDiagnostic> {
    return this.getDiagnosticsByVehicleId(vehicleId);
  }

  async getDriverBehaviorEvents(
    driverId: string,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<NormalizedBehaviorEvent[]> {
    return this.getBehaviorEvents({ startDate: dateRange.startDate, endDate: dateRange.endDate });
  }

  async getFuelLevel(vehicleId: string): Promise<NormalizedFuelReading> {
    return this.getFuelReadingByVehicleId(vehicleId);
  }

  async subscribeToEvents(
    webhookUrl: string,
    eventTypes: string[],
  ): Promise<WebhookSubscription> {
    await this.subscribeWebhook({ webhookId: "", url: webhookUrl, events: eventTypes, createdAt: new Date() });
    return { webhookId: `powerfleet-${Date.now()}`, url: webhookUrl, events: eventTypes, createdAt: new Date() };
  }

  async unsubscribeFromEvents(webhookId: string): Promise<void> {
    return this.unsubscribeWebhook(webhookId);
  }

  /**
   * Validate connection and credentials
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.request<unknown>("GET", "/assets");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize Powerfleet asset to vehicle
   */
  private normalizeAsset(asset: PowerfleetAsset): NormalizedVehicle {
    return {
      externalVehicleId: asset.assetId,
      name: asset.assetName,
      vin: asset.vin,
      licensePlate: asset.licensePlate,
      make: asset.make,
      model: asset.model,
      year: asset.year,
      status: this.mapAssetStatus(asset.status),
    };
  }

  /**
   * Normalize Powerfleet location to position
   */
  private normalizeLocation(loc: PowerfleetLocation): NormalizedPosition {
    return {
      externalVehicleId: loc.assetId,
      latitude: loc.latitude,
      longitude: loc.longitude,
      altitude: loc.altitude,
      speed: loc.speed
        ? {
            value: loc.speed,
            unit: "mph",
          }
        : undefined,
      heading: loc.heading,
      accuracy: loc.accuracy,
      timestamp: new Date(loc.timestamp),
    };
  }

  /**
   * Map Powerfleet asset status to normalized status
   */
  private mapAssetStatus(status: string): "ACTIVE" | "INACTIVE" | "DELETED" {
    return status as "ACTIVE" | "INACTIVE" | "DELETED";
  }
}
