/**
 * Samsara REST API v1 SDK Client
 * High-performance SDK for Samsara telematics integration
 * Supports live vehicle tracking, driver status, diagnostics, and webhooks
 */

import type {
  WitylogixVehiclePosition,
  WitylogixDriverStatus,
  WitylogixVehicleDiagnostics,
  WitylogixSafetyEvent,
  TelematicsProvider,
} from "./telematics-types.js";

/**
 * Samsara API Response Types
 */
interface SamsaraWebhookPayload {
  eventType: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface SamsaraError {
  code: string;
  message: string;
  statusCode: number;
  retryable: boolean;
}

/**
 * Rate limiter for Samsara API (200 req/sec global)
 */
class SamsaraRateLimiter {
  private requestTimestamps: number[] = [];
  private readonly maxRequestsPerSecond = 200;
  private readonly windowMs = 1000;

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    // Clean up old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(
      (t) => t > now - this.windowMs,
    );

    if (this.requestTimestamps.length >= this.maxRequestsPerSecond) {
      const oldestTime = this.requestTimestamps[0];
      const waitTime = this.windowMs - (now - oldestTime) + 1;
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.requestTimestamps.push(now);
  }

  getRemainingCapacity(): number {
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(
      (t) => t > now - this.windowMs,
    );
    return this.maxRequestsPerSecond - recentRequests.length;
  }
}

/**
 * Samsara SDK Client
 */
export class SamsaraSdkClient implements TelematicsProvider {
  private apiToken: string;
  private baseUrl = "https://api.samsara.com/v1";
  private timeout = 30000;
  private retries = 3;
  private rateLimiter = new SamsaraRateLimiter();

  constructor(
    apiToken: string,
    options?: { timeout?: number; retries?: number },
  ) {
    if (!apiToken) {
      throw new Error("Samsara API token is required");
    }
    this.apiToken = apiToken;
    if (options?.timeout) this.timeout = options.timeout;
    if (options?.retries) this.retries = options.retries;
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request("GET", "/fleet/vehicles", { limit: 1 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Test the connection and credentials
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.request("GET", "/fleet/vehicles", { limit: 1 });
      return {
        success: true,
        message: "Successfully connected to Samsara API",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Get all vehicles with pagination
   * GET /fleet/vehicles
   */
  async getVehicles(): Promise<WitylogixVehiclePosition[]> {
    const vehicles: WitylogixVehiclePosition[] = [];
    let hasNextPage = true;
    let endCursor: string | undefined;

    while (hasNextPage) {
      const params: Record<string, unknown> = { limit: 100 };
      if (endCursor) {
        params.after = endCursor;
      }

      const response = await this.request("GET", "/fleet/vehicles", params);
      const data = response as {
        data?: Array<{
          id: string;
          name: string;
          externalIds?: Array<{ externalIdType: string; value: string }>;
          staticFields?: {
            vin?: string;
            licensePlate?: string;
            make?: string;
            model?: string;
            year?: number;
          };
        }>;
        pagination?: { hasNextPage: boolean; endCursor?: string };
      };

      if (data.data) {
        for (const vehicle of data.data) {
          // Fetch current position for each vehicle
          try {
            const position = await this.getVehiclePosition(vehicle.id);
            vehicles.push(position);
          } catch {
            // Skip vehicles without position data
          }
        }
      }

      hasNextPage = data.pagination?.hasNextPage ?? false;
      endCursor = data.pagination?.endCursor;
    }

    return vehicles;
  }

  /**
   * Get real-time GPS positions
   * GET /fleet/vehicles/locations
   */
  async getVehiclePosition(
    vehicleId: string,
  ): Promise<WitylogixVehiclePosition> {
    const response = await this.request("GET", "/fleet/vehicles/locations", {
      vehicleIds: [vehicleId],
      limit: 1,
    });

    const data = response as {
      data?: Array<{
        id: string;
        vehicleId: string;
        latitude: number;
        longitude: number;
        speedMph: number;
        heading: number;
        time: string;
        accuracy?: number;
        altitude?: number;
      }>;
    };

    if (!data.data || data.data.length === 0) {
      throw new Error(`No location data available for vehicle ${vehicleId}`);
    }

    const location = data.data[0];
    return {
      vehicleId: location.vehicleId,
      lat: location.latitude,
      lng: location.longitude,
      heading: location.heading,
      speed: location.speedMph,
      timestamp: new Date(location.time),
      provider: "samsara",
      accuracy: location.accuracy || 0,
      altitude: location.altitude,
    };
  }

  /**
   * Get batch vehicle positions
   */
  async getBatchVehiclePositions(
    vehicleIds: string[],
  ): Promise<WitylogixVehiclePosition[]> {
    if (vehicleIds.length === 0) {
      return [];
    }

    const response = await this.request("GET", "/fleet/vehicles/locations", {
      vehicleIds,
      limit: vehicleIds.length,
    });

    const data = response as {
      data?: Array<{
        id: string;
        vehicleId: string;
        latitude: number;
        longitude: number;
        speedMph: number;
        heading: number;
        time: string;
        accuracy?: number;
        altitude?: number;
      }>;
    };

    return (data.data || []).map((location) => ({
      vehicleId: location.vehicleId,
      lat: location.latitude,
      lng: location.longitude,
      heading: location.heading,
      speed: location.speedMph,
      timestamp: new Date(location.time),
      provider: "samsara",
      accuracy: location.accuracy || 0,
      altitude: location.altitude,
    }));
  }

  /**
   * Get driver status
   */
  async getDriverStatus(driverId: string): Promise<WitylogixDriverStatus> {
    const response = await this.request("GET", `/fleet/drivers/${driverId}`);

    const data = response as {
      data?: {
        id: string;
        name: string;
        status?: string;
        vehicleId?: string;
        currentVehicleId?: string;
      };
    };

    if (!data.data) {
      throw new Error(`Driver ${driverId} not found`);
    }

    const driver = data.data;
    const vehicleId = driver.currentVehicleId || driver.vehicleId || "";

    return {
      driverId: driver.id,
      vehicleId,
      status: this.mapDriverStatus(driver.status || ""),
      dutyStatus: "ON_DUTY",
    };
  }

  /**
   * Get vehicle diagnostics (fuel, odometer, engine hours, battery)
   * GET /fleet/vehicles/{id}/stats
   */
  async getVehicleDiagnostics(
    vehicleId: string,
  ): Promise<WitylogixVehicleDiagnostics> {
    const response = await this.request(
      "GET",
      `/fleet/vehicles/${vehicleId}/stats`,
    );

    const data = response as {
      data?: {
        engineState?: string;
        odometer?: { miles: number; kilometers?: number };
        fuelPercentageRemaining?: number;
        engineRunningHours?: number;
        faultCodes?: Array<{
          id: string;
          spnId: number;
          fmiId: number;
          description: string;
        }>;
      };
    };

    if (!data.data) {
      throw new Error(`No diagnostics available for vehicle ${vehicleId}`);
    }

    const stats = data.data;
    return {
      vehicleId,
      fuelLevel: stats.fuelPercentageRemaining,
      fuelUnit: "percent",
      odometer: stats.odometer
        ? {
            value: stats.odometer.miles,
            unit: "miles",
          }
        : undefined,
      engineHours: stats.engineRunningHours,
      dtcCodes: (stats.faultCodes || []).map((code) => ({
        code: `${code.spnId}-${code.fmiId}`,
        description: code.description,
        severity: "warning" as const,
      })),
    };
  }

  /**
   * Get location history trail
   * GET /fleet/vehicles/{id}/locations/history
   */
  async getLocationHistory(
    vehicleId: string,
    options?: {
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    },
  ): Promise<WitylogixVehiclePosition[]> {
    const params: Record<string, unknown> = {
      limit: options?.limit || 100,
    };

    if (options?.startTime) {
      params.startTime = options.startTime.toISOString();
    }
    if (options?.endTime) {
      params.endTime = options.endTime.toISOString();
    }

    const response = await this.request(
      "GET",
      `/fleet/vehicles/${vehicleId}/locations/history`,
      params,
    );

    const data = response as {
      data?: Array<{
        id: string;
        vehicleId: string;
        latitude: number;
        longitude: number;
        speedMph: number;
        heading: number;
        time: string;
        accuracy?: number;
        altitude?: number;
      }>;
    };

    return (data.data || []).map((location) => ({
      vehicleId: location.vehicleId,
      lat: location.latitude,
      lng: location.longitude,
      heading: location.heading,
      speed: location.speedMph,
      timestamp: new Date(location.time),
      provider: "samsara",
      accuracy: location.accuracy || 0,
      altitude: location.altitude,
    }));
  }

  /**
   * Get recent safety events
   * GET /fleet/drivers/{id}/safety-score
   */
  async getSafetyEvents(
    driverId?: string,
    options?: {
      limit?: number;
      since?: Date;
    },
  ): Promise<WitylogixSafetyEvent[]> {
    if (!driverId) {
      return [];
    }

    const params: Record<string, unknown> = {
      limit: options?.limit || 50,
    };

    if (options?.since) {
      params.startTime = options.since.toISOString();
    }

    const response = await this.request(
      "GET",
      `/fleet/drivers/${driverId}/safety-score`,
      params,
    );

    const data = response as {
      data?: {
        safetyEvents?: Array<{
          id: string;
          eventType: string;
          severity: string;
          latitude: number;
          longitude: number;
          timestamp: string;
          description?: string;
        }>;
      };
    };

    return (data.data?.safetyEvents || []).map((event) => ({
      driverId,
      eventType: this.mapEventType(event.eventType),
      severity: (event.severity === "critical"
        ? "critical"
        : event.severity === "warning"
          ? "warning"
          : "info") as "info" | "warning" | "critical",
      timestamp: new Date(event.timestamp),
      location: {
        lat: event.latitude,
        lng: event.longitude,
      },
      details: { description: event.description },
    }));
  }

  /**
   * Parse and handle webhook events
   */
  parseWebhookEvent(payload: SamsaraWebhookPayload): {
    type: "location_update" | "status_change" | "alert" | "unknown";
    vehicleId?: string;
    driverId?: string;
    data: Record<string, unknown>;
  } {
    const eventType = payload.eventType.toLowerCase();

    if (eventType.includes("location")) {
      return { type: "location_update", data: payload.data };
    }
    if (eventType.includes("status") || eventType.includes("driver")) {
      return { type: "status_change", data: payload.data };
    }
    if (eventType.includes("alert") || eventType.includes("safety")) {
      return { type: "alert", data: payload.data };
    }

    return { type: "unknown", data: payload.data };
  }

  /**
   * Get drivers list
   * GET /fleet/drivers
   */
  async getDrivers(): Promise<
    Array<{
      id: string;
      name: string;
      status: string;
      vehicleId?: string;
    }>
  > {
    const response = await this.request("GET", "/fleet/drivers", {
      limit: 100,
    });

    const data = response as {
      data?: Array<{
        id: string;
        name: string;
        status?: string;
        vehicleId?: string;
      }>;
    };

    return (data.data || []).map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status ?? "unknown",
      vehicleId: d.vehicleId,
    }));
  }

  /**
   * Make authenticated HTTP request to Samsara API
   */
  private async request(
    method: string,
    endpoint: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    await this.rateLimiter.waitIfNeeded();

    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (params) {
      if (method === "GET") {
        // URL encode parameters
        for (const [key, value] of Object.entries(params)) {
          if (Array.isArray(value)) {
            value.forEach((v) => url.searchParams.append(key, String(v)));
          } else if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
          }
        }
      }
    }

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };

    if (method !== "GET" && params) {
      options.body = JSON.stringify(params);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const response = await fetch(url.toString(), {
            ...options,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const error = await this.parseErrorResponse(response);
            const retryable =
              response.status === 429 ||
              response.status >= 500 ||
              response.status === 408;

            if (!retryable) {
              throw new Error(`${error.code}: ${error.message}`);
            }

            lastError = new Error(`${error.code}: ${error.message}`);

            if (attempt < this.retries - 1) {
              const delayMs = Math.pow(2, attempt) * 100;
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
            continue;
          }

          return response.json();
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retries - 1) {
          const delayMs = Math.pow(2, attempt) * 100;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  /**
   * Parse error response
   */
  private async parseErrorResponse(
    response: Response,
  ): Promise<{ code: string; message: string }> {
    try {
      const data = (await response.json()) as {
        code?: string;
        message?: string;
        error?: string;
      };
      return {
        code: data.code || `HTTP_${response.status}`,
        message: data.message || data.error || response.statusText,
      };
    } catch {
      return {
        code: `HTTP_${response.status}`,
        message: response.statusText,
      };
    }
  }

  /**
   * Map driver status
   */
  private mapDriverStatus(
    status: string,
  ): "ACTIVE" | "INACTIVE" | "ON_BREAK" | "OFFLINE" | "UNKNOWN" {
    const normalized = status.toUpperCase();
    if (normalized.includes("ACTIVE")) return "ACTIVE";
    if (normalized.includes("BREAK")) return "ON_BREAK";
    if (normalized.includes("OFFLINE")) return "OFFLINE";
    if (normalized.includes("INACTIVE")) return "INACTIVE";
    return "UNKNOWN";
  }

  /**
   * Map event type
   */
  private mapEventType(eventType: string): WitylogixSafetyEvent["eventType"] {
    const normalized = eventType.toLowerCase();
    if (normalized.includes("harsh_accel")) return "harsh_acceleration";
    if (normalized.includes("harsh_brake")) return "harsh_braking";
    if (normalized.includes("harsh_turn")) return "harsh_turn";
    if (normalized.includes("speed")) return "speeding";
    if (normalized.includes("idle")) return "idling";
    if (normalized.includes("seatbelt")) return "seatbelt_off";
    if (normalized.includes("phone")) return "phone_use";
    if (normalized.includes("drowsy")) return "drowsy_driving";
    if (normalized.includes("collision")) return "collision";
    return "other";
  }
}

/**
 * Export named exports
 */
export type {
  TelematicsProvider,
  WitylogixVehiclePosition,
  WitylogixDriverStatus,
};
