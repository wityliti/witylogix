/**
 * Geotab MyGeotab API Client
 * Implements TelematicsAdapter for Geotab telematics platform
 * Uses JSONRPC 2.0 style API calls
 */

import type {
  TelematicsConfig,
  GeotabCredentials,
  NormalizedVehicle,
  NormalizedPosition,
  NormalizedDiagnostic,
  NormalizedBehaviorEvent,
  NormalizedFuelReading,
  WebhookSubscription,
  GeotabDevice,
  GeotabDeviceStatusInfo,
  GeotabFaultData,
  GeotabStatusData,
  GeotabExceptionEvent,
} from "./types.js";
import { TelematicsAdapter } from "./telematics-adapter.js";
import { TelematicsNormalizer } from "./telematics-normalizer.js";

/**
 * Geotab API Error
 */
class GeotabAPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "GeotabAPIError";
  }
}

/**
 * Geotab JSONRPC Request/Response Types
 */
interface GeotabJSONRPCRequest {
  method: string;
  params: Record<string, unknown>;
}

interface GeotabJSONRPCResponse<T> {
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Geotab MyGeotab API Client
 */
export class GeotabClient extends TelematicsAdapter {
  private credentials: GeotabCredentials;
  private baseUrl: string;
  private sessionId?: string;
  private normalizer: TelematicsNormalizer;
  private requestId = 0;

  constructor(config: TelematicsConfig) {
    super(config);
    this.credentials = config.credentials as GeotabCredentials;
    this.sessionId = this.credentials.sessionId;
    this.baseUrl = "https://my.geotab.com/apiv1";
    this.normalizer = new TelematicsNormalizer("geotab");
  }

  /**
   * Authenticate with Geotab
   * Authenticate call with database, userName, password
   */
  async authenticate(): Promise<void> {
    try {
      const response = await this.jsonrpcCall<{
        sessionId: string;
      }>("Authenticate", {
        userName: this.credentials.userName,
        password: this.credentials.password,
        database: this.credentials.database,
      });

      this.sessionId = response.sessionId;
      // Update credentials with new session
      this.credentials.sessionId = response.sessionId;
    } catch (error) {
      throw new Error(
        `Geotab authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get all vehicles (Get Device)
   */
  async getVehicles(): Promise<NormalizedVehicle[]> {
    const cacheKey = "geotab:vehicles";
    const cached = this.cache.get(cacheKey) as NormalizedVehicle[] | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const devices = await this.jsonrpcCall<GeotabDevice[]>("Get", {
        typeName: "Device",
        search: {
          fromDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
        },
      });

      const normalized = devices.map((d) =>
        this.normalizer.normalizeGeotabDevice(d),
      );
      this.cache.set(cacheKey, normalized, 300000); // 5 min cache
      return normalized;
    });
  }

  /**
   * Get current position of a vehicle (Get DeviceStatusInfo)
   */
  async getVehiclePosition(vehicleId: string): Promise<NormalizedPosition> {
    const cacheKey = `geotab:position:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as NormalizedPosition | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const statuses = await this.jsonrpcCall<GeotabDeviceStatusInfo[]>("Get", {
        typeName: "DeviceStatusInfo",
        search: {
          deviceSearch: {
            id: vehicleId,
          },
        },
      });

      if (!statuses || statuses.length === 0) {
        throw new Error(`No status info available for device ${vehicleId}`);
      }

      const status = statuses[0];
      const normalized = this.normalizer.normalizeGeotabPosition(status);
      this.cache.set(cacheKey, normalized, 30000); // 30 sec cache
      return normalized;
    });
  }

  /**
   * Get diagnostics for a vehicle (Get FaultData + StatusData)
   */
  async getVehicleDiagnostics(
    vehicleId: string,
  ): Promise<NormalizedDiagnostic> {
    const cacheKey = `geotab:diagnostics:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as NormalizedDiagnostic | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      // Get fault codes
      const faults = await this.jsonrpcCall<GeotabFaultData[]>("Get", {
        typeName: "FaultData",
        search: {
          deviceSearch: {
            id: vehicleId,
          },
          fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      });

      // Get current status data (engine running state)
      const statusData = await this.jsonrpcCall<GeotabStatusData[]>("Get", {
        typeName: "StatusData",
        search: {
          deviceSearch: {
            id: vehicleId,
          },
          diagnosticSearch: {
            id: "EngineRunning",
          },
          fromDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      });

      const normalized = this.normalizer.normalizeGeotabDiagnostic(
        vehicleId,
        faults,
        statusData,
      );
      this.cache.set(cacheKey, normalized, 300000); // 5 min cache
      return normalized;
    });
  }

  /**
   * Get driver behavior events (Get ExceptionEvent)
   */
  async getDriverBehaviorEvents(
    driverId: string,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<NormalizedBehaviorEvent[]> {
    return this.retryWithBackoff(async () => {
      const events = await this.jsonrpcCall<GeotabExceptionEvent[]>("Get", {
        typeName: "ExceptionEvent",
        search: {
          userSearch: {
            id: driverId,
          },
          fromDate: dateRange.startDate,
          toDate: dateRange.endDate,
        },
      });

      return events.map((e) => this.normalizer.normalizeGeotabBehaviorEvent(e));
    });
  }

  /**
   * Get fuel level for a vehicle (Get StatusData with fuelLevel diagnostic)
   */
  async getFuelLevel(vehicleId: string): Promise<NormalizedFuelReading> {
    const cacheKey = `geotab:fuel:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as
      | NormalizedFuelReading
      | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const statusData = await this.jsonrpcCall<GeotabStatusData[]>("Get", {
        typeName: "StatusData",
        search: {
          deviceSearch: {
            id: vehicleId,
          },
          diagnosticSearch: {
            id: "FuelLevel",
          },
          fromDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      });

      if (!statusData || statusData.length === 0) {
        throw new Error(`No fuel level data available for device ${vehicleId}`);
      }

      // Get the most recent reading
      const latestStatus = statusData[statusData.length - 1];
      const normalized = this.normalizer.normalizeGeotabFuel(latestStatus);
      this.cache.set(cacheKey, normalized, 120000); // 2 min cache
      return normalized;
    });
  }

  /**
   * Subscribe to events via DataFeed (polling-based)
   */
  async subscribeToEvents(
    webhookUrl: string,
    eventTypes: string[],
  ): Promise<WebhookSubscription> {
    // Geotab doesn't support traditional webhooks, but we can create a DataFeed
    // For now, we'll return a subscription ID that the poller will use
    return this.retryWithBackoff(async () => {
      const subscriptionId = `geotab-feed-${Date.now()}`;

      // In production, you might store this in a database
      // For now, we'll just return a valid subscription
      return {
        webhookId: subscriptionId,
        url: webhookUrl,
        events: eventTypes,
        createdAt: new Date(),
      };
    });
  }

  /**
   * Unsubscribe from events
   * For Geotab, this is a no-op since we use polling
   */
  async unsubscribeFromEvents(webhookId: string): Promise<void> {
    // No-op for polling-based subscription
    return Promise.resolve();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.authenticate();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Make a JSONRPC 2.0 call to Geotab API
   */
  private async jsonrpcCall<T>(
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    // Skip auto-auth for the Authenticate method itself to prevent infinite recursion
    if (!this.sessionId && method !== "Authenticate") {
      await this.authenticate();
    }

    const requestId = ++this.requestId;
    const url = new URL(`${this.baseUrl}`);
    url.searchParams.append("sessionId", this.sessionId || "");

    const body = JSON.stringify({
      jsonrpc: "2.0",
      method,
      params: {
        ...params,
        credentials: {
          userName: this.credentials.userName,
          sessionId: this.sessionId,
          database: this.credentials.database,
        },
      },
      id: requestId,
    });

    const response = await this.fetchWithTimeout(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new GeotabAPIError(
        `HTTP_${response.status}`,
        error,
        response.status === 429,
      );
    }

    const data = (await response.json()) as GeotabJSONRPCResponse<T>;

    if (data.error) {
      // 401 likely means session expired, should retry auth
      const retryable = data.error.code === 401;
      throw new GeotabAPIError(
        `ERROR_${data.error.code}`,
        data.error.message,
        retryable,
      );
    }

    if (!data.result) {
      throw new GeotabAPIError(
        "EMPTY_RESULT",
        `No result for method ${method}`,
        false,
      );
    }

    return data.result;
  }
}
