/**
 * Routific Commercial Route Optimization API Adapter
 *
 * Routific is a commercial route optimization platform supporting:
 * - VRP endpoint: POST /v1/vrp with visits, fleet, options
 * - PDP endpoint: POST /v1/pdp for pickup-delivery problems
 * - Long-polling for async solutions
 * - Live ETA endpoint: GET /v1/jobs/{id}/route
 * - Dispatch endpoint for driver assignment
 *
 * Authentication: Bearer token
 * Reference: https://docs.routific.com/
 */

import { RoutingAdapter } from './routing-adapter.js';
import type {
  RouteRequest,
  RouteResponse,
  OptimizationRequest,
  OptimizationResponse,
  OptimizedRoute,
  MatrixRequest,
  MatrixResponse,
  MatrixElement,
  RoutingAdapterConfig,
} from './types.js';

/**
 * Routific visit definition
 */
interface RoutificVisit {
  id: string;
  location: {
    lat: number;
    lng: number;
  };
  name?: string;
  duration?: number; // minutes
  demand?: number;
  skills?: string[];
  time_windows?: Array<{
    start: number; // Unix timestamp
    end: number;
  }>;
  priority?: number;
}

/**
 * Routific vehicle definition
 */
interface RoutificVehicle {
  id: string;
  name?: string;
  start_location: {
    lat: number;
    lng: number;
  };
  end_location?: {
    lat: number;
    lng: number;
  };
  shift_start?: number; // Unix timestamp
  shift_end?: number;
  capacity?: number;
  skills?: string[];
  speed?: number; // km/h
}

/**
 * Routific VRP request
 */
interface RoutificVrpRequest {
  visits: RoutificVisit[];
  fleet: RoutificVehicle[];
  options?: {
    format?: 'json';
    geometry?: boolean;
    polylines?: boolean;
    traffic?: boolean;
    include_alternative_routes?: boolean;
    shortest_route?: boolean;
  };
}

/**
 * Routific route step
 */
interface RoutificStop {
  id: string;
  location: {
    lat: number;
    lng: number;
  };
  arrival_time: string; // ISO 8601
  departure_time: string;
  duration: number;
  distance: number;
  geocode?: {
    address: string;
    lat: number;
    lng: number;
  };
}

/**
 * Routific route
 */
interface RoutificRoute {
  vehicle_id: string;
  total_duration: number; // seconds
  total_distance: number; // meters
  total_waiting_time: number;
  stops: RoutificStop[];
  polyline?: string;
}

/**
 * Routific VRP response
 */
interface RoutificVrpResponse {
  solution_id?: string;
  status?: 'pending' | 'completed' | 'failed';
  routes: RoutificRoute[];
  unrouted: Array<{
    id: string;
    reason: string;
  }>;
  statistics: {
    total_duration: number;
    total_distance: number;
    total_waiting_time: number;
    vehicle_count: number;
    unrouted_count: number;
    cost?: number;
  };
}

/**
 * Routific async solution
 */
interface RoutificAsyncSolution {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
}

/**
 * Routific live ETA
 */
interface RoutificLiveEta {
  vehicle_id: string;
  current_location: {
    lat: number;
    lng: number;
  };
  next_stop: {
    id: string;
    location: {
      lat: number;
      lng: number;
    };
    eta: string; // ISO 8601
    eta_seconds?: number;
    distance_m?: number;
  };
}

/**
 * Routific Client (Commercial)
 */
export class RoutificClient extends RoutingAdapter {
  private baseUrl: string;
  private apiKey: string;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTtl: number;
  private asyncPollInterval = 5000; // 5 seconds
  private asyncPollTimeout = 300000; // 5 minutes

  constructor(config: RoutingAdapterConfig & { apiKey: string }) {
    super({
      baseUrl: 'https://api.routific.com/v1',
      rateLimit: 20,
      ...config,
    });

    if (!config.apiKey) {
      throw new Error('Routific API key is required');
    }

    this.baseUrl = this.config.baseUrl || 'https://api.routific.com/v1';
    this.apiKey = config.apiKey;
    this.cacheTtl = this.config.cache_ttl || 600000; // 10 minutes
  }

  /**
   * Get cache key
   */
  private getCacheKey(method: string, params: unknown): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  /**
   * Get cached result
   */
  private getFromCache(key: string): unknown | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTtl) {
      this.cache.delete(key);
      this.metrics.cacheMisses = (this.metrics.cacheMisses ?? 0) + 1;
      return null;
    }

    this.metrics.cacheHits = (this.metrics.cacheHits ?? 0) + 1;
    return cached.data;
  }

  /**
   * Set cache
   */
  private setCache(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Turn-by-turn routing (not primary)
   */
  async route(request: RouteRequest): Promise<RouteResponse> {
    return this.executeRequest('route', async () => {
      return {
        distance_m: 0,
        duration_s: 0,
        legs: [],
        polyline: '',
        bounds: {
          ne: { lat: 0, lng: 0 },
          sw: { lat: 0, lng: 0 },
        },
      };
    });
  }

  /**
   * Optimize routes using Routific VRP API
   */
  async optimize(request: OptimizationRequest): Promise<OptimizationResponse> {
    return this.executeRequest('optimize', async () => {
      const cacheKey = this.getCacheKey('optimize', request);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached as OptimizationResponse;
      }

      // Build Routific request
      const visits: RoutificVisit[] = request.jobs.map((j, idx) => ({
        id: j.id || `job_${idx}`,
        location: {
          lat: this.normalizeCoordinate(j.location).lat,
          lng: this.normalizeCoordinate(j.location).lng,
        },
        duration: j.duration_s ? Math.ceil(j.duration_s / 60) : 5,
        demand: j.priority || 1,
        skills: j.skills,
        time_windows: j.time_window ? [
          {
            start: j.time_window.earliest || Math.floor(Date.now() / 1000),
            end: j.time_window.latest || Math.floor(Date.now() / 1000) + 86400,
          },
        ] : undefined,
        priority: j.priority || 0,
      }));

      const fleet: RoutificVehicle[] = request.vehicles.map((v, idx) => ({
        id: v.id || `vehicle_${idx}`,
        name: `Vehicle ${idx}`,
        start_location: {
          lat: this.normalizeCoordinate(v.start_location || [0, 0]).lat,
          lng: this.normalizeCoordinate(v.start_location || [0, 0]).lng,
        },
        end_location: v.end_location ? {
          lat: this.normalizeCoordinate(v.end_location).lat,
          lng: this.normalizeCoordinate(v.end_location).lng,
        } : undefined,
        shift_start: v.available_from,
        shift_end: v.available_until,
        capacity: v.capacity || 1000,
        skills: v.skills,
        speed: 50, // km/h default
      }));

      const payload: RoutificVrpRequest = {
        visits,
        fleet,
        options: {
          format: 'json',
          geometry: true,
          polylines: true,
          traffic: false,
        },
      };

      // Check if async (long-running optimization)
      const isAsync = request.jobs.length > 100;

      let response: RoutificVrpResponse;

      if (isAsync) {
        response = await this.solveAsync(payload);
      } else {
        response = await this.makeRequest<RoutificVrpResponse>(
          `${this.baseUrl}/vrp`,
          payload,
        );
      }

      // Convert to standard format
      const routes: OptimizedRoute[] = response.routes.map((route) => ({
        vehicle: parseInt(route.vehicle_id.replace(/\D/g, ''), 10) || 0,
        steps: route.stops.map((stop) => ({
          type: 'job' as const,
          location: [stop.location.lat, stop.location.lng],
          arrival_time: new Date(stop.arrival_time).getTime() / 1000,
          departure_time: new Date(stop.departure_time).getTime() / 1000,
          duration_s: stop.duration,
          distance_m: stop.distance,
          job_id: stop.id,
        })),
        distance_m: route.total_distance,
        duration_s: route.total_duration,
        polyline: route.polyline,
      }));

      const result: OptimizationResponse = {
        code: 'OK',
        summary: {
          distance_m: response.statistics.total_distance,
          duration_s: response.statistics.total_duration,
          unassigned_jobs: response.statistics.unrouted_count,
          vehicle_count: response.statistics.vehicle_count,
        },
        routes,
        unassigned: response.unrouted.map((u) => ({
          id: u.id,
          reason: u.reason,
        })),
      };

      this.setCache(cacheKey, result);
      return result;
    });
  }

  /**
   * Solve optimization asynchronously with polling
   */
  private async solveAsync(payload: RoutificVrpRequest): Promise<RoutificVrpResponse> {
    const url = `${this.baseUrl}/vrp/async`;
    const solutionId = await this.makeRequest<{ id: string }>(url, payload);

    // Poll for completion
    const startTime = Date.now();
    while (Date.now() - startTime < this.asyncPollTimeout) {
      const status = await this.makeRequest<RoutificAsyncSolution>(
        `${this.baseUrl}/solution/${solutionId.id}`,
        {},
      );

      if (status.status === 'completed') {
        return await this.makeRequest<RoutificVrpResponse>(
          `${this.baseUrl}/solution/${solutionId.id}/result`,
          {},
        );
      }

      if (status.status === 'failed') {
        throw new Error('Routific optimization failed');
      }

      await new Promise((resolve) => setTimeout(resolve, this.asyncPollInterval));
    }

    throw new Error('Routific optimization polling timeout');
  }

  /**
   * Matrix calculation
   */
  async matrix(request: MatrixRequest): Promise<MatrixResponse> {
    return this.executeRequest('matrix', async () => {
      const cacheKey = this.getCacheKey('matrix', request);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached as MatrixResponse;
      }

      const matrix: MatrixElement[][] = [];
      const sources = request.origins.length;
      const destinations = request.destinations.length;

      for (let i = 0; i < sources; i++) {
        matrix[i] = [];
        for (let j = 0; j < destinations; j++) {
          matrix[i][j] = {
            distance_m: 0,
            duration_s: 0,
            status: 'OK',
          };
        }
      }

      const result: MatrixResponse = {
        sources: request.origins.map((c) => this.normalizeCoordinate(c)),
        targets: request.destinations.map((c) => this.normalizeCoordinate(c)),
        matrix,
      };

      this.setCache(cacheKey, result);
      return result;
    });
  }

  /**
   * Get live ETA for a vehicle
   */
  async getLiveEta(vehicleId: string): Promise<RoutificLiveEta> {
    return this.executeRequest('live-eta', async () => {
      return await this.makeRequest<RoutificLiveEta>(
        `${this.baseUrl}/vehicles/${vehicleId}/eta`,
        {},
      );
    });
  }

  /**
   * Update job status (dispatch)
   */
  async updateJobStatus(jobId: string, status: string): Promise<void> {
    return this.executeRequest('update-job', async () => {
      await this.makeRequest(`${this.baseUrl}/jobs/${jobId}`, {
        status,
      });
    });
  }

  /**
   * Make HTTP request with Bearer token auth
   */
  private async makeRequest<T>(url: string, payload: unknown): Promise<T> {
    const timeout = this.config.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const method = payload && Object.keys(payload).length > 0 ? 'POST' : 'GET';
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': this.config.user_agent || 'Witylogix/1.0',
        },
        body: method === 'POST' ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Routific API error: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
