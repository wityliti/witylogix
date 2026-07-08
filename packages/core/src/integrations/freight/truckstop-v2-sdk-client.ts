/**
 * Truckstop (Internet Truckstop) API v2 SDK Client
 *
 * Comprehensive client for load posting, rate intelligence, carrier matching,
 * asset tracking, payments, RMIS integration, Book It Now, and documents.
 */

import { EventEmitter } from "events";
import type {
  LoadPosting,
  CarrierMatch,
  BookingConfirmation,
  FreightDocument,
  TruckstopRateResponse,
  RateLimitInfo,
  APIError,
  EquipmentType,
  LoadStatus,
  CacheEntry,
} from "./freight-sdk-types";

/**
 * Truckstop authentication (hybrid API key + OAuth2)
 */
interface TruckstopAuth {
  apiKey: string;
  oauthToken?: string;
  oauthExpiresAt?: number;
}

/**
 * Rate limit tracking
 */
interface RateLimitData {
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfter?: number;
}

/**
 * Truckstop v2 SDK Client
 */
export class TruckstopV2SDKClient extends EventEmitter {
  private auth: TruckstopAuth;
  private baseUrl: string;
  private rateLimitData: RateLimitData | null = null;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private debug: boolean;
  private backoffMs = 1000; // Initial backoff time

  /**
   * Initialize Truckstop v2 SDK client
   */
  constructor(config: { apiKey: string; baseUrl?: string; debug?: boolean }) {
    super();
    this.auth = { apiKey: config.apiKey };
    this.baseUrl = config.baseUrl || "https://api.truckstop.com/v2";
    this.debug = config.debug || false;
  }

  /**
   * Make API request with caching, rate limiting, and backoff strategy
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
      headers?: Record<string, string>;
      body?: unknown;
      query?: Record<string, string | number>;
      timeout?: number;
      cache?: boolean;
    } = {},
  ): Promise<T> {
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
        console.log("[Truckstop v2] Cache hit:", cacheKey);
      }
      return cached.data as T;
    }

    const headers: Record<string, string> = {
      "X-API-Key": this.auth.apiKey,
      "Content-Type": "application/json",
      ...(this.auth.oauthToken && {
        Authorization: `Bearer ${this.auth.oauthToken}`,
      }),
      ...(options.headers || {}),
    };

    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
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
        const retryAfter = response.headers.get("retry-after");

        if (remaining && limit && reset) {
          this.rateLimitData = {
            remaining: parseInt(remaining, 10),
            limit: parseInt(limit, 10),
            resetAt: new Date(parseInt(reset, 10) * 1000),
            retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
          };
        }

        // Handle rate limiting with backoff
        if (response.status === 429) {
          const waitTime = this.rateLimitData?.retryAfter || this.backoffMs;
          if (retries < maxRetries - 1) {
            if (this.debug) {
              console.log(
                `[Truckstop v2] Rate limited, backing off for ${waitTime}ms (retry ${retries + 1}/${maxRetries})`,
              );
            }
            await this.delay(waitTime);
            this.backoffMs = Math.min(this.backoffMs * 2, 30000); // Exponential backoff, max 30s
            retries++;
            continue;
          }
        }

        // Reset backoff on successful request
        if (response.ok) {
          this.backoffMs = 1000;
        }

        if (!response.ok) {
          const error: APIError = {
            code: `HTTP_${response.status}`,
            message: response.statusText,
            statusCode: response.status,
            timestamp: new Date(),
          };

          try {
            const errorData = (await response.json()) as Record<
              string,
              unknown
            >;
            error.details = errorData;
          } catch {
            // Ignore JSON parse errors
          }

          throw error;
        }

        const data = (await response.json()) as T;

        // Cache successful GET responses for 5 minutes
        if (
          options.cache !== false &&
          options.method !== "POST" &&
          options.method !== "PUT" &&
          options.method !== "DELETE"
        ) {
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
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
        if (this.debug) {
          console.error(
            `[Truckstop v2] Request error (attempt ${retries + 1}):`,
            error,
          );
        }

        if (retries < maxRetries - 1) {
          await this.delay(this.backoffMs);
          this.backoffMs *= 2;
          retries++;
        } else {
          throw error;
        }
      }
    }

    throw new Error("Max retries exceeded");
  }

  /**
   * Delay utility for backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Post a load to the Truckstop network
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

    return this.request<LoadPosting>("/loads", {
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

    return this.request<LoadPosting>(`/loads/${loadId}`, {
      method: "PUT",
      body,
    });
  }

  /**
   * Remove/cancel a load
   */
  async removeLoad(loadId: string): Promise<{ success: boolean }> {
    return this.request(`/loads/${loadId}`, {
      method: "DELETE",
    });
  }

  /**
   * Search loads by criteria
   */
  async searchLoads(params: {
    originMarket?: string;
    destinationMarket?: string;
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

    if (params.originMarket) query.origin_market = params.originMarket;
    if (params.destinationMarket) query.dest_market = params.destinationMarket;
    if (params.equipmentType) query.equipment = params.equipmentType;
    if (params.maxRate) query.max_rate = params.maxRate;
    if (params.minRate) query.min_rate = params.minRate;
    if (params.status) query.status = params.status;
    if (params.page) query.page = params.page;
    if (params.pageSize) query.page_size = params.pageSize;

    return this.request("/loads", { query });
  }

  /**
   * Get rate intelligence for a lane (spot/contract rates)
   */
  async getLaneRates(params: {
    originMarket: string;
    destinationMarket: string;
    equipmentType: EquipmentType;
  }): Promise<TruckstopRateResponse> {
    const query: Record<string, string> = {
      origin_market: params.originMarket,
      dest_market: params.destinationMarket,
      equipment: params.equipmentType,
    };

    return this.request("/rates/lanes", { query });
  }

  /**
   * Get rate predictions for a lane
   */
  async getRatePredictions(params: {
    originMarket: string;
    destinationMarket: string;
    equipmentType: EquipmentType;
    days?: 7 | 30;
  }): Promise<{
    predictions: Array<{
      date: string;
      forecastRate: number;
      confidence: number;
      trend: "up" | "down" | "stable";
    }>;
  }> {
    const query: Record<string, string | number> = {
      origin_market: params.originMarket,
      dest_market: params.destinationMarket,
      equipment: params.equipmentType,
      days: params.days || 7,
    };

    return this.request("/rates/predictions", { query });
  }

  /**
   * Get seasonal rate trends
   */
  async getSeasonalTrends(params: {
    originMarket: string;
    destinationMarket: string;
    equipmentType: EquipmentType;
  }): Promise<{
    trends: Array<{
      season: string;
      avgRate: number;
      variance: number;
      confidence: number;
    }>;
  }> {
    const query: Record<string, string> = {
      origin_market: params.originMarket,
      dest_market: params.destinationMarket,
      equipment: params.equipmentType,
    };

    return this.request("/rates/seasonal-trends", { query });
  }

  /**
   * Find matching carriers for a load
   */
  async findCarriers(params: {
    originMarket: string;
    destinationMarket: string;
    equipmentType: EquipmentType;
    minRating?: number;
    limit?: number;
  }): Promise<CarrierMatch[]> {
    const query: Record<string, string | number> = {
      origin_market: params.originMarket,
      dest_market: params.destinationMarket,
      equipment: params.equipmentType,
    };

    if (params.minRating) query.min_rating = params.minRating;
    if (params.limit) query.limit = params.limit;

    return this.request<CarrierMatch[]>("/carriers/matches", { query });
  }

  /**
   * Get carrier profile
   */
  async getCarrierProfile(carrierId: string): Promise<{
    carrierId: string;
    carrierName: string;
    mcNumber: string;
    usdotNumber: string;
    rating: number;
    equipmentTypes: EquipmentType[];
    serviceAreas: string[];
    yearsInBusiness: number;
    truckCount: number;
    trailerCount: number;
  }> {
    return this.request(`/carriers/${carrierId}`);
  }

  /**
   * Post truck/equipment availability
   */
  async postEquipmentAvailability(params: {
    equipmentType: EquipmentType;
    currentLocation: {
      city: string;
      state: string;
      zip: string;
    };
    availableDate: Date;
    dropoffDate?: Date;
    rate?: number;
  }): Promise<{
    postingId: string;
    postedAt: Date;
  }> {
    const body = {
      equipment_type: params.equipmentType,
      current_location: params.currentLocation,
      available_date: params.availableDate.toISOString(),
      ...(params.dropoffDate && {
        dropoff_date: params.dropoffDate.toISOString(),
      }),
      ...(params.rate && { rate: params.rate }),
    };

    return this.request("/assets/equipment-postings", {
      method: "POST",
      body,
    });
  }

  /**
   * Update ETA for a load
   */
  async updateETA(params: {
    loadId: string;
    estimatedArrival: Date;
    currentLocation: {
      city: string;
      state: string;
      zip: string;
    };
  }): Promise<{ success: boolean }> {
    const body = {
      estimated_arrival: params.estimatedArrival.toISOString(),
      current_location: params.currentLocation,
    };

    return this.request(`/assets/eta/${params.loadId}`, {
      method: "PUT",
      body,
    });
  }

  /**
   * Process QuickPay payment
   */
  async processQuickPayment(params: {
    loadId: string;
    amount: number;
    carrierId: string;
  }): Promise<{
    transactionId: string;
    status: "pending" | "completed" | "failed";
    timestamp: Date;
  }> {
    const body = {
      load_id: params.loadId,
      amount: params.amount,
      carrier_id: params.carrierId,
    };

    return this.request("/payments/quickpay", {
      method: "POST",
      body,
    });
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(transactionId: string): Promise<{
    transactionId: string;
    status: "pending" | "completed" | "failed";
    amount: number;
    timestamp: Date;
    reference?: string;
  }> {
    return this.request(`/payments/${transactionId}`);
  }

  /**
   * Access RMIS carrier safety data
   */
  async getCarrierSafetyData(carrierId: string): Promise<{
    carrierId: string;
    safetyRating: number;
    inspectionScore: number;
    crashIndicator: number;
    violationScore: number;
    hazmatFlag: boolean;
    lastUpdated: Date;
  }> {
    return this.request(`/rmis/carriers/${carrierId}/safety`);
  }

  /**
   * Verify carrier insurance
   */
  async verifyCarrierInsurance(carrierId: string): Promise<{
    carrierId: string;
    insured: boolean;
    coverageType: string;
    coverageAmount: number;
    expirationDate: Date;
    verified: boolean;
    verifiedAt?: Date;
  }> {
    return this.request(`/rmis/carriers/${carrierId}/insurance`);
  }

  /**
   * Check carrier authority status
   */
  async checkCarrierAuthority(carrierId: string): Promise<{
    carrierId: string;
    authorityStatus: "active" | "inactive" | "pending_renewal";
    mcNumber: string;
    usdotNumber: string;
    lastVerified: Date;
  }> {
    return this.request(`/rmis/carriers/${carrierId}/authority`);
  }

  /**
   * Book It Now - instant booking with digital confirmation
   */
  async bookItNow(params: {
    loadId: string;
    carrierId: string;
    rate: number;
  }): Promise<BookingConfirmation> {
    const body = {
      load_id: params.loadId,
      carrier_id: params.carrierId,
      rate: params.rate,
    };

    return this.request<BookingConfirmation>("/booking/book-it-now", {
      method: "POST",
      body,
    });
  }

  /**
   * Upload freight document (BOL, POD, receipts)
   */
  async uploadDocument(params: {
    loadId: string;
    documentType: "bol" | "pod" | "lumper_receipt" | "inspection";
    file: Buffer;
    fileName: string;
  }): Promise<FreightDocument> {
    const formData = new FormData();
    formData.append("load_id", params.loadId);
    formData.append("document_type", params.documentType);
    formData.append("file", new Blob([params.file]), params.fileName);

    const headers = {
      "X-API-Key": this.auth.apiKey,
      ...(this.auth.oauthToken && {
        Authorization: `Bearer ${this.auth.oauthToken}`,
      }),
    };

    const response = await fetch(`${this.baseUrl}/documents/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Document upload failed: ${response.statusText}`);
    }

    return response.json() as Promise<FreightDocument>;
  }

  /**
   * Download freight document
   */
  async downloadDocument(documentId: string): Promise<{
    document: Buffer;
    fileName: string;
    mimeType: string;
  }> {
    const response = await fetch(
      `${this.baseUrl}/documents/${documentId}/download`,
      {
        headers: {
          "X-API-Key": this.auth.apiKey,
          ...(this.auth.oauthToken && {
            Authorization: `Bearer ${this.auth.oauthToken}`,
          }),
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Document download failed: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const fileName =
      response.headers.get("content-disposition")?.split("filename=")[1] ||
      "document";
    const mimeType =
      response.headers.get("content-type") || "application/octet-stream";

    return {
      document: Buffer.from(buffer),
      fileName,
      mimeType,
    };
  }

  /**
   * Register webhook for load matches and booking confirmations
   */
  async registerWebhook(params: {
    webhookUrl: string;
    eventTypes: ("load_match" | "booking_confirmation" | "payment_event")[];
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
      console.log("[Truckstop v2] Cache cleared");
    }
  }
}
