/**
 * Trimble Transportation API Adapter
 * Enterprise transportation & logistics platform
 * Supports: vehicles, drivers, HOS, trips, fuel, ELD, dispatch, navigation, maintenance, visibility
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
 * Trimble API Error
 */
class TrimbleAPIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "TrimbleAPIError";
  }
}

/**
 * Trimble Vehicle
 */
interface TrimbleVehicle {
  id: string;
  name: string;
  vin: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  groupId?: string;
  status: string;
  lastUpdate: string;
  position?: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    accuracy?: number;
  };
}

/**
 * Trimble Driver
 */
interface TrimbleDriver {
  id: string;
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  hosStatus: string; // on_duty, off_duty, sleeper, driving
  hoursAvailable: number;
  status: string;
  assignedVehicle?: string;
}

/**
 * Trimble Trip
 */
interface TrimbleTrip {
  id: string;
  vehicleId: string;
  driverId?: string;
  plannedStart?: string;
  actualStart?: string;
  plannedEnd?: string;
  actualEnd?: string;
  plannedDistance?: number;
  actualDistance: number;
  plannedDuration?: number;
  actualDuration: number;
  stops: Array<{
    id: string;
    location: {
      latitude: number;
      longitude: number;
    };
    plannedArrival?: string;
    actualArrival?: string;
    departureTime?: string;
  }>;
  status: string;
}

/**
 * Trimble Fuel Entry
 */
interface TrimbleFuelEntry {
  id: string;
  vehicleId: string;
  timestamp: string;
  quantity: number;
  unit: string; // gallons, liters
  costPerUnit: number;
  vendor?: string;
  odometer: number;
  taxReporting?: {
    state: string;
    fuelType: string;
    distance: number;
  };
}

/**
 * Trimble ELD Record
 */
interface TrimbleELDRecord {
  id: string;
  driverId: string;
  vehicleId?: string;
  recordDate: string;
  status: string; // on_duty, off_duty, sleeper, driving
  location?: {
    latitude: number;
    longitude: number;
  };
  hoursRemaining: number;
  violations: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
}

/**
 * Trimble Dispatch Load
 */
interface TrimbleDispatchLoad {
  id: string;
  shipmentId: string;
  assignedVehicle?: string;
  assignedDriver?: string;
  origin: {
    latitude: number;
    longitude: number;
    address: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  weight?: number;
  pickupTime?: string;
  deliveryTime?: string;
  status: string;
  eta?: string;
}

/**
 * Trimble Maintenance
 */
interface TrimbleMaintenance {
  id: string;
  vehicleId: string;
  type: string;
  dueDate?: string;
  dueOdometer?: number;
  lastServiceOdometer?: number;
  status: string;
  inspectionReports?: Array<{
    id: string;
    date: string;
    items: Array<{
      name: string;
      status: string; // pass, fail, warning
    }>;
  }>;
  faultCodes?: string[];
}

/**
 * Trimble Credentials
 */
interface TrimbleCredentials {
  apiKey: string;
  oauthToken: string;
  clientId: string;
  clientSecret: string;
}

/**
 * Trimble Transportation API Client
 */
export class TrimbleClient extends TelematicsAdapter {
  private apiKey: string;
  private oauthToken: string;
  private baseUrl = "https://api.trimble.com/t/transportation/v1";
  private normalizer: TelematicsNormalizer;
  private clientId: string;
  private clientSecret: string;

  constructor(config: TelematicsConfig) {
    super(config);
    const credentials = config.credentials as unknown as TrimbleCredentials;
    this.apiKey = credentials.apiKey;
    this.oauthToken = credentials.oauthToken;
    this.clientId = credentials.clientId;
    this.clientSecret = credentials.clientSecret;
    this.normalizer = new TelematicsNormalizer("samsara");
  }

  /**
   * Authenticate with Trimble
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
          const error = await this.parseErrorResponse(response);
          throw new TrimbleAPIError(
            response.status,
            error.code,
            error.message,
            response.status === 429,
          );
        }
      });
    } catch (error) {
      throw new Error(
        `Trimble authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get all vehicles
   * GET /vehicles
   */
  async getVehicles(): Promise<NormalizedVehicle[]> {
    const cacheKey = "trimble:vehicles";
    const cached = this.cache.get(cacheKey) as NormalizedVehicle[] | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const vehicles: TrimbleVehicle[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const url = new URL(`${this.baseUrl}/vehicles`);
        url.searchParams.append("offset", offset.toString());
        url.searchParams.append("limit", "100");

        const response = await this.fetchWithTimeout(url.toString(), {
          method: "GET",
          headers: this.buildHeaders(),
        });

        if (!response.ok) {
          const error = await this.parseErrorResponse(response);
          throw new TrimbleAPIError(
            response.status,
            error.code,
            error.message,
            response.status === 429,
          );
        }

        const data = (await response.json()) as {
          items: TrimbleVehicle[];
          hasMore: boolean;
        };

        if (!data.items || data.items.length === 0) {
          hasMore = false;
        } else {
          vehicles.push(...data.items);
          offset += 100;
          hasMore = data.hasMore ?? false;
        }
      }

      const normalized = vehicles.map((v) => this.normalizeVehicle(v));
      this.cache.set(cacheKey, normalized, 300000);
      return normalized;
    });
  }

  /**
   * Get vehicle position
   * GET /vehicles/{id}/position
   */
  async getVehiclePosition(vehicleId: string): Promise<NormalizedPosition> {
    const cacheKey = `trimble:position:${vehicleId}`;
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
        throw new TrimbleAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as TrimbleVehicle;

      if (!data.position) {
        throw new Error(`No position data for vehicle ${vehicleId}`);
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
   * Get vehicle diagnostics
   * GET /vehicles/{id}/diagnostics
   */
  async getVehicleDiagnostics(
    vehicleId: string,
  ): Promise<NormalizedDiagnostic> {
    const cacheKey = `trimble:diagnostics:${vehicleId}`;
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
        throw new TrimbleAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as {
        engineRunning: boolean;
        faultCodes: string[];
        odometer?: number;
      };

      const normalized: NormalizedDiagnostic = {
        externalVehicleId: vehicleId,
        engineRunning: data.engineRunning,
        faultCodes: (data.faultCodes || []).map((code) => ({
          code,
          description: code,
          severity: "warning",
        })),
        odometer: data.odometer
          ? { value: data.odometer, unit: "miles" }
          : undefined,
        timestamp: new Date(),
      };

      this.cache.set(cacheKey, normalized, 120000);
      return normalized;
    });
  }

  /**
   * Get driver behavior events
   */
  async getDriverBehaviorEvents(
    driverId: string,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<NormalizedBehaviorEvent[]> {
    // Trimble doesn't provide behavior events, return empty
    return [];
  }

  /**
   * Get fuel level
   * GET /vehicles/{id}/fuel
   */
  async getFuelLevel(vehicleId: string): Promise<NormalizedFuelReading> {
    const cacheKey = `trimble:fuel:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as
      | NormalizedFuelReading
      | undefined;
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
        throw new TrimbleAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as {
        fuelLevel: number;
        capacity: number;
        lastUpdate: string;
      };

      const normalized: NormalizedFuelReading = {
        externalVehicleId: vehicleId,
        fuelLevel: (data.fuelLevel / data.capacity) * 100,
        fuelUnit: "gallons",
        fuelCapacity: data.capacity,
        timestamp: new Date(data.lastUpdate),
      };

      this.cache.set(cacheKey, normalized, 120000);
      return normalized;
    });
  }

  /**
   * Subscribe to events
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
        throw new TrimbleAPIError(
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
        throw new TrimbleAPIError(
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
   * Get drivers
   * GET /drivers
   */
  async getDrivers(): Promise<TrimbleDriver[]> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/drivers`, {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new TrimbleAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { items: TrimbleDriver[] };
      return data.items || [];
    });
  }

  /**
   * Get ELD records for driver
   * GET /drivers/{id}/eld
   */
  async getELDRecords(driverId: string): Promise<TrimbleELDRecord[]> {
    return this.retryWithBackoff(async () => {
      const url = new URL(`${this.baseUrl}/drivers/${driverId}/eld`);
      url.searchParams.append("days", "7");

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new TrimbleAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { items: TrimbleELDRecord[] };
      return data.items || [];
    });
  }

  /**
   * Get trips
   * GET /vehicles/{id}/trips
   */
  async getTrips(vehicleId: string): Promise<TrimbleTrip[]> {
    return this.retryWithBackoff(async () => {
      const url = new URL(`${this.baseUrl}/vehicles/${vehicleId}/trips`);
      url.searchParams.append("limit", "50");

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new TrimbleAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { items: TrimbleTrip[] };
      return data.items || [];
    });
  }

  /**
   * Get fuel entries
   * GET /fuel-entries
   */
  async getFuelEntries(vehicleId: string): Promise<TrimbleFuelEntry[]> {
    return this.retryWithBackoff(async () => {
      const url = new URL(`${this.baseUrl}/fuel-entries`);
      url.searchParams.append("vehicleId", vehicleId);
      url.searchParams.append("limit", "100");

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new TrimbleAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { items: TrimbleFuelEntry[] };
      return data.items || [];
    });
  }

  /**
   * Create dispatch load
   * POST /dispatch/loads
   */
  async createDispatchLoad(
    load: Omit<TrimbleDispatchLoad, "id">,
  ): Promise<TrimbleDispatchLoad> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/dispatch/loads`,
        {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify(load),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new TrimbleAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { item: TrimbleDispatchLoad };
      return data.item;
    });
  }

  /**
   * Get maintenance records
   * GET /vehicles/{id}/maintenance
   */
  async getMaintenance(vehicleId: string): Promise<TrimbleMaintenance[]> {
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
        throw new TrimbleAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { items: TrimbleMaintenance[] };
      return data.items || [];
    });
  }

  /**
   * Calculate route with truck-specific routing
   */
  async calculateRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    restrictions?: { height?: number; weight?: number; hazmat?: boolean },
  ): Promise<{ distance: number; duration: number; route: unknown }> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/navigation/routes`,
        {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify({
            origin,
            destination,
            restrictions,
            vehicleType: "truck",
          }),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new TrimbleAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as {
        distance: number;
        duration: number;
        route: unknown;
      };
      return data;
    });
  }

  /**
   * Build request headers
   */
  protected buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.oauthToken}`,
      "X-API-Key": this.apiKey,
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
        code?: string;
        message?: string;
        error?: string;
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
   * Normalize Trimble vehicle
   */
  private normalizeVehicle(vehicle: TrimbleVehicle): NormalizedVehicle {
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
