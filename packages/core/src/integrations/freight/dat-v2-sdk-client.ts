/**
 * DAT Freight & Analytics API v2 SDK Client
 *
 * Comprehensive client for DAT's RateView, Load Board, Carrier Search,
 * Market Analytics, and Broker Tools APIs with OAuth2, caching, webhooks.
 */

import { EventEmitter } from "events";
import type {
  SpotRate,
  ContractRate,
  LaneRate,
  LoadPosting,
  CarrierMatch,
  BookingConfirmation,
  FreightDocument,
  DATRateViewResponse,
  RateLimitInfo,
  APIError,
  EquipmentType,
  RateType,
  LoadStatus,
  CacheEntry,
} from "./freight-sdk-types";

/**
 * DAT OAuth token
 */
interface DATToken {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: number;
  refreshToken?: string;
}

/**
 * DAT API request options
 */
interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | number>;
  timeout?: number;
}

/**
 * Rate limit tracking
 */
interface RateLimitData {
  remaining: number;
  limit: number;
  resetAt: Date;
}

/**
 * DAT v2 SDK Client
 */
export class DATv2SDKClient extends EventEmitter {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private token: DATToken | null = null;
  private rateLimitData: RateLimitData | null = null;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private debug: boolean;

  /**
   * Initialize DAT v2 SDK client
   */
  constructor(config: {
    clientId: string;
    clientSecret: string;
    baseUrl?: string;
    debug?: boolean;
  }) {
    super();
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.baseUrl = config.baseUrl || "https://api.dat.com/v2";
    this.debug = config.debug || false;
  }

  /**
   * Authenticate and obtain OAuth2 token
   */
  async authenticate(): Promise<string> {
    if (this.debug) {
      console.log("[DAT v2] Authenticating with OAuth2...");
    }

    const tokenUrl = `${this.baseUrl}/oauth/token`;
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString("base64");

    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Authentication failed: ${response.statusText} - ${JSON.stringify(errorData)}`,
        );
      }

      const data = (await response.json()) as {
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token?: string;
      };

      const expiresAt = Date.now() + data.expires_in * 1000;
      this.token = {
        accessToken: data.access_token,
        tokenType: data.token_type,
        expiresIn: data.expires_in,
        expiresAt,
        refreshToken: data.refresh_token,
      };

      if (this.debug) {
        console.log(
          "[DAT v2] Authentication successful, token expires at:",
          new Date(expiresAt),
        );
      }

      this.emit("authenticated");
      return this.token.accessToken;
    } catch (error) {
      if (this.debug) {
        console.error("[DAT v2] Authentication error:", error);
      }
      throw error;
    }
  }

  /**
   * Get valid access token (refresh if needed)
   */
  private async getAccessToken(): Promise<string> {
    // If no token or expired, authenticate
    if (!this.token || this.token.expiresAt < Date.now() + 60000) {
      return this.authenticate();
    }
    return this.token.accessToken;
  }

  /**
   * Make API request with caching, rate limiting, and error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Add query parameters
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    // Check cache for GET requests
    const cacheKey = `${options.method || "GET"}:${url.toString()}`;
    const cached = this.cache.get(cacheKey);
    if (options.method !== "POST" && cached && cached.expiresAt > new Date()) {
      if (this.debug) {
        console.log("[DAT v2] Cache hit:", cacheKey);
      }
      return cached.data as T;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url.toString(), {
        method: options.method || "GET",
        headers,
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        signal: AbortSignal.timeout(options.timeout || 30000),
      });

      // Update rate limit info from headers
      const remaining = response.headers.get("x-ratelimit-remaining");
      const limit = response.headers.get("x-ratelimit-limit");
      const reset = response.headers.get("x-ratelimit-reset");

      if (remaining && limit && reset) {
        this.rateLimitData = {
          remaining: parseInt(remaining, 10),
          limit: parseInt(limit, 10),
          resetAt: new Date(parseInt(reset, 10) * 1000),
        };
      }

      if (!response.ok) {
        const error: APIError = {
          code: `HTTP_${response.status}`,
          message: response.statusText,
          statusCode: response.status,
          timestamp: new Date(),
        };

        try {
          const errorData = (await response.json()) as Record<string, unknown>;
          error.details = errorData;
        } catch {
          // Ignore JSON parse errors
        }

        throw error;
      }

      const data = (await response.json()) as T;

      // Cache successful GET responses for 1 hour
      if (
        options.method !== "POST" &&
        options.method !== "PUT" &&
        options.method !== "DELETE"
      ) {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        this.cache.set(cacheKey, {
          data,
          cachedAt: new Date(),
          expiresAt,
          key: cacheKey,
          isHit: false,
        });
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        if (this.debug) {
          console.error("[DAT v2] Request error:", error.message);
        }
      }
      throw error;
    }
  }

  /**
   * Get spot rates for a lane
   */
  async getSpotRate(params: {
    originCity: string;
    originState: string;
    originZip?: string;
    destinationCity: string;
    destinationState: string;
    destinationZip?: string;
    equipmentType: EquipmentType;
  }): Promise<DATRateViewResponse> {
    const query: Record<string, string | number> = {
      origin_city: params.originCity,
      origin_state: params.originState,
      dest_city: params.destinationCity,
      dest_state: params.destinationState,
      equipment: params.equipmentType,
    };

    if (params.originZip) query.origin_zip = params.originZip;
    if (params.destinationZip) query.dest_zip = params.destinationZip;

    return this.request<DATRateViewResponse>("/rateview/spot-rate", { query });
  }

  /**
   * Get historical rate trends
   */
  async getRateTrends(params: {
    originCity: string;
    originState: string;
    destinationCity: string;
    destinationState: string;
    equipmentType: EquipmentType;
    weeks?: 13 | 52;
  }): Promise<{
    avg13Week: number;
    avg52Week: number;
    low13Week: number;
    high13Week: number;
    trend: number;
    weeklyData: Array<{ date: string; rate: number; volume: number }>;
  }> {
    const query: Record<string, string | number> = {
      origin_city: params.originCity,
      origin_state: params.originState,
      dest_city: params.destinationCity,
      dest_state: params.destinationState,
      equipment: params.equipmentType,
      weeks: params.weeks || 13,
    };

    return this.request("/rateview/trends", { query });
  }

  /**
   * Get rate components (line-haul, fuel, all-in)
   */
  async getRateComponents(params: {
    originCity: string;
    originState: string;
    destinationCity: string;
    destinationState: string;
    equipmentType: EquipmentType;
  }): Promise<{
    lineHaul: number;
    fuel: number;
    allIn: number;
    fuelSurcharge: number;
    accessorial?: number;
  }> {
    const query: Record<string, string> = {
      origin_city: params.originCity,
      origin_state: params.originState,
      dest_city: params.destinationCity,
      dest_state: params.destinationState,
      equipment: params.equipmentType,
    };

    return this.request("/rateview/components", { query });
  }

  /**
   * Post a load to the load board
   */
  async postLoad(
    load: Omit<LoadPosting, "loadId" | "status" | "postedAt" | "updatedAt">,
  ): Promise<LoadPosting> {
    const body = {
      origin: load.origin,
      destination: load.destination,
      equipment_type: load.equipmentType,
      weight: load.weight,
      length: load.length,
      pickup_date: load.pickupDate.toISOString(),
      delivery_date: load.deliveryDate.toISOString(),
      rate: load.rate,
      currency: load.currency,
      commodity: load.commodity,
      is_hazmat: load.isHazmat,
      attributes: load.attributes,
      shipper: load.shipper,
      receiver: load.receiver,
      reference_number: load.referenceNumber,
    };

    return this.request<LoadPosting>("/loadboard/loads", {
      method: "POST",
      body,
    });
  }

  /**
   * Update a posted load
   */
  async updateLoad(
    loadId: string,
    updates: Partial<LoadPosting>,
  ): Promise<LoadPosting> {
    const body = {
      ...(updates.rate && { rate: updates.rate }),
      ...(updates.status && { status: updates.status }),
      ...(updates.pickupDate && {
        pickup_date: updates.pickupDate.toISOString(),
      }),
      ...(updates.deliveryDate && {
        delivery_date: updates.deliveryDate.toISOString(),
      }),
    };

    return this.request<LoadPosting>(`/loadboard/loads/${loadId}`, {
      method: "PUT",
      body,
    });
  }

  /**
   * Remove a load from the load board
   */
  async removeLoad(loadId: string): Promise<{ success: boolean }> {
    return this.request(`/loadboard/loads/${loadId}`, {
      method: "DELETE",
    });
  }

  /**
   * Search loads
   */
  async searchLoads(params: {
    originState?: string;
    destinationState?: string;
    equipmentType?: EquipmentType;
    maxRate?: number;
    minRate?: number;
    status?: LoadStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{
    loads: LoadPosting[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const query: Record<string, string | number> = {};

    if (params.originState) query.origin_state = params.originState;
    if (params.destinationState) query.dest_state = params.destinationState;
    if (params.equipmentType) query.equipment = params.equipmentType;
    if (params.maxRate) query.max_rate = params.maxRate;
    if (params.minRate) query.min_rate = params.minRate;
    if (params.status) query.status = params.status;
    if (params.page) query.page = params.page;
    if (params.pageSize) query.page_size = params.pageSize;

    return this.request("/loadboard/loads", { query });
  }

  /**
   * Find matching carriers for a load
   */
  async matchCarriers(
    loadId: string,
    options?: { limit?: number; minRating?: number },
  ): Promise<CarrierMatch[]> {
    const query: Record<string, string | number> = {
      load_id: loadId,
    };

    if (options?.limit) query.limit = options.limit;
    if (options?.minRating) query.min_rating = options.minRating;

    return this.request<CarrierMatch[]>("/loadboard/matches", { query });
  }

  /**
   * Create load alerts for automated notifications
   */
  async createLoadAlert(params: {
    originState: string;
    destinationState: string;
    equipmentType: EquipmentType;
    maxRate: number;
    webhookUrl: string;
  }): Promise<{ alertId: string; createdAt: Date }> {
    const body = {
      origin_state: params.originState,
      dest_state: params.destinationState,
      equipment: params.equipmentType,
      max_rate: params.maxRate,
      webhook_url: params.webhookUrl,
    };

    return this.request("/loadboard/alerts", {
      method: "POST",
      body,
    });
  }

  /**
   * Search carriers
   */
  async searchCarriers(params: {
    originState?: string;
    destinationState?: string;
    equipmentType?: EquipmentType;
    minRating?: number;
    authorityStatus?: "active" | "inactive";
    page?: number;
    pageSize?: number;
  }): Promise<{
    carriers: Array<{
      carrierId: string;
      carrierName: string;
      mcNumber: string;
      rating: number;
      equipmentTypes: EquipmentType[];
      serviceAreas: string[];
      authorityStatus: string;
    }>;
    total: number;
    page: number;
  }> {
    const query: Record<string, string | number> = {};

    if (params.originState) query.origin_state = params.originState;
    if (params.destinationState) query.dest_state = params.destinationState;
    if (params.equipmentType) query.equipment = params.equipmentType;
    if (params.minRating) query.min_rating = params.minRating;
    if (params.authorityStatus) query.authority_status = params.authorityStatus;
    if (params.page) query.page = params.page;
    if (params.pageSize) query.page_size = params.pageSize;

    return this.request("/carriers/search", { query });
  }

  /**
   * Get carrier details
   */
  async getCarrierDetails(carrierId: string): Promise<{
    carrierId: string;
    carrierName: string;
    mcNumber: string;
    usdotNumber: string;
    rating: number;
    safetyRating: number;
    insurance: {
      provider: string;
      coverage: number;
      expirationDate: Date;
    };
    equipmentTypes: EquipmentType[];
    serviceAreas: string[];
    yearsInBusiness: number;
  }> {
    return this.request(`/carriers/${carrierId}`);
  }

  /**
   * Get lane volume trends for market analytics
   */
  async getLaneVolumeTrends(params: {
    originState: string;
    destinationState: string;
    days?: 7 | 30 | 365;
  }): Promise<{
    lane: string;
    volumeTrend: number;
    dailyVolumes: Array<{ date: string; volume: number }>;
    avgDaily: number;
    maxDaily: number;
  }> {
    const query: Record<string, string | number> = {
      origin_state: params.originState,
      dest_state: params.destinationState,
      days: params.days || 30,
    };

    return this.request("/analytics/lane-volumes", { query });
  }

  /**
   * Get capacity indicators (load-to-truck ratio)
   */
  async getCapacityIndicators(params: {
    originState: string;
    destinationState: string;
    equipmentType: EquipmentType;
  }): Promise<{
    loadToTruckRatio: number;
    capacityStatus: "tight" | "normal" | "loose";
    loadsPerTruck: number;
    estimatedWaitTime: number; // in minutes
    trend: number; // percentage change
  }> {
    const query: Record<string, string> = {
      origin_state: params.originState,
      dest_state: params.destinationState,
      equipment: params.equipmentType,
    };

    return this.request("/analytics/capacity", { query });
  }

  /**
   * Get rate forecasts
   */
  async getRateForecast(params: {
    originState: string;
    destinationState: string;
    equipmentType: EquipmentType;
    days?: 7 | 30;
  }): Promise<{
    forecast: Array<{
      date: string;
      forecastRate: number;
      confidence: number;
      trend: "up" | "down" | "stable";
    }>;
  }> {
    const query: Record<string, string | number> = {
      origin_state: params.originState,
      dest_state: params.destinationState,
      equipment: params.equipmentType,
      days: params.days || 7,
    };

    return this.request("/analytics/forecast", { query });
  }

  /**
   * Onboard carrier (broker tools)
   */
  async onboardCarrier(params: {
    carrierName: string;
    mcNumber: string;
    usdotNumber: string;
    email: string;
    phone: string;
    equipment: EquipmentType[];
  }): Promise<{
    carrierId: string;
    onboardingStatus: "pending" | "verified" | "rejected";
    verificationUrl?: string;
  }> {
    const body = {
      carrier_name: params.carrierName,
      mc_number: params.mcNumber,
      usdot_number: params.usdotNumber,
      email: params.email,
      phone: params.phone,
      equipment: params.equipment,
    };

    return this.request("/broker/onboard", {
      method: "POST",
      body,
    });
  }

  /**
   * Get carrier credit report
   */
  async getCarrierCreditReport(carrierId: string): Promise<{
    carrierId: string;
    creditScore: number;
    creditHistory: string;
    paymentHistory: Array<{
      date: Date;
      amount: number;
      status: "paid" | "overdue" | "pending";
    }>;
    recommendations: string[];
  }> {
    return this.request(`/broker/credit-reports/${carrierId}`);
  }

  /**
   * Get rate limit info
   */
  getRateLimitInfo(): RateLimitInfo | null {
    if (!this.rateLimitData) return null;

    const { remaining, limit, resetAt } = this.rateLimitData;
    return {
      remaining,
      limit,
      resetAt,
      used: limit - remaining,
      percentageUsed: ((limit - remaining) / limit) * 100,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    if (this.debug) {
      console.log("[DAT v2] Cache cleared");
    }
  }

  /**
   * Register webhook for load match notifications
   */
  async registerWebhook(params: {
    webhookUrl: string;
    eventTypes: ("load_match" | "rate_alert" | "carrier_update")[];
  }): Promise<{
    webhookId: string;
    registeredAt: Date;
  }> {
    const body = {
      webhook_url: params.webhookUrl,
      event_types: params.eventTypes,
    };

    return this.request("/webhooks", {
      method: "POST",
      body,
    });
  }

  /**
   * Get loads by status
   */
  async getLoadsByStatus(
    status: LoadStatus,
    page = 1,
    pageSize = 50,
  ): Promise<{
    loads: LoadPosting[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    return this.searchLoads({
      status,
      page,
      pageSize,
    });
  }
}
