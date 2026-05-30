/**
 * Azuga API v2 Client Adapter
 * Handles GPS tracking, trip history, driver behavior scoring,
 * fuel integration, maintenance scheduling, and geofence alerts
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
 * Azuga Vehicle Response
 */
interface AzugaVehicle {
  vehicleId: number;
  licensePlate: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  activeStatus: "Active" | "Inactive";
  deviceImei?: string;
}

/**
 * Azuga GPS Location
 */
interface AzugaLocation {
  vehicleId: number;
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed: number;
  heading?: number;
  accuracy?: number;
}

/**
 * Azuga Trip
 */
interface AzugaTrip {
  tripId: string;
  vehicleId: number;
  startTime: number;
  endTime: number;
  startLocation: {
    latitude: number;
    longitude: number;
  };
  endLocation: {
    latitude: number;
    longitude: number;
  };
  distance: number;
  duration: number;
  fuelUsed?: number;
  idlingTime?: number;
  driverId?: number;
}

/**
 * Azuga Driver Behavior
 */
interface AzugaDriverBehavior {
  eventId: string;
  vehicleId: number;
  driverId?: number;
  eventType:
    | "harsh_acceleration"
    | "harsh_braking"
    | "harsh_turn"
    | "speeding"
    | "rapid_acceleration"
    | "rapid_deceleration";
  severity: "low" | "medium" | "high";
  timestamp: number;
  latitude: number;
  longitude: number;
  speed?: number;
  speedLimit?: number;
}

/**
 * Azuga Maintenance Schedule
 */
interface AzugaMaintenance {
  maintenanceId: string;
  vehicleId: number;
  type: string;
  description?: string;
  dueDate: number;
  dueMileage?: number;
  status: "pending" | "completed" | "overdue";
  notes?: string;
}

/**
 * Azuga Fuel Reading
 */
interface AzugaFuelReading {
  readingId: string;
  vehicleId: number;
  timestamp: number;
  fuelLevel: number; // percentage 0-100
  fuelInGallons?: number;
  fuelInLiters?: number;
  mpg?: number;
}

/**
 * Azuga Geofence
 */
interface AzugaGeofence {
  geofenceId: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  type: string;
}

/**
 * Azuga API Client
 */
export class AzugaTelematicsClient implements ITelematicsAdapter {
  private baseUrl = "https://api.azuga.com/api/v2";
  private accountId: string;
  private apiKey: string;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private logger: any;

  /**
   * Initialize Azuga API Client
   * @param config - Telematics configuration with API key
   */
  constructor(config: TelematicsConfig) {
    const credentials = config.credentials as any;
    if (!credentials?.apiKey) {
      throw new Error("Azuga API key is required");
    }

    this.apiKey = credentials.apiKey;
    this.accountId = credentials.accountId || "";

    this.rateLimiter = new RateLimiter(config.rateLimit ?? 10);
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
    });

    this.logger = console;
  }

  /**
   * Make authenticated request to Azuga API
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitIfNeeded();

      const url = `${this.baseUrl}${path}`;
      const auth = Buffer.from(`${this.accountId}:${this.apiKey}`).toString("base64");

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`Azuga API error: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    });
  }

  /**
   * Get all vehicles
   */
  async getVehicles(options?: SyncOptions): Promise<NormalizedVehicle[]> {
    try {
      const response = await this.request<{
        data: AzugaVehicle[];
      }>("GET", "/vehicles");

      return response.data.map((vehicle) => this.normalizeVehicle(vehicle));
    } catch (error) {
      this.logger.error("Failed to get vehicles from Azuga", error);
      return [];
    }
  }

  /**
   * Get vehicle by ID
   */
  async getVehicleById(vehicleId: string): Promise<NormalizedVehicle> {
    const response = await this.request<AzugaVehicle>(
      "GET",
      `/vehicles/${vehicleId}`,
    );

    return this.normalizeVehicle(response);
  }

  /**
   * Get current positions
   */
  async getPositions(options?: SyncOptions): Promise<NormalizedPosition[]> {
    try {
      const response = await this.request<{
        data: AzugaLocation[];
      }>("GET", "/locations/latest");

      return response.data.map((loc) => this.normalizeLocation(loc));
    } catch (error) {
      this.logger.error("Failed to get positions from Azuga", error);
      return [];
    }
  }

  /**
   * Get position by vehicle ID
   */
  async getPositionByVehicleId(vehicleId: string): Promise<NormalizedPosition> {
    const response = await this.request<AzugaLocation>(
      "GET",
      `/locations/${vehicleId}/latest`,
    );

    return this.normalizeLocation(response);
  }

  /**
   * Get diagnostics
   */
  async getDiagnostics(options?: SyncOptions): Promise<NormalizedDiagnostic[]> {
    // Azuga provides diagnostics via OBD integration
    try {
      const response = await this.request<{
        data: Array<{
          vehicleId: number;
          dtc: Array<{ code: string; description: string }>;
          timestamp: number;
        }>;
      }>("GET", "/diagnostics/faults");

      return response.data.map((diag) => ({
        externalVehicleId: diag.vehicleId.toString(),
        engineRunning: false,
        faultCodes: diag.dtc.map((dtc) => ({
          code: dtc.code,
          description: dtc.description,
          severity: "warning" as const,
        })),
        timestamp: new Date(diag.timestamp),
      }));
    } catch (error) {
      this.logger.error("Failed to get diagnostics from Azuga", error);
      return [];
    }
  }

  /**
   * Get diagnostics by vehicle ID
   */
  async getDiagnosticsByVehicleId(vehicleId: string): Promise<NormalizedDiagnostic> {
    try {
      const response = await this.request<{
        dtc: Array<{ code: string; description: string }>;
        timestamp: number;
      }>("GET", `/diagnostics/${vehicleId}/faults`);

      return {
        externalVehicleId: vehicleId,
        engineRunning: false,
        faultCodes: response.dtc.map((dtc) => ({
          code: dtc.code,
          description: dtc.description,
          severity: "warning" as const,
        })),
        timestamp: new Date(response.timestamp),
      };
    } catch (error) {
      this.logger.error(`Failed to get diagnostics for ${vehicleId}`, error);
      throw error;
    }
  }

  /**
   * Get driver behavior events
   */
  async getBehaviorEvents(options?: SyncOptions): Promise<NormalizedBehaviorEvent[]> {
    try {
      const response = await this.request<{
        data: AzugaDriverBehavior[];
      }>("GET", "/events/behavior");

      return response.data.map((event) => this.normalizeBehaviorEvent(event));
    } catch (error) {
      this.logger.error("Failed to get behavior events from Azuga", error);
      return [];
    }
  }

  /**
   * Get fuel readings
   */
  async getFuelReadings(options?: SyncOptions): Promise<NormalizedFuelReading[]> {
    try {
      const response = await this.request<{
        data: AzugaFuelReading[];
      }>("GET", "/fuel/readings");

      return response.data.map((reading) => this.normalizeFuelReading(reading));
    } catch (error) {
      this.logger.error("Failed to get fuel readings from Azuga", error);
      return [];
    }
  }

  /**
   * Get fuel reading by vehicle ID
   */
  async getFuelReadingByVehicleId(vehicleId: string): Promise<NormalizedFuelReading> {
    const response = await this.request<AzugaFuelReading>(
      "GET",
      `/fuel/${vehicleId}/latest`,
    );

    return this.normalizeFuelReading(response);
  }

  /**
   * Get trips
   */
  async getTrips(options?: SyncOptions): Promise<AzugaTrip[]> {
    try {
      const response = await this.request<{
        data: AzugaTrip[];
      }>("GET", "/trips");

      return response.data;
    } catch (error) {
      this.logger.error("Failed to get trips from Azuga", error);
      return [];
    }
  }

  /**
   * Get trips by vehicle ID
   */
  async getTripsByVehicleId(vehicleId: string): Promise<AzugaTrip[]> {
    try {
      const response = await this.request<{
        data: AzugaTrip[];
      }>("GET", `/vehicles/${vehicleId}/trips`);

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get trips for ${vehicleId}`, error);
      return [];
    }
  }

  /**
   * Get maintenance schedule
   */
  async getMaintenanceSchedule(vehicleId?: string): Promise<AzugaMaintenance[]> {
    try {
      const path = vehicleId ? `/vehicles/${vehicleId}/maintenance` : "/maintenance";
      const response = await this.request<{
        data: AzugaMaintenance[];
      }>("GET", path);

      return response.data;
    } catch (error) {
      this.logger.error("Failed to get maintenance schedule", error);
      return [];
    }
  }

  /**
   * Get driver rewards program status
   */
  async getDriverRewards(driverId: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.request<Record<string, unknown>>(
        "GET",
        `/drivers/${driverId}/rewards`,
      );

      return response;
    } catch (error) {
      this.logger.error(`Failed to get driver rewards for ${driverId}`, error);
      return {};
    }
  }

  /**
   * Get geofences
   */
  async getGeofences(): Promise<AzugaGeofence[]> {
    try {
      const response = await this.request<{
        data: AzugaGeofence[];
      }>("GET", "/geofences");

      return response.data;
    } catch (error) {
      this.logger.error("Failed to get geofences", error);
      return [];
    }
  }

  /**
   * Subscribe to webhook events
   */
  async subscribeWebhook(subscription: WebhookSubscription): Promise<string> {
    const response = await this.request<{
      subscriptionId: string;
    }>("POST", "/webhooks", subscription);

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
      await this.getVehicles({ limit: 1 });
      return true;
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
    return { webhookId: `azuga-${Date.now()}`, url: webhookUrl, events: eventTypes, createdAt: new Date() };
  }

  async unsubscribeFromEvents(webhookId: string): Promise<void> {
    return this.unsubscribeWebhook(webhookId);
  }

  /**
   * Validate connection
   */
  async validateConnection(): Promise<boolean> {
    return this.healthCheck();
  }

  /**
   * Normalize Azuga vehicle to standard format
   */
  private normalizeVehicle(vehicle: AzugaVehicle): NormalizedVehicle {
    return {
      externalVehicleId: vehicle.vehicleId.toString(),
      name: vehicle.licensePlate,
      vin: vehicle.vin,
      licensePlate: vehicle.licensePlate,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      status: vehicle.activeStatus === "Active" ? "ACTIVE" : "INACTIVE",
    };
  }

  /**
   * Normalize Azuga location to position
   */
  private normalizeLocation(loc: AzugaLocation): NormalizedPosition {
    return {
      externalVehicleId: loc.vehicleId.toString(),
      latitude: loc.latitude,
      longitude: loc.longitude,
      altitude: loc.altitude,
      speed: {
        value: loc.speed,
        unit: "mph",
      },
      heading: loc.heading,
      accuracy: loc.accuracy,
      timestamp: new Date(loc.timestamp),
    };
  }

  /**
   * Normalize Azuga driver behavior event
   */
  private normalizeBehaviorEvent(event: AzugaDriverBehavior): NormalizedBehaviorEvent {
    return {
      externalEventId: event.eventId,
      externalVehicleId: event.vehicleId.toString(),
      externalDriverId: event.driverId?.toString(),
      eventType: event.eventType,
      severity: this.mapSeverity(event.severity),
      latitude: event.latitude,
      longitude: event.longitude,
      speed: event.speed ? { value: event.speed, unit: "mph" } : undefined,
      speedLimit: event.speedLimit ? { value: event.speedLimit, unit: "mph" } : undefined,
      timestamp: new Date(event.timestamp),
    };
  }

  /**
   * Normalize Azuga fuel reading
   */
  private normalizeFuelReading(reading: AzugaFuelReading): NormalizedFuelReading {
    return {
      externalVehicleId: reading.vehicleId.toString(),
      fuelLevel: reading.fuelLevel,
      fuelUnit: "gallons",
      fuelCapacity: reading.fuelInGallons,
      timestamp: new Date(reading.timestamp),
    };
  }

  /**
   * Map Azuga severity to normalized severity
   */
  private mapSeverity(severity: string): "info" | "warning" | "critical" {
    const map: Record<string, "info" | "warning" | "critical"> = {
      low: "info",
      medium: "warning",
      high: "critical",
    };

    return map[severity] || "warning";
  }
}
