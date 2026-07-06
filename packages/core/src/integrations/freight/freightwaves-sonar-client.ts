/**
 * FreightWaves SONAR API Client
 *
 * Market intelligence platform for tender data, rate data, capacity data,
 * market indices, and freight futures with real-time and historical analytics.
 */

import { EventEmitter } from "events";
import type {
  SONARMetric,
  MarketIndex,
  FreightMarket,
  RateLimitInfo,
  APIError,
  CacheEntry,
} from "./freight-sdk-types";

/**
 * Rate limit tracking
 */
interface RateLimitData {
  remaining: number;
  limit: number;
  dayRemaining: number;
  dayLimit: number;
  resetAt: Date;
}

/**
 * SONAR metric types
 */
export type SONARMetricType =
  | "OTVI" // Outbound Tender Volume Index
  | "OTRI" // Outbound Tender Rejection Index
  | "ITVI" // Inbound Tender Volume Index
  | "TLI" // Truckload Linehaul Index
  | "DTS" // Diesel Fuel
  | "CRI" // Carrier Revocations Index
  | "NACI" // New Active Carrier Index
  | "ATU"; // Active Truck Utilization

/**
 * FreightWaves SONAR Client
 */
export class FreightWavesSONARClient extends EventEmitter {
  private apiKey: string;
  private baseUrl: string;
  private rateLimitData: RateLimitData | null = null;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private debug: boolean;

  /**
   * Initialize FreightWaves SONAR client
   */
  constructor(config: { apiKey: string; baseUrl?: string; debug?: boolean }) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://api.freightwaves.com/sonar";
    this.debug = config.debug || false;
  }

  /**
   * Make API request with caching and rate limiting
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: "GET" | "POST";
      headers?: Record<string, string>;
      body?: unknown;
      query?: Record<string, string | number | boolean>;
      timeout?: number;
      cacheMinutes?: number;
    } = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Add query parameters
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    // Check cache
    const cacheKey = `${options.method || "GET"}:${url.toString()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      if (this.debug) {
        console.log("[SONAR] Cache hit:", cacheKey);
      }
      return cached.data as T;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
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

      // Update rate limit info
      const remaining = response.headers.get("x-ratelimit-remaining");
      const limit = response.headers.get("x-ratelimit-limit");
      const dayRemaining = response.headers.get("x-ratelimit-day-remaining");
      const dayLimit = response.headers.get("x-ratelimit-day-limit");
      const reset = response.headers.get("x-ratelimit-reset");

      if (remaining && limit && dayRemaining && dayLimit && reset) {
        this.rateLimitData = {
          remaining: parseInt(remaining, 10),
          limit: parseInt(limit, 10),
          dayRemaining: parseInt(dayRemaining, 10),
          dayLimit: parseInt(dayLimit, 10),
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

      // Cache successful responses
      const cacheMinutes = options.cacheMinutes || 15; // Default 15 min for real-time
      const expiresAt = new Date(Date.now() + cacheMinutes * 60 * 1000);
      this.cache.set(cacheKey, {
        data,
        cachedAt: new Date(),
        expiresAt,
        key: cacheKey,
        isHit: false,
      });

      return data;
    } catch (error) {
      if (this.debug) {
        console.error("[SONAR] Request error:", error);
      }
      throw error;
    }
  }

  /**
   * Get Outbound Tender Volume Index (OTVI)
   */
  async getOTVI(params?: {
    markets?: FreightMarket[];
    dateRange?: { start: Date; end: Date };
    granularity?: "daily" | "weekly" | "monthly";
  }): Promise<SONARMetric[]> {
    const query: Record<string, string | number | boolean> = {
      metrics: "OTVI",
    };

    if (params?.granularity) query.granularity = params.granularity;
    if (params?.dateRange) {
      query.start_date = params.dateRange.start.toISOString().split("T")[0];
      query.end_date = params.dateRange.end.toISOString().split("T")[0];
    }
    if (params?.markets) {
      query.markets = params.markets.join(",");
    }

    return this.request("/metrics", {
      query,
      cacheMinutes: 15, // Real-time data
    });
  }

  /**
   * Get Outbound Tender Rejection Index (OTRI)
   */
  async getOTRI(params?: {
    markets?: FreightMarket[];
    dateRange?: { start: Date; end: Date };
    granularity?: "daily" | "weekly" | "monthly";
  }): Promise<SONARMetric[]> {
    const query: Record<string, string | number | boolean> = {
      metrics: "OTRI",
    };

    if (params?.granularity) query.granularity = params.granularity;
    if (params?.dateRange) {
      query.start_date = params.dateRange.start.toISOString().split("T")[0];
      query.end_date = params.dateRange.end.toISOString().split("T")[0];
    }
    if (params?.markets) {
      query.markets = params.markets.join(",");
    }

    return this.request("/metrics", {
      query,
      cacheMinutes: 15,
    });
  }

  /**
   * Get Inbound Tender Volume Index (ITVI)
   */
  async getITVI(params?: {
    markets?: FreightMarket[];
    dateRange?: { start: Date; end: Date };
    granularity?: "daily" | "weekly" | "monthly";
  }): Promise<SONARMetric[]> {
    const query: Record<string, string | number | boolean> = {
      metrics: "ITVI",
    };

    if (params?.granularity) query.granularity = params.granularity;
    if (params?.dateRange) {
      query.start_date = params.dateRange.start.toISOString().split("T")[0];
      query.end_date = params.dateRange.end.toISOString().split("T")[0];
    }
    if (params?.markets) {
      query.markets = params.markets.join(",");
    }

    return this.request("/metrics", {
      query,
      cacheMinutes: 15,
    });
  }

  /**
   * Get Truckload Linehaul Index (TLI)
   */
  async getTLI(params?: {
    markets?: FreightMarket[];
    dateRange?: { start: Date; end: Date };
    granularity?: "daily" | "weekly" | "monthly";
  }): Promise<SONARMetric[]> {
    const query: Record<string, string | number | boolean> = {
      metrics: "TLI",
    };

    if (params?.granularity) query.granularity = params.granularity;
    if (params?.dateRange) {
      query.start_date = params.dateRange.start.toISOString().split("T")[0];
      query.end_date = params.dateRange.end.toISOString().split("T")[0];
    }
    if (params?.markets) {
      query.markets = params.markets.join(",");
    }

    return this.request("/metrics", {
      query,
      cacheMinutes: 15,
    });
  }

  /**
   * Get Diesel Fuel Index (DTS)
   */
  async getDieselFuelIndex(params?: {
    dateRange?: { start: Date; end: Date };
    granularity?: "daily" | "weekly" | "monthly";
  }): Promise<SONARMetric[]> {
    const query: Record<string, string | number | boolean> = {
      metrics: "DTS",
    };

    if (params?.granularity) query.granularity = params.granularity;
    if (params?.dateRange) {
      query.start_date = params.dateRange.start.toISOString().split("T")[0];
      query.end_date = params.dateRange.end.toISOString().split("T")[0];
    }

    return this.request("/metrics", {
      query,
      cacheMinutes: 15,
    });
  }

  /**
   * Get Carrier Revocations Index (CRI)
   */
  async getCarrierRevocations(params?: {
    dateRange?: { start: Date; end: Date };
    granularity?: "daily" | "weekly" | "monthly";
  }): Promise<SONARMetric[]> {
    const query: Record<string, string | number | boolean> = {
      metrics: "CRI",
    };

    if (params?.granularity) query.granularity = params.granularity;
    if (params?.dateRange) {
      query.start_date = params.dateRange.start.toISOString().split("T")[0];
      query.end_date = params.dateRange.end.toISOString().split("T")[0];
    }

    return this.request("/metrics", {
      query,
      cacheMinutes: 240, // 4 hours for historical data
    });
  }

  /**
   * Get New Active Carrier Index (NACI)
   */
  async getNewCarrierApplications(params?: {
    dateRange?: { start: Date; end: Date };
    granularity?: "daily" | "weekly" | "monthly";
  }): Promise<SONARMetric[]> {
    const query: Record<string, string | number | boolean> = {
      metrics: "NACI",
    };

    if (params?.granularity) query.granularity = params.granularity;
    if (params?.dateRange) {
      query.start_date = params.dateRange.start.toISOString().split("T")[0];
      query.end_date = params.dateRange.end.toISOString().split("T")[0];
    }

    return this.request("/metrics", {
      query,
      cacheMinutes: 240,
    });
  }

  /**
   * Get Active Truck Utilization (ATU)
   */
  async getActiveTruckUtilization(params?: {
    markets?: FreightMarket[];
    dateRange?: { start: Date; end: Date };
    granularity?: "daily" | "weekly" | "monthly";
  }): Promise<SONARMetric[]> {
    const query: Record<string, string | number | boolean> = {
      metrics: "ATU",
    };

    if (params?.granularity) query.granularity = params.granularity;
    if (params?.dateRange) {
      query.start_date = params.dateRange.start.toISOString().split("T")[0];
      query.end_date = params.dateRange.end.toISOString().split("T")[0];
    }
    if (params?.markets) {
      query.markets = params.markets.join(",");
    }

    return this.request("/metrics", {
      query,
      cacheMinutes: 15,
    });
  }

  /**
   * Batch query multiple metrics (up to 50 per request)
   */
  async batchQueryMetrics(params: {
    metrics: SONARMetricType[];
    markets?: FreightMarket[];
    dateRange?: { start: Date; end: Date };
    granularity?: "daily" | "weekly" | "monthly";
  }): Promise<SONARMetric[]> {
    if (params.metrics.length > 50) {
      throw new Error("Maximum 50 metrics per batch query");
    }

    const query: Record<string, string | number | boolean> = {
      metrics: params.metrics.join(","),
    };

    if (params.granularity) query.granularity = params.granularity;
    if (params.dateRange) {
      query.start_date = params.dateRange.start.toISOString().split("T")[0];
      query.end_date = params.dateRange.end.toISOString().split("T")[0];
    }
    if (params.markets) {
      query.markets = params.markets.join(",");
    }

    return this.request("/metrics", {
      query,
      cacheMinutes: params.dateRange ? 240 : 15, // Historical data cached longer
    });
  }

  /**
   * Get DAT spot rates feed
   */
  async getDATSpotRates(params?: {
    markets?: FreightMarket[];
    dateRange?: { start: Date; end: Date };
  }): Promise<SONARMetric[]> {
    const query: Record<string, string | number | boolean> = {
      source: "dat_feeds",
      metrics: "DAT_SPOT_RATES",
    };

    if (params?.dateRange) {
      query.start_date = params.dateRange.start.toISOString().split("T")[0];
      query.end_date = params.dateRange.end.toISOString().split("T")[0];
    }
    if (params?.markets) {
      query.markets = params.markets.join(",");
    }

    return this.request("/metrics", {
      query,
      cacheMinutes: 15,
    });
  }

  /**
   * Get contract rates feed
   */
  async getContractRates(params?: {
    markets?: FreightMarket[];
    dateRange?: { start: Date; end: Date };
  }): Promise<SONARMetric[]> {
    const query: Record<string, string | number | boolean> = {
      source: "dat_feeds",
      metrics: "CONTRACT_RATES",
    };

    if (params?.dateRange) {
      query.start_date = params.dateRange.start.toISOString().split("T")[0];
      query.end_date = params.dateRange.end.toISOString().split("T")[0];
    }
    if (params?.markets) {
      query.markets = params.markets.join(",");
    }

    return this.request("/metrics", {
      query,
      cacheMinutes: 60, // Contract rates less volatile
    });
  }

  /**
   * Get freight futures pricing
   */
  async getFreightFutures(params?: {
    dateRange?: { start: Date; end: Date };
  }): Promise<{
    futures: Array<{
      month: string;
      price: number;
      change: number;
      openInterest: number;
    }>;
  }> {
    const query: Record<string, string> = {};

    if (params?.dateRange) {
      query.start_date = params.dateRange.start.toISOString().split("T")[0];
      query.end_date = params.dateRange.end.toISOString().split("T")[0];
    }

    return this.request("/futures", {
      query,
      cacheMinutes: 15,
    });
  }

  /**
   * Get border wait times
   */
  async getBorderWaitTimes(params?: {
    border?: "US_MEXICO" | "US_CANADA";
    dateRange?: { start: Date; end: Date };
  }): Promise<{
    borderWaitTimes: Array<{
      border: string;
      crossingPoint: string;
      averageWaitTime: number; // in minutes
      timestamp: Date;
      trend: number; // percentage change
    }>;
  }> {
    const query: Record<string, string> = {};

    if (params?.border) query.border = params.border;
    if (params?.dateRange) {
      query.start_date = params.dateRange.start.toISOString().split("T")[0];
      query.end_date = params.dateRange.end.toISOString().split("T")[0];
    }

    return this.request("/border-wait-times", {
      query,
      cacheMinutes: 30,
    });
  }

  /**
   * Get lane-level metrics for a specific market pair
   */
  async getLaneMetrics(params: {
    originMarket: FreightMarket;
    destinationMarket: FreightMarket;
    dateRange?: { start: Date; end: Date };
  }): Promise<{
    lane: string;
    metrics: Array<{
      metricName: string;
      value: number;
      previousValue?: number;
      changePercent?: number;
    }>;
  }> {
    const query: Record<string, string> = {
      origin: params.originMarket,
      destination: params.destinationMarket,
    };

    if (params.dateRange) {
      query.start_date = params.dateRange.start.toISOString().split("T")[0];
      query.end_date = params.dateRange.end.toISOString().split("T")[0];
    }

    return this.request("/lane-metrics", {
      query,
      cacheMinutes: 60,
    });
  }

  /**
   * Create threshold-based alert
   */
  async createAlert(params: {
    metric: SONARMetricType;
    threshold: number;
    condition: "above" | "below" | "change_percent";
    webhookUrl: string;
    markets?: FreightMarket[];
  }): Promise<{
    alertId: string;
    createdAt: Date;
  }> {
    const body = {
      metric: params.metric,
      threshold: params.threshold,
      condition: params.condition,
      webhook_url: params.webhookUrl,
      markets: params.markets || [],
    };

    return this.request("/alerts", {
      method: "POST",
      body,
    });
  }

  /**
   * Get alert status
   */
  async getAlertStatus(alertId: string): Promise<{
    alertId: string;
    metric: SONARMetricType;
    status: "active" | "triggered" | "inactive";
    lastTriggered?: Date;
    triggerCount: number;
  }> {
    return this.request(`/alerts/${alertId}`);
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
   * Get daily rate limit info
   */
  getDailyRateLimitInfo(): RateLimitInfo | null {
    if (!this.rateLimitData) return null;

    const { dayRemaining, dayLimit, resetAt } = this.rateLimitData;
    return {
      remaining: dayRemaining,
      limit: dayLimit,
      resetAt,
      used: dayLimit - dayRemaining,
      percentageUsed: ((dayLimit - dayRemaining) / dayLimit) * 100,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    if (this.debug) {
      console.log("[SONAR] Cache cleared");
    }
  }

  /**
   * Get all 135 freight markets
   */
  static getFreightMarkets(): FreightMarket[] {
    return [
      "LA",
      "OKC",
      "DAL",
      "ATL",
      "EUA",
      "HTH",
      "JKS",
      "MEM",
      "DEN",
      "CHI",
      // Additional major markets would be listed here
      // This is a representative sample of the 135 markets
    ] as FreightMarket[];
  }
}
