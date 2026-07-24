/**
 * Geotab MyGeotab API SDK (v2)
 * Complete implementation of JSON-RPC 2.0 API for telematics data retrieval
 * Handles authentication, session management, auto-reauthentication, and rate limiting
 */

import type { GeotabCredentials } from "./types.js";

/**
 * Rate limiter for managing API call frequency
 */
class RateLimiter {
  private requestTimes: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(requestsPerSecond: number) {
    this.maxRequests = Math.ceil(requestsPerSecond);
    this.windowMs = 1000;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    // Remove timestamps outside the current window
    this.requestTimes = this.requestTimes.filter(
      (t) => t > now - this.windowMs,
    );

    if (this.requestTimes.length >= this.maxRequests) {
      const oldestTime = this.requestTimes[0];
      const waitTime = this.windowMs - (now - oldestTime) + 1;
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.requestTimes.push(now);
  }
}

/**
 * Geotab API Error
 */
export class GeotabSDKError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "GeotabSDKError";
  }
}

/**
 * JSON-RPC Request/Response types
 */
interface JSONRPCRequest {
  method: string;
  params: Record<string, unknown>;
  id?: number | string;
}

interface JSONRPCResponse<T> {
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: Record<string, unknown>;
  };
  id?: number | string;
}

/**
 * Geotab Device (Vehicle)
 */
export interface GeotabDevice {
  id: string;
  name: string;
  vin?: string;
  licensePlate?: string;
  make?: string;
  model?: string;
  modelYear?: number;
  deviceType: string;
  status?: string;
}

/**
 * Geotab Log Record (GPS Position)
 */
export interface GeotabLogRecord {
  id: string;
  device: { id: string };
  dateTime: string; // ISO 8601
  latitude: number;
  longitude: number;
  speed: number; // km/h
  bearing: number; // degrees 0-360
}

/**
 * Geotab Status Data (Diagnostic readings)
 */
export interface GeotabStatusData {
  id: string;
  device: { id: string };
  diagnostic: { id: string; name: string };
  value: number | string;
  dateTime: string; // ISO 8601
}

/**
 * Geotab Fault Data (DTC codes)
 */
export interface GeotabFaultData {
  id: string;
  device: { id: string };
  code: string;
  description: string;
  dateTime: string;
  dismissDateTime?: string;
}

/**
 * Geotab Trip
 */
export interface GeotabTrip {
  id: string;
  device: { id: string };
  driver?: { id: string };
  startDateTime: string; // ISO 8601
  stopDateTime: string;
  startOdometer: number; // kilometers
  stopOdometer: number;
  distance: number; // kilometers
  drivingDurationMinutes: number;
  stops: number;
}

/**
 * Geotab Zone (Geofence)
 */
export interface GeotabZone {
  id: string;
  name: string;
  comment?: string;
  externalReference?: string;
  centrePoint?: { x: number; y: number }; // lat/lng
  radius?: number; // meters
  activeFrom: string; // ISO 8601
  activeTo: string; // ISO 8601
  points?: Array<{ x: number; y: number }>; // polygon points
}

/**
 * Search criteria for Get* calls
 */
export interface GeotabSearchCriteria {
  fromDate?: Date;
  toDate?: Date;
  deviceSearch?: { id: string };
  userSearch?: { id: string };
}

/**
 * Geotab MyGeotab API SDK Client
 */
export class GeotabSDKClient {
  private baseUrl = "https://my.geotab.com/apiv1";
  private database: string;
  private userName: string;
  private password: string;
  private sessionId?: string;
  private requestId = 0;
  private rateLimiter: RateLimiter;
  private authRateLimiter: RateLimiter;
  private lastAuthTime = 0;
  private authTimeout = 24 * 60 * 60 * 1000; // 24 hours
  private readonly timeout: number;

  constructor(credentials: GeotabCredentials, timeout = 30000) {
    this.database = credentials.database;
    this.userName = credentials.userName;
    this.password = credentials.password;
    this.sessionId = credentials.sessionId;
    this.timeout = timeout;
    // Default: 10 auth calls/min, general API limit higher
    this.authRateLimiter = new RateLimiter(10 / 60);
    this.rateLimiter = new RateLimiter(100);
  }

  /**
   * Authenticate and obtain session ID
   */
  async authenticate(): Promise<string> {
    await this.authRateLimiter.waitIfNeeded();

    const response = await this.jsonrpcCall<{
      sessionId: string;
    }>("Authenticate", {
      database: this.database,
      userName: this.userName,
      password: this.password,
    });

    this.sessionId = response.sessionId;
    this.lastAuthTime = Date.now();
    return response.sessionId;
  }

  /**
   * Get devices (vehicles)
   */
  async getDevices(search?: GeotabSearchCriteria): Promise<GeotabDevice[]> {
    await this.ensureAuthenticated();
    return this.jsonrpcCall<GeotabDevice[]>("Get", {
      typeName: "Device",
      search: this.buildSearch(search),
    });
  }

  /**
   * Get log records (GPS positions) for a device
   */
  async getLogRecords(
    deviceId: string,
    search?: GeotabSearchCriteria,
  ): Promise<GeotabLogRecord[]> {
    await this.ensureAuthenticated();
    return this.jsonrpcCall<GeotabLogRecord[]>("Get", {
      typeName: "LogRecord",
      search: {
        ...this.buildSearch(search),
        deviceSearch: { id: deviceId },
      },
    });
  }

  /**
   * Get status data (engine diagnostics)
   */
  async getStatusData(
    search?: GeotabSearchCriteria,
  ): Promise<GeotabStatusData[]> {
    await this.ensureAuthenticated();
    return this.jsonrpcCall<GeotabStatusData[]>("Get", {
      typeName: "StatusData",
      search: this.buildSearch(search),
    });
  }

  /**
   * Get fault data (DTC codes)
   */
  async getFaultData(
    search?: GeotabSearchCriteria,
  ): Promise<GeotabFaultData[]> {
    await this.ensureAuthenticated();
    return this.jsonrpcCall<GeotabFaultData[]>("Get", {
      typeName: "FaultData",
      search: this.buildSearch(search),
    });
  }

  /**
   * Get trips for a device
   */
  async getTrips(
    deviceId: string,
    search?: GeotabSearchCriteria,
  ): Promise<GeotabTrip[]> {
    await this.ensureAuthenticated();
    return this.jsonrpcCall<GeotabTrip[]>("Get", {
      typeName: "Trip",
      search: {
        ...this.buildSearch(search),
        deviceSearch: { id: deviceId },
      },
    });
  }

  /**
   * Get zones (geofences)
   */
  async getZones(search?: GeotabSearchCriteria): Promise<GeotabZone[]> {
    await this.ensureAuthenticated();
    return this.jsonrpcCall<GeotabZone[]>("Get", {
      typeName: "Zone",
      search: this.buildSearch(search),
    });
  }

  /**
   * Add a new zone (geofence)
   */
  async addZone(zone: Partial<GeotabZone>): Promise<string> {
    await this.ensureAuthenticated();
    const result = await this.jsonrpcCall<string>("Add", {
      typeName: "Zone",
      entity: zone,
    });
    return result;
  }

  /**
   * Set (update) a zone
   */
  async setZone(zone: GeotabZone): Promise<void> {
    await this.ensureAuthenticated();
    await this.jsonrpcCall<void>("Set", {
      typeName: "Zone",
      entity: zone,
    });
  }

  /**
   * Remove a zone
   */
  async removeZone(zoneId: string): Promise<void> {
    await this.ensureAuthenticated();
    await this.jsonrpcCall<void>("Remove", {
      typeName: "Zone",
      entity: { id: zoneId },
    });
  }

  /**
   * Batch call multiple Get requests in parallel (MultiCall)
   */
  async multiCall(
    calls: Array<{ method: string; params: Record<string, unknown> }>,
  ): Promise<unknown[]> {
    await this.ensureAuthenticated();

    const requests = calls.map((call) => ({
      method: call.method,
      params: {
        ...call.params,
        credentials: {
          sessionId: this.sessionId,
          database: this.database,
          userName: this.userName,
          password: this.password,
        },
      },
    }));

    const response = await this.request<unknown[]>("POST", "MultiCall", {
      calls: requests,
    });

    return response;
  }

  /**
   * JSON-RPC 2.0 call with automatic session management
   */
  private async jsonrpcCall<T>(
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    await this.rateLimiter.waitIfNeeded();

    // Add credentials to params
    const enhancedParams = {
      ...params,
      credentials: {
        sessionId: this.sessionId,
        database: this.database,
        userName: this.userName,
        password: this.password,
      },
    };

    return this.request<T>("POST", method, enhancedParams);
  }

  /**
   * Core HTTP request handler
   */
  private async request<T>(
    method: "POST" | "GET",
    endpoint: string,
    data?: Record<string, unknown>,
  ): Promise<T> {
    const requestId = ++this.requestId;
    const body: JSONRPCRequest = {
      method: endpoint,
      params: data || {},
      id: requestId,
    };

    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}`, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      if (!response.ok) {
        const text = await response.text();
        throw new GeotabSDKError(
          "HTTP_ERROR",
          `HTTP ${response.status}: ${text}`,
          response.status,
          response.status >= 500,
        );
      }

      const result = (await response.json()) as JSONRPCResponse<T>;

      if (result.error) {
        // Handle session expiry
        if (
          result.error.code === -2147483648 ||
          result.error.message.includes("InvalidUserException")
        ) {
          this.sessionId = undefined;
          throw new GeotabSDKError(
            "SESSION_EXPIRED",
            "Session expired, re-authentication required",
            undefined,
            true,
          );
        }

        throw new GeotabSDKError(
          `ERROR_${result.error.code}`,
          result.error.message,
          undefined,
          false,
        );
      }

      if (!result.result) {
        throw new GeotabSDKError("NO_RESULT", "API returned no result");
      }

      return result.result as T;
    } catch (error) {
      if (error instanceof GeotabSDKError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new GeotabSDKError(
            "TIMEOUT",
            `Request timeout after ${this.timeout}ms`,
          );
        }

        throw new GeotabSDKError("NETWORK_ERROR", error.message);
      }

      throw new GeotabSDKError("UNKNOWN_ERROR", String(error));
    }
  }

  /**
   * Ensure we have a valid session, re-authenticate if needed
   */
  private async ensureAuthenticated(): Promise<void> {
    // Check if session has expired (24-hour timeout)
    if (!this.sessionId || Date.now() - this.lastAuthTime > this.authTimeout) {
      await this.authenticate();
    }
  }

  /**
   * Build search criteria object
   */
  private buildSearch(search?: GeotabSearchCriteria): Record<string, unknown> {
    if (!search) {
      return {};
    }

    return {
      fromDate: search.fromDate?.toISOString(),
      toDate: search.toDate?.toISOString(),
      deviceSearch: search.deviceSearch,
      userSearch: search.userSearch,
    };
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Clear session (logout)
   */
  clearSession(): void {
    this.sessionId = undefined;
    this.lastAuthTime = 0;
  }
}
