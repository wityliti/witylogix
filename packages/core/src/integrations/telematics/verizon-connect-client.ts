/**
 * Verizon Connect API Adapter
 * Formerly Fleetmatics - enterprise fleet management platform
 * Supports: vehicles, drivers, trips, alerts, geofences, reports, maintenance, fuel, real-time tracking
 */

import type {
  TelematicsConfig,
  NormalizedVehicle,
  NormalizedPosition,
  NormalizedDiagnostic,
  NormalizedBehaviorEvent,
  NormalizedFuelReading,
  WebhookSubscription,
} from "./types.js";
import { TelematicsAdapter } from "./telematics-adapter.js";
import { TelematicsNormalizer } from "./telematics-normalizer.js";

/**
 * Verizon Connect API Error
 */
class VerizonConnectAPIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "VerizonConnectAPIError";
  }
}

/**
 * Verizon Connect Vehicle
 */
interface VerizonConnectVehicle {
  id: string;
  name: string;
  vin: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  status: string;
  lastUpdate: string; // ISO 8601
  position?: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    accuracy: number;
  };
  ignitionStatus: string;
}

/**
 * Verizon Connect Driver
 */
interface VerizonConnectDriver {
  id: string;
  name: string;
  email: string;
  phone: string;
  assignedVehicle?: string;
  safetyScore: number; // 0-100
  status: string;
  lastUpdate: string;
}

/**
 * Verizon Connect Trip
 */
interface VerizonConnectTrip {
  id: string;
  vehicleId: string;
  driverId?: string;
  startTime: string; // ISO 8601
  endTime: string;
  distance: number; // miles
  duration: number; // seconds
  averageSpeed: number;
  topSpeed: number;
  routePoints: Array<{
    latitude: number;
    longitude: number;
    speed: number;
    timestamp: string;
  }>;
}

/**
 * Verizon Connect Alert
 */
interface VerizonConnectAlert {
  id: string;
  vehicleId: string;
  driverId?: string;
  type: string; // speeding, harsh_braking, geofence, maintenance
  severity: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  speed?: number;
  speedLimit?: number;
  timestamp: string; // ISO 8601
  message: string;
}

/**
 * Verizon Connect Geofence
 */
interface VerizonConnectGeofence {
  id: string;
  name: string;
  type: string; // circle, polygon
  center?: {
    latitude: number;
    longitude: number;
  };
  radius?: number;
  polygon?: Array<{
    latitude: number;
    longitude: number;
  }>;
}

/**
 * Verizon Connect Report
 */
interface VerizonConnectReport {
  id: string;
  name: string;
  type: string; // utilization, scorecard, fuel
  generatedAt: string;
  period: {
    start: string;
    end: string;
  };
  data: Record<string, unknown>;
}

/**
 * Verizon Connect Maintenance Record
 */
interface VerizonConnectMaintenance {
  id: string;
  vehicleId: string;
  type: string;
  dueDate?: string;
  odometer?: number;
  lastServiceOdometer?: number;
  status: string; // pending, scheduled, completed
  description: string;
}

/**
 * Verizon Connect Credentials
 */
interface VerizonConnectCredentials {
  accessToken: string;
  refreshToken?: string;
  clientId: string;
  clientSecret: string;
}

/**
 * Verizon Connect API Client
 */
export class VerizonConnectClient extends TelematicsAdapter {
  private accessToken: string;
  private baseUrl = "https://api.verizonconnect.com/v1";
  private normalizer: TelematicsNormalizer;
  private clientId: string;
  private clientSecret: string;

  constructor(config: TelematicsConfig) {
    super(config);
    const credentials = config.credentials as VerizonConnectCredentials;
    this.accessToken = credentials.accessToken;
    this.clientId = credentials.clientId;
    this.clientSecret = credentials.clientSecret;
    this.normalizer = new TelematicsNormalizer("samsara");
  }

  /**
   * Authenticate with Verizon Connect
   * Uses OAuth2 access token verification
   */
  async authenticate(): Promise<void> {
    try {
      await this.retryWithBackoff(async () => {
        const response = await this.fetchWithTimeout(
          `${this.baseUrl}/vehicles?limit=1`,
          {
            method: "GET",
            headers: this.buildHeaders(),
          },
        );

        if (!response.ok) {
          if (response.status === 401) {
            // Token expired, would need refresh in production
            throw new VerizonConnectAPIError(
              401,
              "UNAUTHORIZED",
              "Access token expired",
              true,
            );
          }
          const error = await this.parseErrorResponse(response);
          throw new VerizonConnectAPIError(
            response.status,
            error.code,
            error.message,
            response.status === 429,
          );
        }
      });
    } catch (error) {
      throw new Error(
        `Verizon Connect authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get all vehicles
   * GET /vehicles
   */
  async getVehicles(): Promise<NormalizedVehicle[]> {
    const cacheKey = "verizon:vehicles";
    const cached = this.cache.get(cacheKey) as NormalizedVehicle[] | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const vehicles: VerizonConnectVehicle[] = [];
      let skip = 0;
      const take = 100;
      let hasMore = true;

      while (hasMore) {
        const url = new URL(`${this.baseUrl}/vehicles`);
        url.searchParams.append("skip", skip.toString());
        url.searchParams.append("take", take.toString());

        const response = await this.fetchWithTimeout(url.toString(), {
          method: "GET",
          headers: this.buildHeaders(),
        });

        if (!response.ok) {
          const error = await this.parseErrorResponse(response);
          throw new VerizonConnectAPIError(
            response.status,
            error.code,
            error.message,
            response.status === 429,
          );
        }

        const data = (await response.json()) as {
          vehicles: VerizonConnectVehicle[];
          totalCount: number;
        };

        if (!data.vehicles || data.vehicles.length === 0) {
          hasMore = false;
        } else {
          vehicles.push(...data.vehicles);
          skip += take;
          hasMore = skip < (data.totalCount ?? 0);
        }
      }

      const normalized = vehicles.map((v) => this.normalizeVehicle(v));
      this.cache.set(cacheKey, normalized, 300000);
      return normalized;
    });
  }

  /**
   * Get current position of a vehicle
   * GET /vehicles/{id}/position
   */
  async getVehiclePosition(vehicleId: string): Promise<NormalizedPosition> {
    const cacheKey = `verizon:position:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as NormalizedPosition | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/vehicles/${vehicleId}/position`,
        {
          method: "GET",
          headers: this.buildHeaders(),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new VerizonConnectAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as VerizonConnectVehicle;

      if (!data.position) {
        throw new Error(`No position data available for vehicle ${vehicleId}`);
      }

      const normalized: NormalizedPosition = {
        externalVehicleId: vehicleId,
        latitude: data.position.latitude,
        longitude: data.position.longitude,
        speed: {
          value: data.position.speed,
          unit: "mph",
        },
        heading: data.position.heading,
        accuracy: data.position.accuracy,
        timestamp: new Date(data.lastUpdate),
      };

      this.cache.set(cacheKey, normalized, 30000);
      return normalized;
    });
  }

  /**
   * Get diagnostics for a vehicle
   * GET /vehicles/{id}/diagnostics
   */
  async getVehicleDiagnostics(vehicleId: string): Promise<NormalizedDiagnostic> {
    const cacheKey = `verizon:diagnostics:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as NormalizedDiagnostic | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/vehicles/${vehicleId}/diagnostics`,
        {
          method: "GET",
          headers: this.buildHeaders(),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new VerizonConnectAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as {
        engineRunning: boolean;
        faultCodes: Array<{ code: string; description: string }>;
      };

      const normalized: NormalizedDiagnostic = {
        externalVehicleId: vehicleId,
        engineRunning: data.engineRunning,
        faultCodes: (data.faultCodes || []).map((code) => ({
          code: code.code,
          description: code.description,
          severity: "warning",
        })),
        timestamp: new Date(),
      };

      this.cache.set(cacheKey, normalized, 120000);
      return normalized;
    });
  }

  /**
   * Get driver behavior events
   * GET /alerts with type filters
   */
  async getDriverBehaviorEvents(
    driverId: string,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<NormalizedBehaviorEvent[]> {
    return this.retryWithBackoff(async () => {
      const startTime = dateRange.startDate.toISOString();
      const endTime = dateRange.endDate.toISOString();

      const url = new URL(`${this.baseUrl}/alerts`);
      url.searchParams.append("driverId", driverId);
      url.searchParams.append("startTime", startTime);
      url.searchParams.append("endTime", endTime);

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new VerizonConnectAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { alerts: VerizonConnectAlert[] };
      const behaviorAlerts = (data.alerts || []).filter(
        (a) =>
          [
            "harsh_braking",
            "harsh_acceleration",
            "speeding",
            "harsh_turn",
          ].includes(a.type),
      );

      return behaviorAlerts.map((alert) => ({
        externalEventId: alert.id,
        externalVehicleId: alert.vehicleId,
        externalDriverId: alert.driverId,
        eventType: alert.type as NormalizedBehaviorEvent["eventType"],
        severity: alert.severity as NormalizedBehaviorEvent["severity"],
        latitude: alert.location?.latitude ?? 0,
        longitude: alert.location?.longitude ?? 0,
        speed: alert.speed ? { value: alert.speed, unit: "mph" as const } : undefined,
        speedLimit: alert.speedLimit
          ? { value: alert.speedLimit, unit: "mph" as const }
          : undefined,
        timestamp: new Date(alert.timestamp),
        description: alert.message,
      }));
    });
  }

  /**
   * Get fuel level for a vehicle
   * GET /vehicles/{id}/fuel
   */
  async getFuelLevel(vehicleId: string): Promise<NormalizedFuelReading> {
    const cacheKey = `verizon:fuel:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as NormalizedFuelReading | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/vehicles/${vehicleId}/fuel`,
        {
          method: "GET",
          headers: this.buildHeaders(),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new VerizonConnectAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as {
        fuelLevel: number;
        fuelCapacity: number;
        lastUpdate: string;
      };

      const normalized: NormalizedFuelReading = {
        externalVehicleId: vehicleId,
        fuelLevel: (data.fuelLevel / data.fuelCapacity) * 100, // Convert to percentage
        fuelUnit: "gallons",
        fuelCapacity: data.fuelCapacity,
        timestamp: new Date(data.lastUpdate),
      };

      this.cache.set(cacheKey, normalized, 120000);
      return normalized;
    });
  }

  /**
   * Subscribe to events via webhook
   * POST /webhooks
   */
  async subscribeToEvents(
    webhookUrl: string,
    eventTypes: string[],
  ): Promise<WebhookSubscription> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/webhooks`, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({
          url: webhookUrl,
          events: eventTypes,
        }),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new VerizonConnectAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as {
        id: string;
        url: string;
        events: string[];
        createdAt: string;
      };

      return {
        webhookId: data.id,
        url: data.url,
        events: data.events,
        createdAt: new Date(data.createdAt),
      };
    });
  }

  /**
   * Unsubscribe from events
   * DELETE /webhooks/{id}
   */
  async unsubscribeFromEvents(webhookId: string): Promise<void> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/webhooks/${webhookId}`,
        {
          method: "DELETE",
          headers: this.buildHeaders(),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new VerizonConnectAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.retryWithBackoff(async () => {
        const response = await this.fetchWithTimeout(
          `${this.baseUrl}/vehicles?limit=1`,
          {
            method: "GET",
            headers: this.buildHeaders(),
          },
        );
        return response.ok;
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get driver profiles
   * GET /drivers
   */
  async getDrivers(): Promise<VerizonConnectDriver[]> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/drivers`, {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new VerizonConnectAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { drivers: VerizonConnectDriver[] };
      return data.drivers || [];
    });
  }

  /**
   * Get trip history
   * GET /vehicles/{id}/trips
   */
  async getTrips(vehicleId: string): Promise<VerizonConnectTrip[]> {
    return this.retryWithBackoff(async () => {
      const url = new URL(`${this.baseUrl}/vehicles/${vehicleId}/trips`);
      url.searchParams.append("limit", "50");

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new VerizonConnectAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { trips: VerizonConnectTrip[] };
      return data.trips || [];
    });
  }

  /**
   * Create geofence
   * POST /geofences
   */
  async createGeofence(
    name: string,
    type: "circle" | "polygon",
    shapeData: Record<string, unknown>,
  ): Promise<VerizonConnectGeofence> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/geofences`,
        {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify({
            name,
            type,
            ...shapeData,
          }),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new VerizonConnectAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { geofence: VerizonConnectGeofence };
      return data.geofence;
    });
  }

  /**
   * Get maintenance records
   * GET /vehicles/{id}/maintenance
   */
  async getMaintenance(vehicleId: string): Promise<VerizonConnectMaintenance[]> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/vehicles/${vehicleId}/maintenance`,
        {
          method: "GET",
          headers: this.buildHeaders(),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new VerizonConnectAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as {
        records: VerizonConnectMaintenance[];
      };
      return data.records || [];
    });
  }

  /**
   * Build request headers with Bearer token
   */
  protected buildHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Parse error response
   */
  protected async parseErrorResponse(
    response: Response,
  ): Promise<{ code: string; message: string }> {
    try {
      const body = (await response.json()) as {
        error?: string;
        message?: string;
        code?: string;
      };
      return {
        code: body.code || body.error || "UNKNOWN",
        message: body.message || response.statusText,
      };
    } catch {
      return {
        code: `HTTP_${response.status}`,
        message: response.statusText,
      };
    }
  }

  /**
   * Normalize Verizon Connect vehicle
   */
  private normalizeVehicle(vehicle: VerizonConnectVehicle): NormalizedVehicle {
    return {
      externalVehicleId: vehicle.id,
      name: vehicle.name,
      vin: vehicle.vin,
      licensePlate: vehicle.licensePlate,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      status: vehicle.status === "active" ? "ACTIVE" : "INACTIVE",
      odometer: undefined,
    };
  }
}
