/**
 * Samsara REST API v1 Client
 * Implements TelematicsAdapter for Samsara telematics platform
 * Supports: vehicles, positions, diagnostics, driver behavior, fuel levels, webhooks
 */

import type {
  TelematicsConfig,
  SamsaraCredentials,
  NormalizedVehicle,
  NormalizedPosition,
  NormalizedDiagnostic,
  NormalizedBehaviorEvent,
  NormalizedFuelReading,
  WebhookSubscription,
  SamsaraVehicle,
  SamsaraLocation,
  SamsaraStats,
  SamsaraSafetyEvent,
  SamsaraFuel,
} from "./types.js";
import { TelematicsAdapter } from "./telematics-adapter.js";
import { TelematicsNormalizer } from "./telematics-normalizer.js";

/**
 * Samsara API Error
 */
class SamsaraAPIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "SamsaraAPIError";
  }
}

/**
 * Samsara REST API v1 Client
 */
export class SamsaraClient extends TelematicsAdapter {
  private apiToken: string;
  private baseUrl = "https://api.samsara.com/v1";
  private normalizer: TelematicsNormalizer;

  constructor(config: TelematicsConfig) {
    super(config);
    const credentials = config.credentials as SamsaraCredentials;
    this.apiToken = credentials.apiToken;
    this.normalizer = new TelematicsNormalizer("samsara");
  }

  /**
   * Authenticate with Samsara
   * Samsara uses static API tokens, so we just verify it works
   */
  async authenticate(): Promise<void> {
    try {
      await this.retryWithBackoff(async () => {
        const response = await this.fetchWithTimeout(
          `${this.baseUrl}/fleet/vehicles?limit=1`,
          {
            method: "GET",
            headers: this.buildHeaders(),
          },
        );

        if (!response.ok) {
          const error = await this.parseErrorResponse(response);
          throw new SamsaraAPIError(
            response.status,
            error.code,
            error.message,
            response.status === 429,
          );
        }
      });
    } catch (error) {
      throw new Error(
        `Samsara authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get all vehicles
   * GET /fleet/vehicles
   */
  async getVehicles(): Promise<NormalizedVehicle[]> {
    const cacheKey = "samsara:vehicles";
    const cached = this.cache.get(cacheKey) as NormalizedVehicle[] | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const vehicles: SamsaraVehicle[] = [];
      let pageIndex = 0;
      let hasMorePages = true;

      while (hasMorePages) {
        const url = new URL(`${this.baseUrl}/fleet/vehicles`);
        url.searchParams.append("limit", "100");
        url.searchParams.append("pageIndex", pageIndex.toString());

        const response = await this.fetchWithTimeout(url.toString(), {
          method: "GET",
          headers: this.buildHeaders(),
        });

        if (!response.ok) {
          const error = await this.parseErrorResponse(response);
          throw new SamsaraAPIError(
            response.status,
            error.code,
            error.message,
            response.status === 429,
          );
        }

        const data = (await response.json()) as {
          data: SamsaraVehicle[];
          pagination: { hasNextPage: boolean };
        };

        vehicles.push(...data.data);
        hasMorePages = data.pagination?.hasNextPage ?? false;
        pageIndex++;
      }

      const normalized = vehicles.map((v) => this.normalizer.normalizeVehicle(v));
      this.cache.set(cacheKey, normalized, 300000); // 5 min cache
      return normalized;
    });
  }

  /**
   * Get current position of a vehicle
   * GET /fleet/vehicles/{id}/locations
   */
  async getVehiclePosition(vehicleId: string): Promise<NormalizedPosition> {
    const cacheKey = `samsara:position:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as NormalizedPosition | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const url = new URL(`${this.baseUrl}/fleet/vehicles/${vehicleId}/locations`);
      url.searchParams.append("limit", "1");

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new SamsaraAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as {
        data: SamsaraLocation[];
      };

      if (!data.data || data.data.length === 0) {
        throw new Error(`No location data available for vehicle ${vehicleId}`);
      }

      const location = data.data[0];
      const normalized = this.normalizer.normalizePosition(location, vehicleId);
      this.cache.set(cacheKey, normalized, 30000); // 30 sec cache
      return normalized;
    });
  }

  /**
   * Get diagnostics for a vehicle
   * GET /fleet/vehicles/{id}/stats
   */
  async getVehicleDiagnostics(vehicleId: string): Promise<NormalizedDiagnostic> {
    const cacheKey = `samsara:diagnostics:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as NormalizedDiagnostic | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/fleet/vehicles/${vehicleId}/stats`,
        {
          method: "GET",
          headers: this.buildHeaders(),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new SamsaraAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { data: SamsaraStats };
      const normalized = this.normalizer.normalizeDiagnostic(data.data, vehicleId);
      this.cache.set(cacheKey, normalized, 300000); // 5 min cache
      return normalized;
    });
  }

  /**
   * Get driver behavior events
   * GET /fleet/drivers/{id}/safety
   */
  async getDriverBehaviorEvents(
    driverId: string,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<NormalizedBehaviorEvent[]> {
    return this.retryWithBackoff(async () => {
      const events: SamsaraSafetyEvent[] = [];
      let pageIndex = 0;
      let hasMorePages = true;

      while (hasMorePages) {
        const url = new URL(`${this.baseUrl}/fleet/drivers/${driverId}/safety`);
        url.searchParams.append("limit", "100");
        url.searchParams.append("pageIndex", pageIndex.toString());
        url.searchParams.append("startTime", dateRange.startDate.toISOString());
        url.searchParams.append("endTime", dateRange.endDate.toISOString());

        const response = await this.fetchWithTimeout(url.toString(), {
          method: "GET",
          headers: this.buildHeaders(),
        });

        if (!response.ok) {
          const error = await this.parseErrorResponse(response);
          throw new SamsaraAPIError(
            response.status,
            error.code,
            error.message,
            response.status === 429,
          );
        }

        const data = (await response.json()) as {
          data: SamsaraSafetyEvent[];
          pagination: { hasNextPage: boolean };
        };

        events.push(...data.data);
        hasMorePages = data.pagination?.hasNextPage ?? false;
        pageIndex++;
      }

      return events.map((e) => this.normalizer.normalizeBehaviorEvent(e));
    });
  }

  /**
   * Get fuel level for a vehicle
   * GET /fleet/vehicles/{id}/stats (fuel field)
   */
  async getFuelLevel(vehicleId: string): Promise<NormalizedFuelReading> {
    const cacheKey = `samsara:fuel:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as NormalizedFuelReading | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/fleet/vehicles/${vehicleId}/stats`,
        {
          method: "GET",
          headers: this.buildHeaders(),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new SamsaraAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as {
        data: SamsaraFuel & { id: string };
      };

      const normalized = this.normalizer.normalizeFuel(data.data);
      this.cache.set(cacheKey, normalized, 120000); // 2 min cache
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
          eventTypes: eventTypes.length > 0 ? eventTypes : ["*.created", "*.updated"],
        }),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new SamsaraAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as {
        data: { id: string; url: string; eventTypes: string[] };
      };

      return {
        webhookId: data.data.id,
        url: data.data.url,
        events: data.data.eventTypes,
        createdAt: new Date(),
      };
    });
  }

  /**
   * Unsubscribe from events
   * DELETE /webhooks/{webhookId}
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

      if (!response.ok && response.status !== 204) {
        const error = await this.parseErrorResponse(response);
        throw new SamsaraAPIError(
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
      await this.authenticate();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build authorization headers
   */
  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
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
}
