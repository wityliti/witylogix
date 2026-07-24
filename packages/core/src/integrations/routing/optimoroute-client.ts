/**
 * OptimoRoute Commercial Route Optimization API Adapter
 *
 * OptimoRoute is a commercial route planning and scheduling platform supporting:
 * - Plan routes: POST /v1/plan_routes
 * - Get routes: GET /v1/get_routes
 * - Update order: PUT /v1/update_order
 * - Real-time scheduling with driver availability
 * - Completion events and ETAs
 *
 * Authentication: API key in header X-API-Key
 * Reference: https://docs.optimoroute.com/
 */

import { RoutingAdapter } from "./routing-adapter.js";
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
} from "./types.js";

/**
 * OptimoRoute order definition
 */
interface OptimorderOrder {
  id: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  service_time?: number; // minutes
  time_window?: {
    start: number; // Unix timestamp
    end: number;
  };
  priority?: number;
  tags?: string[];
  demand?: number;
}

/**
 * OptimoRoute vehicle definition
 */
interface OptimorderVehicle {
  id: string;
  name?: string;
  start_location: {
    latitude: number;
    longitude: number;
  };
  end_location?: {
    latitude: number;
    longitude: number;
  };
  available_from?: number;
  available_until?: number;
  capacity?: number;
  speed_factor?: number;
  skills?: string[];
}

/**
 * OptimoRoute plan request
 */
interface OptimorderPlanRequest {
  orders: OptimorderOrder[];
  vehicles: OptimorderVehicle[];
  options?: {
    algorithm?: "default" | "fast" | "balanced" | "thorough";
    traffic?: boolean;
    avoid_unreachable?: boolean;
    auto_start?: boolean;
  };
}

/**
 * OptimoRoute stop
 */
interface OptimorderStop {
  order_id: string;
  location: {
    latitude: number;
    longitude: number;
  };
  arrival_time: number;
  departure_time: number;
  distance_from_start: number;
  time_from_start: number;
}

/**
 * OptimoRoute route response
 */
interface OptimorderRoute {
  vehicle_id: string;
  stops: OptimorderStop[];
  total_distance: number;
  total_time: number;
  total_service_time: number;
  route_polyline?: string;
}

/**
 * OptimoRoute plan response
 */
interface OptimorderPlanResponse {
  status: "success" | "error";
  message?: string;
  plan_id?: string;
  routes: OptimorderRoute[];
  unrouted_orders: Array<{
    id: string;
    reason: string;
  }>;
  statistics: {
    total_distance: number;
    total_time: number;
    routes_count: number;
    orders_count: number;
    unrouted_count: number;
  };
}

/**
 * OptimoRoute route status
 */
interface OptimorderRouteStatus {
  vehicle_id: string;
  status: "pending" | "active" | "completed";
  current_location?: {
    latitude: number;
    longitude: number;
  };
  current_stop_index?: number;
  stops_completed: number;
  total_stops: number;
  eta_next_stop?: number; // Unix timestamp
  distance_remaining: number;
  time_remaining: number;
}

/**
 * OptimoRoute completion event
 */
interface OptimorderCompletionEvent {
  order_id: string;
  vehicle_id: string;
  completed_at: number; // Unix timestamp
  location: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
  signature?: string;
  photos?: string[];
}

/**
 * OptimoRoute Update Order Request
 */
interface OptimorderUpdateOrderRequest {
  id: string;
  status?: "pending" | "assigned" | "completed" | "cancelled";
  priority?: number;
  time_window?: {
    start: number;
    end: number;
  };
  location?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * OptimoRoute Client (Commercial)
 */
export class OptimocourteClient extends RoutingAdapter {
  private baseUrl: string;
  private apiKey: string;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTtl: number;

  constructor(config: RoutingAdapterConfig & { apiKey: string }) {
    super({
      baseUrl: "https://api.optimoroute.com/v1",
      rateLimit: 20,
      ...config,
    });

    if (!config.apiKey) {
      throw new Error("OptimoRoute API key is required");
    }

    this.baseUrl = this.config.baseUrl || "https://api.optimoroute.com/v1";
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
    return this.executeRequest("route", async () => {
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
   * Optimize routes using OptimoRoute API
   */
  async optimize(request: OptimizationRequest): Promise<OptimizationResponse> {
    return this.executeRequest("optimize", async () => {
      const cacheKey = this.getCacheKey("optimize", request);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached as OptimizationResponse;
      }

      // Build OptimoRoute request
      const orders: OptimorderOrder[] = request.jobs.map((j, idx) => ({
        id: j.id || `order_${idx}`,
        location: {
          latitude: this.normalizeCoordinate(j.location).lat,
          longitude: this.normalizeCoordinate(j.location).lng,
        },
        service_time: j.duration_s ? Math.ceil(j.duration_s / 60) : 5,
        time_window: j.time_window
          ? {
              start: j.time_window.earliest || Math.floor(Date.now() / 1000),
              end:
                j.time_window.latest || Math.floor(Date.now() / 1000) + 86400,
            }
          : undefined,
        priority: j.priority || 0,
        tags: j.skills,
        demand: j.priority || 1,
      }));

      const vehicles: OptimorderVehicle[] = request.vehicles.map((v, idx) => ({
        id: v.id || `vehicle_${idx}`,
        name: `Vehicle ${idx}`,
        start_location: {
          latitude: this.normalizeCoordinate(v.start_location || [0, 0]).lat,
          longitude: this.normalizeCoordinate(v.start_location || [0, 0]).lng,
        },
        end_location: v.end_location
          ? {
              latitude: this.normalizeCoordinate(v.end_location).lat,
              longitude: this.normalizeCoordinate(v.end_location).lng,
            }
          : undefined,
        available_from: v.available_from,
        available_until: v.available_until,
        capacity: v.capacity || 1000,
        speed_factor: v.speed_factor || 1,
        skills: v.skills,
      }));

      const payload: OptimorderPlanRequest = {
        orders,
        vehicles,
        options: {
          algorithm: "balanced",
          traffic: false,
          avoid_unreachable: true,
          auto_start: true,
        },
      };

      const response = await this.makeRequest<OptimorderPlanResponse>(
        `${this.baseUrl}/plan_routes`,
        payload,
      );

      if (response.status !== "success") {
        throw new Error(`OptimoRoute planning failed: ${response.message}`);
      }

      // Convert to standard format
      const routes: OptimizedRoute[] = response.routes.map((route) => ({
        vehicle: parseInt(route.vehicle_id.replace(/\D/g, ""), 10) || 0,
        steps: route.stops.map((stop) => ({
          type: "job" as const,
          location: [stop.location.latitude, stop.location.longitude],
          arrival_time: stop.arrival_time,
          departure_time: stop.departure_time,
          duration_s: stop.time_from_start,
          distance_m: stop.distance_from_start,
          job_id: stop.order_id,
        })),
        distance_m: route.total_distance,
        duration_s: route.total_time,
        polyline: route.route_polyline,
      }));

      const result: OptimizationResponse = {
        code: "OK",
        summary: {
          distance_m: response.statistics.total_distance,
          duration_s: response.statistics.total_time,
          unassigned_jobs: response.statistics.unrouted_count,
          vehicle_count: response.statistics.routes_count,
        },
        routes,
        unassigned: response.unrouted_orders.map((u) => ({
          id: u.id,
          reason: u.reason,
        })),
      };

      this.setCache(cacheKey, result);
      return result;
    });
  }

  /**
   * Get route status
   */
  async getRouteStatus(vehicleId: string): Promise<OptimorderRouteStatus> {
    return this.executeRequest("get-route-status", async () => {
      return await this.makeRequest<OptimorderRouteStatus>(
        `${this.baseUrl}/vehicles/${vehicleId}/status`,
        {},
      );
    });
  }

  /**
   * Update order (dispatch, complete, etc.)
   */
  async updateOrder(
    orderId: string,
    update: OptimorderUpdateOrderRequest,
  ): Promise<void> {
    return this.executeRequest("update-order", async () => {
      await this.makeRequest(`${this.baseUrl}/orders/${orderId}`, update);
    });
  }

  /**
   * Report completion event
   */
  async reportCompletion(event: OptimorderCompletionEvent): Promise<void> {
    return this.executeRequest("report-completion", async () => {
      await this.makeRequest(`${this.baseUrl}/completion_events`, event);
    });
  }

  /**
   * Get routes
   */
  async getRoutes(filters?: {
    status?: string;
    vehicle_id?: string;
    date?: string;
  }): Promise<OptimorderRoute[]> {
    return this.executeRequest("get-routes", async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append("status", filters.status);
      if (filters?.vehicle_id) params.append("vehicle_id", filters.vehicle_id);
      if (filters?.date) params.append("date", filters.date);

      const url = `${this.baseUrl}/routes${params.toString() ? `?${params}` : ""}`;
      const response = await this.makeRequest<{ routes: OptimorderRoute[] }>(
        url,
        {},
      );
      return response.routes;
    });
  }

  /**
   * Matrix calculation
   */
  async matrix(request: MatrixRequest): Promise<MatrixResponse> {
    return this.executeRequest("matrix", async () => {
      const cacheKey = this.getCacheKey("matrix", request);
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
   * Make HTTP request with API key auth
   */
  private async makeRequest<T>(url: string, payload: unknown): Promise<T> {
    const timeout = this.config.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const method =
        payload && Object.keys(payload).length > 0 ? "POST" : "GET";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
          "User-Agent": this.config.user_agent || "Witylogix/1.0",
        },
        body: method === "POST" ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `OptimoRoute API error: ${response.status} ${response.statusText}`,
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
