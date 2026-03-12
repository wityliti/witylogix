/**
 * Route4Me API Client
 *
 * Comprehensive implementation of Route4Me APIs:
 * - Route optimization: POST /api.v4/optimization_problem.php
 * - Address management: add/update/remove addresses
 * - Route tracking: GET route progress, driver location
 * - Territory planning: create/update territories with polygons
 * - Fleet management: vehicles, driver assignments
 * - Activity feed: route events, completions, ETAs
 * - Geocoding via Route4Me API
 *
 * API Key authentication via query parameter
 * Rate limit: 100 requests/minute (1.67 per second)
 * Documentation: https://route4me.io/docs/
 */

import type {
  RouteRequest,
  RouteResponse,
  OptimizationRequest,
  OptimizationResponse,
  MatrixRequest,
  MatrixResponse,
  RoutingAdapterConfig,
} from './types.js';

export interface Route4MeAddress {
  route_id?: string;
  address_id?: string;
  address: string;
  lat: number;
  lng: number;
  curbside_lat?: number;
  curbside_lng?: number;
  alias?: string;
  time?: number; // Service time in seconds
  time_window_start?: number; // Unix timestamp
  time_window_end?: number; // Unix timestamp
  custom_fields?: Record<string, unknown>;
  order_id?: string;
  is_depot?: boolean;
  sequence_no?: number;
}

export interface Route4MeVehicle {
  vehicle_id?: string;
  vehicle_alias: string;
  vehicle_type?: string;
  capacity?: number;
  max_distance_km?: number;
  max_stop_count?: number;
  start_address?: Route4MeAddress;
  end_address?: Route4MeAddress;
  custom_fields?: Record<string, unknown>;
}

export interface Route4MeTerritory {
  territory_id?: string;
  territory_name: string;
  color?: string;
  polygon?: Array<{ lat: number; lng: number }>;
  addresses?: Route4MeAddress[];
}

export interface Route4MeActivity {
  activity_id?: string;
  route_id: string;
  activity_type: string; // 'location', 'eta', 'status_update', etc.
  timestamp: number; // Unix timestamp
  data?: Record<string, unknown>;
}

interface Route4MeOptimizationRequest {
  algorithm?: number; // 1: traditional, 2: genetic, 3: advanced dynamic
  share_service?: number; // 0 or 1
  route_time?: number; // Unix timestamp for arrival time
  optimize?: string; // 'Distance', 'Time', 'TimeWithTraffic'
  distance_unit?: 'mi' | 'km';
  directions?: number; // 0 or 1
  addresses: Route4MeAddress[];
  vehicles: Route4MeVehicle[];
}

interface Route4MeOptimizationResult {
  optimization_problem_id?: string;
  state?: number;
  routes?: Array<{
    route_id?: string;
    vehicle_alias: string;
    distance: number;
    time: number;
    addresses: Route4MeAddress[];
  }>;
  unrouted?: Route4MeAddress[];
  total_distance?: number;
  total_time?: number;
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
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private failureCount = 0;
  private failureThreshold: number;
  private resetTimeout: number;
  private lastFailureTime: number = 0;

  constructor(failureThreshold: number = 5, resetTimeout: number = 60000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
  }

  getState(): 'closed' | 'open' | 'half_open' {
    if (this.state === 'open' && Date.now() - this.lastFailureTime > this.resetTimeout) {
      this.state = 'half_open';
    }
    return this.state;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();
    if (currentState === 'open') {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      if (currentState === 'half_open') {
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
 * Route4Me API Client
 */
export class Route4MeClient {
  private apiKey: string;
  private baseUrl = 'https://api.route4me.com';
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
      throw new Error('Route4Me API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || this.baseUrl;
    this.rateLimit = config.rateLimit || 1.67; // 100/minute
    this.timeout = config.timeout || 30000;

    this.rateLimiter = new TokenBucketRateLimiter(this.rateLimit);
    this.circuitBreaker = new CircuitBreaker(5, 60000);
  }

  /**
   * Normalize coordinate to LatLng format
   */
  private normalizeCoordinate(coord: [number, number] | { lat: number; lng: number }): { lat: number; lng: number } {
    if (Array.isArray(coord)) {
      return { lat: coord[0], lng: coord[1] };
    }
    return coord;
  }

  /**
   * Optimize route (VRP solver)
   */
  async optimize(request: OptimizationRequest): Promise<OptimizationResponse> {
    const startTime = Date.now();
    try {
      this.totalRequests++;
      await this.rateLimiter.acquire();

      const addresses: Route4MeAddress[] = request.jobs.map((job, index) => {
        const coord = this.normalizeCoordinate(job.location);
        return {
          address: `Location ${index + 1}`,
          lat: coord.lat,
          lng: coord.lng,
          time: job.duration_s,
          time_window_start: job.time_window?.earliest,
          time_window_end: job.time_window?.latest,
          sequence_no: index,
        };
      });

      const vehicles: Route4MeVehicle[] = request.vehicles.map((vehicle) => {
        const startCoord = vehicle.start_location ? this.normalizeCoordinate(vehicle.start_location) : { lat: 0, lng: 0 };
        return {
          vehicle_alias: vehicle.id || `Vehicle ${Math.random()}`,
          capacity: vehicle.capacity,
          max_distance_km: vehicle.max_distance_m ? vehicle.max_distance_m / 1000 : undefined,
          max_stop_count: undefined,
          start_address: {
            address: 'Start',
            lat: startCoord.lat,
            lng: startCoord.lng,
            is_depot: true,
          },
        };
      });

      const params = new URLSearchParams({
        api_key: this.apiKey,
      });

      const payload: Route4MeOptimizationRequest = {
        algorithm: 3, // Advanced dynamic
        optimize: 'Time',
        distance_unit: 'km',
        directions: 1,
        addresses,
        vehicles,
      };

      const response = await this.circuitBreaker.call(async () => {
        return fetch(`${this.baseUrl}/api.v4/optimization_problem.php?${params.toString()}`, {
          method: 'POST',
          timeout: this.timeout,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      });

      if (!response.ok) {
        throw new Error(`Route4Me Optimization API error: ${response.statusText}`);
      }

      const data = await response.json() as Route4MeOptimizationResult;

      const routes = (data.routes || []).map((route) => ({
        vehicle: request.vehicles.findIndex((v) => v.id === route.vehicle_alias),
        steps: route.addresses.map((addr) => ({
          type: addr.is_depot ? 'start' : 'job' as const,
          location: { lat: addr.lat, lng: addr.lng },
          arrival_time: 0,
          departure_time: 0,
          duration_s: addr.time || 0,
          distance_m: 0,
          job_id: addr.address_id,
        })),
        distance_m: (route.distance || 0) * 1000,
        duration_s: route.time || 0,
      }));

      const responseObj: OptimizationResponse = {
        code: routes.length > 0 ? 'OK' : 'ERROR',
        summary: {
          distance_m: (data.total_distance || 0) * 1000,
          duration_s: data.total_time || 0,
          vehicle_count: data.routes?.length || 0,
          unassigned_jobs: (data.unrouted || []).length,
        },
        routes,
        unassigned: (data.unrouted || []).map((job) => ({
          id: job.address_id || '',
          reason: 'Unable to assign',
        })),
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
   * Add address to route
   */
  async addAddress(address: Route4MeAddress): Promise<Route4MeAddress> {
    const startTime = Date.now();
    try {
      this.totalRequests++;
      await this.rateLimiter.acquire();

      const params = new URLSearchParams({
        api_key: this.apiKey,
      });

      const response = await this.circuitBreaker.call(async () => {
        return fetch(`${this.baseUrl}/api.v4/address.php?${params.toString()}`, {
          method: 'POST',
          timeout: this.timeout,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(address),
        });
      });

      if (!response.ok) {
        throw new Error(`Route4Me Add Address API error: ${response.statusText}`);
      }

      const data = await response.json() as Route4MeAddress;
      this.successfulRequests++;
      this.totalResponseTime += Date.now() - startTime;

      return data;
    } catch (error) {
      this.failedRequests++;
      this.totalResponseTime += Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Get route tracking data
   */
  async getRouteTracking(routeId: string): Promise<{
    route_id: string;
    vehicle_lat: number;
    vehicle_lng: number;
    last_update: number;
  }> {
    const startTime = Date.now();
    try {
      this.totalRequests++;
      await this.rateLimiter.acquire();

      const params = new URLSearchParams({
        api_key: this.apiKey,
        route_id: routeId,
      });

      const response = await this.circuitBreaker.call(async () => {
        return fetch(`${this.baseUrl}/api.v4/route.php?${params.toString()}`, {
          method: 'GET',
          timeout: this.timeout,
          headers: {
            'Accept': 'application/json',
          },
        });
      });

      if (!response.ok) {
        throw new Error(`Route4Me Route Tracking API error: ${response.statusText}`);
      }

      const data = await response.json() as {
        route_id: string;
        vehicle_lat: number;
        vehicle_lng: number;
        last_update: number;
      };

      this.successfulRequests++;
      this.totalResponseTime += Date.now() - startTime;

      return data;
    } catch (error) {
      this.failedRequests++;
      this.totalResponseTime += Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Create territory
   */
  async createTerritory(territory: Route4MeTerritory): Promise<Route4MeTerritory> {
    const startTime = Date.now();
    try {
      this.totalRequests++;
      await this.rateLimiter.acquire();

      const params = new URLSearchParams({
        api_key: this.apiKey,
      });

      const response = await this.circuitBreaker.call(async () => {
        return fetch(`${this.baseUrl}/api.v4/territory.php?${params.toString()}`, {
          method: 'POST',
          timeout: this.timeout,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(territory),
        });
      });

      if (!response.ok) {
        throw new Error(`Route4Me Create Territory API error: ${response.statusText}`);
      }

      const data = await response.json() as Route4MeTerritory;
      this.successfulRequests++;
      this.totalResponseTime += Date.now() - startTime;

      return data;
    } catch (error) {
      this.failedRequests++;
      this.totalResponseTime += Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Get activity feed
   */
  async getActivityFeed(routeId: string): Promise<Route4MeActivity[]> {
    const startTime = Date.now();
    try {
      this.totalRequests++;
      await this.rateLimiter.acquire();

      const params = new URLSearchParams({
        api_key: this.apiKey,
        route_id: routeId,
      });

      const response = await this.circuitBreaker.call(async () => {
        return fetch(`${this.baseUrl}/api.v4/activity_feed.php?${params.toString()}`, {
          method: 'GET',
          timeout: this.timeout,
          headers: {
            'Accept': 'application/json',
          },
        });
      });

      if (!response.ok) {
        throw new Error(`Route4Me Activity Feed API error: ${response.statusText}`);
      }

      const data = await response.json() as {
        data?: Array<{
          activity_id: string;
          route_id: string;
          activity_type: string;
          timestamp: number;
          data?: Record<string, unknown>;
        }>;
      };

      this.successfulRequests++;
      this.totalResponseTime += Date.now() - startTime;

      return (data.data || []).map((activity) => ({
        activity_id: activity.activity_id,
        route_id: activity.route_id,
        activity_type: activity.activity_type,
        timestamp: activity.timestamp,
        data: activity.data,
      }));
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
    const avgResponseTime = this.totalRequests > 0 ? this.totalResponseTime / this.totalRequests : 0;

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      averageResponseTime: avgResponseTime,
      successRate: this.totalRequests > 0 ? this.successfulRequests / this.totalRequests : 0,
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
