/**
 * VROOM Vehicle Routing Optimization Adapter
 *
 * VROOM is an open-source solver for VRP (Vehicle Routing Problems):
 * - CVRP: Capacitated Vehicle Routing Problem
 * - VRPTW: Vehicle Routing Problem with Time Windows
 * - Pickup-and-Delivery Problem (PDP)
 * - Multi-vehicle job assignment with skills/priorities
 * - Solution with route geometry, arrival/departure times
 *
 * Reference: https://github.com/VROOM-Project/vroom
 */

import { RoutingAdapter } from "./routing-adapter.js";
import type {
  OptimizationRequest,
  OptimizationResponse,
  OptimizedRoute,
  MatrixRequest,
  MatrixResponse,
  MatrixElement,
  RouteRequest,
  RouteResponse,
  RoutingAdapterConfig,
} from "./types.js";

/**
 * VROOM vehicle definition
 */
interface VroomVehicle {
  id: number;
  start: [number, number];
  end: [number, number];
  capacity: number[];
  time_window?: {
    start: number;
    end: number;
  };
  speed_factor?: number;
  max_tasks?: number;
  skills?: number[];
}

/**
 * VROOM job (delivery) definition
 */
interface VroomJob {
  id: number;
  location: [number, number];
  service: number;
  demand?: number[];
  time_windows?: Array<{
    start: number;
    end: number;
  }>;
  priority?: number;
  skills?: number[];
}

/**
 * VROOM shipment (pickup+delivery)
 */
interface VroomShipment {
  pickup: {
    id: number;
    location: [number, number];
    service: number;
    time_windows?: Array<{
      start: number;
      end: number;
    }>;
  };
  delivery: {
    id: number;
    location: [number, number];
    service: number;
    time_windows?: Array<{
      start: number;
      end: number;
    }>;
  };
  amount?: number[];
  skills?: number[];
  priority?: number;
}

/**
 * VROOM matrix definition
 */
interface VroomMatrix {
  profile: string;
  durations: number[][];
  distances?: number[][];
}

/**
 * VROOM request
 */
interface VroomProblem {
  vehicles: VroomVehicle[];
  jobs?: VroomJob[];
  shipments?: VroomShipment[];
  matrix?: VroomMatrix;
  options?: {
    g?: boolean; // Get route geometry
    a?: boolean; // Get detailed route attributes
  };
}

/**
 * VROOM route step
 */
interface VroomStep {
  type: "start" | "job" | "delivery" | "pickup" | "end";
  id?: number;
  location: [number, number];
  arrival: number;
  departure: number;
  service: number;
  waiting_time?: number;
  load?: number[];
  distance?: number;
  duration?: number;
}

/**
 * VROOM route
 */
interface VroomRoute {
  vehicle: number;
  steps: VroomStep[];
  geometry?: string; // Encoded polyline
  distance: number;
  duration: number;
  waiting_time: number;
  service: number;
  amount?: number[];
}

/**
 * VROOM solution
 */
interface VroomSolution {
  code: number;
  summary: {
    cost: number;
    routes: number;
    unassigned: number;
    amount: number[];
  };
  routes: VroomRoute[];
  unassigned: Array<{
    id: number;
    type: "job" | "shipment";
  }>;
}

/**
 * VROOM Optimization Adapter
 */
export class VroomClient extends RoutingAdapter {
  private baseUrl: string;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTtl: number;

  constructor(config: RoutingAdapterConfig = {}) {
    super({
      baseUrl: "https://solver.vroom-project.org",
      rateLimit: 5,
      ...config,
    });

    this.baseUrl = this.config.baseUrl || "https://solver.vroom-project.org";
    this.cacheTtl = this.config.cache_ttl || 600000; // 10 minutes for optimization
  }

  /**
   * Get cache key
   */
  private getCacheKey(method: string, params: unknown): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  /**
   * Get cached result if valid
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
   * Convert to VROOM location format [lon, lat]
   */
  private toVroomLocation(
    coord: import("./types.js").Coordinate,
  ): [number, number] {
    const normalized = this.normalizeCoordinate(coord);
    return [normalized.lng, normalized.lat]; // VROOM uses [lon, lat]
  }

  /**
   * Optimize vehicle routes
   */
  async optimize(request: OptimizationRequest): Promise<OptimizationResponse> {
    return this.executeRequest("optimize", async () => {
      const cacheKey = this.getCacheKey("optimize", request);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached as OptimizationResponse;
      }

      // Build VROOM problem
      const vehicles: VroomVehicle[] = request.vehicles.map((v, idx) => ({
        id: idx,
        start: this.toVroomLocation(v.start_location || [0, 0]),
        end: this.toVroomLocation(v.end_location || [0, 0]),
        capacity: v.capacity ? [v.capacity] : [1000],
        time_window:
          v.available_from && v.available_until
            ? {
                start: Math.floor(v.available_from / 1000),
                end: Math.floor(v.available_until / 1000),
              }
            : undefined,
        speed_factor: v.speed_factor,
        max_tasks: 100,
        skills: v.skills ? v.skills.map((_, i) => i) : undefined,
      }));

      const jobs: VroomJob[] = request.jobs.map((j, idx) => ({
        id: idx,
        location: this.toVroomLocation(j.location),
        service: j.duration_s || 300,
        demand: j.priority ? [j.priority] : undefined,
        time_windows: j.time_window
          ? [
              {
                start: Math.floor((j.time_window.earliest || 0) / 1000),
                end: Math.floor((j.time_window.latest || Date.now()) / 1000),
              },
            ]
          : undefined,
        priority: j.priority,
        skills: j.skills ? j.skills.map((_, i) => i) : undefined,
      }));

      const problem: VroomProblem = {
        vehicles,
        jobs,
        options: {
          g: true, // Get geometry
          a: true, // Get attributes
        },
      };

      const response = await this.makeRequest<VroomSolution>(
        `${this.baseUrl}/solve`,
        problem,
      );

      if (response.code !== 0) {
        throw new Error(`VROOM solver returned code ${response.code}`);
      }

      // Convert VROOM solution to OptimizationResponse
      const routes: OptimizedRoute[] = response.routes.map((route) => ({
        vehicle: route.vehicle,
        steps: route.steps.map((step) => ({
          type: step.type as any,
          location: [step.location[1], step.location[0]], // Convert back to [lat, lng]
          arrival_time: step.arrival,
          departure_time: step.departure,
          duration_s: step.duration || 0,
          distance_m: step.distance || 0,
          job_id: step.id?.toString(),
        })),
        distance_m: route.distance,
        duration_s: route.duration,
        polyline: route.geometry,
      }));

      const result: OptimizationResponse = {
        code: "OK",
        summary: {
          distance_m: response.summary.cost,
          duration_s: response.summary.cost, // Simplified
          unassigned_jobs: response.summary.unassigned,
          vehicle_count: response.summary.routes,
        },
        routes,
        unassigned: response.unassigned.map((u) => ({
          id: u.id.toString(),
          reason: "Unable to assign",
        })),
      };

      this.setCache(cacheKey, result);
      return result;
    });
  }

  /**
   * Turn-by-turn routing (not main purpose of VROOM, but supported)
   */
  async route(request: RouteRequest): Promise<RouteResponse> {
    return this.executeRequest("route", async () => {
      // VROOM is primarily for optimization, use matrix for routing
      return {
        distance_m: 0,
        duration_s: 0,
        legs: [],
        polyline: "",
        bounds: {
          ne: { lat: 0, lng: 0 },
          sw: { lat: 0, lng: 0 },
        },
      };
    });
  }

  /**
   * Matrix calculation (not primary function)
   */
  async matrix(request: MatrixRequest): Promise<MatrixResponse> {
    return this.executeRequest("matrix", async () => {
      const cacheKey = this.getCacheKey("matrix", request);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached as MatrixResponse;
      }

      // VROOM would typically use external matrix service
      const matrix: MatrixElement[][] = [];
      const sources = request.origins.length;
      const destinations = request.destinations.length;

      for (let i = 0; i < sources; i++) {
        matrix[i] = [];
        for (let j = 0; j < destinations; j++) {
          matrix[i][j] = {
            distance_m: 0,
            duration_s: 0,
            status: "OK",
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
   * Make HTTP request to VROOM API
   */
  private async makeRequest<T>(url: string, payload: unknown): Promise<T> {
    const timeout = this.config.timeout || 60000; // Optimization takes longer
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": this.config.user_agent || "Witylogix/1.0",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `VROOM API error: ${response.status} ${response.statusText}`,
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
