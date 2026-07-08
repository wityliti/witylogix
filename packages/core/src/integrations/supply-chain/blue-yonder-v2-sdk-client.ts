/**
 * Blue Yonder (JDA) Luminate API SDK Client
 *
 * Production-grade implementation with:
 * - OAuth2 + JWT authentication
 * - Demand Planning (forecasts, promotional lifts, new product intro)
 * - Supply Planning (inventory optimization, replenishment, allocation)
 * - Fulfillment (order promising, ATP, sourcing)
 * - WMS (inbound/outbound/inventory management)
 * - Control Tower (alerts, KPIs, visibility)
 * - Network optimization
 * - Sustainability tracking
 * - Rate limiting (200 req/min)
 * - Exponential backoff retry logic
 */

import type {
  NormalizedWarehouse,
  NormalizedInventory,
  NormalizedOrder,
  NormalizedShipment,
  DemandForecast,
  ReplenishmentRecommendation,
  HealthCheckResult,
  RateLimitInfo,
  PaginatedResponse,
} from "./supply-chain-sdk-types.js";

// ─── BLUE YONDER SPECIFIC TYPES ────────────────────────────────────

interface BlueYonderAuthConfig {
  clientId: string;
  clientSecret: string;
  apiUrl: string;
  jwtSecret?: string;
}

interface BlueYonderForecast {
  id: string;
  skuId: string;
  locationId: string;
  forecastDate: string;
  forecastQuantity: number;
  confidence: number;
  seasonalFactor?: number;
  trendFactor?: number;
  promotionalLift?: number;
  method: string;
  lastUpdated: string;
}

interface BlueYonderInventoryOptimization {
  id: string;
  skuId: string;
  locationId: string;
  currentStock: number;
  safetyStock: number;
  targetStock: number;
  recommendedAction: "increase" | "decrease" | "hold";
  estimatedImpact?: number;
  priority: "low" | "medium" | "high" | "critical";
}

interface BlueYonderReplenishment {
  id: string;
  skuId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  priority: string;
  createdDate: string;
  recommendedShipDate?: string;
}

interface BlueYonderOrderPromise {
  orderId: string;
  skuId: string;
  requestedQuantity: number;
  promisedQuantity: number;
  promiseDate: string;
  location: { id: string; name: string };
  score: number; // fulfillment confidence 0-100
}

interface BlueYonderATP {
  skuId: string;
  locationId: string;
  availableToPromise: number;
  onHand: number;
  onOrder: number;
  reserved: number;
  asOfDate: string;
}

interface BlueYonderWaveRecords {
  id: string;
  waveNumber: string;
  status: string;
  releaseDate: string;
  shipmentLines: Array<{
    skuId: string;
    quantity: number;
    destination: string;
  }>;
}

interface BlueYonderAlert {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  message: string;
  affectedEntity: { type: string; id: string };
  createdAt: string;
  resolvedAt?: string;
}

interface BlueYonderKPI {
  id: string;
  name: string;
  value: number;
  unit: string;
  target?: number;
  trend?: "up" | "down" | "stable";
  lastUpdated: string;
}

interface BlueYonderNetworkNode {
  id: string;
  name: string;
  type: "supplier" | "warehouse" | "distribution" | "store" | "customer";
  location: { latitude: number; longitude: number };
  capacity?: number;
  leadTime?: number; // days
}

// ─── RATE LIMITER ───────────────────────────────────────────────────

class RateLimiter {
  private requestTimestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 200, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => now - ts < this.windowMs,
    );

    if (this.requestTimestamps.length >= this.maxRequests) {
      const oldestTimestamp = this.requestTimestamps[0] as number;
      const waitTime = this.windowMs - (now - oldestTimestamp);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.acquire();
    }

    this.requestTimestamps.push(now);
  }

  getInfo(): RateLimitInfo {
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(
      (ts) => now - ts < this.windowMs,
    );
    const remaining = Math.max(0, this.maxRequests - recentRequests.length);

    return {
      remaining,
      limit: this.maxRequests,
      resetAt: new Date(now + this.windowMs),
    };
  }
}

// ─── RETRY HANDLER ──────────────────────────────────────────────────

interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

class RetryHandler {
  private readonly config: RetryConfig;

  constructor(config: RetryConfig) {
    this.config = config;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const statusCode =
          lastError instanceof Error &&
          "statusCode" in lastError &&
          typeof (lastError as Record<string, unknown>).statusCode === "number"
            ? ((lastError as Record<string, unknown>).statusCode as number)
            : 500;

        const shouldRetry =
          statusCode >= 500 || statusCode === 429 || statusCode === 408;

        if (!shouldRetry || attempt === this.config.maxAttempts - 1) {
          throw lastError;
        }

        const delay = Math.min(
          this.config.maxDelayMs,
          this.config.initialDelayMs *
            Math.pow(this.config.backoffMultiplier, attempt),
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

// ─── BLUE YONDER V2 SDK CLIENT ──────────────────────────────────────

/**
 * Blue Yonder (JDA) Luminate API SDK Client
 */
export class BlueYonderV2SDKClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private readonly authConfig: BlueYonderAuthConfig;
  private readonly rateLimiter: RateLimiter;
  private readonly retryHandler: RetryHandler;

  constructor(authConfig: BlueYonderAuthConfig) {
    this.authConfig = authConfig;
    this.baseUrl = authConfig.apiUrl.replace(/\/$/, "");
    this.rateLimiter = new RateLimiter(200, 60000);
    this.retryHandler = new RetryHandler({
      maxAttempts: 3,
      initialDelayMs: 500,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
    });
  }

  private async ensureAuthenticated(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    return this.authenticate();
  }

  /**
   * Authenticate with Blue Yonder using OAuth2 + JWT
   */
  async authenticate(): Promise<string> {
    return this.retryHandler.execute(async () => {
      await this.rateLimiter.acquire();

      const payload = new URLSearchParams();
      payload.append("grant_type", "client_credentials");
      payload.append("client_id", this.authConfig.clientId);
      payload.append("client_secret", this.authConfig.clientSecret);

      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload.toString(),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
      };

      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

      return this.accessToken;
    });
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    return this.retryHandler.execute(async () => {
      await this.rateLimiter.acquire();

      const token = await this.ensureAuthenticated();
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string>),
      };

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = new Error(
          `API request failed: ${response.status} ${response.statusText}`,
        );
        (error as unknown as Record<string, unknown>).statusCode =
          response.status;
        throw error;
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return (await response.json()) as T;
      }

      return response as unknown as T;
    });
  }

  // ─── DEMAND PLANNING ─────────────────────────────────────────────

  /**
   * Get demand forecasts
   */
  async getForecasts(options?: {
    skuId?: string;
    locationId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PaginatedResponse<DemandForecast>> {
    const params = new URLSearchParams();
    if (options?.skuId) params.append("skuId", options.skuId);
    if (options?.locationId) params.append("locationId", options.locationId);
    if (options?.dateFrom) params.append("dateFrom", options.dateFrom);
    if (options?.dateTo) params.append("dateTo", options.dateTo);

    const data = (await this.request<{
      items: BlueYonderForecast[];
      totalCount: number;
    }>(`/demand/forecasts?${params.toString()}`)) as {
      items: BlueYonderForecast[];
      totalCount: number;
    };

    return {
      items: data.items.map((f) => ({
        id: f.id,
        skuId: f.skuId,
        warehouseId: f.locationId,
        forecastDate: new Date(f.forecastDate),
        forecastPeriod: "daily" as const,
        forecastQuantity: f.forecastQuantity,
        confidence: f.confidence,
        seasonalFactor: f.seasonalFactor,
        trendFactor: f.trendFactor,
        promotionalLift: f.promotionalLift,
        method: f.method as any,
        createdAt: new Date(f.lastUpdated),
      })),
      totalCount: data.totalCount,
      pageSize: 25,
      pageNumber: 1,
      hasMore: data.items.length === 25,
    };
  }

  /**
   * Get demand forecast for specific SKU
   */
  async getForecastBySKU(skuId: string): Promise<DemandForecast> {
    const data = (await this.request<BlueYonderForecast>(
      `/demand/forecasts/${skuId}`,
    )) as BlueYonderForecast;

    return {
      id: data.id,
      skuId: data.skuId,
      warehouseId: data.locationId,
      forecastDate: new Date(data.forecastDate),
      forecastPeriod: "daily" as const,
      forecastQuantity: data.forecastQuantity,
      confidence: data.confidence,
      seasonalFactor: data.seasonalFactor,
      trendFactor: data.trendFactor,
      promotionalLift: data.promotionalLift,
      method: data.method as any,
      createdAt: new Date(data.lastUpdated),
    };
  }

  /**
   * Get promotional lift forecast
   */
  async getPromotionalLift(config: {
    skuId: string;
    locationId: string;
    promotionStartDate: string;
    promotionEndDate: string;
    discountPercent?: number;
  }): Promise<{ liftFactor: number; forecastedSalesLift: number }> {
    const data = (await this.request<{
      liftFactor: number;
      forecastedSalesLift: number;
    }>(`/demand/promotional-lift`, {
      method: "POST",
      body: JSON.stringify(config),
    })) as { liftFactor: number; forecastedSalesLift: number };

    return data;
  }

  /**
   * Get new product introduction forecast
   */
  async getNPIForecast(config: {
    skuId: string;
    launchDate: string;
    similarSkuId?: string;
  }): Promise<DemandForecast> {
    const data = (await this.request<BlueYonderForecast>(
      `/demand/npi-forecast`,
      {
        method: "POST",
        body: JSON.stringify(config),
      },
    )) as BlueYonderForecast;

    return {
      id: data.id,
      skuId: data.skuId,
      warehouseId: data.locationId,
      forecastDate: new Date(data.forecastDate),
      forecastPeriod: "daily" as const,
      forecastQuantity: data.forecastQuantity,
      confidence: data.confidence,
      method: data.method as any,
      createdAt: new Date(data.lastUpdated),
    };
  }

  // ─── SUPPLY PLANNING ─────────────────────────────────────────────

  /**
   * Get inventory optimization recommendations
   */
  async getInventoryOptimization(
    locationId: string,
  ): Promise<BlueYonderInventoryOptimization[]> {
    const data = (await this.request<{
      items: BlueYonderInventoryOptimization[];
    }>(`/supply/inventory-optimization/${locationId}`)) as {
      items: BlueYonderInventoryOptimization[];
    };

    return data.items;
  }

  /**
   * Get replenishment recommendations
   */
  async getReplenishmentPlan(options?: {
    fromLocationId?: string;
    toLocationId?: string;
    priority?: string;
  }): Promise<ReplenishmentRecommendation[]> {
    const params = new URLSearchParams();
    if (options?.fromLocationId)
      params.append("fromLocationId", options.fromLocationId);
    if (options?.toLocationId)
      params.append("toLocationId", options.toLocationId);
    if (options?.priority) params.append("priority", options.priority);

    const data = (await this.request<{ items: BlueYonderReplenishment[] }>(
      `/supply/replenishment?${params.toString()}`,
    )) as { items: BlueYonderReplenishment[] };

    return data.items.map((r) => ({
      id: r.id,
      skuId: r.skuId,
      warehouseId: r.toLocationId,
      currentStock: 0,
      safetyStock: 0,
      recommendedQuantity: r.quantity,
      recommendedDate: new Date(
        r.recommendedShipDate || new Date().toISOString(),
      ),
      priority: (r.priority as any) || "medium",
      reason: "replenishment",
      leadTime: 0,
    }));
  }

  /**
   * Create allocation
   */
  async createAllocation(config: {
    orderId: string;
    skuId: string;
    quantity: number;
    fromLocationId: string;
  }): Promise<{ allocationId: string; status: string }> {
    const data = (await this.request<{ id: string; status: string }>(
      `/supply/allocations`,
      {
        method: "POST",
        body: JSON.stringify(config),
      },
    )) as { id: string; status: string };

    return { allocationId: data.id, status: data.status };
  }

  // ─── FULFILLMENT ────────────────────────────────────────────────

  /**
   * Promise an order (determine fulfillment)
   */
  async promiseOrder(config: {
    orderId: string;
    lines: Array<{ skuId: string; quantity: number }>;
  }): Promise<BlueYonderOrderPromise[]> {
    const data = (await this.request<BlueYonderOrderPromise[]>(
      `/fulfillment/promise-order`,
      {
        method: "POST",
        body: JSON.stringify(config),
      },
    )) as BlueYonderOrderPromise[];

    return data;
  }

  /**
   * Get available to promise (ATP)
   */
  async getATP(skuId: string, locationId: string): Promise<BlueYonderATP> {
    const data = (await this.request<BlueYonderATP>(
      `/fulfillment/atp/${skuId}/${locationId}`,
    )) as BlueYonderATP;

    return data;
  }

  /**
   * Get optimal sourcing location
   */
  async getOptimalSource(config: {
    skuId: string;
    quantity: number;
    destinationLocationId: string;
  }): Promise<{ locationId: string; leadTime: number; cost: number }> {
    const data = (await this.request<{
      locationId: string;
      leadTime: number;
      cost: number;
    }>(`/fulfillment/optimal-source`, {
      method: "POST",
      body: JSON.stringify(config),
    })) as { locationId: string; leadTime: number; cost: number };

    return data;
  }

  // ─── WMS INTEGRATION ─────────────────────────────────────────────

  /**
   * Get wave records
   */
  async getWaveRecords(options?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<PaginatedResponse<NormalizedShipment>> {
    const params = new URLSearchParams();
    if (options?.status) params.append("status", options.status);
    if (options?.dateFrom) params.append("dateFrom", options.dateFrom);
    if (options?.dateTo) params.append("dateTo", options.dateTo);
    if (options?.limit) params.append("limit", String(options.limit));

    const data = (await this.request<{
      items: BlueYonderWaveRecords[];
      totalCount: number;
    }>(`/wms/waves?${params.toString()}`)) as {
      items: BlueYonderWaveRecords[];
      totalCount: number;
    };

    return {
      items: data.items.map((w) => ({
        id: w.id,
        shipmentNumber: w.waveNumber,
        warehouseId: "",
        status: w.status as any,
        orders: [],
        lines: w.shipmentLines.map((sl) => ({
          id: sl.skuId,
          skuId: sl.skuId,
          skuCode: sl.skuId,
          quantity: sl.quantity,
        })),
        createdAt: new Date(w.releaseDate),
        updatedAt: new Date(),
      })),
      totalCount: data.totalCount,
      pageSize: options?.limit || 25,
      pageNumber: 1,
      hasMore: data.items.length === (options?.limit || 25),
    };
  }

  /**
   * Trigger WMS inbound operation
   */
  async triggerInbound(config: {
    warehouseId: string;
    receiptNumber: string;
    items: Array<{ skuId: string; quantity: number }>;
  }): Promise<{ taskId: string }> {
    const data = (await this.request<{ taskId: string }>(`/wms/inbound`, {
      method: "POST",
      body: JSON.stringify(config),
    })) as { taskId: string };

    return data;
  }

  /**
   * Trigger WMS outbound operation
   */
  async triggerOutbound(config: {
    warehouseId: string;
    shipmentNumber: string;
    orderIds: string[];
  }): Promise<{ taskId: string }> {
    const data = (await this.request<{ taskId: string }>(`/wms/outbound`, {
      method: "POST",
      body: JSON.stringify(config),
    })) as { taskId: string };

    return data;
  }

  // ─── CONTROL TOWER ──────────────────────────────────────────────

  /**
   * Get alerts
   */
  async getAlerts(options?: {
    severity?: string;
    category?: string;
    limit?: number;
  }): Promise<BlueYonderAlert[]> {
    const params = new URLSearchParams();
    if (options?.severity) params.append("severity", options.severity);
    if (options?.category) params.append("category", options.category);
    if (options?.limit) params.append("limit", String(options.limit));

    const data = (await this.request<{ items: BlueYonderAlert[] }>(
      `/control-tower/alerts?${params.toString()}`,
    )) as { items: BlueYonderAlert[] };

    return data.items;
  }

  /**
   * Get KPIs
   */
  async getKPIs(category?: string): Promise<BlueYonderKPI[]> {
    const params = new URLSearchParams();
    if (category) params.append("category", category);

    const data = (await this.request<{ items: BlueYonderKPI[] }>(
      `/control-tower/kpis?${params.toString()}`,
    )) as { items: BlueYonderKPI[] };

    return data.items;
  }

  /**
   * Get visibility dashboard data
   */
  async getVisibilityDashboard(): Promise<{
    onTimeDelivery: number;
    inventoryHealth: number;
    demandFulfillment: number;
    costOptimization: number;
  }> {
    const data = (await this.request<{
      onTimeDelivery: number;
      inventoryHealth: number;
      demandFulfillment: number;
      costOptimization: number;
    }>(`/control-tower/dashboard`)) as {
      onTimeDelivery: number;
      inventoryHealth: number;
      demandFulfillment: number;
      costOptimization: number;
    };

    return data;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, notes?: string): Promise<void> {
    await this.request(`/control-tower/alerts/${alertId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
  }

  // ─── NETWORK OPTIMIZATION ───────────────────────────────────────

  /**
   * Get network nodes
   */
  async getNetworkNodes(): Promise<BlueYonderNetworkNode[]> {
    const data = (await this.request<{ items: BlueYonderNetworkNode[] }>(
      `/network/nodes`,
    )) as { items: BlueYonderNetworkNode[] };

    return data.items;
  }

  /**
   * Optimize distribution network
   */
  async optimizeNetwork(config: {
    objective: "cost" | "service" | "sustainability" | "balanced";
    constraints?: Record<string, unknown>;
  }): Promise<{ optimization: Record<string, unknown>; savings: number }> {
    const data = (await this.request<{
      optimization: Record<string, unknown>;
      savings: number;
    }>(`/network/optimize`, {
      method: "POST",
      body: JSON.stringify(config),
    })) as {
      optimization: Record<string, unknown>;
      savings: number;
    };

    return data;
  }

  // ─── SUSTAINABILITY TRACKING ────────────────────────────────────

  /**
   * Get carbon footprint data
   */
  async getCarbonFootprint(options?: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    totalEmissions: number;
    unit: string;
    breakdown: Record<string, number>;
  }> {
    const params = new URLSearchParams();
    if (options?.dateFrom) params.append("dateFrom", options.dateFrom);
    if (options?.dateTo) params.append("dateTo", options.dateTo);

    const data = (await this.request<{
      totalEmissions: number;
      unit: string;
      breakdown: Record<string, number>;
    }>(`/sustainability/carbon-footprint?${params.toString()}`)) as {
      totalEmissions: number;
      unit: string;
      breakdown: Record<string, number>;
    };

    return data;
  }

  /**
   * Get sustainability recommendations
   */
  async getSustainabilityRecommendations(): Promise<
    Array<{
      id: string;
      title: string;
      potentialCarbonSavings: number;
      estimatedCost: number;
      roi: number;
    }>
  > {
    const data = (await this.request<
      Array<{
        id: string;
        title: string;
        potentialCarbonSavings: number;
        estimatedCost: number;
        roi: number;
      }>
    >(`/sustainability/recommendations`)) as Array<{
      id: string;
      title: string;
      potentialCarbonSavings: number;
      estimatedCost: number;
      roi: number;
    }>;

    return data;
  }

  // ─── HEALTH CHECK ───────────────────────────────────────────────

  /**
   * Health check for the API
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      await this.authenticate();
      const duration = Date.now() - startTime;

      return {
        status: "healthy",
        timestamp: new Date(),
        responseTimeMs: duration,
      };
    } catch (error: unknown) {
      return {
        status: "unhealthy",
        timestamp: new Date(),
        responseTimeMs: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Get rate limit info
   */
  getRateLimitInfo(): RateLimitInfo {
    return this.rateLimiter.getInfo();
  }
}
