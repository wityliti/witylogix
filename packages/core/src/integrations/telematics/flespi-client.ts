/**
 * Flespi Universal Telematics Platform Client
 * Implements TelematicsAdapter for Flespi (2500+ device protocols)
 * Supports: devices, channels, telemetry, messages, streams, geofences, calculators, analytics, MQTT, webhooks
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
 * Flespi API Error
 */
class FlespiAPIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "FlespiAPIError";
  }
}

/**
 * Flespi Device Type
 */
interface FlespiDevice {
  id: number;
  name: string;
  ident: string; // IMEI, VIN, or custom identifier
  protocol: string; // GPS tracker protocol
  custom_name?: string;
  position?: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    altitude: number;
    timestamp: number;
  };
  status?: string;
}

/**
 * Flespi Channel Type
 */
interface FlespiChannel {
  id: number;
  name: string;
  protocol: string;
  device_id?: number;
  type: string;
}

/**
 * Flespi Telemetry Message
 */
interface FlespiTelemetry {
  device_id: number;
  position: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    altitude?: number;
  };
  timestamp: number;
  accuracy?: number;
  satellite_count?: number;
  hdop?: number;
}

/**
 * Flespi Historical Message
 */
interface FlespiMessage {
  device_id: number;
  timestamp: number;
  position?: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    altitude?: number;
  };
  engine_running?: boolean;
  fuel_level?: number;
  odometer?: number;
  temperature?: number;
  battery?: number;
  inputs?: Record<string, number | boolean>;
  outputs?: Record<string, number | boolean>;
}

/**
 * Flespi Geofence
 */
interface FlespiGeofence {
  id: number;
  name: string;
  type: "circle" | "polygon";
  center?: { latitude: number; longitude: number };
  radius?: number;
  perimeter?: Array<{ latitude: number; longitude: number }>;
}

/**
 * Flespi Stream (Data Forward)
 */
interface FlespiStream {
  id: number;
  name: string;
  type: string; // mqtt, http, amqp
  protocol: string;
  device_id?: number;
  active: boolean;
}

/**
 * Flespi Calculator
 */
interface FlespiCalculator {
  id: number;
  name: string;
  type: string; // mileage, fuel_consumption, idle_time
  device_id: number;
  enabled: boolean;
}

/**
 * Flespi Webhook Subscription
 */
interface FlespiWebhook {
  id: number;
  url: string;
  events: string[];
  enabled: boolean;
  created: number;
}

/**
 * Credentials for Flespi
 */
interface FlespiCredentials {
  apiToken: string;
  mqttUsername?: string;
  mqttPassword?: string;
}

/**
 * Flespi REST API Client
 */
export class FlespiClient extends TelematicsAdapter {
  private apiToken: string;
  private baseUrl = "https://api.flespi.io";
  private normalizer: TelematicsNormalizer;
  private mqttUsername?: string;
  private mqttPassword?: string;

  constructor(config: TelematicsConfig) {
    super(config);
    const credentials = config.credentials as FlespiCredentials;
    this.apiToken = credentials.apiToken;
    this.mqttUsername = credentials.mqttUsername;
    this.mqttPassword = credentials.mqttPassword;
    this.normalizer = new TelematicsNormalizer("samsara"); // Use Samsara normalizer pattern
  }

  /**
   * Authenticate with Flespi
   * Flespi uses Bearer tokens, verify with a simple devices list
   */
  async authenticate(): Promise<void> {
    try {
      await this.retryWithBackoff(async () => {
        const response = await this.fetchWithTimeout(
          `${this.baseUrl}/gw/devices?limit=1`,
          {
            method: "GET",
            headers: this.buildHeaders(),
          },
        );

        if (!response.ok) {
          const error = await this.parseErrorResponse(response);
          throw new FlespiAPIError(
            response.status,
            error.code || "UNKNOWN",
            error.message || "Authentication failed",
            response.status === 429,
          );
        }
      });
    } catch (error) {
      throw new Error(
        `Flespi authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get all devices
   * GET /gw/devices
   */
  async getVehicles(): Promise<NormalizedVehicle[]> {
    const cacheKey = "flespi:devices";
    const cached = this.cache.get(cacheKey) as NormalizedVehicle[] | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const devices: FlespiDevice[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const url = new URL(`${this.baseUrl}/gw/devices`);
        url.searchParams.append("limit", "100");
        url.searchParams.append("offset", offset.toString());

        const response = await this.fetchWithTimeout(url.toString(), {
          method: "GET",
          headers: this.buildHeaders(),
        });

        if (!response.ok) {
          const error = await this.parseErrorResponse(response);
          throw new FlespiAPIError(
            response.status,
            error.code || "UNKNOWN",
            error.message || "Failed to fetch devices",
            response.status === 429,
          );
        }

        const data = (await response.json()) as {
          result: FlespiDevice[];
        };

        if (!data.result || data.result.length === 0) {
          hasMore = false;
        } else {
          devices.push(...data.result);
          offset += 100;
        }
      }

      const normalized = devices.map((d) => this.normalizeDevice(d));
      this.cache.set(cacheKey, normalized, 300000); // 5 min cache
      return normalized;
    });
  }

  /**
   * Get current position of a device
   * GET /gw/devices/{id}/telemetry
   */
  async getVehiclePosition(vehicleId: string): Promise<NormalizedPosition> {
    const cacheKey = `flespi:position:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as NormalizedPosition | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/gw/devices/${vehicleId}/telemetry`,
        {
          method: "GET",
          headers: this.buildHeaders(),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FlespiAPIError(
          response.status,
          error.code || "UNKNOWN",
          error.message || "Failed to fetch telemetry",
          response.status === 429,
        );
      }

      const data = (await response.json()) as { result: FlespiTelemetry };

      if (!data.result || !data.result.position) {
        throw new Error(`No telemetry data available for device ${vehicleId}`);
      }

      const telemetry = data.result;
      const normalized: NormalizedPosition = {
        externalVehicleId: vehicleId,
        latitude: telemetry.position.latitude,
        longitude: telemetry.position.longitude,
        altitude: telemetry.position.altitude,
        speed: {
          value: telemetry.position.speed,
          unit: "kmh",
        },
        heading: telemetry.position.heading,
        accuracy: telemetry.accuracy,
        timestamp: new Date(telemetry.timestamp * 1000),
      };

      this.cache.set(cacheKey, normalized, 30000); // 30 sec cache
      return normalized;
    });
  }

  /**
   * Get diagnostics for a device
   * GET /gw/devices/{id}/messages with time range
   */
  async getVehicleDiagnostics(vehicleId: string): Promise<NormalizedDiagnostic> {
    const cacheKey = `flespi:diagnostics:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as NormalizedDiagnostic | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const now = Math.floor(Date.now() / 1000);
      const oneHourAgo = now - 3600;

      const url = new URL(`${this.baseUrl}/gw/devices/${vehicleId}/messages`);
      url.searchParams.append("from", oneHourAgo.toString());
      url.searchParams.append("to", now.toString());
      url.searchParams.append("limit", "1");

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FlespiAPIError(
          response.status,
          error.code || "UNKNOWN",
          error.message || "Failed to fetch diagnostics",
          response.status === 429,
        );
      }

      const data = (await response.json()) as { result: FlespiMessage[] };
      const message = data.result?.[0];

      if (!message) {
        throw new Error(`No diagnostic data available for device ${vehicleId}`);
      }

      const normalized: NormalizedDiagnostic = {
        externalVehicleId: vehicleId,
        engineRunning: message.engine_running ?? false,
        faultCodes: [],
        odometer: message.odometer
          ? { value: message.odometer, unit: "kilometers" }
          : undefined,
        timestamp: new Date(message.timestamp * 1000),
      };

      this.cache.set(cacheKey, normalized, 120000); // 2 min cache
      return normalized;
    });
  }

  /**
   * Get driver behavior events
   * GET /gw/devices/{id}/messages with filtering
   */
  async getDriverBehaviorEvents(
    driverId: string,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<NormalizedBehaviorEvent[]> {
    // Flespi doesn't have native behavior events, return empty array
    // Would require external processing of acceleration/braking/speed data
    return [];
  }

  /**
   * Get fuel level for a device
   * GET /gw/devices/{id}/messages with fuel_level field
   */
  async getFuelLevel(vehicleId: string): Promise<NormalizedFuelReading> {
    const cacheKey = `flespi:fuel:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as NormalizedFuelReading | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 86400;

      const url = new URL(`${this.baseUrl}/gw/devices/${vehicleId}/messages`);
      url.searchParams.append("from", oneDayAgo.toString());
      url.searchParams.append("to", now.toString());
      url.searchParams.append("limit", "1");

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FlespiAPIError(
          response.status,
          error.code || "UNKNOWN",
          error.message || "Failed to fetch fuel data",
          response.status === 429,
        );
      }

      const data = (await response.json()) as { result: FlespiMessage[] };
      const message = data.result?.[0];

      if (!message || message.fuel_level === undefined) {
        throw new Error(`No fuel data available for device ${vehicleId}`);
      }

      const normalized: NormalizedFuelReading = {
        externalVehicleId: vehicleId,
        fuelLevel: message.fuel_level,
        fuelUnit: "liters",
        timestamp: new Date(message.timestamp * 1000),
      };

      this.cache.set(cacheKey, normalized, 120000); // 2 min cache
      return normalized;
    });
  }

  /**
   * Subscribe to events via webhook
   * POST /gw/webhooks
   */
  async subscribeToEvents(
    webhookUrl: string,
    eventTypes: string[],
  ): Promise<WebhookSubscription> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/gw/webhooks`, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({
          url: webhookUrl,
          events: eventTypes,
        }),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FlespiAPIError(
          response.status,
          error.code || "UNKNOWN",
          error.message || "Failed to create webhook",
          response.status === 429,
        );
      }

      const data = (await response.json()) as { result: FlespiWebhook };
      const webhook = data.result;

      return {
        webhookId: webhook.id.toString(),
        url: webhook.url,
        events: webhook.events,
        createdAt: new Date(webhook.created * 1000),
      };
    });
  }

  /**
   * Unsubscribe from events
   * DELETE /gw/webhooks/{id}
   */
  async unsubscribeFromEvents(webhookId: string): Promise<void> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/gw/webhooks/${webhookId}`,
        {
          method: "DELETE",
          headers: this.buildHeaders(),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FlespiAPIError(
          response.status,
          error.code || "UNKNOWN",
          error.message || "Failed to delete webhook",
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
          `${this.baseUrl}/gw/devices?limit=1`,
          {
            method: "GET",
            headers: this.buildHeaders(),
          },
        );
        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}`);
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a data channel
   * POST /gw/devices/{id}/channels
   */
  async createChannel(
    deviceId: string,
    protocol: string,
  ): Promise<FlespiChannel> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/gw/devices/${deviceId}/channels`,
        {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify({ protocol }),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FlespiAPIError(
          response.status,
          error.code || "UNKNOWN",
          error.message || "Failed to create channel",
          response.status === 429,
        );
      }

      const data = (await response.json()) as { result: FlespiChannel };
      return data.result;
    });
  }

  /**
   * Create a geofence
   * POST /gw/geofences
   */
  async createGeofence(
    name: string,
    type: "circle" | "polygon",
    shapeData: Record<string, unknown>,
  ): Promise<FlespiGeofence> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/gw/geofences`,
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
        throw new FlespiAPIError(
          response.status,
          error.code || "UNKNOWN",
          error.message || "Failed to create geofence",
          response.status === 429,
        );
      }

      const data = (await response.json()) as { result: FlespiGeofence };
      return data.result;
    });
  }

  /**
   * Create a stream (data forwarding)
   * POST /gw/streams
   */
  async createStream(
    name: string,
    type: string,
    configuration: Record<string, unknown>,
  ): Promise<FlespiStream> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/gw/streams`,
        {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify({
            name,
            type,
            ...configuration,
          }),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FlespiAPIError(
          response.status,
          error.code || "UNKNOWN",
          error.message || "Failed to create stream",
          response.status === 429,
        );
      }

      const data = (await response.json()) as { result: FlespiStream };
      return data.result;
    });
  }

  /**
   * Create a calculator
   * POST /gw/calculators
   */
  async createCalculator(
    deviceId: string,
    calculatorType: string,
  ): Promise<FlespiCalculator> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/gw/calculators`,
        {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify({
            device_id: deviceId,
            type: calculatorType,
            enabled: true,
          }),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FlespiAPIError(
          response.status,
          error.code || "UNKNOWN",
          error.message || "Failed to create calculator",
          response.status === 429,
        );
      }

      const data = (await response.json()) as { result: FlespiCalculator };
      return data.result;
    });
  }

  /**
   * Get aggregated analytics for a device
   * GET /gw/devices/{id}/analytics
   */
  async getAnalytics(deviceId: string): Promise<Record<string, unknown>> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/gw/devices/${deviceId}/analytics`,
        {
          method: "GET",
          headers: this.buildHeaders(),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FlespiAPIError(
          response.status,
          error.code || "UNKNOWN",
          error.message || "Failed to fetch analytics",
          response.status === 429,
        );
      }

      const data = (await response.json()) as { result: Record<string, unknown> };
      return data.result;
    });
  }

  /**
   * Build request headers with Bearer token
   */
  protected buildHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Parse Flespi error response
   */
  protected async parseErrorResponse(
    response: Response,
  ): Promise<{ code: string; message: string }> {
    try {
      const body = (await response.json()) as {
        errors?: Array<{ title: string; detail: string }>;
      };
      if (body.errors && body.errors.length > 0) {
        return {
          code: body.errors[0].title,
          message: body.errors[0].detail,
        };
      }
    } catch {
      // Ignore parse errors
    }
    return {
      code: `HTTP_${response.status}`,
      message: response.statusText,
    };
  }

  /**
   * Normalize Flespi device to NormalizedVehicle
   */
  private normalizeDevice(device: FlespiDevice): NormalizedVehicle {
    return {
      externalVehicleId: device.id.toString(),
      name: device.custom_name || device.name,
      vin: device.ident,
      licensePlate: undefined,
      make: undefined,
      model: undefined,
      year: undefined,
      status: device.status === "online" ? "ACTIVE" : "INACTIVE",
      odometer: undefined,
    };
  }
}
