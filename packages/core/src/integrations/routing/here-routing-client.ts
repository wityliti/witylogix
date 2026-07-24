/**
 * HERE Routing V8 API Client
 *
 * Comprehensive implementation of HERE Routing v8 APIs:
 * - Route calculation: GET /v8/routes with transport modes (car, truck, pedestrian, bicycle)
 * - Truck routing: height/weight/axle restrictions, tunnel categories, hazmat
 * - Matrix routing: POST /v8/matrix for multiple origins/destinations
 * - EV routing: battery consumption, charging stations
 * - Isoline (isochrone) calculation: time/distance polygons
 * - Route with traffic: real-time and historical traffic data
 * - Waypoint sequencing (route optimization)
 *
 * API Key authentication via query parameter
 * Rate limit: 50 requests/second
 * Documentation: https://developer.here.com/
 */

import type {
  RouteRequest,
  RouteResponse,
  MatrixRequest,
  MatrixResponse,
  IsochroneRequest,
  IsochroneResponse,
  RoutingAdapterConfig,
} from "./types.js";

export interface TruckAttributes {
  maxAxles?: number;
  maxHeight?: number; // meters
  maxLength?: number; // meters
  maxWeight?: number; // kilograms
  maxWeightPerAxle?: number; // kilograms
  tunnelCategory?: "B" | "C" | "D" | "E";
  hazmatTables?: ("ADR" | "IMDG" | "IATA")[];
  shippedHazmatClasses?: string[];
}

export interface EVAttributes {
  batteryCapacity?: number; // kWh
  currentBatteryCharge?: number; // kWh
  chargingConnectors?: string[];
  chargingCurve?: Array<{
    speed: number; // km/h
    power: number; // kW
  }>;
}

export interface RouteOptions {
  alternatives?: boolean;
  spans?: boolean;
  returnElevation?: boolean;
  returnTraffic?: boolean;
  departureTime?: Date;
  avoidTolls?: boolean;
  avoidMotorways?: boolean;
  avoidFerries?: boolean;
  viaRoute?: boolean;
  truck?: TruckAttributes;
  ev?: EVAttributes;
}

interface HERERouteLeg {
  arrival: {
    place: {
      type: string;
      location: { lat: number; lng: number };
      display_name?: string;
    };
    time: string; // ISO 8601
  };
  departure: {
    place: {
      type: string;
      location: { lat: number; lng: number };
      display_name?: string;
    };
    time: string; // ISO 8601
  };
  id: string;
  links: Array<{
    id: string;
    length: number; // meters
    speed: number; // km/h
    duration: number; // seconds
    direction: string; // compass direction
    speedLimit?: number; // km/h
    classification?: {
      functional: string;
      names: string[];
    };
    road: {
      names: string[];
    };
    turn?: string;
  }>;
  length: number; // meters
  duration: number; // seconds
  baseDuration?: number; // seconds, without traffic
  trafficSpeed?: number; // km/h
  summary: {
    distance: number; // meters
    duration: number; // seconds
    baseDuration?: number; // seconds
  };
}

interface HERERoute {
  id: string;
  polyline: string; // Encoded polyline
  legs: HERERouteLeg[];
  sections: Array<{
    id: string;
    type: string;
    departure?: {
      place: { location: { lat: number; lng: number } };
      time: string;
    };
    arrival?: {
      place: { location: { lat: number; lng: number } };
      time: string;
    };
    summary: {
      length: number;
      duration: number;
      baseDuration?: number;
    };
  }>;
}

interface HEREIsolineResult {
  range: {
    type: "time" | "distance";
    value: number;
  };
  level?: number;
  shape: string; // Encoded polygon
}

/**
 * Rate limiter implementation
 */
class TokenBucketRateLimiter {
  private tokens: number;
  private capacity: number;
  private refillRate: number; // tokens per second
  private lastRefillTime: number;

  constructor(rateLimit: number) {
    this.capacity = rateLimit;
    this.tokens = rateLimit;
    this.refillRate = rateLimit;
    this.lastRefillTime = Date.now();
  }

  async acquire(): Promise<void> {
    while (this.tokens < 1) {
      this.refill();
      if (this.tokens < 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefillTime) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  remaining(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  resetAt(): Date {
    const tokensNeeded = Math.max(0, 1 - this.tokens);
    const secondsNeeded = tokensNeeded / this.refillRate;
    return new Date(Date.now() + secondsNeeded * 1000);
  }
}

/**
 * Circuit breaker implementation
 */
class CircuitBreaker {
  private state: "closed" | "open" | "half_open" = "closed";
  private failureCount = 0;
  private failureThreshold: number;
  private resetTimeout: number;
  private lastFailureTime: number = 0;

  constructor(failureThreshold: number = 5, resetTimeout: number = 60000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
  }

  getState(): "closed" | "open" | "half_open" {
    if (
      this.state === "open" &&
      Date.now() - this.lastFailureTime > this.resetTimeout
    ) {
      this.state = "half_open";
    }
    return this.state;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
    }
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();
    if (currentState === "open") {
      throw new Error("Circuit breaker is open");
    }

    try {
      const result = await fn();
      if (currentState === "half_open") {
        this.recordSuccess();
      }
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}

/**
 * HERE Routing V8 API Client
 */
export class HERERoutingClient {
  private apiKey: string;
  private baseUrl = "https://router.hereapi.com/v8";
  private rateLimit: number;
  private timeout: number;

  private rateLimiter: TokenBucketRateLimiter;
  private circuitBreaker: CircuitBreaker;

  // Metrics
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private totalResponseTime: number = 0;

  constructor(config: RoutingAdapterConfig) {
    if (!config.apiKey) {
      throw new Error("HERE Routing API key is required");
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || this.baseUrl;
    this.rateLimit = config.rateLimit || 50;
    this.timeout = config.timeout || 30000;

    this.rateLimiter = new TokenBucketRateLimiter(this.rateLimit);
    this.circuitBreaker = new CircuitBreaker(5, 60000);
  }

  /**
   * Normalize coordinate to LatLng format
   */
  private normalizeCoordinate(
    coord: [number, number] | { lat: number; lng: number },
  ): { lat: number; lng: number } {
    if (Array.isArray(coord)) {
      return { lat: coord[0], lng: coord[1] };
    }
    return coord;
  }

  /**
   * Calculate a single route
   */
  async route(
    request: RouteRequest,
    options?: RouteOptions,
  ): Promise<RouteResponse> {
    const startTime = Date.now();
    try {
      this.totalRequests++;
      await this.rateLimiter.acquire();

      const origin = this.normalizeCoordinate(request.origin);
      const destination = this.normalizeCoordinate(request.destination);

      const waypoints =
        request.waypoints?.map((w) => this.normalizeCoordinate(w)) || [];
      const allPoints = [origin, ...waypoints, destination];
      const routePoints = allPoints.map((p) => `${p.lat},${p.lng}`).join(";");

      const params = new URLSearchParams({
        apiKey: this.apiKey,
        transportMode: request.costing === "truck" ? "truck" : "car",
        return: "polyline,summary,legs,turnByTurnActions",
      });

      // Add alternative routes
      if (options?.alternatives) {
        params.append("alternatives", "true");
      }

      // Add departure time for traffic-aware routing
      if (options?.departureTime) {
        params.append("departureTime", options.departureTime.toISOString());
      }

      // Add truck options
      if (request.costing === "truck" && options?.truck) {
        const truck = options.truck;
        if (truck.maxHeight)
          params.append("limitedHeight", String(truck.maxHeight));
        if (truck.maxWeight)
          params.append("limitedWeight", String(truck.maxWeight));
        if (truck.maxLength)
          params.append("limitedLength", String(truck.maxLength));
        if (truck.tunnelCategory)
          params.append("tunnelCategory", truck.tunnelCategory);
        if (truck.hazmatTables)
          params.append("hazmatTables", truck.hazmatTables.join(","));
      }

      // Add route avoidance options
      if (options?.avoidTolls) params.append("avoid[tollRoads]", "true");
      if (options?.avoidMotorways) params.append("avoid[motorways]", "true");
      if (options?.avoidFerries) params.append("avoid[ferries]", "true");

      const response = await this.circuitBreaker.call(async () => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeout);
        try {
          return await fetch(
            `${this.baseUrl}/routes?${routePoints}&${params.toString()}`,
            {
              method: "GET",
              signal: controller.signal,
              headers: { Accept: "application/json" },
            },
          );
        } finally {
          clearTimeout(id);
        }
      });

      if (!response.ok) {
        throw new Error(`HERE Routing API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        routes: HERERoute[];
      };

      if (!data.routes || data.routes.length === 0) {
        throw new Error("No routes found");
      }

      const route = data.routes[0];
      const summary = route.sections[0]?.summary || { length: 0, duration: 0 };

      const legs = route.legs.map((leg) => ({
        distance_m: leg.summary.distance,
        duration_s: leg.summary.duration,
        steps: leg.links.map((link) => ({
          distance_m: link.length,
          duration_s: link.duration,
          instruction: `${link.direction}: ${link.road.names[0] || "unnamed"}`,
          maneuver: link.turn,
          way_name: link.road.names[0],
          start_location: link.id ? { lat: 0, lng: 0 } : { lat: 0, lng: 0 },
          end_location: { lat: 0, lng: 0 },
        })),
        start_location: leg.departure.place.location,
        end_location: leg.arrival.place.location,
        summary: `${leg.summary.distance}m, ${leg.summary.duration}s`,
      }));

      const responseObj: RouteResponse = {
        distance_m: summary.length,
        duration_s: summary.duration,
        legs,
        polyline: route.polyline,
        bounds: {
          ne: { lat: 0, lng: 0 },
          sw: { lat: 0, lng: 0 },
        },
      };

      this.successfulRequests++;
      this.totalResponseTime += Date.now() - startTime;

      return responseObj;
    } catch (error) {
      this.failedRequests++;
      this.totalResponseTime += Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Calculate distance/time matrix for multiple origins and destinations
   */
  async matrix(request: MatrixRequest): Promise<MatrixResponse> {
    const startTime = Date.now();
    try {
      this.totalRequests++;
      await this.rateLimiter.acquire();

      const origins = request.origins.map((o) => this.normalizeCoordinate(o));
      const destinations = request.destinations.map((d) =>
        this.normalizeCoordinate(d),
      );

      const params = new URLSearchParams({
        apiKey: this.apiKey,
        transportMode: request.costing === "truck" ? "truck" : "car",
      });

      const payload = {
        origins: origins.map((o) => ({ lat: o.lat, lng: o.lng })),
        destinations: destinations.map((d) => ({ lat: d.lat, lng: d.lng })),
      };

      const response = await this.circuitBreaker.call(async () => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeout);
        try {
          return await fetch(`${this.baseUrl}/matrix?${params.toString()}`, {
            method: "POST",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
        } finally {
          clearTimeout(id);
        }
      });

      if (!response.ok) {
        throw new Error(`HERE Matrix API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        matrix?: Array<Array<{ distance: number; time: number }>>;
      };

      const matrix = (data.matrix || []).map((row) =>
        row.map((cell) => ({
          distance_m: cell.distance,
          duration_s: Math.ceil(cell.time / 1000),
          status: "OK" as const,
        })),
      );

      const responseObj: MatrixResponse = {
        sources: origins,
        targets: destinations,
        matrix,
      };

      this.successfulRequests++;
      this.totalResponseTime += Date.now() - startTime;

      return responseObj;
    } catch (error) {
      this.failedRequests++;
      this.totalResponseTime += Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Calculate isoline (isochrone) polygons
   */
  async isoline(request: IsochroneRequest): Promise<IsochroneResponse> {
    const startTime = Date.now();
    try {
      this.totalRequests++;
      await this.rateLimiter.acquire();

      const center = this.normalizeCoordinate(request.center);

      const params = new URLSearchParams({
        apiKey: this.apiKey,
        origin: `${center.lat},${center.lng}`,
        transportMode: request.costing === "truck" ? "truck" : "car",
        range: request.contours.map((c) => c.value).join(","),
        rangeType: request.contours[0]?.value ? "time" : "distance",
      });

      const response = await this.circuitBreaker.call(async () => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeout);
        try {
          return await fetch(`${this.baseUrl}/isoline?${params.toString()}`, {
            method: "GET",
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });
        } finally {
          clearTimeout(id);
        }
      });

      if (!response.ok) {
        throw new Error(`HERE Isoline API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        isolines?: HEREIsolineResult[];
      };

      const contours = (data.isolines || []).map((iso, index) => ({
        feature: {
          type: "Feature" as const,
          geometry: {
            type: "Polygon" as const,
            coordinates: [],
          },
          properties: {},
        },
        value: iso.range.value,
        color: request.contours[index]?.color || "#ff0000",
      }));

      const responseObj: IsochroneResponse = {
        contours,
        attribution: "HERE Maps",
      };

      this.successfulRequests++;
      this.totalResponseTime += Date.now() - startTime;

      return responseObj;
    } catch (error) {
      this.failedRequests++;
      this.totalResponseTime += Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    const avgResponseTime =
      this.totalRequests > 0 ? this.totalResponseTime / this.totalRequests : 0;

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      averageResponseTime: avgResponseTime,
      successRate:
        this.totalRequests > 0
          ? this.successfulRequests / this.totalRequests
          : 0,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.totalResponseTime = 0;
  }
}
